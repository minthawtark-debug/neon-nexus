import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shell, PageHeader } from "@/components/Shell";
import { Users, Send, Bot, Power, Trash2, Activity, ShieldAlert, Loader2, Radio, RefreshCw, CheckCircle2, Radar, Skull, Calendar, Clock, Edit3 } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/hooks/use-session";
import { InitDataErrorScreen } from "./index";
import {
  adminGetOverview,
  adminToggleUserbot,
  adminRemoveUserbot,
  adminExtendUserbot,
  adminGetProxyOverview,
  adminForceSyncProxies,
} from "@/lib/app.functions";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { session, loading, error } = useSession();

  if (loading) {
    return (
      <Shell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--neon-cyan)]" />
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <InitDataErrorScreen error={error} />
      </Shell>
    );
  }

  if (!session || !session.isAdmin) {
    return (
      <Shell>
        <div className="mt-10 flex flex-col items-center text-center animate-float-up">
          <div
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-red-500/60 bg-red-500/10"
            style={{ boxShadow: "0 0 32px rgba(239,68,68,0.45)" }}
          >
            <ShieldAlert className="h-10 w-10 text-red-400" />
          </div>
          <h1
            className="font-display text-3xl font-black uppercase tracking-[0.25em] text-red-400"
            style={{ textShadow: "0 0 12px rgba(239,68,68,0.7)" }}
          >
            Access Denied
          </h1>
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-widest neon-text-purple">
            Admin Only
          </p>
          <p className="mt-4 max-w-xs text-xs text-muted-foreground">
            This control surface is restricted to the network operator. Your Telegram identity does not match the authorized admin signature.
          </p>
        </div>
      </Shell>
    );
  }

  return <AdminPanel initData={session.initData} />;
}

function AdminPanel({ initData }: { initData: string }) {
  const fetchOverview = useServerFn(adminGetOverview);
  const toggleFn = useServerFn(adminToggleUserbot);
  const removeFn = useServerFn(adminRemoveUserbot);
  const extendFn = useServerFn(adminExtendUserbot);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview", initData],
    queryFn: () => fetchOverview({ data: { initData } }),
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      toggleFn({ data: { initData, ...vars } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { initData, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-overview"] }),
  });

  const bots = data?.userbots ?? [];

  return (
    <Shell>
      <PageHeader title="Admin Panel" subtitle="System control & monitoring" accent="purple" />

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        <StatCard icon={Users} label="Total Users" value={(data?.totalUsers ?? 0).toLocaleString()} color="cyan" />
        <StatCard icon={Send} label="Active Fwds" value={data?.activeForwards ?? 0} color="purple" />
        <StatCard icon={Bot} label="Userbots" value={data?.activeBots ?? 0} color="cyan" />
      </div>

      {/* Bot list */}
      <div className="glass-panel rounded-2xl p-4 animate-float-up">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xs font-bold uppercase tracking-widest neon-text-cyan">Userbot Management</h2>
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3 w-3 text-emerald-400" /> Live
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--neon-cyan)]" />
          </div>
        ) : bots.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No userbots connected yet.</p>
        ) : (
          <div className="space-y-2">
            {bots.map((b, i) => (
            <SubscriptionManagementRow 
              key={b.id} 
              bot={b} 
              i={i}
              onToggle={() => toggle.mutate({ id: b.id, active: !b.active })}
              onRemove={() => { if (confirm("Remove this userbot?")) remove.mutate(b.id); }}
              onExtend={(days, hours, expiryDate) => extendFn({ data: { initData, userbot_id: b.id, days_to_add: days, hours_to_add: hours, expiry_date: expiryDate } })}
              isToggling={toggle.isPending}
              isRemoving={remove.isPending}
            />
            ))}
          </div>
        )}
      </div>

      <ProxyMainframe initData={initData} />
    </Shell>
  );
}

function SubscriptionManagementRow({
  bot,
  i,
  onToggle,
  onRemove,
  onExtend,
  isToggling,
  isRemoving,
}: {
  bot: any;
  i: number;
  onToggle: () => void;
  onRemove: () => void;
  onExtend: (days?: number, hours?: number, expiryDate?: string) => void;
  isToggling: boolean;
  isRemoving: boolean;
}) {
  const [expandedBotId, setExpandedBotId] = useState<string | null>(null);
  const [daysToAdd, setDaysToAdd] = useState("0");
  const [hoursToAdd, setHoursToAdd] = useState("0");
  const [expiryDate, setExpiryDate] = useState("");

  const isExpanded = expandedBotId === bot.id;

  return (
    <div key={bot.id} className="rounded-lg border border-border bg-[rgba(13,14,18,0.5)] animate-float-up" style={{ animationDelay: `${i * 40}ms` }}>
      <div className="flex items-center gap-3 p-3 transition hover:border-[rgba(0,240,255,0.4)]">
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[rgba(0,240,255,0.2)] to-[rgba(157,0,255,0.2)] font-display text-sm font-bold text-foreground">
            {(bot.username?.[0] ?? "?").toUpperCase()}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-base)] ${bot.active ? "bg-emerald-400" : "bg-zinc-600"}`} style={bot.active ? { boxShadow: "0 0 6px rgb(52,211,153)" } : undefined} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold text-foreground">@{bot.username ?? "unknown"}</div>
          <div className="font-mono text-[10px] text-muted-foreground">{bot.phone ?? "—"} · {bot.forwards24h} fwds/24h</div>
        </div>
        <button 
          onClick={() => onToggle()} 
          disabled={isToggling}
          title={bot.active ? "Deactivate" : "Activate"}
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${bot.active ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20" : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"}`}
        >
          <Power className="h-3.5 w-3.5" />
        </button>
        <button 
          onClick={() => setExpandedBotId(isExpanded ? null : bot.id)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--neon-purple)]/40 bg-[rgba(157,0,255,0.1)] text-[var(--neon-purple)] hover:bg-[rgba(157,0,255,0.15)]"
        >
          <Edit3 className="h-3.5 w-3.5" />
        </button>
        <button 
          onClick={() => onRemove()} 
          disabled={isRemoving}
          title="Remove"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Subscription extension UI */}
      {isExpanded && (
        <div className="border-t border-border bg-[rgba(0,0,0,0.3)] p-3 space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--neon-purple)] mb-2">
            Extend Subscription
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Days</label>
              <input 
                type="number" 
                min="0" 
                value={daysToAdd} 
                onChange={(e) => setDaysToAdd(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] px-2 py-1.5 font-mono text-xs text-foreground focus:border-[var(--neon-cyan)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Hours</label>
              <input 
                type="number" 
                min="0" 
                value={hoursToAdd} 
                onChange={(e) => setHoursToAdd(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] px-2 py-1.5 font-mono text-xs text-foreground focus:border-[var(--neon-cyan)] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Or Set Expiry Date</label>
            <input 
              type="datetime-local"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full rounded border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] px-2 py-1.5 font-mono text-xs text-foreground focus:border-[var(--neon-cyan)] focus:outline-none"
            />
          </div>
          <button
            onClick={() => {
              const days = parseInt(daysToAdd) || undefined;
              const hours = parseInt(hoursToAdd) || undefined;
              const date = expiryDate ? new Date(expiryDate).toISOString() : undefined;
              onExtend(days, hours, date);
              setDaysToAdd("0");
              setHoursToAdd("0");
              setExpiryDate("");
              setExpandedBotId(null);
            }}
            className="btn-neon-purple w-full rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <Calendar className="h-3 w-3 inline mr-1" />
            Update Duration
          </button>
        </div>
      )}
    </div>
  );
}

function ProxyMainframe({ initData }: { initData: string }) {
  const fetchOverview = useServerFn(adminGetProxyOverview);
  const syncFn = useServerFn(adminForceSyncProxies);
  const qc = useQueryClient();
  const [pulseOk, setPulseOk] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["proxy-overview", initData],
    queryFn: () => fetchOverview({ data: { initData } }),
    refetchInterval: 15_000,
  });

  const sync = useMutation({
    mutationFn: () => syncFn({ data: { initData } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proxy-overview"] });
      setPulseOk(true);
      setTimeout(() => setPulseOk(false), 2200);
    },
  });

  return (
    <section className="mt-6 animate-float-up">
      <div className="mb-3 flex items-center gap-2">
        <Radio className="h-4 w-4 text-[var(--neon-cyan)]" />
        <h2
          className="font-display text-sm font-black uppercase tracking-[0.3em] neon-text-cyan"
          style={{ textShadow: "0 0 10px rgba(0,240,255,0.6)" }}
        >
          📡 Proxy Mainframe
        </h2>
      </div>

      {/* Source card */}
      <div
        className="glass-panel relative overflow-hidden rounded-2xl p-4"
        style={{
          borderColor: "rgba(0,240,255,0.45)",
          boxShadow: "0 0 24px rgba(0,240,255,0.18), inset 0 0 18px rgba(0,240,255,0.06)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Source Channel
            </div>
            <a
              href={data?.sourceChannel ?? "https://t.me/V_Usproxy1"}
              target="_blank"
              rel="noreferrer"
              className="block truncate font-mono text-sm font-bold neon-text-cyan"
              style={{ textShadow: "0 0 8px rgba(0,240,255,0.85)" }}
            >
              {data?.sourceChannel ?? "https://t.me/V_Usproxy1"}
            </a>
          </div>
          <span className="flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgb(52,211,153)" }} />
            Live Link
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ProxyStat icon={Radar} label="Ingested" value={data?.total ?? 0} color="cyan" />
        <ProxyStat icon={CheckCircle2} label="Live" value={data?.active ?? 0} color="emerald" />
        <ProxyStat icon={Skull} label="Dead" value={data?.dead ?? 0} color="red" />
      </div>

      {/* Force sync */}
      <button
        onClick={() => sync.mutate()}
        disabled={sync.isPending}
        className={`group relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border-2 px-4 py-3 font-display text-xs font-black uppercase tracking-[0.3em] transition ${
          pulseOk
            ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
            : sync.isPending
              ? "border-[var(--neon-cyan)] bg-[rgba(0,240,255,0.1)] text-[var(--neon-cyan)]"
              : "border-[var(--neon-cyan)]/60 bg-[rgba(0,240,255,0.06)] text-[var(--neon-cyan)] hover:bg-[rgba(0,240,255,0.14)]"
        }`}
        style={{
          boxShadow: pulseOk
            ? "0 0 32px rgba(52,211,153,0.6), inset 0 0 18px rgba(52,211,153,0.25)"
            : sync.isPending
              ? "0 0 28px rgba(0,240,255,0.55)"
              : "0 0 14px rgba(0,240,255,0.25)",
        }}
      >
        {sync.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="animate-pulse">Syncing Mainframe…</span>
          </>
        ) : pulseOk ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <span>Sync Complete · +{sync.data?.ingested ?? 0}</span>
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            <span>🔄 Force Sync Now</span>
          </>
        )}
      </button>

      {/* Recent feed */}
      <div className="mt-4 glass-panel rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Recent Ingestion
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Auto-refresh 15s
          </span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--neon-cyan)]" />
          </div>
        ) : (data?.recent ?? []).length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No proxies ingested yet. Press Force Sync to bootstrap the pool.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data!.recent.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-border bg-[rgba(13,14,18,0.5)] px-2 py-1.5 font-mono text-[11px]"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${p.is_active ? "bg-emerald-400" : "bg-red-500"}`}
                  style={{ boxShadow: p.is_active ? "0 0 6px rgb(52,211,153)" : "0 0 6px rgb(239,68,68)" }}
                />
                <span className="flex-1 truncate text-foreground">
                  {p.ip}:{p.port}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {p.last_tested_at ? new Date(p.last_tested_at).toLocaleTimeString() : "untested"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ProxyStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: "cyan" | "emerald" | "red";
}) {
  const palette = {
    cyan: { border: "rgba(0,240,255,0.35)", text: "text-[var(--neon-cyan)]", glow: "neon-text-cyan" },
    emerald: { border: "rgba(52,211,153,0.45)", text: "text-emerald-300", glow: "text-emerald-300" },
    red: { border: "rgba(239,68,68,0.45)", text: "text-red-400", glow: "text-red-400" },
  }[color];
  return (
    <div
      className="glass-panel relative overflow-hidden rounded-xl p-3"
      style={{ borderColor: palette.border }}
    >
      <Icon className={`mb-1 h-4 w-4 ${palette.text}`} />
      <div className={`font-display text-xl font-black ${palette.glow}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; color: "cyan" | "purple" }) {
  const isCyan = color === "cyan";
  return (
    <div className="glass-panel relative overflow-hidden rounded-xl p-3 animate-float-up" style={{ borderColor: isCyan ? "rgba(0,240,255,0.3)" : "rgba(157,0,255,0.35)" }}>
      <Icon className={`mb-1 h-4 w-4 ${isCyan ? "text-[var(--neon-cyan)]" : "text-[var(--neon-purple)]"}`} />
      <div className={`font-display text-xl font-black ${isCyan ? "neon-text-cyan" : "neon-text-purple"}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}