import { useEffect, useState } from "react";
import { X, Sparkles, Trash2, Loader2, Globe2, Lock, Users, Clock, LogOut } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { amiciStore } from "@/lib/amici-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CATEGORY_COLORS, type AgendaEvent } from "./types";
import { parseNL } from "@/lib/nl-parse";
import { toLocalISOString } from "@/lib/date-utils";
import { supabaseErrorMessage } from "@/lib/error-message";

type Visibility = "public" | "lists" | "private";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  editing?: AgendaEvent | null;
  defaultDate?: Date;
  defaultStart?: Date;
};

const EMOJI = ["🗓️", "🍸", "🎵", "💼", "🏃", "🍝", "🎬", "☕", "❤️", "✈️", "🎂", "📚"];

function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toInputTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
function addHours(d: Date, n: number): Date {
  const x = new Date(d);
  x.setHours(x.getHours() + n);
  return x;
}

export function EventForm({ open, onClose, userId, editing, defaultDate, defaultStart }: Props) {
  const qc = useQueryClient();
  const [quick, setQuick] = useState("");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("🗓️");
  const [place, setPlace] = useState("");
  const now = new Date();
  const initialStart = defaultStart ?? now;
  const [startDate, setStartDate] = useState(toInputDate(defaultStart ?? defaultDate ?? now));
  const [endDate, setEndDate] = useState(toInputDate(defaultStart ?? defaultDate ?? now));
  const [startTime, setStartTime] = useState(toInputTime(initialStart));
  const [endTime, setEndTime] = useState(toInputTime(addHours(initialStart, 1)));
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0].value);
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
  const [invitees, setInvitees] = useState<Set<string>>(new Set());
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);

  // Accepted friends (bi-directional accepted follows)
  const { data: friends = [] } = useQuery({
    queryKey: ["friends-for-invite", userId],
    enabled: open,
    queryFn: async () => {
      const { data: follows, error } = await supabase
        .from("follows")
        .select("follower_id, followee_id, status")
        .eq("status", "accepted");
      if (error) throw error;
      const ids = new Set<string>();
      for (const f of follows ?? []) {
        if (f.follower_id === userId) ids.add(f.followee_id);
        if (f.followee_id === userId) ids.add(f.follower_id);
      }
      if (ids.size === 0) return [] as { id: string; username: string; display_name: string | null }[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", Array.from(ids));
      return profs ?? [];
    },
  });

  const { data: lists = [] } = useQuery({
    queryKey: ["lists", userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists").select("id, name, color").eq("owner_id", userId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-defaults", userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("default_visibility_list_id").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const s = new Date(editing.starts_at);
      const en = editing.ends_at ? new Date(editing.ends_at) : null;
      setTitle(editing.title);
      setIcon(editing.icon ?? "🗓️");
      setPlace(editing.place ?? "");
      setStartDate(toInputDate(s));
      setEndDate(toInputDate(en ?? s));
      setStartTime(toInputTime(s));
      setEndTime(en ? toInputTime(en) : "");
      setDescription(editing.description ?? "");
      setColor(editing.list_color);
      setVisibility(editing.visibility_type);
      setReminderMinutes(editing.reminder_minutes);
      // Load existing linked lists and invitees
      supabase.from("event_lists").select("list_id").eq("event_id", editing.id)
        .then(({ data }) => setSelectedLists(new Set((data ?? []).map((r) => r.list_id))));
      supabase.from("event_invites").select("invitee_id").eq("event_id", editing.id)
        .then(({ data }) => setInvitees(new Set((data ?? []).map((r) => r.invitee_id))));
    } else {
      const base = defaultDate ?? new Date();
      const startBase = defaultStart ?? new Date();
      setQuick("");
      setTitle("");
      setIcon("🗓️");
      setPlace("");
      setStartDate(toInputDate(defaultStart ?? base));
      setEndDate(toInputDate(defaultStart ?? base));
      setStartTime(toInputTime(startBase));
      setEndTime(toInputTime(addHours(startBase, 1)));
      setDescription("");
      setColor(CATEGORY_COLORS[0].value);
      // Preselect default from profile
      if (profile?.default_visibility_list_id) {
        setVisibility("lists");
        setSelectedLists(new Set([profile.default_visibility_list_id]));
      } else {
        setVisibility("private");
        setSelectedLists(new Set());
      }
      setInvitees(new Set());
      setReminderMinutes(null);
    }
  }, [open, editing, defaultDate, defaultStart, profile?.default_visibility_list_id]);

  function applyQuick() {
    const r = parseNL(quick);
    if (r.title) setTitle(r.title);
    if (r.place) setPlace(r.place);
    if (r.when) {
      setStartDate(toInputDate(r.when));
      setEndDate(toInputDate(r.when));
      setStartTime(toInputTime(r.when));
      setEndTime(toInputTime(addHours(r.when, 1)));
    }
    if (!r.title && !r.place && !r.when) {
      toast.info("Non ho capito. Prova ad esempio: “domani 21 aperitivo al Barrio”.");
    }
  }

  function toggleList(id: string) {
    setSelectedLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        const l = lists.find((x) => x.id === id);
        if (l?.color) setColor(l.color);
      }
      return next;
    });
  }

  function toggleInvitee(id: string) {
    setInvitees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Manca il titolo");
      if (visibility === "lists" && selectedLists.size === 0) {
        throw new Error("Scegli almeno una lista o cambia la visibilità");
      }
      const starts = new Date(`${startDate}T${startTime}:00`);
      let effectiveEndDate = endDate || startDate;
      // If end time is before start time on the same date, roll end date to next day.
      if (endTime && effectiveEndDate === startDate && endTime <= startTime) {
        const d = new Date(`${startDate}T00:00:00`);
        d.setDate(d.getDate() + 1);
        effectiveEndDate = toInputDate(d);
      }
      const ends = endTime ? new Date(`${effectiveEndDate}T${endTime}:00`) : null;
      if (ends && ends <= starts) {
        throw new Error("La fine deve essere successiva all'inizio");
      }
      const payload = {
        owner_id: userId,
        title: title.trim(),
        icon,
        place: place.trim() || null,
        starts_at: toLocalISOString(starts),
        ends_at: ends ? toLocalISOString(ends) : null,
        description: description.trim() || null,
        list_color: color,
        visibility_type: visibility,
        reminder_minutes: reminderMinutes,
      };

      let eventId: string;
      if (editing) {
        const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
        if (error) throw error;
        eventId = editing.id;
        // Reset list links
        await supabase.from("event_lists").delete().eq("event_id", eventId);
      } else {
        const { data, error } = await supabase.from("events").insert(payload).select("id").single();
        if (error) throw error;
        eventId = data.id;
      }

      if (visibility === "lists" && selectedLists.size > 0) {
        const rows = Array.from(selectedLists).map((list_id) => ({ event_id: eventId, list_id }));
        const { error } = await supabase.from("event_lists").insert(rows);
        if (error) throw error;
      }

      // Sync invitees
      const { data: existingInvites } = await supabase
        .from("event_invites")
        .select("id, invitee_id")
        .eq("event_id", eventId);
      const existingIds = new Set((existingInvites ?? []).map((r) => r.invitee_id));
      const toAdd = Array.from(invitees).filter((id) => !existingIds.has(id));
      const toRemove = (existingInvites ?? []).filter((r) => !invitees.has(r.invitee_id));
      if (toAdd.length) {
        await supabase.from("event_invites").insert(
          toAdd.map((invitee_id) => ({ event_id: eventId, invitee_id, invited_by: userId }))
        );
      }
      if (toRemove.length) {
        await supabase
          .from("event_invites")
          .delete()
          .in("id", toRemove.map((r) => r.id));
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Impegno aggiornato" : "Impegno creato");
      qc.invalidateQueries({ queryKey: ["events", userId] });
      qc.invalidateQueries({ queryKey: ["event-invites"] });
      onClose();
    },
    onError: (err) => {
      toast.error(supabaseErrorMessage(err));
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("events").delete().eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eliminato");
      qc.invalidateQueries({ queryKey: ["events", userId] });
      onClose();
    },
  });

  const leave = useMutation({
    mutationFn: async () => {
      if (!editing?.origin_id) return;
      const { error } = await supabase.rpc("leave_event", {
        _origin_event_id: editing.origin_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rimosso dai tuoi impegni");
      qc.invalidateQueries({ queryKey: ["events", userId] });
      if (editing?.origin_id) {
        qc.invalidateQueries({ queryKey: ["going-count", editing.origin_id] });
        qc.invalidateQueries({ queryKey: ["my-copy", editing.origin_id, userId] });
      }
      onClose();
    },
    onError: (e) => toast.error(supabaseErrorMessage(e)),
  });

  const isJoinedCopy = !!editing?.origin_id;

  if (!open) return null;

  const visibilityLabel: Record<Visibility, string> = {
    public: "Chiunque può vederlo.",
    lists: selectedLists.size
      ? `Visibile alle ${selectedLists.size === 1 ? "persone della lista scelta" : `persone di ${selectedLists.size} liste`}.`
      : "Scegli almeno una lista qui sotto.",
    private: "Solo tu vedi questo impegno.",
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center">
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-card p-5 shadow-elevated sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-700">
            {editing ? "Modifica impegno" : "Nuovo impegno"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!editing && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-background/50 p-2">
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); applyQuick(); }
              }}
              placeholder="es. domani 21 aperitivo al Barrio"
              className="h-9 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <button
              type="button"
              onClick={applyQuick}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" /> Compila
            </button>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: color + "22" }}>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="h-full w-full cursor-pointer appearance-none bg-transparent text-center text-2xl outline-none"
              >
                {EMOJI.map((em) => <option key={em} value={em}>{em}</option>)}
              </select>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titolo"
              required
              maxLength={80}
              className="h-14 flex-1 rounded-2xl border border-input bg-background/50 px-4 text-base outline-none focus:border-ring"
            />
          </div>

          <input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Luogo"
            maxLength={120}
            readOnly={isJoinedCopy}
            title={isJoinedCopy ? "Luogo bloccato dall'organizzatore" : undefined}
            className={
              "h-11 rounded-xl border border-input px-3 text-sm outline-none focus:border-ring " +
              (isJoinedCopy ? "bg-muted/30 text-muted-foreground" : "bg-background/50")
            }
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Data inizio</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartDate(v);
                  // Keep endDate in sync if it was equal (or earlier) — user can still change it.
                  if (!endDate || endDate < v) setEndDate(v);
                }}
                required
                className="h-11 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Ora inizio</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required
                className="h-11 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Data fine</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Ora fine</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="h-11 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring" />
            </label>
          </div>
          {endTime && endDate === startDate && endTime <= startTime && (
            <p className="-mt-2 text-xs text-muted-foreground">
              L'ora di fine è precedente all'inizio: la fine verrà spostata al giorno successivo.
            </p>
          )}

          {visibility === "lists" ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: color }} />
              Il colore viene preso dalla lista selezionata.
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Colore</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button key={c.value} type="button" onClick={() => setColor(c.value)}
                    className={"h-10 flex-1 rounded-full text-[11px] font-medium transition " +
                      (color === c.value ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "opacity-80")}
                    style={{ backgroundColor: c.value + "22", color: c.value }}>
                    {c.label}
                  </button>
                ))}
                <label
                  className="flex h-10 min-w-[80px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background/60 px-3 text-[11px] font-medium text-muted-foreground"
                  title="Colore personalizzato"
                >
                  <span className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: color }} />
                  <span>Custom</span>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="sr-only" />
                </label>
              </div>
            </label>
          )}

          {/* Visibility — the critical control */}
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Chi lo vede</span>
              <span className="text-[11px] text-muted-foreground">Nessuna pubblicazione silenziosa</span>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-full border border-border bg-card p-1 text-xs">
              <VisBtn active={visibility === "private"} onClick={() => setVisibility("private")} icon={<Lock className="h-3.5 w-3.5" />} label="Privato" />
              <VisBtn active={visibility === "lists"} onClick={() => setVisibility("lists")} icon={<Users className="h-3.5 w-3.5" />} label="Liste" />
              <VisBtn active={visibility === "public"} onClick={() => setVisibility("public")} icon={<Globe2 className="h-3.5 w-3.5" />} label="Pubblico" />
            </div>
            <p className="mt-2 text-xs text-foreground/80">{visibilityLabel[visibility]}</p>

            {visibility === "lists" && (
              <div className="mt-3 flex flex-col gap-1.5">
                {lists.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                    Non hai liste. <Link to="/app/liste" onClick={onClose} className="font-medium text-foreground underline">Creane una</Link>.
                  </div>
                ) : (
                  lists.map((l) => {
                    const on = selectedLists.has(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleList(l.id)}
                        className={
                          "flex items-center gap-2 rounded-xl border p-2 text-left text-sm transition " +
                          (on ? "border-primary bg-primary/10" : "border-border bg-background/60")
                        }
                      >
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="flex-1">{l.name}</span>
                        <span className={"flex h-5 w-5 items-center justify-center rounded-full border " + (on ? "border-primary bg-primary text-primary-foreground" : "border-muted")}>
                          {on ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Promemoria */}
          <div className="rounded-2xl border border-border bg-card/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" /> Promemoria
              </span>
            </div>
            <select
              value={reminderMinutes ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setReminderMinutes(v === "" ? null : Number(v));
              }}
              className="h-11 w-full rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring"
            >
              <option value="">Nessun promemoria</option>
              <option value={15}>15 minuti prima</option>
              <option value={30}>30 minuti prima</option>
              <option value={60}>1 ora prima</option>
              <option value={1440}>1 giorno prima</option>
            </select>
          </div>

          {/* Invita amici */}
          <div className="rounded-2xl border border-border bg-card/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Invita amici</span>
              <span className="text-[11px] text-muted-foreground">
                {invitees.size > 0 ? `${invitees.size} selezionati` : "opzionale"}
              </span>
            </div>
            {friends.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nessun amico ancora.{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    amiciStore.open();
                  }}
                  className="font-medium text-foreground underline"
                >
                  Trova persone
                </button>
                .
              </p>
            ) : (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                {friends.map((f) => {
                  const on = invitees.has(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleInvitee(f.id)}
                      className={
                        "flex items-center gap-2 rounded-xl border p-2 text-left text-sm transition " +
                        (on ? "border-primary bg-primary/10" : "border-border bg-background/60")
                      }
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-600 text-primary">
                        {(f.display_name ?? f.username).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex-1 truncate">
                        {f.display_name || f.username}
                        <span className="ml-1 text-xs text-muted-foreground">@{f.username}</span>
                      </span>
                      <span className={"flex h-5 w-5 items-center justify-center rounded-full border " + (on ? "border-primary bg-primary text-primary-foreground" : "border-muted")}>
                        {on ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>


          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Note (opzionale)"
            rows={2}
            maxLength={500}
            className="rounded-xl border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-ring"
          />

          <div className="flex gap-2 pt-2">
            {editing && (
              <button
                type="button"
                onClick={() => { if (confirm("Eliminare l'impegno?")) del.mutate(); }}
                className="inline-flex h-12 items-center justify-center rounded-full border border-destructive/40 px-4 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {isJoinedCopy && (
              <button
                type="button"
                onClick={() => { if (confirm("Rimuoverti dall'evento?")) leave.mutate(); }}
                disabled={leave.isPending}
                className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-destructive/40 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
              >
                {leave.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Non vengo più
              </button>
            )}
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salva modifiche" : "Crea impegno"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VisBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex h-8 items-center justify-center gap-1 rounded-full font-medium transition " +
        (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
      }
    >
      {icon} {label}
    </button>
  );
}
