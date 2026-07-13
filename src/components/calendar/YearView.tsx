import type { AgendaEvent } from "./types";
import {
  MESI_SHORT,
  addDays,
  daysInMonth,
  isSameDay,
  startOfMonth,
  weekdayMondayFirst,
} from "@/lib/date-utils";

type Props = {
  cursor: Date;
  events: AgendaEvent[];
  onSelectMonth: (d: Date) => void;
};

export function YearView({ cursor, events, onSelectMonth }: Props) {
  const year = cursor.getFullYear();
  const today = new Date();

  const eventDays = new Set(
    events.map((e) => {
      const d = new Date(e.starts_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 12 }, (_, m) => {
        const monthStart = new Date(year, m, 1);
        const leading = weekdayMondayFirst(monthStart);
        const dim = daysInMonth(year, m);
        const total = Math.ceil((leading + dim) / 7) * 7;
        const gridStart = addDays(startOfMonth(monthStart), -leading);

        return (
          <button
            key={m}
            onClick={() => onSelectMonth(monthStart)}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-2 text-left hover:border-primary/40"
          >
            <span className="px-0.5 text-xs font-medium text-foreground">{MESI_SHORT[m]}</span>
            <div className="grid grid-cols-7 gap-[1px]">
              {Array.from({ length: total }, (_, i) => {
                const d = addDays(gridStart, i);
                const inMonth = d.getMonth() === m;
                const isToday = isSameDay(d, today);
                const has = inMonth && eventDays.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
                return (
                  <span
                    key={i}
                    className={
                      "flex h-2.5 items-center justify-center rounded-[3px] text-[7px] " +
                      (isToday
                        ? "bg-primary text-primary-foreground"
                        : has
                          ? "bg-primary/30"
                          : inMonth
                            ? "bg-background/60"
                            : "")
                    }
                  />
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
