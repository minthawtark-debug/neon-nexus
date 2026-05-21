import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell, PageHeader } from "@/components/Shell";
import { Link2, Check, X, Trash2, Eye, EyeOff, Shield, Users, Loader2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/links")({ component: LinksPage });

interface PublicLink {
  id: string;
  url: string;
  title: string;
  kind: "channel" | "group";
  members: number;
  hidden?: boolean;
}

const initial: PublicLink[] = [
  { id: "1", url: "https://t.me/cyber_dropzone", title: "Cyber Dropzone", kind: "channel", members: 12400 },
  { id: "2", url: "https://t.me/neon_market", title: "Neon Market", kind: "group", members: 5230 },
  { id: "3", url: "https://t.me/v3_announcements", title: "V3 Announcements", kind: "channel", members: 23110 },
  { id: "4", url: "https://t.me/synth_traders", title: "Synth Traders", kind: "group", members: 1880 },
];

const TG_RE = /^https?:\/\/t\.me\/[A-Za-z0-9_+\-]{3,}$/;

function LinksPage() {
  const [links, setLinks] = useState<PublicLink[]>(initial);
  const [input, setInput] = useState("");
  const { session } = useSession();
  const isAdmin = session?.isAdmin ?? false;
  const [admin, setAdmin] = useState(true);
  const [pending, setPending] = useState<Record<string, "hide" | "delete" | undefined>>({});
  const [toast, setToast] = useState<string | null>(null);

  const isValid = useMemo(() => TG_RE.test(input.trim()), [input]);

  const submit = () => {
    if (!isValid) return;
    const slug = input.trim().split("/").pop() || "link";
    setLinks((ls) => [
      { id: crypto.randomUUID(), url: input.trim(), title: slug.replace(/_/g, " "), kind: "channel", members: Math.floor(Math.random() * 9000) + 100 },
      ...ls,
    ]);
    setInput("");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const toggleHide = (id: string) => {
    setPending((p) => ({ ...p, [id]: "hide" }));
    setLinks((ls) => ls.map((x) => (x.id === id ? { ...x, hidden: !x.hidden } : x)));
    setTimeout(() => {
      setPending((p) => ({ ...p, [id]: undefined }));
      showToast("Visibility updated");
    }, 450);
  };

  const deleteLink = (id: string) => {
    if (!confirm("Delete this link permanently?")) return;
    setPending((p) => ({ ...p, [id]: "delete" }));
    setTimeout(() => {
      setLinks((ls) => ls.filter((x) => x.id !== id));
      setPending((p) => ({ ...p, [id]: undefined }));
      showToast("Link removed");
    }, 450);
  };

  return (
    <Shell>
      <PageHeader title="Public Links" subtitle="Submit & discover Telegram channels" accent="cyan" />

      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg border border-[var(--neon-cyan)] bg-[rgba(13,14,18,0.95)] px-4 py-2 font-display text-xs font-bold uppercase tracking-widest text-[var(--neon-cyan)] animate-float-up" style={{ boxShadow: "0 0 16px rgba(0,240,255,0.4)" }}>
          ✓ {toast}
        </div>
      )}

      {/* Submit */}
      <div className="glass-panel mb-4 rounded-2xl p-4 animate-float-up">
        <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-widest neon-text-cyan">Submit Link</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--neon-cyan)]" />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://t.me/yourchannel"
              className="w-full rounded-lg border border-[rgba(0,240,255,0.25)] bg-[rgba(13,14,18,0.7)] py-2.5 pl-9 pr-10 font-mono text-sm text-foreground focus:border-[var(--neon-cyan)] focus:outline-none" />
            {input.length > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValid ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-red-400" />}
              </span>
            )}
          </div>
          <button onClick={submit} disabled={!isValid} className="btn-neon rounded-lg px-4 text-xs font-bold uppercase tracking-widest disabled:opacity-40">
            Submit
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Validation: must match a valid t.me/ channel or group URL.</p>
      </div>

      {/* Admin toggle */}
      {isAdmin && (
        <button onClick={() => setAdmin((a) => !a)} className="mb-3 flex items-center gap-2 rounded-lg border border-[rgba(157,0,255,0.3)] bg-[rgba(157,0,255,0.06)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#e9c3ff]">
          <Shield className="h-3.5 w-3.5" /> Admin Mode: {admin ? "ON" : "OFF"}
        </button>
      )}

      {/* Feed */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((l, i) => (
          <div key={l.id} className={`glass-panel relative overflow-hidden rounded-xl p-3 transition animate-float-up ${l.hidden ? "opacity-40" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[rgba(0,240,255,0.2)] to-[rgba(157,0,255,0.2)]">
                <Link2 className="h-4 w-4 text-[var(--neon-cyan)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-semibold capitalize text-foreground">{l.title}</div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className={`rounded px-1.5 py-0.5 ${l.kind === "channel" ? "bg-[rgba(0,240,255,0.15)] text-[var(--neon-cyan)]" : "bg-[rgba(157,0,255,0.15)] text-[#e9c3ff]"}`}>{l.kind}</span>
                  <Users className="h-3 w-3" /> {l.members.toLocaleString()}
                </div>
              </div>
            </div>
            <a href={l.url} target="_blank" rel="noreferrer" className="block truncate font-mono text-[11px] text-muted-foreground hover:text-[var(--neon-cyan)]">{l.url}</a>
            {isAdmin && admin && (
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => toggleHide(l.id)} disabled={!!pending[l.id]}
                  className="flex flex-1 items-center justify-center gap-1 rounded border border-border bg-[rgba(255,255,255,0.03)] py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)] disabled:opacity-50">
                  {pending[l.id] === "hide" ? <Loader2 className="h-3 w-3 animate-spin" /> : l.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} {l.hidden ? "Show" : "Hide"}
                </button>
                <button onClick={() => deleteLink(l.id)} disabled={!!pending[l.id]}
                  className="flex flex-1 items-center justify-center gap-1 rounded border border-red-500/40 bg-red-500/10 py-1 text-[10px] uppercase tracking-wider text-red-300 hover:bg-red-500/20 disabled:opacity-50">
                  {pending[l.id] === "delete" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}