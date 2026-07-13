import type { AgendaEvent } from "@/components/calendar/types";

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
}

export function buildEventIcs(event: AgendaEvent): string {
  const start = toIcsUtc(new Date(event.starts_at));
  const end = event.ends_at ? toIcsUtc(new Date(event.ends_at)) : null;

  const lines = [
    "BEGIN:VEVENT",
    `UID:event-${event.id}@calendario`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${start}`,
    ...(end ? [`DTEND:${end}`] : []),
    `SUMMARY:${escapeIcs(event.title)}`,
    ...(event.place ? [`LOCATION:${escapeIcs(event.place)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeIcs(event.description)}`] : []),
    "END:VEVENT",
  ];

  return lines.join("\r\n");
}

export function buildCalendarIcs(events: AgendaEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendario//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push(buildEventIcs(event));
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
