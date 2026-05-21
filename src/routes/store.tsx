import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, PageHeader } from "@/components/Shell";
import { ShoppingCart, Edit3, Plus, Crown, Gamepad2, KeySquare, Sparkles } from "lucide-react";

export const Route = createFileRoute("/store")({ component: StorePage });

interface Product {
  id: string;
  title: string;
  category: "premium" | "gaming" | "software";
  price: number;
  stock: number;
  icon: React.ComponentType<{ className?: string }>;
}

const seed: Product[] = [
  { id: "1", title: "Telegram Premium 3M", category: "premium", price: 14.99, stock: 42, icon: Crown },
  { id: "2", title: "Telegram Premium 12M", category: "premium", price: 39.99, stock: 18, icon: Crown },
  { id: "3", title: "Valorant Smurf Acc", category: "gaming", price: 7.50, stock: 60, icon: Gamepad2 },
  { id: "4", title: "Steam Wallet $25", category: "gaming", price: 22.00, stock: 0, icon: Gamepad2 },
  { id: "5", title: "Windows 11 Pro Key", category: "software", price: 9.99, stock: 230, icon: KeySquare },
  { id: "6", title: "Office 365 Family", category: "software", price: 19.99, stock: 12, icon: KeySquare },
];

const catColors = {
  premium: { bg: "rgba(0,240,255,0.15)", text: "var(--neon-cyan)", border: "rgba(0,240,255,0.4)" },
  gaming: { bg: "rgba(157,0,255,0.18)", text: "#e9c3ff", border: "rgba(157,0,255,0.45)" },
  software: { bg: "rgba(255,0,170,0.15)", text: "#ff8fd1", border: "rgba(255,0,170,0.4)" },
};

function StorePage() {
  const [items, setItems] = useState<Product[]>(seed);
  const [edit, setEdit] = useState(false);

  const updatePrice = (id: string, val: number) => setItems((xs) => xs.map(x => x.id === id ? { ...x, price: val } : x));
  const updateStock = (id: string, val: number) => setItems((xs) => xs.map(x => x.id === id ? { ...x, stock: val } : x));

  const add = () => setItems((xs) => [...xs, { id: crypto.randomUUID(), title: "New Product", category: "software", price: 9.99, stock: 10, icon: Sparkles }]);

  return (
    <Shell>
      <PageHeader title="Store" subtitle="Premium digital goods marketplace" accent="purple" />

      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setEdit(e => !e)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${edit ? "btn-neon-purple" : "border border-border text-muted-foreground hover:border-[var(--neon-purple)]"}`}>
          <Edit3 className="h-3.5 w-3.5" /> Admin Edit {edit ? "ON" : "OFF"}
        </button>
        {edit && (
          <button onClick={add} className="btn-neon flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest">
            <Plus className="h-3.5 w-3.5" /> Add Product
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((p, i) => {
          const c = catColors[p.category];
          const Icon = p.icon;
          const out = p.stock === 0;
          return (
            <div key={p.id} className="glass-panel relative overflow-hidden rounded-2xl p-4 animate-float-up" style={{ animationDelay: `${i * 40}ms`, borderColor: c.border }}>
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: c.bg, boxShadow: `0 0 12px ${c.border}` }}>
                  <Icon className="h-5 w-5" style={{ color: c.text }} />
                </div>
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                  {p.category}
                </span>
              </div>
              <div className="mb-2 font-display text-sm font-bold text-foreground">{p.title}</div>

              {edit ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">$</span>
                    <input type="number" step="0.01" value={p.price} onChange={(e) => updatePrice(p.id, parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-border bg-[rgba(13,14,18,0.7)] px-2 py-1 font-mono text-xs text-foreground" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">Stk</span>
                    <input type="number" value={p.stock} onChange={(e) => updateStock(p.id, parseInt(e.target.value) || 0)}
                      className="w-full rounded border border-border bg-[rgba(13,14,18,0.7)] px-2 py-1 font-mono text-xs text-foreground" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-baseline gap-1">
                    <span className="font-display text-xl font-black neon-text-cyan">${p.price.toFixed(2)}</span>
                    <span className="text-[10px] text-muted-foreground">USD</span>
                  </div>
                  <div className={`mb-3 text-[10px] uppercase tracking-wider ${out ? "text-red-400" : "text-emerald-400"}`}>
                    {out ? "Out of Stock" : `${p.stock} in stock`}
                  </div>
                  <button disabled={out} className="btn-neon flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-30">
                    <ShoppingCart className="h-3.5 w-3.5" /> Buy Now
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}