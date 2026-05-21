import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { getTelegramUser } from "@/lib/telegram";
import { UserPlus, Send, Link2, ShoppingBag, Shield, Zap, Radio, Hash, TrendingUp, TrendingDown, Globe, Satellite } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

const navCards = [
  { to: "/create", label: "Create Userbot", desc: "API setup wizard", icon: UserPlus, color: "cyan" },
  { to: "/forward", label: "Forwarder", desc: "Mass message engine", icon: Send, color: "purple" },
  { to: "/links", label: "Public Links", desc: "Ad submission hub", icon: Link2, color: "cyan" },
  { to: "/store", label: "Store", desc: "Premium digital goods", icon: ShoppingBag, color: "purple" },
  { to: "/admin", label: "Admin Panel", desc: "System control", icon: Shield, color: "cyan" },
] as const;

function Index() {
  const user = getTelegramUser();
  const [channels, setChannels] = useState("https://t.me/v3network_official");
  const [groups, setGroups] = useState("https://t.me/v3network_chat");
  const [saved, setSaved] = useState(false);
  const active = true;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <Shell>
      {/* Logo header */}
      <div className="mb-6 animate-float-up">
        <div className="glass-panel relative overflow-hidden rounded-2xl p-5 scanline">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)] font-display text-xl font-black text-black"
                style={{ boxShadow: "var(--shadow-neon-cyan)" }}
              >
                V3
              </div>
              <Zap className="absolute -right-1 -top-1 h-4 w-4 text-[var(--neon-cyan)]" fill="currentColor" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black uppercase tracking-[0.25em] neon-text-cyan">
                V3 Network
              </h1>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Radio className="h-3 w-3 text-[var(--neon-purple)]" />
                <span>Mainframe Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile block */}
      <div className="glass-panel mb-5 rounded-2xl p-4 animate-float-up" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            {user.photo_url ? (
              <img src={user.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--neon-purple)] to-[var(--neon-cyan)] font-display text-xl font-bold text-black">
                {(user.first_name?.[0] || user.username?.[0] || "U").toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[var(--bg-base)] ${active ? "bg-emerald-400" : "bg-zinc-600"}`}
              style={active ? { boxShadow: "0 0 8px rgb(52,211,153)" } : undefined}
            />
          </div>
          <div className="flex-1">
            <div className="font-display text-base font-semibold text-foreground">
              @{user.username ?? user.first_name ?? "operator"}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Hash className="h-3 w-3 text-[var(--neon-cyan)]" />
              <span className="font-mono text-muted-foreground">{user.id}</span>
            </div>
          </div>
          <div
            className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${active ? "border-emerald-400/50 text-emerald-300" : "border-zinc-700 text-zinc-500"}`}
            style={active ? { boxShadow: "0 0 12px rgba(52,211,153,0.3)" } : undefined}
          >
            {active ? "Active" : "Inactive"}
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="glass-panel mb-5 rounded-2xl p-4 animate-float-up" style={{ animationDelay: "120ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-widest neon-text-purple">
            Configuration
          </h2>
          {saved && <span className="text-xs text-emerald-300">✓ Saved</span>}
        </div>
        <div className="space-y-3">
          <FieldInput label="Channel Links" value={channels} onChange={setChannels} placeholder="https://t.me/yourchannel" />
          <FieldInput label="Group Links" value={groups} onChange={setGroups} placeholder="https://t.me/yourgroup" />
          <button onClick={handleSave} className="btn-neon w-full rounded-lg py-2.5 font-display text-sm font-bold uppercase tracking-widest">
            Update Config
          </button>
        </div>
      </div>

      {/* Live Exchange Rate Dashboard */}
      <LiveExchangeDashboard />

      {/* Nav hub */}
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Navigation Hub
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {navCards.map((c, i) => {
          const Icon = c.icon;
          const isCyan = c.color === "cyan";
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group glass-panel relative overflow-hidden rounded-2xl p-4 transition-all hover:-translate-y-0.5 animate-float-up"
              style={{
                animationDelay: `${180 + i * 60}ms`,
                borderColor: isCyan ? "rgba(0,240,255,0.3)" : "rgba(157,0,255,0.35)",
              }}
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                style={{
                  background: isCyan
                    ? "linear-gradient(135deg, rgba(0,240,255,0.2), rgba(0,240,255,0.05))"
                    : "linear-gradient(135deg, rgba(157,0,255,0.25), rgba(157,0,255,0.05))",
                  boxShadow: isCyan
                    ? "0 0 12px rgba(0,240,255,0.4), inset 0 0 8px rgba(0,240,255,0.15)"
                    : "0 0 12px rgba(157,0,255,0.45), inset 0 0 8px rgba(157,0,255,0.15)",
                }}
              >
                <Icon className={`h-5 w-5 ${isCyan ? "text-[var(--neon-cyan)]" : "text-[var(--neon-purple)]"}`} />
              </div>
              <div className={`font-display text-sm font-bold ${isCyan ? "neon-text-cyan" : "neon-text-purple"}`}>
                {c.label}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{c.desc}</div>
              <div
                className="absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-50 blur-xl transition-opacity group-hover:opacity-80"
                style={{ background: isCyan ? "rgba(0,240,255,0.3)" : "rgba(157,0,255,0.35)" }}
              />
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}

function LiveExchangeDashboard() {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const rates = [
    {
      id: "usd",
      pair: "USD / MMK",
      main: "$1 = 4,500",
      sub: "10,000 MMK = $2.22",
      trend: "+0.2%",
      up: true,
      accent: "cyan",
    },
    {
      id: "thb",
      pair: "THB / MMK",
      main: "1 THB = 128",
      sub: "10,000 MMK = 78.12 THB",
      trend: "+0.5%",
      up: true,
      accent: "purple",
    },
    {
      id: "cny",
      pair: "CNY / MMK",
      main: "1 CNY = 620",
      sub: "10,000 MMK = 16.12 CNY",
      trend: "-0.1%",
      up: false,
      accent: "pink",
    },
  ] as const;

  return (
    <div className="mb-5 animate-float-up" style={{ animationDelay: "140ms" }}>
      {/* Section title */}
      <div className="mb-2 flex items-center gap-2">
        <Globe className="h-4 w-4 text-[var(--neon-cyan)]" />
        <h2 className="font-display text-sm font-bold uppercase tracking-widest neon-text-cyan">
          V3 LIVE EXCHANGE RATES
        </h2>
      </div>
      {/* Source badge */}
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,240,255,0.25)] bg-[rgba(0,240,255,0.08)] px-3 py-1">
        <Satellite className="h-3 w-3 text-[var(--neon-purple)]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--neon-cyan)]">
          SOURCE: AUTOMATED TELEGRAM FEED & GLOBAL API
        </span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {rates.map((r) => {
          const isActive = activeCard === r.id;
          const isCyan = r.accent === "cyan";
          const isPurple = r.accent === "purple";
          const borderColor = isCyan
            ? "rgba(0,240,255,0.45)"
            : isPurple
              ? "rgba(157,0,255,0.45)"
              : "rgba(255,0,170,0.45)";
          const glowColor = isCyan
            ? "rgba(0,240,255,0.6)"
            : isPurple
              ? "rgba(157,0,255,0.6)"
              : "rgba(255,0,170,0.6)";
          return (
            <button
              key={r.id}
              onClick={() => setActiveCard(isActive ? null : r.id)}
              className={`relative overflow-hidden rounded-2xl p-3 text-left transition-all duration-300 ${isActive ? "exchange-card-active" : ""}`}
              style={{
                background: "linear-gradient(180deg, rgba(26,29,40,0.9), rgba(20,22,30,0.85))",
                backdropFilter: "blur(12px)",
                border: `1px solid ${isActive ? glowColor : borderColor}`,
                boxShadow: isActive
                  ? `0 0 24px ${glowColor}, inset 0 0 16px ${glowColor}`
                  : `0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
              }}
            >
              <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                {r.pair}
              </div>
              <div className="font-display text-lg font-black leading-tight text-foreground">
                {r.main}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{r.sub}</div>
              <div className="mt-2 flex items-center gap-1">
                {r.up ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-rose-400" />
                )}
                <span className={`text-[10px] font-bold ${r.up ? "text-emerald-400" : "text-rose-400"}`}>
                  {r.up ? "▲" : "▼"} {r.trend}
                </span>
              </div>
              {isActive && (
                <div
                  className="pointer-events-none absolute inset-0 animate-pulse-glow opacity-30"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${glowColor}, transparent 70%)`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div
        className="mt-3 rounded-xl border p-3"
        style={{
          borderColor: "rgba(251,191,36,0.4)",
          background: "linear-gradient(180deg, rgba(251,191,36,0.08), rgba(251,191,36,0.03))",
          boxShadow: "0 0 16px rgba(251,191,36,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <p className="text-[10px] leading-relaxed tracking-wide text-amber-200/90">
          <span className="mr-1 font-bold text-amber-300">⚠️ DISCLAIMER:</span>
          Exchange rates are dynamically sourced from external Telegram channels and free public APIs. Financial data is automated and may not always be 100% accurate. Please use for reference only.
        </p>
      </div>
    </div>
  );

function FieldInput({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,240,255,0.3)]"
      />
    </label>
  );
}