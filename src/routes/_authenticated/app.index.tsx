import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ChevronLeft, ChevronRight, MapPin, Lock, Users, Globe2, Clock, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { DayClock } from "@/components/calendar/DayClock";
import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { YearView } from "@/components/calendar/YearView";
import { EventForm } from "@/components/calendar/EventForm";
import { EventInvites } from "@/components/calendar/EventInvites";
import { EventComments } from "@/components/calendar/EventComments";
import { EventReactions } from "@/components/calendar/EventReactions";
import { GoingCount } from "@/components/calendar/GoingCount";
import { exportCalendarIcs } from "@/lib/calendar.functions";
import { buildEventIcs, downloadIcs } from "@/lib/ics";
import type { AgendaEvent, CalendarView } from "@/components/calendar/types";
import {
  MESI,
  addDays,
  addMonths,
  addYears,
  endOfDay,
  eventOverlapsDay,
  formatItalianDate,
  formatTime,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "@/lib/date-utils";

export const Route = createFileRoute("/_authenticated/app/")({
  component: HomePage,
});

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Giorno" },
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
  { value: "year", label: "Anno" },
];

function HomePage() {
  const { user } = Route.useRouteContext();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [presetStart, setPresetStart] = useState<Date | null>(null);
  const exportIcs = useServerFn(exportCalendarIcs);

  // Fetch a window that covers the current view
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
    if (view === "day") {
      return { from: startOfDay(selectedDay), to: endOfDay(selectedDay) };
    }
    const s = startOfMonth(cursor);
    // Grab a wider window so month grid dots include leading/trailing days too
    return {
      from: addDays(s, -7),
      to: endOfDay(addDays(s, 42)),
    };
  }, [view, cursor, selectedDay]);

  const { data: events = [] } = useQuery({
    queryKey: ["events", user.id, view, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      // Overlap query: event.starts_at <= window.to AND (event.ends_at >= window.from OR ends_at IS NULL)
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("owner_id", user.id)
        .lte("starts_at", to.toISOString())
        .or(`ends_at.gte.${from.toISOString()},ends_at.is.null`)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgendaEvent[];
    },
  });

  const dayEvents = useMemo(
    () => events.filter((e) => eventOverlapsDay(e.starts_at, e.ends_at, selectedDay))
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
    if (view === "day")
      return `${selectedDay.getDate()} ${MESI[selectedDay.getMonth()]}`;
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${s.getDate()} ${MESI[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MESI[e.getMonth()].slice(0, 3)}`;
    }
    if (view === "month") return `${MESI[cursor.getMonth()]} ${cursor.getFullYear()}`;
    return `${cursor.getFullYear()}`;
  }

  return (
    <AppShell>
      {/* View switcher */}
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

      {/* Period nav */}
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
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const ics = await exportIcs({ data: { from: from.toISOString(), to: to.toISOString() } });
                downloadIcs("calendario.ics", ics);
              } catch (e) {
                console.error("Export ICS error", e);
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
            aria-label="Esporta periodo in ICS"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => shift(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Views */}
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
            if (e) { setEditing(e); setFormOpen(true); }
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
                if (e) { setEditing(e); setFormOpen(true); }
              }}
              onHourTap={(h) => {
                const d = new Date(selectedDay);
                d.setHours(h, 0, 0, 0);
                setEditing(null);
                setPresetStart(d);
                setFormOpen(true);
              }}
            />
          </div>

          <ul className="flex flex-col gap-2">
            {dayEvents.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nessun impegno per questo giorno.
              </li>
            )}
            {dayEvents.map((e) => (
              <li key={e.id} className="flex flex-col gap-2">
                <button
                  onClick={() => { setEditing(e); setFormOpen(true); }}
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
                    </span>
                  </span>
                  <VisibilityBadge v={e.visibility_type} />
                  {e.reminder_minutes != null && (
                    <ReminderBadge minutes={e.reminder_minutes} />
                  )}
                </button>
                <EventInvites
                  eventId={e.id}
                  isOwner={e.owner_id === user.id}
                  currentUserId={user.id}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <EventReactions eventId={e.id} currentUserId={user.id} />
                    <GoingCount eventId={e.origin_id ?? e.id} />
                  </div>
                  <button
                    onClick={() => downloadIcs(`evento-${e.id}.ics`, buildEventIcs(e))}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
                    aria-label="Esporta evento in ICS"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
                <EventComments eventId={e.id} currentUserId={user.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Floating create button */}
      <button
        onClick={() => { setEditing(null); setPresetStart(null); setFormOpen(true); }}
        className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform hover:-translate-y-0.5"
        aria-label="Nuovo impegno"
      >
        <Plus className="h-6 w-6" />
      </button>

      <EventForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setPresetStart(null); }}
        userId={user.id}
        editing={editing}
        defaultDate={view === "day" ? selectedDay : cursor}
        defaultStart={presetStart ?? undefined}
      />
    </AppShell>
  );
}

function VisibilityBadge({ v }: { v: AgendaEvent["visibility_type"] }) {
  const map = {
    private: { icon: <Lock className="h-3 w-3" />, label: "Privato" },
    lists: { icon: <Users className="h-3 w-3" />, label: "Liste" },
    public: { icon: <Globe2 className="h-3 w-3" />, label: "Pubblico" },
  } as const;
  const { icon, label } = map[v];
  return (
    <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {icon} {label}
    </span>
  );
}

function ReminderBadge({ minutes }: { minutes: number }) {
  let label: string;
  if (minutes < 60) label = `${minutes}m prima`;
  else if (minutes === 60) label = "1h prima";
  else if (minutes === 1440) label = "1g prima";
  else label = `${Math.floor(minutes / 60)}h prima`;
  return (
    <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      <Clock className="h-3 w-3" /> {label}
    </span>
  );
}
