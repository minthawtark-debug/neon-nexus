import { Link, useLocation } from "@tanstack/react-router";
import { Home, UserPlus, Send, Link2, ShoppingBag, Shield } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/create", label: "Create", icon: UserPlus },
  { to: "/forward", label: "Forward", icon: Send },
  { to: "/links", label: "Links", icon: Link2 },
  { to: "/store", label: "Store", icon: ShoppingBag },
  { to: "/admin", label: "Admin", icon: Shield },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-2 pt-1">
      <div className="glass-panel mx-auto flex max-w-2xl items-center justify-between rounded-2xl px-1 py-1.5"
           style={{ borderColor: "rgba(0,240,255,0.25)", boxShadow: "0 0 24px rgba(0,240,255,0.15), 0 -4px 24px rgba(0,0,0,0.6)" }}>
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className="group relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-all"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                  active
                    ? "bg-gradient-to-br from-[rgba(0,240,255,0.25)] to-[rgba(157,0,255,0.25)] text-[var(--neon-cyan)]"
                    : "text-muted-foreground group-hover:text-[var(--neon-cyan)]"
                }`}
                style={
                  active
                    ? { boxShadow: "0 0 12px rgba(0,240,255,0.6), inset 0 0 8px rgba(0,240,255,0.2)" }
                    : undefined
                }
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  active ? "neon-text-cyan" : "text-muted-foreground"
                }`}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}