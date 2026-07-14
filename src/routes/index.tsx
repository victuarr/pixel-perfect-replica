import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: Landing,
});

function Landing() {
  const [now, setNow] = useState(new Date());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const timeLabel = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/app" },
      });
      if (error) throw error;
      toast.success("Profilo creato! Controlla la mail per confermare.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore imprevisto";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* soft radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(231,226,240,0))",
        }}
      />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-14">
        <header className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
          </span>
          Laviniard
        </header>

        <section className="mt-10 flex flex-1 flex-col">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {dateLabel}
            </p>
            <p className="font-display text-3xl font-700 tracking-tight text-foreground">
              {timeLabel}
            </p>
          </div>

          <p className="mt-8 max-w-sm text-base leading-relaxed text-muted-foreground">
            Il calendario personale che diventa social: segna i tuoi impegni e scegli chi può vederli.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@esempio.it"
                className="h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted-foreground">Password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Almeno 8 caratteri"
                className="h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-elevated transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Crea il tuo profilo
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Hai già un account?{" "}
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Accedi
            </Link>
          </p>
        </section>

        <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Principio
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            Nessuna pubblicazione silenziosa. Vedi sempre <em>chi vedrà cosa</em>{" "}
            prima di confermare.
          </p>
        </div>
      </main>
    </div>
  );
}
