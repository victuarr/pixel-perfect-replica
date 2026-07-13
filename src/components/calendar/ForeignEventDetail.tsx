import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, LogOut, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatItalianDate, formatTime, toLocalISOString } from "@/lib/date-utils";
import type { AgendaEvent } from "./types";
import { GoingCount } from "./GoingCount";

type Visibility = "public" | "lists" | "private";

export function ForeignEventDetail({
  event,
  userId,
  onClose,
}: {
  event: AgendaEvent;
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const rootId = event.origin_id ?? event.id;
  const [arrival, setArrival] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());

  const { data: profile } = useQuery({
    queryKey: ["profile-defaults", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("default_visibility_list_id")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
  });

  const { data: lists = [] } = useQuery({
    queryKey: ["lists", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lists")
        .select("id, name, color")
        .eq("owner_id", userId)
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: myCopy } = useQuery({
    queryKey: ["my-copy", rootId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id")
        .eq("owner_id", userId)
        .eq("origin_id", rootId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile?.default_visibility_list_id) {
      setVisibility("lists");
      setSelectedLists(new Set([profile.default_visibility_list_id]));
    }
  }, [profile?.default_visibility_list_id]);

  const join = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("join_event", {
        _origin_event_id: rootId,
        _arrival: arrival ? toLocalISOString(new Date(arrival)) : undefined,
        _note: note.trim() || undefined,
        _visibility: visibility,
        _list_ids:
          visibility === "lists" ? Array.from(selectedLists) : undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ti sei aggiunto all'evento");
      qc.invalidateQueries({ queryKey: ["events", userId] });
      qc.invalidateQueries({ queryKey: ["my-copy", rootId, userId] });
      qc.invalidateQueries({ queryKey: ["going-count", rootId] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("leave_event", {
        _origin_event_id: rootId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rimosso dai tuoi impegni");
      qc.invalidateQueries({ queryKey: ["events", userId] });
      qc.invalidateQueries({ queryKey: ["my-copy", rootId, userId] });
      qc.invalidateQueries({ queryKey: ["going-count", rootId] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  const starts = new Date(event.starts_at);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center">
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-card p-5 shadow-elevated sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-700">Dettaglio evento</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-start gap-3">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{ backgroundColor: event.list_color + "22" }}
          >
            {event.icon ?? "•"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-700 leading-tight">
              {event.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatItalianDate(starts)} · {formatTime(starts)}
            </p>
            <div className="mt-1">
              <GoingCount eventId={rootId} />
            </div>
          </div>
        </div>

        <label className="mb-3 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Luogo (bloccato)</span>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-muted/30 px-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{event.place || "—"}</span>
          </div>
        </label>

        {event.description && (
          <p className="mb-4 rounded-xl bg-background/60 p-3 text-sm text-foreground/80">
            {event.description}
          </p>
        )}

        {myCopy ? (
          <button
            onClick={() => leave.mutate()}
            disabled={leave.isPending}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-destructive/40 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            {leave.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Non vengo più
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                Orario di arrivo (opzionale)
              </span>
              <input
                type="datetime-local"
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
                className="h-11 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                Nota personale (opzionale)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                className="rounded-xl border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-3">
              <span className="mb-2 block text-sm font-medium">
                Chi lo vede sul tuo calendario
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-full border border-border bg-card p-1 text-xs">
                {(["private", "lists", "public"] as Visibility[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={
                      "flex h-8 items-center justify-center rounded-full font-medium transition " +
                      (visibility === v
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {v === "private"
                      ? "Privato"
                      : v === "lists"
                        ? "Liste"
                        : "Pubblico"}
                  </button>
                ))}
              </div>
              {visibility === "lists" && (
                <div className="mt-3 flex flex-col gap-1.5">
                  {lists.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Non hai liste.
                    </p>
                  ) : (
                    lists.map((l) => {
                      const on = selectedLists.has(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setSelectedLists((prev) => {
                              const next = new Set(prev);
                              if (next.has(l.id)) next.delete(l.id);
                              else next.add(l.id);
                              return next;
                            });
                          }}
                          className={
                            "flex items-center gap-2 rounded-xl border p-2 text-left text-sm " +
                            (on
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background/60")
                          }
                        >
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: l.color }}
                          />
                          <span className="flex-1">{l.name}</span>
                          {on && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => join.mutate()}
              disabled={
                join.isPending ||
                (visibility === "lists" && selectedLists.size === 0)
              }
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
            >
              {join.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Ci vengo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
