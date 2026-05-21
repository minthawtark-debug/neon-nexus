import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { getTelegramUser } from "@/lib/telegram";
import { Zap, Hash, ChevronDown } from "lucide-react";
import { LiveExchangeDashboard } from "@/components/LiveExchangeDashboard";

export const Route = createFileRoute("/")({ component: Index });


function Index() {
  const user = getTelegramUser();
  const [link, setLink] = useState("");
  const [linkType, setLinkType] = useState<"Channel" | "Group">("Channel");
  const [saved, setSaved] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
          {/* Link to ID Converter subtitle */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(157,0,255,0.4)]" />
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-[var(--neon-purple)]">
              Link to ID Converter
            </span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(157,0,255,0.4)]" />
          </div>

          {/* Dropdown + Input row */}
          <div className="flex gap-2">
            {/* Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-[rgba(157,0,255,0.35)] bg-[rgba(13,14,18,0.7)] px-3 text-sm font-semibold text-foreground focus:border-[var(--neon-purple)] focus:outline-none"
                style={{ boxShadow: "0 0 8px rgba(157,0,255,0.15)" }}
              >
                <span className={linkType === "Channel" ? "text-[var(--neon-cyan)]" : "text-[var(--neon-purple)]"}>
                  {linkType}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {dropdownOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-1.5 min-w-[120px] overflow-hidden rounded-lg border border-[rgba(157,0,255,0.35)] bg-[#12131a] py-1"
                  style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(157,0,255,0.25)" }}
                >
                  {(["Channel", "Group"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setLinkType(opt); setDropdownOpen(false); }}
                      className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(157,0,255,0.12)] ${linkType === opt ? (opt === "Channel" ? "text-[var(--neon-cyan)]" : "text-[var(--neon-purple)]") : "text-foreground"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Unified input */}
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Enter Telegram link or ID here..."
              className="h-10 flex-1 rounded-lg border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,240,255,0.3)]"
            />
          </div>

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
