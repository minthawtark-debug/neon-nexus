import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, PageHeader } from "@/components/Shell";
import { Plus, X, Send, Repeat, Layers, UserCircle2, Play } from "lucide-react";

export const Route = createFileRoute("/forward")({ component: ForwardPage });

function ForwardPage() {
  const [source, setSource] = useState("@source_channel");
  const [targets, setTargets] = useState<string[]>(["@target_one", "@target_two"]);
  const [newTarget, setNewTarget] = useState("");
  const [batch, setBatch] = useState(true);
  const [infinite, setInfinite] = useState(false);
  const [keepAuthor, setKeepAuthor] = useState(true);
  const [running, setRunning] = useState(false);

  const addTarget = () => {
    if (!newTarget.trim()) return;
    setTargets((t) => [...t, newTarget.trim()]);
    setNewTarget("");
  };

  return (
    <Shell>
      <PageHeader title="Forwarder" subtitle="Mass message distribution engine" accent="cyan" />

      {/* Source */}
      <Section title="Source" accent="cyan">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Channel / Group / Chat</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="@channel or t.me/link"
            className="w-full rounded-lg border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] px-3 py-2.5 font-mono text-sm text-foreground focus:border-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,240,255,0.3)]" />
        </label>
      </Section>

      {/* Targets */}
      <Section title="Targets" accent="purple">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {targets.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md border border-[rgba(157,0,255,0.4)] bg-[rgba(157,0,255,0.08)] px-2 py-1 font-mono text-xs text-[#e9c3ff]" style={{ boxShadow: "0 0 8px rgba(157,0,255,0.25)" }}>
              {t}
              <button onClick={() => setTargets(targets.filter((_, j) => j !== i))} className="text-[#e9c3ff]/70 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTarget()} placeholder="Add target ID / link"
            className="flex-1 rounded-lg border border-[rgba(157,0,255,0.3)] bg-[rgba(13,14,18,0.7)] px-3 py-2.5 font-mono text-sm text-foreground focus:border-[var(--neon-purple)] focus:outline-none" />
          <button onClick={addTarget} className="btn-neon-purple flex items-center gap-1 rounded-lg px-3 text-xs font-bold uppercase">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </Section>

      {/* Controls */}
      <Section title="Controls" accent="cyan">
        <div className="space-y-2">
          <Toggle icon={Layers} label="Batch Splitting" desc="Split targets across runs" value={batch} onChange={setBatch} />
          <Toggle icon={Repeat} label={infinite ? "Infinite Loop" : "Loop Once & Stop"} desc="Forward behavior" value={infinite} onChange={setInfinite} />
          <Toggle icon={UserCircle2} label={keepAuthor ? "Forward with Original Author" : "Clean Forward (No Name)"} desc="Header attribution" value={keepAuthor} onChange={setKeepAuthor} />
        </div>
      </Section>

      <button
        onClick={() => setRunning((r) => !r)}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-sm font-bold uppercase tracking-[0.25em] ${running ? "btn-neon-purple animate-pulse-glow" : "btn-neon"}`}
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