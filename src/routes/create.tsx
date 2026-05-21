import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, PageHeader } from "@/components/Shell";
import { Info, ExternalLink, ChevronRight, Check, Loader2, Phone, KeyRound, Lock, Hash } from "lucide-react";

export const Route = createFileRoute("/create")({ component: CreatePage });

const STEPS = ["API Keys", "Phone", "OTP", "2FA"] as const;

function CreatePage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [api, setApi] = useState({ id: "", hash: "" });
  const [phone, setPhone] = useState({ cc: "+1", number: "" });
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");

  const next = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (step === STEPS.length - 1) setDone(true);
      else setStep((s) => s + 1);
    }, 900);
  };

  return (
    <Shell>
      <PageHeader title="Create Userbot" subtitle="Connect a Telegram account in 4 steps" accent="purple" />

      {/* Stepper */}
      <div className="glass-panel mb-5 rounded-2xl p-3">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                  i < step || done
                    ? "bg-[var(--neon-cyan)] text-black"
                    : i === step
                      ? "bg-[var(--neon-purple)] text-white animate-pulse-glow"
                      : "border border-border bg-transparent text-muted-foreground"
                }`}
              >
                {i < step || done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 ${i < step ? "bg-[var(--neon-cyan)]" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          {STEPS.map((s) => <span key={s}>{s}</span>)}
        </div>
      </div>

      {done ? (
        <div className="glass-panel rounded-2xl p-8 text-center animate-float-up">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 animate-pulse-glow" style={{ boxShadow: "0 0 32px rgba(52,211,153,0.6)" }}>
            <Check className="h-8 w-8 text-emerald-300" strokeWidth={3} />
          </div>
          <h3 className="font-display text-xl font-bold neon-text-cyan">Userbot Online</h3>
          <p className="mt-1 text-sm text-muted-foreground">Session established. Ready to forward.</p>
          <button onClick={() => { setDone(false); setStep(0); }} className="btn-neon-purple mt-5 rounded-lg px-6 py-2 text-sm font-bold uppercase tracking-widest">
            Add Another
          </button>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-5 animate-float-up">
          {step === 0 && (
            <div className="space-y-4">
              <Field icon={Hash} label="API ID" value={api.id} onChange={(v) => setApi({ ...api, id: v })} placeholder="12345678" mono />
              <Field icon={KeyRound} label="API Hash" value={api.hash} onChange={(v) => setApi({ ...api, hash: v })} placeholder="abc123def456..." mono />
              <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-[rgba(0,240,255,0.25)] bg-[rgba(0,240,255,0.05)] px-3 py-2 text-xs text-[var(--neon-cyan)] transition hover:bg-[rgba(0,240,255,0.1)]">
                <Info className="h-3.5 w-3.5" />
                <span>Get keys at my.telegram.org</span>
                <ExternalLink className="ml-auto h-3.5 w-3.5" />
              </a>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="w-24">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Code</label>
                  <select value={phone.cc} onChange={(e) => setPhone({ ...phone, cc: e.target.value })} className="w-full rounded-lg border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] px-2 py-2.5 font-mono text-sm text-foreground focus:border-[var(--neon-cyan)] focus:outline-none">
                    {["+1","+44","+91","+62","+7","+86","+49","+33","+34","+39","+55","+27","+971"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <Field icon={Phone} label="Phone Number" value={phone.number} onChange={(v) => setPhone({ ...phone, number: v })} placeholder="555 123 4567" mono />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">An OTP will be sent through the official Telegram app.</p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <Field icon={KeyRound} label="OTP Code" value={otp} onChange={setOtp} placeholder="•••••" mono />
              <p className="text-xs text-muted-foreground">Check the Telegram app on your device for the login code.</p>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <Field icon={Lock} label="2FA Password (optional)" value={pw} onChange={setPw} placeholder="cloud password" mono type="password" />
              <p className="text-xs text-muted-foreground">Leave blank if 2FA is disabled.</p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-2">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || loading}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground transition hover:border-[var(--neon-purple)] hover:text-[var(--neon-purple)] disabled:opacity-30"
            >
              Back
            </button>
            <button onClick={next} disabled={loading} className="btn-neon flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 font-display text-sm font-bold uppercase tracking-widest disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                {step === STEPS.length - 1 ? "Finish" : "Continue"}
                <ChevronRight className="h-4 w-4" />
              </>}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Field({
  icon: Icon, label, value, onChange, placeholder, mono, type = "text",
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--neon-cyan)]" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,240,255,0.3)] ${mono ? "font-mono" : ""}`}
        />
      </div>
    </label>
  );
}