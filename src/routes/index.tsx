import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: Landing,
});

function Landing() {
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
          Agenda
        </header>

        <section className="mt-16 flex flex-1 flex-col">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Calendario · Sociale · Futuro
          </p>
          <h1 className="mt-4 font-display text-[44px] font-700 leading-[1.02] tracking-tight text-foreground">
            Il calendario
            <br />
            che <span className="italic">condividi.</span>
          </h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
            Segna i tuoi impegni e scegli, per ognuno, chi può vederli.
            Come Instagram — ma dei tuoi piani in arrivo, non delle foto di ieri.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-elevated transition-transform hover:-translate-y-0.5"
            >
              Crea il tuo profilo
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Ho già un account
            </Link>
          </div>

          <div className="mt-auto pt-16">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Principio
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                Nessuna pubblicazione silenziosa. Vedi sempre <em>chi vedrà cosa</em>{" "}
                prima di confermare.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
