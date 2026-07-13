import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, HelpCircle, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { formatItalianDate, formatTime } from "@/lib/date-utils";

type InviteStatus = Database["public"]["Enums"]["invite_status"];

export function ReceivedInvites({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ["received-invites", userId],
    queryFn: async () => {
      const { data: invites, error } = await supabase
        .from("event_invites")
        .select("id, status, event_id, invited_by")
        .eq("invitee_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = invites ?? [];
      if (!rows.length) return [];
      const eventIds = rows.map((r) => r.event_id);
      const ownerIds = Array.from(new Set(rows.map((r) => r.invited_by)));
      const [{ data: events }, { data: profs }] = await Promise.all([
        supabase.from("events").select("id, title, icon, place, starts_at, list_color").in("id", eventIds),
        supabase.from("profiles").select("id, username, display_name").in("id", ownerIds),
      ]);
      const eMap = new Map((events ?? []).map((e) => [e.id, e]));
      const pMap = new Map((profs ?? []).map((p) => [p.id, p]));
      return rows
        .map((r) => ({
          id: r.id,
          status: r.status,
          event: eMap.get(r.event_id),
          host: pMap.get(r.invited_by),
        }))
        .filter((r) => r.event);
    },
  });

  const rsvp = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InviteStatus }) => {
      const { error } = await supabase.from("event_invites").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["received-invites", userId] });
      toast.success("Risposta inviata");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  const pendingCount = data.filter((r) => r.status === "pending").length;
  if (data.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-[11px] font-600 uppercase tracking-[0.16em] text-muted-foreground">
        Inviti {pendingCount > 0 && `(${pendingCount} da rispondere)`}
      </h2>
      <ul className="flex flex-col gap-2">
        {data.map((r) => {
          const e = r.event!;
          const d = new Date(e.starts_at);
          return (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-card p-3 shadow-card"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ backgroundColor: (e.list_color ?? "#999") + "22" }}
                >
                  {e.icon ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-600 leading-tight">
                    {e.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{formatItalianDate(d)}</span>
                    <span>·</span>
                    <span>{formatTime(d)}</span>
                    {e.place && (
                      <>
                        <span>·</span>
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{e.place}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    da @{r.host?.username ?? "?"}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <RsvpBtn active={r.status === "going"} onClick={() => rsvp.mutate({ id: r.id, status: "going" })} label="Vengo" icon={<Check className="h-3.5 w-3.5" />} />
                <RsvpBtn active={r.status === "maybe"} onClick={() => rsvp.mutate({ id: r.id, status: "maybe" })} label="Forse" icon={<HelpCircle className="h-3.5 w-3.5" />} />
                <RsvpBtn active={r.status === "declined"} onClick={() => rsvp.mutate({ id: r.id, status: "declined" })} label="No" icon={<X className="h-3.5 w-3.5" />} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RsvpBtn({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex h-8 flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-medium transition " +
        (active
          ? "bg-primary text-primary-foreground"
          : "border border-border text-muted-foreground hover:text-foreground")
      }
    >
      {icon} {label}
    </button>
  );
}
