import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { YearView } from "@/components/calendar/YearView";
import { DayClock } from "@/components/calendar/DayClock";
import { ForeignEventDetail } from "@/components/calendar/ForeignEventDetail";
import type { AgendaEvent, CalendarView } from "@/components/calendar/types";
import {
  MESI,
  addDays,
  addMonths,
  addYears,
  endOfDay,
  formatTime,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "@/lib/date-utils";

export const Route = createFileRoute("/_authenticated/app/amici")({
  component: AmiciCalendarPage,
});

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Giorno" },
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
  { value: "year", label: "Anno" },
];

type OwnerProfile = { id: string; username: string; display_name: string | null };
type FeedEvent = AgendaEvent & { owner?: OwnerProfile };

function AmiciCalendarPage() {
  const { user } = Route.useRouteContext();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [openEvent, setOpenEvent] = useState<AgendaEvent | null>(null);

  // Accepted follows: users I follow
  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("followee_id, status, follower_id")
        .eq("follower_id", user.id)
        .eq("status", "accepted");
      if (error) throw error;
      return (data ?? []).map((r) => r.followee_id as string);
    },
  });

  const { from, to } = useMemo(() => {
    if (view === "year") {
      return {
        from: new Date(cursor.getFullYear(), 0, 1),
        to: new Date(cursor.getFullYear(), 11, 31, 23, 59, 59),
      };
    }
    if (view === "week") {
      const s = startOfWeek(cursor);
      return { from: s, to: endOfDay(addDays(s, 6)) };
    }
    if (view === "day") return { from: startOfDay(selectedDay), to: endOfDay(selectedDay) };
    const s = startOfMonth(cursor);
    return { from: addDays(s, -7), to: endOfDay(addDays(s, 42)) };
  }, [view, cursor, selectedDay]);

  const { data: events = [] } = useQuery({
    queryKey: [
      "amici-events",
      user.id,
      followingIds.join(","),
      view,
      from.toISOString(),
      to.toISOString(),
    ],
    enabled: followingIds.length > 0,
    queryFn: async () => {
      const { data: evs, error } = await supabase
        .from("events")
        .select("*")
        .in("owner_id", followingIds)
        .gte("starts_at", from.toISOString())
        .lte("starts_at", to.toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      const list = (evs ?? []) as AgendaEvent[];
      if (list.length === 0) return [] as FeedEvent[];
      const ownerIds = Array.from(new Set(list.map((e) => e.owner_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", ownerIds);
      const map = new Map<string, OwnerProfile>();
      for (const p of (profiles ?? []) as OwnerProfile[]) map.set(p.id, p);
      return list.map((e) => ({ ...e, owner: map.get(e.owner_id) }));
    },
  });

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => isSameDay(new Date(e.starts_at), selectedDay))
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events, selectedDay]
  );

  function shift(dir: -1 | 1) {
    if (view === "day") setSelectedDay((d) => addDays(d, dir));
    else if (view === "week") setCursor((d) => addDays(d, dir * 7));
    else if (view === "month") setCursor((d) => addMonths(d, dir));
    else setCursor((d) => addYears(d, dir));
  }

  function periodLabel() {
    if (view === "day") return `${selectedDay.getDate()} ${MESI[selectedDay.getMonth()]}`;
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${s.getDate()} ${MESI[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MESI[e.getMonth()].slice(0, 3)}`;
    }
    if (view === "month") return `${MESI[cursor.getMonth()]} ${cursor.getFullYear()}`;
    return `${cursor.getFullYear()}`;
  }

  return (
    <AppShell variant="amici" subtitle="Laviniard">
      <div className="mb-4 grid grid-cols-4 rounded-full border border-border bg-card p-1 text-xs">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            onClick={() => setView(v.value)}
            className={
              "h-8 rounded-full font-medium transition-colors " +
              (view === v.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => shift(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setCursor(new Date());
            setSelectedDay(startOfDay(new Date()));
          }}
          className="rounded-full px-3 py-1 font-display text-base font-700 tracking-tight hover:bg-accent"
        >
          {periodLabel()}
        </button>
        <button
          onClick={() => shift(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {followingIds.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Non segui ancora nessuno. Tocca l'icona in alto a destra per trovare persone.
        </div>
      )}

      {view === "month" && (
        <MonthView
          cursor={cursor}
          events={events}
          onSelectDay={(d) => {
            setSelectedDay(d);
            setView("day");
          }}
        />
      )}

      {view === "week" && (
        <WeekView
          cursor={cursor}
          events={events}
          onSelectDay={(d) => {
            setSelectedDay(d);
            setView("day");
          }}
          onEventTap={(id) => {
            const e = events.find((ev) => ev.id === id);
            if (e) setOpenEvent(e);
          }}
        />
      )}

      {view === "year" && (
        <YearView
          cursor={cursor}
          events={events}
          onSelectMonth={(d) => {
            setCursor(d);
            setView("month");
          }}
        />
      )}

      {view === "day" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-3xl bg-card p-4 shadow-card">
            <DayClock
              date={selectedDay}
              events={dayEvents}
              onEventTap={(id) => {
                const e = dayEvents.find((ev) => ev.id === id);
                if (e) setOpenEvent(e);
              }}
            />
          </div>

          <ul className="flex flex-col gap-2">
            {dayEvents.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nessun impegno degli amici in questo giorno.
              </li>
            )}
            {dayEvents.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setOpenEvent(e)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-card hover:border-primary/40"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: e.list_color + "22" }}
                  >
                    {e.icon ?? "•"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base font-600 leading-tight">
                      {e.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatTime(new Date(e.starts_at))}</span>
                      {e.place && (
                        <>
                          <span>·</span>
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{e.place}</span>
                        </>
                      )}
                      {e.owner && (
                        <>
                          <span>·</span>
                          <span className="truncate">@{e.owner.username}</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openEvent && (
        <ForeignEventDetail
          event={openEvent}
          userId={user.id}
          onClose={() => setOpenEvent(null)}
        />
      )}
    </AppShell>
  );
}
