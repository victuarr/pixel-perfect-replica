import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/amici")({
  component: AmiciPage,
});

function AmiciPage() {
  return (
    <AppShell subtitle="Amici">
      <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-3 rounded-3xl border border-dashed border-border p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </span>
        <h1 className="font-display text-lg font-700">Presto qui</h1>
        <p className="text-sm text-muted-foreground">
          Il calendario cumulativo degli amici arriva nella fase 4, insieme al
          sistema di follow.
        </p>
      </div>
    </AppShell>
  );
}
