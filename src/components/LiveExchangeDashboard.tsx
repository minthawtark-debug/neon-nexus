import { useState } from "react";
import { TrendingUp, TrendingDown, Globe, Satellite } from "lucide-react";

export function LiveExchangeDashboard() {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const rates = [
    { id: "usd", pair: "USD / MMK", main: "$1 = 4,500", sub: "10,000 MMK = $2.22", trend: "+0.2%", up: true, accent: "cyan" },
    { id: "thb", pair: "THB / MMK", main: "1 THB = 128", sub: "10,000 MMK = 78.12 THB", trend: "+0.5%", up: true, accent: "purple" },
    { id: "cny", pair: "CNY / MMK", main: "1 CNY = 620", sub: "10,000 MMK = 16.12 CNY", trend: "-0.1%", up: false, accent: "pink" },
  ] as const;

  return (
    <div className="mb-5 animate-float-up" style={{ animationDelay: "140ms" }}>
      <div className="mb-2 flex items-center gap-2">
        <Globe className="h-4 w-4 text-[var(--neon-cyan)]" />
        <h2 className="font-display text-sm font-bold uppercase tracking-widest neon-text-cyan">
          V3 LIVE EXCHANGE RATES
        </h2>
      </div>
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,240,255,0.25)] bg-[rgba(0,240,255,0.08)] px-3 py-1">
        <Satellite className="h-3 w-3 text-[var(--neon-purple)]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--neon-cyan)]">
          SOURCE: AUTOMATED TELEGRAM FEED & GLOBAL API
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {rates.map((r) => {
          const isActive = activeCard === r.id;
          const isCyan = r.accent === "cyan";
          const isPurple = r.accent === "purple";
          const borderColor = isCyan ? "rgba(0,240,255,0.45)" : isPurple ? "rgba(157,0,255,0.45)" : "rgba(255,0,170,0.45)";
          const glowColor = isCyan ? "rgba(0,240,255,0.6)" : isPurple ? "rgba(157,0,255,0.6)" : "rgba(255,0,170,0.6)";
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
              <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{r.pair}</div>
              <div className="font-display text-lg font-black leading-tight text-foreground">{r.main}</div>
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
                  style={{ background: `radial-gradient(circle at 50% 50%, ${glowColor}, transparent 70%)` }}
                />
              )}
            </button>
          );
        })}
      </div>

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
}

export function FieldInput({
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