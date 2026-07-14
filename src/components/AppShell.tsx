import { Link, useRouteContext } from "@tanstack/react-router";
import { Users, User as UserIcon } from "lucide-react";
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
            <button
              type="button"
              onClick={() => amiciStore.open()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
              aria-label="Amici"
            >
              <Users className="h-4 w-4" />
            </button>
            <Link
              to="/app/profilo"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
              aria-label="Profilo e impostazioni"
            >
              <UserIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-5 pb-10 pt-5">{children}</main>

      <Sheet open={amiciOpen} onOpenChange={(v) => amiciStore.set(v)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-5 sm:max-w-md">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="font-display text-lg font-700">Amici</SheetTitle>
          </SheetHeader>
          <AmiciPanel userId={userId} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
