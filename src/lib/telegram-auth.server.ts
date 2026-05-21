import { createHmac } from "crypto";

export interface VerifiedTelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

/**
 * Verifies a Telegram WebApp `initData` string against TELEGRAM_BOT_TOKEN.
 * Returns the parsed user, or throws on invalid signature.
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData: string): VerifiedTelegramUser {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  if (!initData) throw new Error("Missing initData");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Missing hash");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computed !== hash) throw new Error("Invalid Telegram signature");

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Missing user in initData");
  const user = JSON.parse(userRaw) as VerifiedTelegramUser;
  return user;
}