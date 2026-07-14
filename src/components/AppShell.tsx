import { Link, useRouteContext } from "@tanstack/react-router";
import { Users, User as UserIcon, CalendarDays } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatItalianDate } from "@/lib/date-utils";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AmiciPanel } from "@/components/AmiciPanel";
import { amiciStore } from "@/lib/amici-store";

type Props = {
  children: React.ReactNode;
  /** Optional title shown in the header. */
  subtitle?: string;
  right?: React.ReactNode;
  /** Which bottom tab is active; also controls the header top-right icon. */
  variant?: "user" | "amici";
};

export function AppShell({ children, subtitle, right, variant = "user" }: Props) {
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

  const _username = profile?.username ?? "";
  const amiciOpen = useSyncExternalStore(
    amiciStore.subscribe,
    amiciStore.getSnapshot,
    () => false,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-700 leading-tight">
              {subtitle ?? "Laviniard"}
            </p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              {formatItalianDate(new Date())}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {right}
            <NotificationsBell userId={userId} />
            {variant === "amici" ? (
              <button
                type="button"
                onClick={() => amiciStore.open()}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
                aria-label="Feed e persone"
              >
                <Users className="h-4 w-4" />
              </button>
            ) : (
              <Link
                to="/app/profilo"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
                aria-label="Profilo e impostazioni"
              >
                <UserIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-5 pb-28 pt-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-md grid-cols-2">
          <Link
            to="/app"
            className={
              "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium " +
              (variant === "user"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-label="Il mio calendario"
          >
            <UserIcon className="h-5 w-5" />
            Utente
          </Link>
          <Link
            to="/app/amici"
            className={
              "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium " +
              (variant === "amici"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-label="Calendario degli amici"
          >
            <CalendarDays className="h-5 w-5" />
            Amici
          </Link>
        </div>
      </nav>

      <Sheet open={amiciOpen} onOpenChange={(v) => amiciStore.set(v)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-5 sm:max-w-md">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="font-display text-lg font-700">Laviniard</SheetTitle>
          </SheetHeader>
          <AmiciPanel userId={userId} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
