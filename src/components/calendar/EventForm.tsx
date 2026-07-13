import { useEffect, useState } from "react";
import { X, Sparkles, Trash2, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CATEGORY_COLORS, type AgendaEvent } from "./types";
import { parseNL } from "@/lib/nl-parse";
import { toLocalISOString } from "@/lib/date-utils";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  editing?: AgendaEvent | null;
  defaultDate?: Date;
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

export function EventForm({ open, onClose, userId, editing, defaultDate }: Props) {
  const qc = useQueryClient();
  const [quick, setQuick] = useState("");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("🗓️");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(toInputDate(defaultDate ?? new Date()));
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0].value);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const s = new Date(editing.starts_at);
      const en = editing.ends_at ? new Date(editing.ends_at) : null;
      setTitle(editing.title);
      setIcon(editing.icon ?? "🗓️");
      setPlace(editing.place ?? "");
      setDate(toInputDate(s));
      setStartTime(toInputTime(s));
      setEndTime(en ? toInputTime(en) : "");
      setDescription(editing.description ?? "");
      setColor(editing.list_color);
    } else {
      const base = defaultDate ?? new Date();
      setQuick("");
      setTitle("");
      setIcon("🗓️");
      setPlace("");
      setDate(toInputDate(base));
      setStartTime("19:00");
      setEndTime("");
      setDescription("");
      setColor(CATEGORY_COLORS[0].value);
    }
  }, [open, editing, defaultDate]);

  function applyQuick() {
    const r = parseNL(quick);
    if (r.title) setTitle(r.title);
    if (r.place) setPlace(r.place);
    if (r.when) {
      setDate(toInputDate(r.when));
      setStartTime(toInputTime(r.when));
    }
    if (!r.title && !r.place && !r.when) {
      toast.info("Non ho capito. Prova ad esempio: “domani 21 aperitivo al Barrio”.");
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Manca il titolo");
      const starts = new Date(`${date}T${startTime}:00`);
      const ends = endTime ? new Date(`${date}T${endTime}:00`) : null;
      const payload = {
        owner_id: userId,
        title: title.trim(),
        icon,
        place: place.trim() || null,
        starts_at: toLocalISOString(starts),
        ends_at: ends ? toLocalISOString(ends) : null,
        description: description.trim() || null,
        list_color: color,
      };
      if (editing) {
        const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Impegno aggiornato" : "Impegno creato");
      qc.invalidateQueries({ queryKey: ["events", userId] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Errore");
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

  if (!open) return null;

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
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyQuick();
                }
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex gap-2">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                 style={{ backgroundColor: color + "22" }}>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="h-full w-full cursor-pointer appearance-none bg-transparent text-center text-2xl outline-none"
              >
                {EMOJI.map((em) => (
                  <option key={em} value={em}>{em}</option>
                ))}
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
            className="h-11 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring"
          />

          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-3 flex flex-col gap-1 sm:col-span-1">
              <span className="text-xs text-muted-foreground">Data</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="h-11 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Inizio</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="h-11 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Fine</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-11 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Categoria / colore</span>
            <div className="flex gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={
                    "flex h-10 flex-1 items-center justify-center rounded-full text-[11px] font-medium transition " +
                    (color === c.value ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "opacity-80")
                  }
                  style={{ backgroundColor: c.value + "22", color: c.value }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </label>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Note (opzionale)"
            rows={2}
            maxLength={500}
            className="rounded-xl border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-ring"
          />

          <p className="text-xs text-muted-foreground">
            Per ora l'impegno è <span className="font-medium text-foreground">privato</span>. La condivisione arriva nella fase 3.
          </p>

          <div className="flex gap-2 pt-2">
            {editing && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Eliminare l'impegno?")) del.mutate();
                }}
                className="inline-flex h-12 items-center justify-center rounded-full border border-destructive/40 px-4 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
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
