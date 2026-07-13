import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCalendarIcs } from "@/lib/ics";
import type { AgendaEvent } from "@/components/calendar/types";

export const exportCalendarIcs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .gte("starts_at", data.from)
      .lte("starts_at", data.to)
      .order("starts_at", { ascending: true });

    if (error) throw error;
    return buildCalendarIcs((events ?? []) as AgendaEvent[]);
  });
