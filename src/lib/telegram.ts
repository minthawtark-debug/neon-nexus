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
        initDataUnsafe?: { user?: TelegramUser };
        colorScheme?: "light" | "dark";
        setHeaderColor?: (c: string) => void;
        setBackgroundColor?: (c: string) => void;
      };
    };
  }
}

export function getTelegramUser(): TelegramUser {
  if (typeof window !== "undefined") {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) return tg.initDataUnsafe.user;
  }
  return {
    id: 7421052901,
    username: "cyber_v3",
    first_name: "Neo",
    last_name: "X",
  };
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