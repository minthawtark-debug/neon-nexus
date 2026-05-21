/* Telegram WebApp helpers */
export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData?: string;
        initDataUnsafe?: { user?: TelegramUser };
        colorScheme?: "light" | "dark";
        setHeaderColor?: (c: string) => void;
        setBackgroundColor?: (c: string) => void;
        close?: () => void;
      };
    };
  }
}

/**
 * Returns raw initData (signed by Telegram) for server-side verification.
 * In a non-Telegram preview, returns a JSON debug payload that the server
 * will accept ONLY when TELEGRAM_BOT_TOKEN is unset.
 */
export function getInitData(): string {
  if (typeof window === "undefined") return "";
  const tg = window.Telegram?.WebApp;
  if (tg?.initData && tg.initData.length > 0) return tg.initData;
  // Dev fallback: try unsafe user, else anonymous preview identity.
  const u = tg?.initDataUnsafe?.user ?? {
    id: 0,
    username: "preview_user",
    first_name: "Preview",
  };
  return JSON.stringify(u);
}

export function initTelegram() {
  if (typeof window === "undefined") return;
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.("#0d0e12");
    tg.setBackgroundColor?.("#0d0e12");
  } catch {}
}