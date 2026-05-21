import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell, PageHeader } from "@/components/Shell";
import { Plus, X, Send, Repeat, Layers, UserCircle2, Play, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/forward")({ component: ForwardPage });

const SOURCE_RE = /^(@[A-Za-z0-9_]{4,32}|https?:\/\/t\.me\/[A-Za-z0-9_+\-/]{3,}|-?\d{6,})$/;
const TARGET_RE = SOURCE_RE;

function ForwardPage() {
  const [source, setSource] = useState("@source_channel");
  const [targets, setTargets] = useState<string[]>(["@target_one", "@target_two"]);
  const [newTarget, setNewTarget] = useState("");
  const [batch, setBatch] = useState(true);
  const [batchSize, setBatchSize] = useState(10);
  const [infinite, setInfinite] = useState(false);
  const [keepAuthor, setKeepAuthor] = useState(true);
  const [running, setRunning] = useState(false);

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
  const canRun = warnings.length === 0;

  return (
    <Shell>
      <PageHeader title="Forwarder" subtitle="Mass message distribution engine" accent="cyan" />

      {/* Source */}
      <Section title="Source" accent="cyan">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Channel / Group / Chat</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="@channel or t.me/link"
            className={`w-full rounded-lg border bg-[rgba(13,14,18,0.7)] px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 ${sourceValid ? "border-[rgba(0,240,255,0.25)] focus:border-[var(--neon-cyan)] focus:ring-[rgba(0,240,255,0.3)]" : "border-red-500/50 focus:border-red-400 focus:ring-red-500/30"}`} />
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
                <button onClick={() => setTargets(targets.filter((_, j) => j !== i))} className="opacity-70 hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTarget()} placeholder="Add target ID / link"
            className={`flex-1 rounded-lg border bg-[rgba(13,14,18,0.7)] px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none ${newTargetValid ? "border-[rgba(157,0,255,0.3)] focus:border-[var(--neon-purple)]" : "border-red-500/50 focus:border-red-400"}`} />
          <button onClick={addTarget} disabled={!newTargetTrim || !newTargetValid || isDuplicate} className="btn-neon-purple flex items-center gap-1 rounded-lg px-3 text-xs font-bold uppercase disabled:opacity-40">
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
          <Toggle icon={Layers} label="Batch Splitting" desc="Split targets across runs" value={batch} onChange={setBatch} />
          {batch && (
            <div className="ml-2 flex items-center gap-2 rounded-lg border border-[rgba(0,240,255,0.2)] bg-[rgba(0,240,255,0.04)] px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Batch size</span>
              <input type="number" min={1} max={100} value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-20 rounded border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] px-2 py-1 font-mono text-xs text-foreground focus:border-[var(--neon-cyan)] focus:outline-none" />
              <span className="text-[10px] text-muted-foreground">targets / run</span>
            </div>
          )}
          <Toggle icon={Repeat} label={infinite ? "Infinite Loop" : "Loop Once & Stop"} desc="Forward behavior" value={infinite} onChange={setInfinite} />
          <Toggle icon={UserCircle2} label={keepAuthor ? "Forward with Original Author" : "Clean Forward (No Name)"} desc="Header attribution" value={keepAuthor} onChange={setKeepAuthor} />
        </div>
      </Section>

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

      <button
        onClick={() => canRun && setRunning((r) => !r)}
        disabled={!canRun && !running}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-sm font-bold uppercase tracking-[0.25em] disabled:cursor-not-allowed disabled:opacity-40 ${running ? "btn-neon-purple animate-pulse-glow" : "btn-neon"}`}
      >
        {running ? <><Send className="h-4 w-4" /> Running… Tap to Stop</> : <><Play className="h-4 w-4" /> Start Forwarding</>}
      </button>

      <p className="mt-3 rounded-lg border border-dashed border-[rgba(0,240,255,0.25)] bg-[rgba(0,240,255,0.04)] px-3 py-2 text-[11px] text-muted-foreground">
        ⚡ UI implementation ready. Backend logic to be detailed later.
      </p>
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

function Toggle({ icon: Icon, label, desc, value, onChange }: { icon: React.ComponentType<{ className?: string }>; label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center gap-3 rounded-lg border border-border bg-[rgba(13,14,18,0.5)] px-3 py-2.5 text-left transition hover:border-[var(--neon-cyan)]">
      <Icon className={`h-4 w-4 ${value ? "text-[var(--neon-cyan)]" : "text-muted-foreground"}`} />
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <span className={`relative h-5 w-9 rounded-full transition ${value ? "bg-[var(--neon-cyan)]" : "bg-zinc-700"}`} style={value ? { boxShadow: "0 0 10px rgba(0,240,255,0.6)" } : undefined}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-black transition-all ${value ? "left-4" : "left-0.5"}`} />
      </span>
    </button>
  );
}