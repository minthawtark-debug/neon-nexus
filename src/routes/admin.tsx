import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shell, PageHeader } from "@/components/Shell";
import { Users, Send, Bot, Power, Trash2, Activity, ShieldAlert, Loader2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import {
  adminGetOverview,
  adminToggleUserbot,
  adminRemoveUserbot,
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

  if (error || !session || !session.isAdmin) {
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
            <div key={b.id} className="flex items-center gap-3 rounded-lg border border-border bg-[rgba(13,14,18,0.5)] p-3 transition hover:border-[rgba(0,240,255,0.4)] animate-float-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[rgba(0,240,255,0.2)] to-[rgba(157,0,255,0.2)] font-display text-sm font-bold text-foreground">
                  {(b.username?.[0] ?? "?").toUpperCase()}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg-base)] ${b.active ? "bg-emerald-400" : "bg-zinc-600"}`} style={b.active ? { boxShadow: "0 0 6px rgb(52,211,153)" } : undefined} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-semibold text-foreground">@{b.username ?? "unknown"}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{b.phone ?? "—"} · {b.forwards24h} fwds/24h</div>
              </div>
              <button onClick={() => toggle.mutate({ id: b.id, active: !b.active })} title={b.active ? "Deactivate" : "Activate"}
                className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${b.active ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20" : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"}`}>
                <Power className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { if (confirm("Remove this userbot?")) remove.mutate(b.id); }} title="Remove"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 text-red-300 transition hover:bg-red-500/20">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
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