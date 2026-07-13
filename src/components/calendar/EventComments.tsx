import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Comment = {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
};

export function EventComments({
  eventId,
  currentUserId,
}: {
  eventId: string;
  currentUserId: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["event-comments", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_comments")
        .select("id, event_id, user_id, body, created_at, updated_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comment[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["event-comments-profiles", eventId, comments.map((c) => c.user_id).join(",")],
    enabled: comments.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(comments.map((c) => c.user_id)));
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  useEffect(() => {
    const channel = supabase
      .channel(`event-comments:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_comments", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["event-comments", eventId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);

  const add = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from("event_comments")
        .insert({ event_id: eventId, user_id: currentUserId, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["event-comments", eventId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-comments", eventId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <h3 className="mb-2 text-[11px] font-600 uppercase tracking-[0.16em] text-muted-foreground">
        Commenti ({comments.length})
      </h3>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && text.trim()) {
              e.preventDefault();
              add.mutate(text);
            }
          }}
          placeholder="Scrivi un commento..."
          maxLength={300}
          className="h-10 flex-1 rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-ring"
        />
        <button
          type="button"
          disabled={!text.trim() || add.isPending}
          onClick={() => add.mutate(text)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          aria-label="Invia commento"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {comments.length === 0 && (
          <li className="text-center text-xs text-muted-foreground">
            Nessun commento. Scrivi il primo.
          </li>
        )}
        {comments.map((c) => {
          const p = profileById.get(c.user_id);
          const isMine = c.user_id === currentUserId;
          return (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-600 text-primary">
                {(p?.display_name ?? p?.username ?? "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-600">
                    @{p?.username ?? "?"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
              </div>
              {isMine && (
                <button
                  onClick={() => remove.mutate(c.id)}
                  className="mt-1 text-muted-foreground hover:text-destructive"
                  aria-label="Elimina commento"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "adesso";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}g`;
}
