import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  MapPin,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ReceivedInvites } from "@/components/ReceivedInvites";
import { formatItalianDate, formatTime } from "@/lib/date-utils";
import type { AgendaEvent } from "@/components/calendar/types";

export const Route = createFileRoute("/_authenticated/app/amici")({
  component: AmiciPage,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type FeedItem = AgendaEvent & { owner: Profile };

type FollowRow = {
  id: string;
  follower_id: string;
  followee_id: string;
  status: "pending" | "accepted";
};

type Tab = "feed" | "persone";

function AmiciPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("persone");

  // Everyone I have a follow relation with (either direction)
  const { data: follows = [] } = useQuery({
    queryKey: ["follows", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("id, follower_id, followee_id, status");
      if (error) throw error;
      return (data ?? []) as FollowRow[];
    },
  });

  const followingIds = useMemo(
    () =>
      follows
        .filter((f) => f.follower_id === user.id && f.status === "accepted")
        .map((f) => f.followee_id),
    [follows, user.id]
  );
  const incomingPending = useMemo(
    () => follows.filter((f) => f.followee_id === user.id && f.status === "pending"),
    [follows, user.id]
  );
  const outgoingPending = useMemo(
    () => follows.filter((f) => f.follower_id === user.id && f.status === "pending"),
    [follows, user.id]
  );

  // Feed: upcoming events (next 30 days) from users I follow
  const { data: feed = [], isLoading: feedLoading } = useQuery({
    queryKey: ["amici-feed", user.id, followingIds.join(",")],
    enabled: followingIds.length > 0,
    queryFn: async () => {
      const now = new Date().toISOString();
      const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const { data: evs, error } = await supabase
        .from("events")
        .select("*")
        .in("owner_id", followingIds)
        .gte("starts_at", now)
        .lte("starts_at", in30)
        .order("starts_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      const events = (evs ?? []) as AgendaEvent[];
      if (!events.length) return [] as FeedItem[];
      const ownerIds = Array.from(new Set(events.map((e) => e.owner_id)));
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ownerIds);
      if (pErr) throw pErr;
      const map = new Map<string, Profile>();
      for (const p of (profiles ?? []) as Profile[]) map.set(p.id, p);
      return events.map((e) => ({ ...e, owner: map.get(e.owner_id)! })).filter((e) => e.owner);
    },
  });

  return (
    <AppShell subtitle="Amici">
      <div className="mb-4 grid grid-cols-2 rounded-full border border-border bg-card p-1 text-xs">
        <TabButton active={tab === "feed"} onClick={() => setTab("feed")}>
          Feed
          {incomingPending.length > 0 && (
            <span className="ml-1 text-primary">·</span>
          )}
        </TabButton>
        <TabButton active={tab === "persone"} onClick={() => setTab("persone")}>
          Persone
          {incomingPending.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-700 text-primary-foreground">
              {incomingPending.length}
            </span>
          )}
        </TabButton>
      </div>

      {tab === "feed" ? (
        <div className="flex flex-col gap-5">
          <ReceivedInvites userId={user.id} />
          <FeedTab
            loading={feedLoading}
            items={feed}
            hasFollowing={followingIds.length > 0}
            onSwitch={() => setTab("persone")}
          />
        </div>
      ) : (
        <PeopleTab
          userId={user.id}
          follows={follows}
          incomingPending={incomingPending}
          outgoingPending={outgoingPending}
          onChanged={() => qc.invalidateQueries({ queryKey: ["follows", user.id] })}
        />
      )}
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex h-8 items-center justify-center rounded-full font-medium transition-colors " +
        (active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

/* ---------------- Feed tab ---------------- */

function FeedTab({
  loading,
  items,
  hasFollowing,
  onSwitch,
}: {
  loading: boolean;
  items: FeedItem[];
  hasFollowing: boolean;
  onSwitch: () => void;
}) {
  if (!hasFollowing) {
    return (
      <div className="mx-auto mt-8 flex max-w-sm flex-col items-center gap-3 rounded-3xl border border-dashed border-border p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </span>
        <h1 className="font-display text-lg font-700">Il feed è vuoto</h1>
        <p className="text-sm text-muted-foreground">
          Segui qualcuno per vedere qui i suoi prossimi impegni.
        </p>
        <button
          onClick={onSwitch}
          className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <UserPlus className="h-4 w-4" /> Trova persone
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nessun impegno visibile dai tuoi amici nei prossimi 30 giorni.
      </div>
    );
  }

  // Group by day
  const groups = new Map<string, FeedItem[]>();
  for (const it of items) {
    const d = new Date(it.starts_at);
    const key = d.toISOString().slice(0, 10);
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from(groups.entries()).map(([key, evs]) => {
        const date = new Date(key + "T12:00:00");
        return (
          <section key={key}>
            <h2 className="mb-2 text-[11px] font-600 uppercase tracking-[0.16em] text-muted-foreground">
              {formatItalianDate(date)}
            </h2>
            <ul className="flex flex-col gap-2">
              {evs.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: e.list_color + "22" }}
                  >
                    {e.icon ?? "•"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-600 leading-tight">
                      {e.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatTime(new Date(e.starts_at))}</span>
                      {e.place && (
                        <>
                          <span>·</span>
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{e.place}</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      @{e.owner.username}
                      {e.owner.display_name ? ` · ${e.owner.display_name}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- People tab ---------------- */

function PeopleTab({
  userId,
  follows,
  incomingPending,
  outgoingPending,
  onChanged,
}: {
  userId: string;
  follows: FollowRow[];
  incomingPending: FollowRow[];
  outgoingPending: FollowRow[];
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");

  const otherIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of follows) {
      set.add(f.follower_id === userId ? f.followee_id : f.follower_id);
    }
    return Array.from(set);
  }, [follows, userId]);

  // Profiles for known follow rows
  const { data: relatedProfiles = [] } = useQuery({
    queryKey: ["profiles-related", otherIds.join(",")],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", otherIds);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of relatedProfiles) m.set(p.id, p);
    return m;
  }, [relatedProfiles]);

  // Search by username
  const trimmed = query.trim().replace(/^@/, "").toLowerCase();
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["profiles-search", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `%${trimmed}%`)
        .neq("id", userId)
        .limit(15);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const follow = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: userId, followee_id: targetId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Richiesta inviata");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (accept) {
        const { error } = await supabase
          .from("follows")
          .update({ status: "accepted" })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.accept ? "Richiesta accettata" : "Richiesta rifiutata");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("follows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rimosso");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Errore"),
  });

  function relationFor(targetId: string):
    | { kind: "none" }
    | { kind: "following"; id: string }
    | { kind: "requested"; id: string }
    | { kind: "incoming"; id: string }
    | { kind: "follower"; id: string } {
    const f = follows.find(
      (r) =>
        (r.follower_id === userId && r.followee_id === targetId) ||
        (r.followee_id === userId && r.follower_id === targetId)
    );
    if (!f) return { kind: "none" };
    if (f.follower_id === userId) {
      return f.status === "accepted"
        ? { kind: "following", id: f.id }
        : { kind: "requested", id: f.id };
    }
    return f.status === "accepted"
      ? { kind: "follower", id: f.id }
      : { kind: "incoming", id: f.id };
  }

  const accepted = follows.filter(
    (f) => f.follower_id === userId && f.status === "accepted"
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Search */}
      <div className="flex items-center gap-2 rounded-full border border-input bg-card px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca @username"
          className="h-11 flex-1 bg-transparent text-sm outline-none"
        />
        {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {trimmed.length >= 2 && (
        <section>
          <h2 className="mb-2 text-[11px] font-600 uppercase tracking-[0.16em] text-muted-foreground">
            Risultati
          </h2>
          {searchResults.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nessun utente trovato.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {searchResults.map((p) => {
                const rel = relationFor(p.id);
                return (
                  <PersonRow key={p.id} profile={p}>
                    {rel.kind === "none" && (
                      <button
                        onClick={() => follow.mutate(p.id)}
                        disabled={follow.isPending}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Segui
                      </button>
                    )}
                    {rel.kind === "requested" && (
                      <button
                        onClick={() => remove.mutate(rel.id)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground"
                      >
                        Richiesto
                      </button>
                    )}
                    {(rel.kind === "following" || rel.kind === "follower") && (
                      <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground">
                        {rel.kind === "following" ? "Segui" : "Ti segue"}
                      </span>
                    )}
                    {rel.kind === "incoming" && (
                      <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/40 px-3 text-xs font-medium text-primary">
                        Richiesta in arrivo
                      </span>
                    )}
                  </PersonRow>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Incoming pending requests */}
      {incomingPending.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-600 uppercase tracking-[0.16em] text-muted-foreground">
            Richieste ({incomingPending.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {incomingPending.map((f) => {
              const p = profileById.get(f.follower_id);
              if (!p) return null;
              return (
                <PersonRow key={f.id} profile={p}>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => respond.mutate({ id: f.id, accept: true })}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      aria-label="Accetta"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => respond.mutate({ id: f.id, accept: false })}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground"
                      aria-label="Rifiuta"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </PersonRow>
              );
            })}
          </ul>
        </section>
      )}

      {/* Outgoing pending */}
      {outgoingPending.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-600 uppercase tracking-[0.16em] text-muted-foreground">
            In attesa
          </h2>
          <ul className="flex flex-col gap-2">
            {outgoingPending.map((f) => {
              const p = profileById.get(f.followee_id);
              if (!p) return null;
              return (
                <PersonRow key={f.id} profile={p}>
                  <button
                    onClick={() => remove.mutate(f.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground"
                  >
                    Annulla
                  </button>
                </PersonRow>
              );
            })}
          </ul>
        </section>
      )}

      {/* Following */}
      <section>
        <h2 className="mb-2 text-[11px] font-600 uppercase tracking-[0.16em] text-muted-foreground">
          Segui ({accepted.length})
        </h2>
        {accepted.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Non segui ancora nessuno. Cerca qualcunə qui sopra.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {accepted.map((f) => {
              const p = profileById.get(f.followee_id);
              if (!p) return null;
              return (
                <PersonRow key={f.id} profile={p}>
                  <button
                    onClick={() => remove.mutate(f.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <UserMinus className="h-3.5 w-3.5" /> Non seguire
                  </button>
                </PersonRow>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function PersonRow({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const initials = (profile.display_name ?? profile.username)
    .slice(0, 2)
    .toUpperCase();
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-600 text-primary">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-sm font-600 leading-tight">
          {profile.display_name || profile.username}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          @{profile.username}
        </span>
      </span>
      {children}
    </li>
  );
}
