import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shell } from "@/components/Shell";
import { useSession } from "@/hooks/use-session";
import {
  getForwardAnalytics,
  disconnectMyUserbots,
  resolveTelegramPeerId,
} from "@/lib/app.functions";
import { Zap, Hash, ChevronDown, Activity, Target, Gauge, LogOut, Loader2, ShieldAlert, RefreshCw, Copy, Check } from "lucide-react";
import { LiveExchangeDashboard } from "@/components/LiveExchangeDashboard";

export const Route = createFileRoute("/")({ component: Index });


function Index() {
  const { session, loading, error } = useSession();
  const [link, setLink] = useState("");
  const [linkType, setLinkType] = useState<"Channel" | "Group">("Channel");
  const [saved, setSaved] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [converterInput, setConverterInput] = useState("");
  const [converterResult, setConverterResult] = useState<string | null>(null);
  const [converterNote, setConverterNote] = useState<string>("");
  const [converterLoading, setConverterLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const resolveFn = useServerFn(resolveTelegramPeerId);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--neon-cyan)]" />
        </div>
      </Shell>
    );
  }

  if (error || !session) {
    return (
      <Shell>
        <InitDataErrorScreen error={error} />
      </Shell>
    );
  }

  const { profile, isAdmin, initData } = session;
  const active = true;

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
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--neon-purple)] to-[var(--neon-cyan)] font-display text-xl font-bold text-black">
                {(profile.first_name?.[0] || profile.username?.[0] || "U").toUpperCase()}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[var(--bg-base)] ${active ? "bg-emerald-400" : "bg-zinc-600"}`}
              style={active ? { boxShadow: "0 0 8px rgb(52,211,153)" } : undefined}
            />
          </div>
          <div className="flex-1">
            <div className="font-display text-base font-semibold text-foreground">
              @{profile.username ?? profile.first_name ?? "operator"}
              {isAdmin && (
                <span className="ml-2 rounded border border-[var(--neon-purple)]/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--neon-purple)]">
                  Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Hash className="h-3 w-3 text-[var(--neon-cyan)]" />
              <span className="font-mono text-muted-foreground">{profile.telegram_id}</span>
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

      {/* Analytics */}
      <AnalyticsPanel initData={initData} />

      {/* Configuration */}
      <TelegramIdConverterCard
        input={converterInput}
        onInput={(value) => { setConverterInput(value); setCopied(false); }}
        result={converterResult}
        note={converterNote}
        isLoading={converterLoading}
        onResolve={async () => {
          setConverterLoading(true);
          try {
            const response = await resolveFn({ data: { link: converterInput } });
            setConverterResult(response.result);
            setConverterNote(response.note ?? "");
          } catch (err) {
            setConverterResult(null);
            setConverterNote("Failed to resolve link. Please try again.");
          } finally {
            setConverterLoading(false);
          }
        }}
        onCopy={async () => {
          if (!converterResult) return;
          try {
            await navigator.clipboard.writeText(converterResult);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
      />
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

    </Shell>
  );
}

function AnalyticsPanel({ initData }: { initData: string }) {
  const fetchAnalytics = useServerFn(getForwardAnalytics);
  const disconnect = useServerFn(disconnectMyUserbots);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", initData],
    queryFn: () => fetchAnalytics({ data: { initData } }),
  });

  const mutation = useMutation({
    mutationFn: () => disconnect({ data: { initData } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics"] }),
  });

  const health = data?.health ?? { level: "healthy" as const, label: "HEALTHY (Low Spam Risk)" };
  const healthColor =
    health.level === "danger"
      ? "from-red-500 to-orange-500 text-red-300 border-red-500/50"
      : health.level === "warn"
        ? "from-orange-500 to-yellow-500 text-orange-300 border-orange-500/50"
        : "from-emerald-500 to-[var(--neon-cyan)] text-emerald-300 border-emerald-500/50";
  const healthWidth =
    health.level === "danger" ? "100%" : health.level === "warn" ? "65%" : "25%";

  return (
    <div className="glass-panel mb-5 rounded-2xl p-4 animate-float-up" style={{ animationDelay: "90ms" }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest neon-text-cyan">
          Userbot Stats
        </h2>
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Activity className="h-3 w-3 text-emerald-400" /> Live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatTile icon={Target} label="Targets Today" value={isLoading ? "—" : String(data?.dailyTargetsReached ?? 0)} accent="cyan" />
        <StatTile icon={Gauge} label="Fwd / Day" value={isLoading ? "—" : String(data?.forwardsPerDay ?? 0)} accent="purple" />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest">
          <span className="text-muted-foreground">Account Health</span>
          <span className={`font-bold ${health.level === "danger" ? "text-red-300" : health.level === "warn" ? "text-orange-300" : "text-emerald-300"}`}>
            {health.label}
          </span>
        </div>
        <div className={`relative h-2 overflow-hidden rounded-full border bg-[rgba(13,14,18,0.7)] ${healthColor.split(" ").slice(-1)}`}>
          <div
            className={`h-full bg-gradient-to-r ${healthColor.split(" ").slice(0, 2).join(" ")} transition-all duration-500`}
            style={{ width: healthWidth, boxShadow: "0 0 12px currentColor" }}
          />
        </div>
      </div>

      <button
        onClick={() => {
          if (confirm("Disconnect all your userbots? This logs them out on your physical device as well.")) {
            mutation.mutate();
          }
        }}
        disabled={mutation.isPending}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 py-2 font-display text-xs font-bold uppercase tracking-widest text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        {mutation.isPending ? "Disconnecting…" : mutation.isSuccess ? `Terminated ${mutation.data?.terminated ?? 0}` : "Disconnect / Logout Userbot"}
      </button>
    </div>
  );
}

function TelegramIdConverterCard({
  input,
  onInput,
  result,
  note,
  isLoading,
  onResolve,
  onCopy,
}: {
  input: string;
  onInput: (value: string) => void;
  result: string | null;
  note: string;
  isLoading: boolean;
  onResolve: () => Promise<void>;
  onCopy: () => Promise<void>;
}) {
  return (
    <div className="glass-panel mb-5 rounded-2xl p-5 animate-float-up" style={{ animationDelay: "105ms" }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-widest neon-text-cyan">
            Telegram ID Converter Dashboard
          </p>
          <p className="text-[11px] text-muted-foreground">
            Paste a public channel/group link or numeric ID and convert it into a Telegram peer ID.
          </p>
        </div>
        <div className="rounded-full bg-[rgba(0,240,255,0.08)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--neon-cyan)]">
          Mini Tool
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Telegram Channel / Group Link
        </label>
        <input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="https://t.me/channel_username or @channel_username"
          className="w-full rounded-2xl border border-[rgba(0,240,255,0.2)] bg-[rgba(13,14,18,0.75)] px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,240,255,0.18)]"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={onResolve}
            disabled={isLoading || input.trim().length === 0}
            className="btn-neon flex-1 items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-widest disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convert to ID"}
          </button>
          <button
            onClick={onCopy}
            disabled={!result}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[rgba(0,240,255,0.2)] bg-[rgba(0,240,255,0.08)] px-4 py-3 text-sm font-semibold uppercase tracking-widest text-[var(--neon-cyan)] transition hover:border-[var(--neon-cyan)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy className="h-4 w-4" />
            {result ? "Copy" : "No result"}
          </button>
        </div>

        <div className="rounded-2xl border border-[rgba(0,240,255,0.15)] bg-[rgba(0,240,255,0.05)] p-4">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Result</span>
            <span className="text-[11px] text-[var(--neon-cyan)]">{result ? "Ready" : "Waiting"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(0,240,255,0.12)] bg-[#0f1118] px-4 py-3 text-sm font-mono text-foreground">
            <span className="truncate">{result ?? "No ID converted yet"}</span>
            {result && (
              <button
                onClick={onCopy}
                className="flex items-center gap-1 rounded-full bg-[rgba(0,240,255,0.12)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--neon-cyan)]"
              >
                <Check className="h-3.5 w-3.5" />
                {"Copy"}
              </button>
            )}
          </div>
          {note ? <p className="mt-2 text-[11px] text-muted-foreground">{note}</p> : null}
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: "cyan" | "purple" }) {
  const isCyan = accent === "cyan";
  return (
    <div
      className="glass-panel rounded-xl p-3"
      style={{ borderColor: isCyan ? "rgba(0,240,255,0.3)" : "rgba(157,0,255,0.35)" }}
    >
      <Icon className={`mb-1 h-4 w-4 ${isCyan ? "text-[var(--neon-cyan)]" : "text-[var(--neon-purple)]"}`} />
      <div className={`font-display text-xl font-black ${isCyan ? "neon-text-cyan" : "neon-text-purple"}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

export function InitDataErrorScreen({ error }: { error: string | null }) {
  const reason =
    error === "No Telegram session"
      ? "Mini App was opened outside Telegram. Launch it from the official Telegram bot link."
      : error?.includes("Invalid Telegram signature")
        ? "Telegram signature check failed. Your session may be tampered with or expired."
        : error?.includes("TELEGRAM_BOT_TOKEN")
          ? "Server is missing TELEGRAM_BOT_TOKEN. Contact the operator."
          : "Unable to verify your Telegram session.";
  return (
    <div className="mt-10 flex flex-col items-center text-center animate-float-up">
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-red-500/60 bg-red-500/10"
        style={{ boxShadow: "0 0 32px rgba(239,68,68,0.45)" }}
      >
        <ShieldAlert className="h-10 w-10 text-red-400" />
      </div>
      <h1
        className="font-display text-2xl font-black uppercase tracking-[0.25em] text-red-400"
        style={{ textShadow: "0 0 12px rgba(239,68,68,0.7)" }}
      >
        Verification Failed
      </h1>
      <p className="mt-3 max-w-xs text-xs text-muted-foreground">{reason}</p>
      {error && (
        <code className="mt-3 block rounded border border-red-500/30 bg-red-500/5 px-2 py-1 font-mono text-[10px] text-red-300">
          {error}
        </code>
      )}
      <button
        onClick={() => window.location.reload()}
        className="btn-neon mt-5 flex items-center gap-2 rounded-lg px-5 py-2 font-display text-xs font-bold uppercase tracking-widest"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry Verification
      </button>
    </div>
  );
}