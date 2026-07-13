import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: events, error: eventsError } = await supabaseAdmin
          .from("events")
          .select("id, owner_id, title, starts_at, reminder_minutes")
          .not("reminder_minutes", "is", null)
          .gte("starts_at", new Date().toISOString())
          .lte(
            "starts_at",
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          );

        if (eventsError) {
          console.error("send-reminders events error", eventsError);
          return new Response(JSON.stringify({ error: eventsError.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let sent = 0;
        const rows = events ?? [];

        for (const event of rows as Database["public"]["Tables"]["events"]["Row"][]) {
          const scheduledAt = new Date(
            new Date(event.starts_at).getTime() - (event.reminder_minutes ?? 0) * 60_000
          );
          if (scheduledAt > new Date()) continue;

          const { data: existingReminders } = await supabaseAdmin
            .from("event_reminders")
            .select("event_id, user_id")
            .eq("event_id", event.id);
          const already = new Set((existingReminders ?? []).map((r) => r.user_id));

          const { data: invites } = await supabaseAdmin
            .from("event_invites")
            .select("invitee_id, status")
            .eq("event_id", event.id)
            .in("status", ["going", "maybe"]);

          const recipients = new Set<string>([event.owner_id]);
          for (const inv of invites ?? []) {
            if (inv.invitee_id) recipients.add(inv.invitee_id);
          }

          for (const userId of recipients) {
            if (already.has(userId)) continue;
            const { error: reminderError } = await supabaseAdmin
              .from("event_reminders")
              .insert({
                event_id: event.id,
                user_id: userId,
                scheduled_at: scheduledAt.toISOString(),
              });
            if (reminderError) {
              console.error("event_reminders insert error", reminderError);
              continue;
            }
            const { error: notifError } = await supabaseAdmin
              .from("notifications")
              .insert({
                user_id: userId,
                actor_id: event.owner_id,
                type: "event_reminder",
                entity_type: "event",
                entity_id: event.id,
                data: { title: event.title.slice(0, 80) },
              });
            if (notifError) {
              console.error("notifications insert error", notifError);
            } else {
              sent++;
            }
          }
        }

        return Response.json({ ok: true, sent });
      },
    },
  },
});
