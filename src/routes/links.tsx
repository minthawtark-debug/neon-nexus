import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, PageHeader } from "@/components/Shell";
import { Newspaper, TrendingUp, DollarSign, Zap, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/news")({ component: NewsPage });

interface NewsItem {
  id: string;
  title: string;
  category: "telegram" | "crypto" | "money";
  source: string;
  url: string;
  timestamp: string;
  icon: React.ComponentType<{ className?: string }>;
}

const telegramNews: NewsItem[] = [
  {
    id: "tg1",
    title: "New Telegram Bot API Limits: Rate Scaling Updates",
    category: "telegram",
    source: "Telegram Bot API Docs",
    url: "https://core.telegram.org/bots/api",
    timestamp: "2 hours ago",
    icon: Zap,
  },
  {
    id: "tg2",
    title: "Telegram Premium Security Features Expanded",
    category: "telegram",
    source: "Telegram Blog",
    url: "https://telegram.org/blog",
    timestamp: "1 day ago",
    icon: Zap,
  },
  {
    id: "tg3",
    title: "MTProto Update: Connection Stability Improvements",
    category: "telegram",
    source: "Telegram Developers",
    url: "https://t.me/TelegramDevelopers",
    timestamp: "3 days ago",
    icon: Zap,
  },
];

const cryptoNews: NewsItem[] = [
  {
    id: "cry1",
    title: "TON Network Reaches New All-Time High",
    category: "crypto",
    source: "CoinGecko",
    url: "https://coingecko.com/en/coins/ton",
    timestamp: "4 hours ago",
    icon: TrendingUp,
  },
  {
    id: "cry2",
    title: "Telegram Bot Ecosystem Drives Ton Adoption",
    category: "crypto",
    source: "TON Foundation",
    url: "https://ton.org",
    timestamp: "1 day ago",
    icon: TrendingUp,
  },
  {
    id: "cry3",
    title: "Major Web3 Integration: Telegram Mini Apps & Crypto",
    category: "crypto",
    source: "TON News",
    url: "https://ton.org/en/news",
    timestamp: "2 days ago",
    icon: TrendingUp,
  },
];

const moneyNews: NewsItem[] = [
  {
    id: "mon1",
    title: "AI Automation: 7 Telegram Bot Side Hustles in 2026",
    category: "money",
    source: "Digital Marketing Hub",
    url: "https://example.com",
    timestamp: "6 hours ago",
    icon: DollarSign,
  },
  {
    id: "mon2",
    title: "Making $5K/Month with Telegram Bots & Automation",
    category: "money",
    source: "Entrepreneur's Guide",
    url: "https://example.com",
    timestamp: "1 day ago",
    icon: DollarSign,
  },
  {
    id: "mon3",
    title: "Content Forwarding: Passive Income Strategies for 2026",
    category: "money",
    source: "Side Hustle Weekly",
    url: "https://example.com",
    timestamp: "2 days ago",
    icon: DollarSign,
  },
];

type Category = "telegram" | "crypto" | "money";

function NewsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("telegram");

  const categories = [
    { id: "telegram", label: "Telegram News", icon: Zap },
    { id: "crypto", label: "Crypto & TON", icon: TrendingUp },
    { id: "money", label: "Make Money", icon: DollarSign },
  ] as const;

  const allNews = {
    telegram: telegramNews,
    crypto: cryptoNews,
    money: moneyNews,
  };

  const currentNews = allNews[activeCategory];

  return (
    <Shell>
      <PageHeader
        title="News & Trends"
        subtitle="Real-time updates on Telegram, Crypto & AI Automation"
        accent="cyan"
      />

      {/* Category Tabs */}
      <div className="mb-5 flex gap-2 animate-float-up">
        {categories.map((cat, i) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as Category)}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${
                isActive
                  ? cat.id === "telegram"
                    ? "btn-neon-cyan"
                    : cat.id === "crypto"
                      ? "btn-neon"
                      : "btn-neon-purple"
                  : "border border-border text-muted-foreground hover:border-[var(--neon-cyan)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* News Feed */}
      <div className="grid grid-cols-1 gap-3">
        {currentNews.map((item, i) => {
          const Icon = item.icon;
          const categoryColor =
            item.category === "telegram"
              ? { bg: "rgba(0,240,255,0.15)", text: "var(--neon-cyan)", border: "rgba(0,240,255,0.4)" }
              : item.category === "crypto"
                ? { bg: "rgba(52,211,153,0.15)", text: "rgb(52,211,153)", border: "rgba(52,211,153,0.4)" }
                : { bg: "rgba(157,0,255,0.15)", text: "#e9c3ff", border: "rgba(157,0,255,0.4)" };

          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              style={{ animationDelay: `${i * 40}ms` }}
              className="glass-panel relative overflow-hidden rounded-xl p-3 transition hover:border-[var(--neon-cyan)] animate-float-up"
            >
              <div className="mb-2 flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: categoryColor.bg,
                    boxShadow: `0 0 12px ${categoryColor.border}`,
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: categoryColor.text }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-sm font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{item.timestamp}</span>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 opacity-50 transition group-hover:opacity-100" />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block rounded px-2 py-1 text-[9px] font-bold uppercase tracking-widest"
                  style={{ background: categoryColor.bg, color: categoryColor.text }}
                >
                  {item.category === "telegram"
                    ? "Telegram"
                    : item.category === "crypto"
                      ? "Crypto"
                      : "Monetization"}
                </span>
              </div>
            </a>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="mt-6 rounded-lg border border-[rgba(0,240,255,0.2)] bg-[rgba(0,240,255,0.05)] p-3 text-center animate-float-up" style={{ animationDelay: "200ms" }}>
        <p className="text-[11px] text-muted-foreground">
          News updates automatically. Check back regularly for the latest trends in Telegram automation, TON ecosystem, and digital monetization strategies.
        </p>
      </div>
    </Shell>
  );
}
