import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, Trash2, UserPlus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";


export const Route = createFileRoute("/_authenticated/app/liste/$listId")({
  component: ListDetailPage,
});

type Member = {
  id: string;
  member_id: string;
  username: string;
  display_name: string | null;
};

function ListDetailPage() {
  const { listId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: list, isLoading } = useQuery({
    queryKey: ["list", listId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists").select("*").eq("id", listId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["list-members", listId],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("list_members")
        .select("id, member_id, profiles!list_members_member_id_fkey ( username, display_name )")
        .eq("list_id", listId);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const p = row.profiles as { username: string; display_name: string | null } | null;
        return {
          id: row.id,
          member_id: row.member_id,
          username: p?.username ?? "?",
          display_name: p?.display_name ?? null,
        };
      });
    },
  });

  const rename = useMutation({
    mutationFn: async (fields: { name?: string; color?: string }) => {
      const { error } = await supabase.from("lists").update(fields).eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list", listId] }),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lists").delete().eq("id", listId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lista eliminata");
      qc.invalidateQueries({ queryKey: ["lists-with-counts", user.id] });
      navigate({ to: "/app/liste" });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list-members", listId] }),
  });

  const addMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("list_members").insert({ list_id: listId, member_id: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aggiunto");
      qc.invalidateQueries({ queryKey: ["list-members", listId] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Errore";
      toast.error(msg.includes("duplicate") ? "Già in lista" : msg);
    },
  });

  // Search profiles by username fragment
  const { data: searchResults = [] } = useQuery({
    queryKey: ["profile-search", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const q = search.trim().toLowerCase();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .ilike("username", `${q}%`)
        .neq("id", user.id)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const memberIds = new Set(members.map((m) => m.member_id));

  if (isLoading || !list) {
    return (
      <AppShell subtitle="Lista">
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      subtitle={list.name}
      right={
        <Link
          to="/app/liste"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Rename + color */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Nome</span>
            <input
              defaultValue={list.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== list.name) rename.mutate({ name: v });
              }}
              className="h-11 rounded-xl border border-input bg-background/50 px-3 text-base outline-none focus:border-ring"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Colore</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => rename.mutate({ color: c.value })}
                  className={
                    "h-10 flex-1 rounded-full text-[11px] font-medium transition " +
                    (list.color === c.value ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "opacity-80")
                  }
                  style={{ backgroundColor: c.value + "22", color: c.value }}
                >
                  {c.label}
                </button>
              ))}
              <label
                className="flex h-10 min-w-[80px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background/60 px-3 text-[11px] font-medium text-muted-foreground"
                title="Colore personalizzato"
              >
                <span className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: list.color }} />
                <span>Custom</span>
                <input
                  type="color"
                  value={list.color}
                  onChange={(e) => rename.mutate({ color: e.target.value })}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-700">Persone</h2>
            <span className="text-xs text-muted-foreground">{members.length}</span>
          </div>

          <ul className="flex flex-col gap-1.5">
            {members.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Nessuno ancora. Cerca qualcuno per username qui sotto.
              </li>
            )}
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-xl bg-background/60 p-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {(m.display_name ?? m.username).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.display_name ?? m.username}</p>
                  <p className="truncate text-xs text-muted-foreground">@{m.username}</p>
                </div>
                <button
                  onClick={() => removeMember.mutate(m.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Rimuovi"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 rounded-xl border border-input bg-background/50 px-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value.toLowerCase())}
              placeholder="Cerca per @username"
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {search.trim().length >= 2 && (
            <ul className="flex flex-col gap-1">
              {searchResults.length === 0 && (
                <li className="rounded-lg p-2 text-xs text-muted-foreground">Nessuno con questo username.</li>
              )}
              {searchResults.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-accent/60">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {(p.display_name ?? p.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{p.display_name ?? p.username}</p>
                    <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                  </div>
                  <button
                    onClick={() => addMember.mutate(p.id)}
                    disabled={memberIds.has(p.id) || addMember.isPending}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {memberIds.has(p.id) ? "Già in lista" : "Aggiungi"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => {
            if (confirm(`Eliminare la lista "${list.name}"? Gli eventi condivisi con essa resteranno visibili solo a te.`)) del.mutate();
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-destructive/40 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" /> Elimina lista
        </button>
      </div>
    </AppShell>
  );
}
