import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapUser } from "@/lib/app.functions";
import { getInitData, initTelegram } from "@/lib/telegram";

export interface SessionProfile {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
}

export interface Session {
  initData: string;
  profile: SessionProfile;
  isAdmin: boolean;
}

export function useSession() {
  const bootstrap = useServerFn(bootstrapUser);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initTelegram();
    const initData = getInitData();
    if (!initData) {
      setError("No Telegram session");
      setLoading(false);
      return;
    }
    bootstrap({ data: { initData } })
      .then((res) =>
        setSession({ initData, profile: res.profile, isAdmin: res.isAdmin }),
      )
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [bootstrap]);

  return { session, loading, error };
}