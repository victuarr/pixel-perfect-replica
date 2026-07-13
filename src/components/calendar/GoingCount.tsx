import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function GoingCount({
  eventId,
  className,
}: {
  eventId: string;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: ["going-count", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("event_going_count", {
        _event_id: eventId,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });
  const n = data ?? 0;
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-[11px] text-muted-foreground " +
        (className ?? "")
      }
    >
      <Users className="h-3 w-3" /> {n} {n === 1 ? "va" : "vanno"}
    </span>
  );
}
