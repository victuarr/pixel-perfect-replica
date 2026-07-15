import type { AgendaEvent } from "./types";
import {
  GIORNI_SHORT,
  addDays,
  formatTime,
  isSameDay,
  startOfWeek,
} from "@/lib/date-utils";

type Props = {
  cursor: Date;
  events: AgendaEvent[];
  onSelectDay: (d: Date) => void;
  onEventTap?: (id: string) => void;
};

export function WeekView({ cursor, events, onSelectDay, onEventTap }: Props) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();

  const byDay = new Map<number, AgendaEvent[]>();
  for (const e of events) {
    const s = new Date(e.starts_at);
    const en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
    const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    while (cur < en) {
      const key = cur.getTime();
      const arr = byDay.get(key) ?? [];
      arr.push(e);
      byDay.set(key, arr);
      cur.setDate(cur.getDate() + 1);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(d)}
              className={
                "flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-xs " +
                (isToday
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-accent")
              }
            >
              <span className="opacity-70">{GIORNI_SHORT[i]}</span>
              <span className="text-base font-semibold leading-none">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {days.map((d, i) => {
          const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          const list = (byDay.get(key) ?? []).sort(
            (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
          );
          if (list.length === 0) return null;
          return (
            <div key={i} className="rounded-2xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {GIORNI_SHORT[i]} {d.getDate()}
              </p>
              <ul className="flex flex-col gap-2">
                {list.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => onEventTap?.(e.id)}
                      className="flex w-full items-center gap-3 rounded-xl bg-background/60 p-2 text-left hover:bg-accent/60"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                        style={{ backgroundColor: e.list_color + "22", color: e.list_color }}
                      >
                        {e.icon ?? "•"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatTime(new Date(e.starts_at))}
                          {e.place ? ` · ${e.place}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
