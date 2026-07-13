import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, HelpCircle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type InviteStatus = Database["public"]["Enums"]["invite_status"];

type InviteWithProfile = {
  id: string;
  invitee_id: string;
  status: InviteStatus;
  profile: { username: string; display_name: string | null } | null;
};

export function EventInvites({
  eventId,
  isOwner,
  currentUserId,
}: {
  eventId: string;
  isOwner: boolean;
  currentUserId: string;
}) {
  const qc = useQueryClient();

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["event-invites", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_invites")
        .select("id, invitee_id, status")
        .eq("event_id", eventId);
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return [] as InviteWithProfile[];
      const ids = rows.map((r) => r.invitee_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", ids);
      const map = new Map(profs?.map((p) => [p.id, p]) ?? []);
      return rows.map((r) => ({
        ...r,
        profile: map.get(r.invitee_id) ?? null,
      })) as InviteWithProfile[];
    },
  });

  const rsvp = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InviteStatus }) => {
      const { error } = await supabase
        .from("event_invites")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-invites", eventId] });
      qc.invalidateQueries({ queryKey: ["received-invites"] });
      toast.success("Risposta inviata");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  if (isLoading) {
    return <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />;
  }
  if (invites.length === 0) return null;

  const mine = invites.find((i) => i.invitee_id === currentUserId);

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <h3 className="mb-2 text-[11px] font-600 uppercase tracking-[0.16em] text-muted-foreground">
        Partecipanti ({invites.length})
      </h3>

      {mine && !isOwner && (
        <div className="mb-3 flex gap-1.5">
          <RsvpBtn
            active={mine.status === "going"}
            onClick={() => rsvp.mutate({ id: mine.id, status: "going" })}
            label="Vengo"
            icon={<Check className="h-3.5 w-3.5" />}
          />
          <RsvpBtn
            active={mine.status === "maybe"}
            onClick={() => rsvp.mutate({ id: mine.id, status: "maybe" })}
            label="Forse"
            icon={<HelpCircle className="h-3.5 w-3.5" />}
          />
          <RsvpBtn
            active={mine.status === "declined"}
            onClick={() => rsvp.mutate({ id: mine.id, status: "declined" })}
            label="No"
            icon={<X className="h-3.5 w-3.5" />}
          />
        </div>
      )}

      <ul className="flex flex-col gap-1">
        {invites.map((i) => (
          <li key={i.id} className="flex items-center justify-between text-xs">
            <span className="truncate">
              @{i.profile?.username ?? "?"}
              {i.invitee_id === currentUserId && (
                <span className="ml-1 text-muted-foreground">(tu)</span>
              )}
            </span>
            <StatusPill status={i.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RsvpBtn({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
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

function StatusPill({ status }: { status: InviteStatus }) {
  const map: Record<InviteStatus, { label: string; cls: string }> = {
    pending: { label: "In attesa", cls: "bg-muted text-muted-foreground" },
    going: { label: "Viene", cls: "bg-primary/15 text-primary" },
    maybe: { label: "Forse", cls: "bg-accent text-foreground/70" },
    declined: { label: "No", cls: "bg-destructive/10 text-destructive" },
  };
  const { label, cls } = map[status];
  return (
    <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + cls}>{label}</span>
  );
}
