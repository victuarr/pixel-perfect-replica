import { Link, useLocation } from "@tanstack/react-router";
import { Home, Users, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { formatItalianDate, formatTime } from "@/lib/date-utils";

type Props = {
  children: React.ReactNode;
  /** Optional title shown small under the date. */
  subtitle?: string;
  right?: React.ReactNode;
};

export function AppShell({ children, subtitle, right }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              {formatTime(now)}
            </p>
            <p className="truncate font-display text-base font-700 leading-tight">
              {subtitle ?? formatItalianDate(now)}
            </p>
          </div>
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
          <TabLink to="/app" active={path === "/app"} icon={<Home className="h-5 w-5" />} label="Home" />
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
