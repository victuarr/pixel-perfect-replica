import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REACTIONS = ["🔥", "❤️", "🎉", "👍"];

type ReactionRow = {
  id: string;
  event_id: string;
  user_id: string;
  reaction: string;
};

export function EventReactions({
  eventId,
  currentUserId,
}: {
  eventId: string;
  currentUserId: string;
}) {
  const qc = useQueryClient();

  const { data: reactions = [] } = useQuery({
    queryKey: ["event-reactions", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_reactions")
        .select("id, event_id, user_id, reaction")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data ?? []) as ReactionRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`event-reactions:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_reactions", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["event-reactions", eventId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);

  const toggle = useMutation({
    mutationFn: async (reaction: string) => {
      const existing = reactions.find(
        (r) => r.user_id === currentUserId && r.reaction === reaction
      );
      if (existing) {
        const { error } = await supabase.from("event_reactions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_reactions")
          .insert({ event_id: eventId, user_id: currentUserId, reaction });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-reactions", eventId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REACTIONS.map((emoji) => {
        const count = reactions.filter((r) => r.reaction === emoji).length;
        const mine = reactions.some((r) => r.user_id === currentUserId && r.reaction === emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle.mutate(emoji)}
            disabled={toggle.isPending}
            className={
              "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-sm transition " +
              (mine
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/40")
            }
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-xs font-600">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
