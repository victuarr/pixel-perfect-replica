import type { AgendaEvent } from "./types";
import {
  GIORNI_SHORT,
  addDays,
  daysInMonth,
  isSameDay,
  isSameMonth,
  startOfMonth,
  weekdayMondayFirst,
} from "@/lib/date-utils";

type Props = {
  cursor: Date;
  events: AgendaEvent[];
  onSelectDay: (d: Date) => void;
};

export function MonthView({ cursor, events, onSelectDay }: Props) {
  const first = startOfMonth(cursor);
  const leading = weekdayMondayFirst(first);
  const dim = daysInMonth(cursor.getFullYear(), cursor.getMonth());
  const total = Math.ceil((leading + dim) / 7) * 7;
  const gridStart = addDays(first, -leading);
  const today = new Date();

  // Group events into every local day they overlap.
  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of events) {
    const s = new Date(e.starts_at);
    const en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
    const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    while (cur < en) {
      const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
      const arr = byDay.get(key) ?? [];
      arr.push(e);
      byDay.set(key, arr);
      cur.setDate(cur.getDate() + 1);
    }
  }

  return (
    <div className="flex h-[calc(100svh-15rem)] min-h-[26rem] flex-col gap-2">
      <div className="grid grid-cols-7 px-1 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {GIORNI_SHORT.map((g, i) => (
          <span key={i}>{g}</span>
        ))}
      </div>
      <div
        className="grid flex-1 grid-cols-7 gap-1.5"
        style={{ gridTemplateRows: `repeat(${total / 7}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => {
          const d = addDays(gridStart, i);
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          const dayEvents =
            byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? [];
          const dots = dayEvents.slice(0, 4);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(d)}
              className={
                "flex h-full flex-col items-center justify-between rounded-xl p-1.5 text-sm transition " +
                (isToday
                  ? "bg-primary text-primary-foreground shadow-elevated"
                  : inMonth
                    ? "bg-card text-foreground hover:bg-accent"
                    : "bg-transparent text-muted-foreground/60 hover:bg-card")
              }
            >
              <span className={"self-start px-0.5 text-[13px] " + (isToday ? "font-semibold" : "")}>
                {d.getDate()}
              </span>
              <span className="flex gap-0.5">
                {dots.map((e) => (
                  <span
                    key={e.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: e.list_color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
