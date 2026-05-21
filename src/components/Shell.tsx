import { useEffect, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { initTelegram } from "@/lib/telegram";

export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    initTelegram();
  }, []);
  return (
    <div className="relative min-h-screen pb-24">
      <div className="grid-bg pointer-events-none fixed inset-0 opacity-40" />
      <main className="relative mx-auto max-w-2xl px-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}

export function PageHeader({ title, subtitle, accent = "cyan" }: { title: string; subtitle?: string; accent?: "cyan" | "purple" }) {
  return (
    <div className="mb-6 animate-float-up">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accent === "cyan" ? "bg-[var(--neon-cyan)]" : "bg-[var(--neon-purple)]"} animate-pulse-glow`} />
        <h1 className={`font-display text-2xl font-bold uppercase tracking-widest ${accent === "cyan" ? "neon-text-cyan" : "neon-text-purple"}`}>
          {title}
        </h1>
      </div>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}