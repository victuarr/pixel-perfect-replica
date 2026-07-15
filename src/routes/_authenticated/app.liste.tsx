import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, ChevronRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DEFAULT_EVENT_COLOR } from "@/components/calendar/types";
import { supabaseErrorMessage } from "@/lib/error-message";

export const Route = createFileRoute("/_authenticated/app/liste")({
  component: ListePage,
});

type ListRow = {
  id: string;
  name: string;
  color: string;
  member_count: number;
};

function ListePage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_EVENT_COLOR);

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["lists-with-counts", user.id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("lists")
        .select("id, name, color")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!rows?.length) return [] as ListRow[];
      const ids = rows.map((r) => r.id);
      const { data: members, error: mErr } = await supabase
        .from("list_members")
        .select("list_id")
        .in("list_id", ids);
      if (mErr) throw mErr;
      const counts = new Map<string, number>();
      for (const m of members ?? []) {
        counts.set(m.list_id, (counts.get(m.list_id) ?? 0) + 1);
      }
      return rows.map((r) => ({ ...r, member_count: counts.get(r.id) ?? 0 })) as ListRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Manca il nome");
      const { error } = await supabase
        .from("lists")
        .insert({ owner_id: user.id, name: name.trim(), color });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lista creata");
      setName("");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["lists-with-counts", user.id] });
      qc.invalidateQueries({ queryKey: ["lists", user.id] });
    },
    onError: (e) => toast.error(supabaseErrorMessage(e)),
  });

  return (
    <AppShell subtitle="Le mie liste">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Le liste servono a scegliere chi vede un impegno. Aggiungi persone e poi seleziona la lista quando crei un evento.
        </p>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : lists.length === 0 && !creating ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Non hai ancora liste. Creane una per iniziare.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {lists.map((l) => (
              <li key={l.id}>
                <Link
                  to="/app/liste/$listId"
                  params={{ listId: l.id }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card hover:border-primary/40"
                >
                  <span className="h-10 w-10 rounded-xl" style={{ backgroundColor: l.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base font-600">{l.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.member_count} {l.member_count === 1 ? "persona" : "persone"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {creating ? (
          <form
            onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Nome (es. Amici stretti)"
              maxLength={60}
              className="h-11 rounded-xl border border-input bg-background/50 px-3 text-base outline-none focus:border-ring"
            />
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={
                    "h-10 flex-1 rounded-full text-[11px] font-medium transition " +
                    (color === c.value ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "opacity-80")
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
                <span className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: color }} />
                <span>Custom</span>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="sr-only" />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setCreating(false); setName(""); }}
                className="h-11 flex-1 rounded-full border border-border text-sm text-muted-foreground"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={create.isPending}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Crea
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:border-primary/40"
          >
            <Plus className="h-4 w-4" /> Nuova lista
          </button>
        )}
      </div>
    </AppShell>
  );
}
