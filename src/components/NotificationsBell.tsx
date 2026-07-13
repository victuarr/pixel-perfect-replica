import { useState } from "react";
import { Bell, Check, UserPlus, CalendarPlus, CalendarCheck, Clock, MessageCircle, Smile } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useNotifications, type NotificationWithActor } from "@/hooks/useNotifications";

const ITALIAN_TYPE: Record<NotificationWithActor["type"], string> = {
  follow_request: "ti ha inviato una richiesta di amicizia",
  follow_accepted: "ha accettato la tua richiesta",
  event_invite: "ti ha invitato a un evento",
  event_rsvp: "ha risposto al tuo invito",
  event_reminder: "hai un promemoria per un evento",
  event_comment: "ha commentato un evento",
  event_reaction: "ha reagito a un evento",
};

const ICONS: Record<NotificationWithActor["type"], React.ReactNode> = {
  follow_request: <UserPlus className="h-3.5 w-3.5" />,
  follow_accepted: <Check className="h-3.5 w-3.5" />,
  event_invite: <CalendarPlus className="h-3.5 w-3.5" />,
  event_rsvp: <CalendarCheck className="h-3.5 w-3.5" />,
  event_reminder: <Clock className="h-3.5 w-3.5" />,
  event_comment: <MessageCircle className="h-3.5 w-3.5" />,
  event_reaction: <Smile className="h-3.5 w-3.5" />,
};

export function NotificationsBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data = [], unreadCount, markAllRead, markOneRead } = useNotifications(userId);

  function handleClick(n: NotificationWithActor) {
    if (!n.read_at) markOneRead.mutate(n.id);
    if (n.type === "follow_request" || n.type === "follow_accepted") {
      navigate({ to: "/app/amici" });
    } else if (n.type === "event_invite" || n.type === "event_rsvp") {
      navigate({ to: "/app" });
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
        aria-label="Notifiche"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-700 text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-card p-2 shadow-elevated">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="font-display text-sm font-700">Notifiche</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Segna tutte
                </button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {data.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nessuna notifica.
                </li>
              )}
              {data.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={
                      "flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-xs transition hover:bg-accent " +
                      (!n.read_at ? "bg-primary/[0.06]" : "")
                    }
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      {ICONS[n.type]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        <span className="font-600">
                          @{n.actor?.username ?? "qualcuno"}
                        </span>{" "}
                        <span className="text-muted-foreground">{ITALIAN_TYPE[n.type]}</span>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
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
