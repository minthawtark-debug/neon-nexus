import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shell, PageHeader } from "@/components/Shell";
import { useSession } from "@/hooks/use-session";
import {
  checkTrialStatus,
  disconnectMyUserbots,
  getMyUserbots,
  checkUserbotSubscription,
} from "@/lib/app.functions";
import {
  LogOut,
  Loader2,
  Clock,
  AlertTriangle,
  MessageCircle,
  Zap,
  User,
  Hash,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { session, loading, error } = useSession();
  const [disconnecting, setDisconnecting] = useState(false);
  const disconnectFn = useServerFn(disconnectMyUserbots);

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
        <div className="mt-10 flex flex-col items-center text-center animate-float-up">
          <AlertTriangle className="mb-4 h-10 w-10 text-red-400" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title="Profile"
        subtitle="Account info & settings"
        accent="purple"
      />

      {/* User Info Card */}
      <div className="glass-panel mb-5 rounded-2xl p-5 animate-float-up">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            {session.profile.photo_url ? (
              <img
                src={session.profile.photo_url}
                alt=""
                className="h-16 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--neon-purple)] to-[var(--neon-cyan)] font-display text-2xl font-bold text-black">
                {(
                  session.profile.first_name?.[0] ||
                  session.profile.username?.[0] ||
                  "U"
                ).toUpperCase()}
              </div>
            )}
            <Zap className="absolute -bottom-1 -right-1 h-4 w-4 text-[var(--neon-cyan)]" />
          </div>

          <div className="flex-1">
            <div className="font-display text-lg font-bold text-foreground">
              @{session.profile.username || session.profile.first_name || "user"}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" />
              <span className="font-mono">{session.profile.telegram_id}</span>
            </div>
            {session.isAdmin && (
              <div className="mt-1 inline-block rounded border border-[var(--neon-purple)]/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--neon-purple)]">
                Admin
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trial Status */}
      <TrialStatusCard initData={session.initData} />

      {/* Userbots Status */}
      <UserbotStatusCard initData={session.initData} />

      {/* Logout Button */}
      <div className="glass-panel rounded-2xl p-4 animate-float-up" style={{ animationDelay: "180ms" }}>
        <button
          onClick={async () => {
            setDisconnecting(true);
            try {
              await disconnectFn({ data: { initData: session.initData } });
            } catch {}
            // attempt to close Telegram WebApp if available, else redirect
            try { window.Telegram?.WebApp?.close?.(); } catch {}
            setTimeout(() => { window.location.href = "/"; }, 400);
          }}
          disabled={disconnecting}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-bold uppercase tracking-widest text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
        >
          {disconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          {disconnecting ? "Logging Out..." : "Logout & Disconnect All"}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          This will disconnect all your userbots and end your session.
        </p>
      </div>
    </Shell>
  );
}

function TrialStatusCard({ initData }: { initData: string }) {
  const fetchTrial = useServerFn(checkTrialStatus);
  const { data: trial, isLoading: isLoadingTrial } = useQuery({
    queryKey: ["trial-status", initData],
    queryFn: () => fetchTrial({ data: { initData } }),
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoadingTrial) {
    return (
      <div className="glass-panel mb-5 rounded-2xl p-4 animate-float-up">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--neon-cyan)]" />
      </div>
    );
  }

    if (!trial || !trial.has_trial) {
    return (
      <div className="glass-panel mb-5 rounded-2xl p-4 animate-float-up" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <div className="flex-1">
            <h3 className="font-display text-sm font-bold neon-text-purple">No Trial Active</h3>
              <p className="text-xs text-muted-foreground">
                Free trial has expired or not yet started.
              </p>
          </div>
        </div>
        <a
          href="https://t.me/Wolf_002196"
          target="_blank"
          rel="noreferrer"
          className="btn-neon-purple mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold uppercase tracking-widest"
        >
          <MessageCircle className="h-4 w-4" />
          Contact Admin for Paid Plan
        </a>
      </div>
    );
  }

    if (trial.is_expired) {
    return (
      <div
        className="glass-panel mb-5 rounded-2xl p-4 animate-float-up border-red-500/40"
        style={{ animationDelay: "60ms", boxShadow: "0 0 16px rgba(239,68,68,0.15)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <div className="flex-1">
              <h3 className="font-display text-sm font-bold text-red-300">Free trial expired</h3>
              <p className="text-[11px] text-muted-foreground">
                Free trial expired. Please contact Admin to renew your subscription.
              </p>
          </div>
        </div>
        <a
          href="https://t.me/Wolf_002196"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/60 bg-red-500/15 py-2.5 text-xs font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/25"
        >
          <MessageCircle className="h-4 w-4" />
          Message Admin to Renew
        </a>
      </div>
    );
  }

  return (
    <div
      className="glass-panel mb-5 rounded-2xl p-4 animate-float-up border-emerald-500/30"
      style={{ animationDelay: "60ms" }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
          <Clock className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-sm font-bold text-foreground">
            Free Trial Active
          </h3>
          <p className="text-xs text-muted-foreground">
            {trial.hours_remaining.toFixed(1)} hours remaining
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-bold text-emerald-300 uppercase">
            Active
          </span>
        </div>
      </div>
    </div>
  );
}

function UserbotStatusCard({ initData }: { initData: string }) {
  const fetchBots = useServerFn(getMyUserbots as any);
  const { data, isLoading } = useQuery({ queryKey: ["my-userbots", initData], queryFn: () => fetchBots({ data: { initData } }) });

  return (
    <div className="glass-panel mb-5 rounded-2xl p-4 animate-float-up" style={{ animationDelay: "120ms" }}>
      <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-widest neon-text-cyan">
        Connected Userbots
      </h2>
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--neon-cyan)]" />
        </div>
      ) : (data?.userbots ?? []).length === 0 ? (
        <div>
          <p className="text-center text-xs text-muted-foreground">No userbots connected yet.</p>
          <a href="/create" className="btn-neon-purple mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold uppercase tracking-widest">
            <Zap className="h-4 w-4" />
            Add New Userbot
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {(data!.userbots ?? []).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <div className="font-display text-sm font-semibold">@{b.username ?? "unknown"}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{b.phone ?? "—"} · {b.active ? "Active" : "Inactive"}</div>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">{new Date(b.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ban-wave warning & tech tips */}
      <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-yellow-400">Telegram Ban-Wave Warning & Tech Tips</h4>
        <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
          <li>Rotate proxies regularly and avoid bulk-forward spikes.</li>
          <li>Keep per-bot forwarding rate under safe thresholds.</li>
          <li>Avoid forwarding promotional content to large unknown groups.</li>
        </ul>
      </div>
    </div>
  );
}
