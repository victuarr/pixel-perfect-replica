import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, LogOut, User as UserIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/app/profilo")({
  component: ProfiloPage,
});

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  profile_privacy: "open" | "approval";
  presentation_view: "future" | "past";
};

function ProfiloPage() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell
      subtitle="Il mio profilo"
      right={
        <button
          onClick={handleSignOut}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Esci
        </button>
      }
    >
      {isLoading || !profile ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ProfileEditor profile={profile} email={user.email ?? ""} />
      )}
    </AppShell>
  );
}

function ProfileEditor({ profile, email }: { profile: Profile; email: string }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [privacy, setPrivacy] = useState(profile.profile_privacy);
  const [presentation, setPresentation] = useState(profile.presentation_view);

  useEffect(() => {
    setUsername(profile.username);
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setPrivacy(profile.profile_privacy);
    setPresentation(profile.presentation_view);
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        throw new Error("Username: 3-30 caratteri, minuscole, numeri o underscore.");
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          profile_privacy: privacy,
          presentation_view: presentation,
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profilo aggiornato");
      qc.invalidateQueries({ queryKey: ["profile", profile.id] });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Errore";
      toast.error(msg.includes("duplicate") ? "Username già in uso" : msg);
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <UserIcon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-700 leading-tight">
            {displayName || username}
          </p>
          <p className="truncate text-sm text-muted-foreground">@{username}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{email}</p>
        </div>
      </div>

      <Link
        to="/app/liste"
        className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card hover:border-primary/40"
      >
        <span>
          <span className="block font-display text-base font-600">Le mie liste</span>
          <span className="text-xs text-muted-foreground">Gestisci chi vede cosa</span>
        </span>
        <span className="text-muted-foreground">→</span>
      </Link>


      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <Field label="Username" hint="minuscole, numeri, underscore">
          <div className="flex items-center rounded-xl border border-input bg-background/50 focus-within:border-ring">
            <span className="pl-3 text-muted-foreground">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="h-11 flex-1 bg-transparent px-2 text-base outline-none"
              maxLength={30}
              required
            />
          </div>
        </Field>

        <Field label="Nome visualizzato">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Come vuoi essere chiamatə"
            className="h-11 rounded-xl border border-input bg-background/50 px-3 text-base outline-none focus:border-ring"
            maxLength={60}
          />
        </Field>

        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Una riga su di te (opzionale)"
            rows={3}
            maxLength={200}
            className="rounded-xl border border-input bg-background/50 px-3 py-2.5 text-base outline-none focus:border-ring"
          />
        </Field>

        <Field label="Chi può seguirti" hint="Aperto = seguono subito · Approvazione = richieste da accettare">
          <Segmented
            value={privacy}
            onChange={(v) => setPrivacy(v as "open" | "approval")}
            options={[
              { value: "open", label: "Aperto" },
              { value: "approval", label: "Su approvazione" },
            ]}
          />
        </Field>

        <Field label="Vista di presentazione" hint="Come si apre il tuo profilo agli altri">
          <Segmented
            value={presentation}
            onChange={(v) => setPresentation(v as "future" | "past")}
            options={[
              { value: "future", label: "Futuro" },
              { value: "past", label: "Passato" },
            ]}
          />
        </Field>

        <button
          type="submit"
          disabled={save.isPending}
          className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salva profilo
        </button>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="grid grid-cols-2 rounded-full border border-border bg-background/50 p-1 text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={
            "h-9 rounded-full font-medium transition-colors " +
            (value === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
