import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shell, PageHeader } from "@/components/Shell";
import { ShoppingCart, Edit3, Plus, Crown, Gamepad2, KeySquare, Sparkles, Loader2, Trash2 } from "lucide-react";
import { getProducts, updateProduct, addProduct, deleteProduct } from "@/lib/app.functions";
import { useSession } from "@/hooks/use-session";
import { useServerFn } from "@tanstack/react-start";

interface Product {
  id: string;
  title: string;
  description: string | null;
  category: "premium" | "gaming" | "software";
  price: number;
  stock: number;
  icon: string;
  sort_order: number;
}

interface ProductWithIcon extends Product {
  IconComponent: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Crown,
  Gamepad2,
  KeySquare,
  Sparkles,
};

const catColors = {
  premium: { bg: "rgba(0,240,255,0.15)", text: "var(--neon-cyan)", border: "rgba(0,240,255,0.4)" },
  gaming: { bg: "rgba(157,0,255,0.18)", text: "#e9c3ff", border: "rgba(157,0,255,0.45)" },
  software: { bg: "rgba(255,0,170,0.15)", text: "#ff8fd1", border: "rgba(255,0,170,0.4)" },
};

function StorePage() {
  const { session, loading: sessionLoading, error: sessionError } = useSession();
  const [edit, setEdit] = useState(false);
  const [localProducts, setLocalProducts] = useState<ProductWithIcon[]>([]);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newProductForm, setNewProductForm] = useState<Partial<Product>>({
    title: "",
    description: "",
    category: "software",
    price: 9.99,
    stock: 10,
    icon: "Sparkles",
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const initData = session?.initData;
  const isAdmin = session?.isAdmin ?? false;
  const addProductFn = useServerFn(addProduct);
  const deleteProductFn = useServerFn(deleteProduct);

  // Fetch products from server
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      if (!initData) return { products: [] };
      const result = await getProducts({ data: { initData } });
      return result;
    },
    enabled: !!initData,
  });

  // Set enabled based on session
  useEffect(() => {
    // This effect is just for tracking - the query will run when initData is available
  }, [initData]);

  // Transform products when data changes
  useEffect(() => {
    if (data?.products) {
      const transformed = data.products.map((p) => ({
        ...p,
        category: p.category as "premium" | "gaming" | "software",
        IconComponent: iconMap[p.icon] || Sparkles,
      }));
      setLocalProducts(transformed);
    }
  }, [data]);

  const updatePrice = (id: string, val: number) => {
    setLocalProducts((xs) => xs.map(x => x.id === id ? { ...x, price: val } : x));
  };

  const updateStock = (id: string, val: number) => {
    setLocalProducts((xs) => xs.map(x => x.id === id ? { ...x, stock: val } : x));
  };

  const handleSave = async (id: string, price: number, stock: number) => {
    if (!initData) return;
    setUpdatingIds((prev) => new Set(prev).add(id));
    try {
      await updateProduct({
        data: {
          initData,
          product_id: id,
          price,
          stock,
        },
      });
      // Refresh the products list
      refetch();
    } catch (err) {
      console.error("Failed to update product:", err);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!initData) return;
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteProductFn({
        data: {
          initData,
          product_id: id,
        },
      });
      refetch();
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  };

  const handleAddProduct = async () => {
    if (!initData || !newProductForm.title) return;
    setAdding(true);
    try {
      await addProductFn({
        data: {
          initData,
          title: newProductForm.title,
          description: newProductForm.description || undefined,
          category: newProductForm.category as "premium" | "gaming" | "software",
          price: newProductForm.price || 9.99,
          stock: newProductForm.stock || 0,
          icon: newProductForm.icon || "Sparkles",
          sort_order: localProducts.length + 1,
        },
      });
      setShowAddForm(false);
      setNewProductForm({
        title: "",
        description: "",
        category: "software",
        price: 9.99,
        stock: 10,
        icon: "Sparkles",
      });
      refetch();
    } catch (err) {
      console.error("Failed to add product:", err);
    } finally {
      setAdding(false);
    }
  };

  if (sessionLoading) {
    return (
      <Shell>
        <PageHeader title="Store" subtitle="Premium digital goods marketplace" accent="purple" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (sessionError || error || !data?.products) {
    return (
      <Shell>
        <PageHeader title="Store" subtitle="Premium digital goods marketplace" accent="purple" />
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          Failed to load products. Please try again later.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader title="Store" subtitle="Premium digital goods marketplace" accent="purple" />

      <div className="mb-4 flex items-center gap-2">
        {isAdmin && (
          <button
            onClick={() => setEdit((e) => !e)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest ${
              edit
                ? "btn-neon-purple"
                : "border border-border text-muted-foreground hover:border-[var(--neon-purple)]"
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" /> Admin Edit {edit ? "ON" : "OFF"}
          </button>
        )}
        {edit && isAdmin && (
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-neon flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest"
          >
            <Plus className="h-3.5 w-3.5" /> Add Product
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {localProducts.map((p, i) => {
          const c = catColors[p.category] || catColors.software;
          const Icon = p.IconComponent;
          const out = p.stock === 0;
          const isUpdating = updatingIds.has(p.id);
          return (
            <div
              key={p.id}
              className="glass-panel relative overflow-hidden rounded-2xl p-4 animate-float-up"
              style={{
                animationDelay: `${i * 40}ms`,
                borderColor: c.border,
              }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: c.bg, boxShadow: `0 0 12px ${c.border}` }}
                >
                  <Icon className="h-5 w-5" style={{ color: c.text }} />
                </div>
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                >
                  {p.category}
                </span>
              </div>
              <div className="mb-2 font-display text-sm font-bold text-foreground">{p.title}</div>

              {edit && isAdmin ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={p.price}
                      onChange={(e) => updatePrice(p.id, parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-border bg-[rgba(13,14,18,0.7)] px-2 py-1 font-mono text-xs text-foreground"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">Stk</span>
                    <input
                      type="number"
                      value={p.stock}
                      onChange={(e) => updateStock(p.id, parseInt(e.target.value) || 0)}
                      className="w-full rounded border border-border bg-[rgba(13,14,18,0.7)] px-2 py-1 font-mono text-xs text-foreground"
                    />
                  </div>
                  <button
                    onClick={() => handleSave(p.id, p.price, p.stock)}
                    disabled={isUpdating}
                    className="btn-neon w-full rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  >
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="w-full rounded-lg border border-red-500/50 bg-red-500/10 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="inline h-3 w-3 mr-1" /> Delete
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-baseline gap-1">
                    <span className="font-display text-xl font-black neon-text-cyan">
                      ${p.price.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">USD</span>
                  </div>
                  <div
                    className={`mb-3 text-[10px] uppercase tracking-wider ${
                      out ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {out ? "Out of Stock" : `${p.stock} in stock`}
                  </div>
                  <button
                    disabled={out}
                    className="btn-neon flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-30"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" /> Buy Now
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {localProducts.length === 0 && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          No products available at the moment.
        </div>
      )}
    </Shell>
  );
}

export const Route = createFileRoute("/store")({
  component: StorePage,
});
