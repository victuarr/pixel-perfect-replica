import { Link, useLocation, useRouteContext } from "@tanstack/react-router";
import { CalendarDays, Users, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatItalianDate } from "@/lib/date-utils";

type Props = {
  children: React.ReactNode;
  /** Optional title shown small under the username. */
  subtitle?: string;
  right?: React.ReactNode;
};

export function AppShell({ children, subtitle, right }: Props) {
  const ctx = useRouteContext({ from: "/_authenticated" });
  const userId = ctx.user.id;

  const { data: profile } = useQuery({
    queryKey: ["profile-header", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const username = profile?.username ?? "";
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 py-3">
          <Link to="/app/profilo" className="min-w-0 group">
            <p className="truncate font-display text-lg font-700 leading-tight group-hover:text-primary">
              @{username || "…"}
            </p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              {subtitle ?? formatItalianDate(new Date())}
            </p>
          </Link>
          <div className="flex items-center gap-2">
            {right}
            <Link
              to="/app/profilo"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
              aria-label="Profilo e impostazioni"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-5 pb-28 pt-5">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-md grid-cols-2">
          <TabLink to="/app" active={path === "/app"} icon={<CalendarDays className="h-5 w-5" />} label="Calendario" />
          <TabLink
            to="/app/amici"
            active={path.startsWith("/app/amici")}
            icon={<Users className="h-5 w-5" />}
            label="Amici"
          />
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to, active, icon, label,
}: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className={
        "flex flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-colors " +
        (active ? "text-foreground" : "text-muted-foreground")
      }
    >
      <span className={active ? "text-foreground" : ""}>{icon}</span>
      {label}
    </Link>
  );
}
