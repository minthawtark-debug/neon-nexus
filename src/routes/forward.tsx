import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shell, PageHeader } from "@/components/Shell";
import { useSession } from "@/hooks/use-session";
import { Plus, X, Send, Repeat, Layers, UserCircle2, Play, AlertTriangle, Loader2, ShieldAlert, CheckCircle2, XCircle, Activity, StopCircle, RefreshCw } from "lucide-react";
import { initiateMessageForwarding, getForwardingJobStatus, cancelForwardingJob } from "@/lib/app.functions";

export const Route = createFileRoute("/forward")({ component: ForwardPage });

const SOURCE_RE = /^(@[A-Za-z0-9_]{4,32}|https?:\/\/t\.me\/[A-Za-z0-9_+\-/]{3,}|-?\d{6,})$/;
const TARGET_RE = SOURCE_RE;

function ForwardPage() {
  const { session, loading, error } = useSession();
  const qc = useQueryClient();
  
  const [source, setSource] = useState("@source_channel");
  const [targets, setTargets] = useState<string[]>(["@target_one", "@target_two"]);
  const [newTarget, setNewTarget] = useState("");
  const [batch, setBatch] = useState(true);
  const [batchSize, setBatchSize] = useState(10);
  const [infinite, setInfinite] = useState(false);
  const [keepAuthor, setKeepAuthor] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("v3.activeJob");
    }
    return null;
  });

  // Server function handlers
  const startForwardFn = useServerFn(initiateMessageForwarding);
  const cancelForwardFn = useServerFn(cancelForwardingJob);
  const checkStatusFn = useServerFn(getForwardingJobStatus);

  // Start forwarding mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("No session");
      return startForwardFn({ 
        data: { 
          initData: session.initData,
          source: source.trim(),
          targets: targets,
          batchSize: batchSize,
          infinite: infinite,
          keepAuthor: keepAuthor,
        } 
      });
    },
    onSuccess: (data) => {
      setActiveJobId(data.job_id);
      sessionStorage.setItem("v3.activeJob", data.job_id);
      qc.invalidateQueries({ queryKey: ["forward-job"] });
    },
  });

  // Cancel forwarding mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!session || !activeJobId) throw new Error("No active job");
      return cancelForwardFn({ data: { initData: session.initData, jobId: activeJobId } });
    },
    onSuccess: () => {
      setActiveJobId(null);
      sessionStorage.removeItem("v3.activeJob");
      qc.invalidateQueries({ queryKey: ["forward-job"] });
    },
  });

  // Current job status query
  const { data: jobData, isLoading: statusLoading, refetch } = useQuery({
    queryKey: ["forward-job", activeJobId],
    queryFn: async () => {
      if (!session || !activeJobId) return null;
      return checkStatusFn({ data: { initData: session.initData, jobId: activeJobId } });
    },
    enabled: !!activeJobId && !!session,
    refetchInterval: activeJobId ? 5000 : false, // Poll every 5s if job is running
  });

  const isRunning = startMutation.isPending || (!!activeJobId && jobData);
  const hasError = startMutation.isError || cancelMutation.isError;
  const errorMessage = startMutation.error?.message || cancelMutation.error?.message || "";

  const newTargetTrim = newTarget.trim();
  const newTargetValid = newTargetTrim === "" || TARGET_RE.test(newTargetTrim);
  const isDuplicate = targets.includes(newTargetTrim);

  const addTarget = () => {
    if (!newTargetTrim || !TARGET_RE.test(newTargetTrim) || isDuplicate) return;
    setTargets((t) => [...t, newTargetTrim]);
    setNewTarget("");
  };

  const sourceValid = SOURCE_RE.test(source.trim());
  const invalidTargets = useMemo(() => targets.filter((t) => !TARGET_RE.test(t)), [targets]);

  const warnings: string[] = [];
  if (!sourceValid) warnings.push("Source must be @username, t.me link, or numeric chat ID.");
  if (targets.length === 0) warnings.push("Add at least one target to forward to.");
  if (invalidTargets.length) warnings.push(`${invalidTargets.length} target(s) have invalid format.`);
  if (batch && (batchSize < 1 || batchSize > 100)) warnings.push("Batch size must be between 1 and 100.");
  if (infinite && targets.length > 50) warnings.push("Infinite loop with >50 targets greatly increases spam-ban risk.");
  const canRun = warnings.length === 0 && !isRunning;

  // Handle starting/stopping
  const handleStartStop = () => {
    if (activeJobId) {
      // Stop job
      cancelMutation.mutate();
    } else {
      // Start job
      startMutation.mutate();
    }
  };

  // Reset on unmount
  useEffect(() => {
    return () => {
      // Keep active job in storage even on unmount
    };
  }, []);

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
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-red-500/60 bg-red-500/10" style={{ boxShadow: "0 0 32px rgba(239,68,68,0.45)" }}>
            <ShieldAlert className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="font-display text-2xl font-black uppercase tracking-[0.25em] text-red-400" style={{ textShadow: "0 0 12px rgba(239,68,68,0.7)" }}>
            Access Denied
          </h1>
          <p className="mt-4 max-w-xs text-xs text-muted-foreground">
            Mini App was opened outside Telegram. Launch it from the official Telegram bot link.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader title="Forwarder" subtitle="Mass message distribution engine" accent="cyan" />

      {/* Job Status Card */}
      {activeJobId && (
        <JobStatusCard 
          jobId={activeJobId}
          jobData={jobData}
          isLoading={statusLoading}
          onRefresh={() => refetch()}
          onCancel={() => cancelMutation.mutate()}
          isCancelling={cancelMutation.isPending}
        />
      )}

      {/* Error Message */}
      {hasError && (
        <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-red-300">{errorMessage || "An error occurred"}</p>
              <button 
                onClick={() => startMutation.reset()}
                className="mt-2 text-[10px] text-red-400 underline hover:text-red-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source */}
      <Section title="Source" accent="cyan">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Channel / Group / Chat</span>
          <input 
            value={source} 
            onChange={(e) => setSource(e.target.value)} 
            placeholder="@channel or t.me/link"
            disabled={!!activeJobId}
            className={`w-full rounded-lg border bg-[rgba(13,14,18,0.7)] px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 disabled:opacity-50 ${sourceValid ? "border-[rgba(0,240,255,0.25)] focus:border-[var(--neon-cyan)] focus:ring-[rgba(0,240,255,0.3)]" : "border-red-500/50 focus:border-red-400 focus:ring-red-500/30"}`} 
          />
          {!sourceValid && (
            <p className="mt-1 text-[10px] text-red-300">Invalid format. Use @handle, t.me link, or numeric ID.</p>
          )}
        </label>
      </Section>

      {/* Targets */}
      <Section title="Targets" accent="purple">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {targets.map((t, i) => {
            const ok = TARGET_RE.test(t);
            return (
              <span key={i} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs ${ok ? "border-[rgba(157,0,255,0.4)] bg-[rgba(157,0,255,0.08)] text-[#e9c3ff]" : "border-red-500/50 bg-red-500/10 text-red-300"}`} style={ok ? { boxShadow: "0 0 8px rgba(157,0,255,0.25)" } : undefined}>
                {!ok && <AlertTriangle className="h-3 w-3" />}
                {t}
                <button 
                  onClick={() => setTargets(targets.filter((_, j) => j !== i))} 
                  disabled={!!activeJobId}
                  className="opacity-70 hover:opacity-100 disabled:opacity-30"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input 
            value={newTarget} 
            onChange={(e) => setNewTarget(e.target.value)} 
            onKeyDown={(e) => e.key === "Enter" && addTarget()} 
            placeholder="Add target ID / link"
            disabled={!!activeJobId}
            className={`flex-1 rounded-lg border bg-[rgba(13,14,18,0.7)] px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none disabled:opacity-50 ${newTargetValid ? "border-[rgba(157,0,255,0.3)] focus:border-[var(--neon-purple)]" : "border-red-500/50 focus:border-red-400"}`} 
          />
          <button 
            onClick={addTarget} 
            disabled={!newTargetTrim || !newTargetValid || isDuplicate || !!activeJobId} 
            className="btn-neon-purple flex items-center gap-1 rounded-lg px-3 text-xs font-bold uppercase disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        {newTargetTrim && !newTargetValid && (
          <p className="mt-1 text-[10px] text-red-300">Invalid target format.</p>
        )}
        {isDuplicate && (
          <p className="mt-1 text-[10px] text-orange-300">Already in target list.</p>
        )}
      </Section>

      {/* Controls */}
      <Section title="Controls" accent="cyan">
        <div className="space-y-2">
          <Toggle icon={Layers} label="Batch Splitting" desc="Split targets across runs" value={batch} onChange={setBatch} disabled={!!activeJobId} />
          {batch && (
            <div className="ml-2 flex items-center gap-2 rounded-lg border border-[rgba(0,240,255,0.2)] bg-[rgba(0,240,255,0.04)] px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Batch size</span>
              <input 
                type="number" 
                min={1} 
                max={100} 
                value={batchSize} 
                onChange={(e) => setBatchSize(Number(e.target.value))}
                disabled={!!activeJobId}
                className="w-20 rounded border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] px-2 py-1 font-mono text-xs text-foreground focus:border-[var(--neon-cyan)] focus:outline-none disabled:opacity-50" 
              />
              <span className="text-[10px] text-muted-foreground">targets / run</span>
            </div>
          )}
          <Toggle icon={Repeat} label={infinite ? "Infinite Loop" : "Loop Once & Stop"} desc="Forward behavior" value={infinite} onChange={setInfinite} disabled={!!activeJobId} />
          <Toggle icon={UserCircle2} label={keepAuthor ? "Forward with Original Author" : "Clean Forward (No Name)"} desc="Header attribution" value={keepAuthor} onChange={setKeepAuthor} disabled={!!activeJobId} />
        </div>
      </Section>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-3 space-y-1 rounded-lg border border-orange-500/40 bg-orange-500/5 p-3">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-orange-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Start/Stop Button */}
      <button
        onClick={handleStartStop}
        disabled={!canRun && !activeJobId}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-sm font-bold uppercase tracking-[0.25em] disabled:cursor-not-allowed disabled:opacity-40 ${activeJobId ? "btn-neon-purple animate-pulse-glow" : "btn-neon"}`}
      >
        {startMutation.isPending || cancelMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {activeJobId ? "Stopping…" : "Starting…"}
          </>
        ) : activeJobId ? (
          <>
            <StopCircle className="h-4 w-4" />
            Stop Forwarding
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Start Forwarding
          </>
        )}
      </button>

      {/* Success Message */}
      {startMutation.isSuccess && !activeJobId && (
        <div className="mt-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <p className="text-xs text-emerald-300">Job queued successfully!</p>
              <p className="text-[10px] text-muted-foreground mt-1">Your forwarding job has been submitted to the worker.</p>
            </div>
          </div>
        </div>
      )}

      {/* Info Footer */}
      {!activeJobId && (
        <div className="mt-3 rounded-lg border border-dashed border-[rgba(0,240,255,0.25)] bg-[rgba(0,240,255,0.04)] px-3 py-2 text-[11px] text-muted-foreground">
          ⚡ Forwarding runs on Cloudflare Workers. Check the job status panel above for live updates.
        </div>
      )}
    </Shell>
  );
}

function Section({ title, accent, children }: { title: string; accent: "cyan" | "purple"; children: React.ReactNode }) {
  return (
    <div className="glass-panel mb-4 rounded-2xl p-4 animate-float-up">
      <h2 className={`mb-3 font-display text-xs font-bold uppercase tracking-widest ${accent === "cyan" ? "neon-text-cyan" : "neon-text-purple"}`}>{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ icon: Icon, label, desc, value, onChange, disabled }: { icon: React.ComponentType<{ className?: string }>; label: string; desc: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean | null }) {
  const isDisabled = !!disabled;
  return (
    <button 
      onClick={() => !isDisabled && onChange(!value)} 
      disabled={isDisabled}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-50 ${isDisabled ? "border-border bg-[rgba(13,14,18,0.5)]" : "border-border bg-[rgba(13,14,18,0.5)] hover:border-[var(--neon-cyan)]"}`}
    >
      <Icon className={`h-4 w-4 ${value ? "text-[var(--neon-cyan)]" : "text-muted-foreground"}`} />
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <span 
        className={`relative h-5 w-9 rounded-full transition ${value ? "bg-[var(--neon-cyan)]" : "bg-zinc-700"}`} 
        style={value ? { boxShadow: "0 0 10px rgba(0,240,255,0.6)" } : undefined}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-black transition-all ${value ? "left-4" : "left-0.5"}`} />
      </span>
    </button>
  );
}

interface JobStatusCardProps {
  jobId: string;
  jobData: any;
  isLoading: boolean;
  onRefresh: () => void;
  onCancel: () => void;
  isCancelling: boolean;
}

function JobStatusCard({ jobId, jobData, isLoading, onRefresh, onCancel, isCancelling }: JobStatusCardProps) {
  const successCount = jobData?.status_breakdown?.success ?? 0;
  const failedCount = jobData?.status_breakdown?.failed ?? 0;
  const skippedCount = jobData?.status_breakdown?.skipped ?? 0;
  const totalEvents = jobData?.total_events ?? 0;
  const uniqueTargets = jobData?.unique_targets ?? 0;
  
  const createdAt = jobData?.created_at ? new Date(jobData.created_at).toLocaleTimeString() : "—";

  return (
    <div className="glass-panel mb-4 rounded-2xl p-4 animate-float-up border-emerald-500/30" style={{ boxShadow: "0 0 16px rgba(0,240,255,0.12)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          <h3 className="font-display text-xs font-bold uppercase tracking-widest neon-text-cyan">
            Job Active
          </h3>
        </div>
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[var(--neon-cyan)] transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Job ID */}
      <div className="mb-3 rounded-lg bg-[rgba(0,0,0,0.3)] px-3 py-2">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Job ID</span>
        <p className="font-mono text-[11px] text-foreground truncate">{jobId}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-emerald-500/10 p-2 text-center border border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 mx-auto mb-1 text-emerald-400" />
          <p className="font-display text-lg font-black text-emerald-300">{successCount}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Success</p>
        </div>
        <div className="rounded-lg bg-red-500/10 p-2 text-center border border-red-500/20">
          <XCircle className="h-3 w-3 mx-auto mb-1 text-red-400" />
          <p className="font-display text-lg font-black text-red-300">{failedCount}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Failed</p>
        </div>
        <div className="rounded-lg bg-zinc-500/10 p-2 text-center border border-zinc-500/20">
          <Activity className="h-3 w-3 mx-auto mb-1 text-zinc-400" />
          <p className="font-display text-lg font-black text-zinc-300">{skippedCount}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Pending</p>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{uniqueTargets} targets reached</span>
        <span>Started {createdAt}</span>
      </div>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        disabled={isCancelling}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 py-2 text-xs font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
      >
        {isCancelling ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Cancelling…
          </>
        ) : (
          <>
            <StopCircle className="h-3 w-3" />
            Cancel Job
          </>
        )}
      </button>
    </div>
  );
}
