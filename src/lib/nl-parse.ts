// Very small Italian natural-language parser for the "quick add" bar.
// It fills date/time/place/title from a free-text sentence like:
//   "domani 21 aperitivo al Barrio"
//   "venerdì 20:30 cena da Marco"
// Falls back gracefully: unknown parts are left untouched.

import { addDays, startOfDay } from "./date-utils";

export type NlResult = {
  title?: string;
  place?: string;
  when?: Date; // date + time combined, if parseable
};

const GIORNI_MAP: Record<string, number> = {
  lunedi: 0, "lunedì": 0,
  martedi: 1, "martedì": 1,
  mercoledi: 2, "mercoledì": 2,
  giovedi: 3, "giovedì": 3,
  venerdi: 4, "venerdì": 4,
  sabato: 5,
  domenica: 6,
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function nextWeekday(target: number, from: Date): Date {
  const cur = (from.getDay() + 6) % 7; // Mon=0
  let diff = target - cur;
  if (diff <= 0) diff += 7;
  return addDays(startOfDay(from), diff);
}

export function parseNL(input: string, now: Date = new Date()): NlResult {
  const raw = input.trim();
  if (!raw) return {};
  let text = " " + normalize(raw) + " ";
  const result: NlResult = {};

  // --- Date keyword ---
  let date: Date | null = null;
  if (/ dopodomani /.test(text)) {
    date = addDays(startOfDay(now), 2);
    text = text.replace(/ dopodomani /, " ");
  } else if (/ domani /.test(text)) {
    date = addDays(startOfDay(now), 1);
    text = text.replace(/ domani /, " ");
  } else if (/ oggi /.test(text)) {
    date = startOfDay(now);
    text = text.replace(/ oggi /, " ");
  } else {
    for (const [name, idx] of Object.entries(GIORNI_MAP)) {
      const re = new RegExp(` ${name} `);
      if (re.test(text)) {
        date = nextWeekday(idx, now);
        text = text.replace(re, " ");
        break;
      }
    }
  }

  // --- Time ---
  // Patterns: "alle 21", "alle 21:30", "21:30", " 21 " (standalone int 0..23)
  let hour: number | null = null;
  let minute = 0;
  const mHm = text.match(/\b(?:alle\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (mHm) {
    hour = parseInt(mHm[1], 10);
    minute = parseInt(mHm[2], 10);
    text = text.replace(mHm[0], " ");
  } else {
    const mH = text.match(/\balle\s+([01]?\d|2[0-3])\b/);
    if (mH) {
      hour = parseInt(mH[1], 10);
      text = text.replace(mH[0], " ");
    } else {
      // standalone integer 0..23 as a hint
      const mInt = text.match(/(^|\s)([01]?\d|2[0-3])(?=\s)/);
      if (mInt) {
        hour = parseInt(mInt[2], 10);
        text = text.replace(mInt[0], " ");
      }
    }
  }

  if (date || hour !== null) {
    const d = date ? new Date(date) : startOfDay(now);
    if (hour !== null) d.setHours(hour, minute, 0, 0);
    else d.setHours(19, 0, 0, 0); // sensible default: 19:00
    result.when = d;
  }

  // --- Place: "al|allo|alla|a|@ <place>" (capture until end) ---
  const mPlace = text.match(/\s(?:@|al|allo|alla|all'|a|in|da)\s+([^\s].*?)\s*$/);
  if (mPlace) {
    result.place = mPlace[1].trim();
    text = text.slice(0, text.length - mPlace[0].length) + " ";
  }

  // --- Title: whatever is left, capitalized ---
  const rest = text.replace(/\s+/g, " ").trim();
  if (rest) {
    result.title = rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return result;
}
