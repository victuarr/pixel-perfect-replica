import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: AuthPage,
});

type Method = "password" | "magic";

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const title = mode === "signup" ? "Crea il tuo profilo" : "Bentornatə su Laviniard";
  const subtitle =
    mode === "signup"
      ? "Bastano un'email e una password. Il tuo username lo scegli dopo."
      : "Accedi per aprire il tuo calendario.";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (method === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        setMagicSent(true);
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
        toast.success("Profilo creato! Controlla la mail per confermare.");
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate({ to: "/app" });
      }
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
          <div className="mt-8">
            <h1 className="font-display text-3xl font-700 leading-tight tracking-tight">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {magicSent ? (
            <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center shadow-card">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Mail className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-display text-lg font-600">Controlla la mail</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ti abbiamo mandato un link per accedere a{" "}
                <span className="text-foreground">{email}</span>.
              </p>
              <button
                onClick={() => {
                  setMagicSent(false);
                  setMethod("password");
                }}
                className="mt-6 text-sm font-medium text-foreground underline underline-offset-4"
              >
                Usa la password
              </button>
            </div>
          ) : (
            <>
              {/* Method segmented control */}
              <div className="mt-8 grid grid-cols-2 rounded-full border border-border bg-card p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setMethod("password")}
                  className={
                    "h-9 rounded-full font-medium transition-colors " +
                    (method === "password"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("magic")}
                  className={
                    "h-9 rounded-full font-medium transition-colors " +
                    (method === "magic"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  Link magico
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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

                {method === "password" && (
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-muted-foreground">Password</span>
                    <input
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Almeno 8 caratteri"
                      className="h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                    />
                  </label>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-elevated transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {method === "magic"
                    ? "Mandami il link"
                    : mode === "signup"
                      ? "Crea profilo"
                      : "Accedi"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signup" ? "Hai già un account?" : "Non hai un account?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {mode === "signup" ? "Accedi" : "Registrati"}
                </button>
              </p>
            </>
          )}
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
