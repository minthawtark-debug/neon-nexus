import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyInitData } from "./telegram-auth.server";

const ADMIN_USERNAME = "Wolf_002196";

const InitDataInput = z.object({ initData: z.string().min(1) });

async function authenticate(initData: string) {
  // In dev (no Telegram), allow a debug bypass when no bot token is configured.
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const debug = JSON.parse(initData) as {
        id: number;
        username?: string;
        first_name?: string;
        last_name?: string;
        photo_url?: string;
      };
      if (typeof debug.id === "number") return debug;
    } catch {}
    throw new Error("TELEGRAM_BOT_TOKEN not configured");
  }
  return verifyInitData(initData);
}

async function upsertProfileAndRole(user: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}) {
  await supabaseAdmin.from("profiles").upsert(
    {
      telegram_id: user.id,
      username: user.username ?? null,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      photo_url: user.photo_url ?? null,
    },
    { onConflict: "telegram_id" },
  );

  const isAdmin =
    (user.username ?? "").toLowerCase() === ADMIN_USERNAME.toLowerCase();
  if (isAdmin) {
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { telegram_id: user.id, role: "admin" },
        { onConflict: "telegram_id,role" },
      );
  } else {
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { telegram_id: user.id, role: "user" },
        { onConflict: "telegram_id,role" },
      );
  }
  return { isAdmin };
}

/** Bootstraps the session: verifies initData, upserts profile, returns profile + role. */
export const bootstrapUser = createServerFn({ method: "POST" })
  .inputValidator((d) => InitDataInput.parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);
    const { isAdmin } = await upsertProfileAndRole(user);
    return {
      profile: {
        telegram_id: user.id,
        username: user.username ?? null,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        photo_url: user.photo_url ?? null,
      },
      isAdmin,
    };
  });

/** Aggregated, user-friendly forwarding analytics (no raw logs). */
export const getForwardAnalytics = createServerFn({ method: "POST" })
  .inputValidator((d) => InitDataInput.parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);

    const { data: bots } = await supabaseAdmin
      .from("userbots")
      .select("id, active")
      .eq("owner_telegram_id", user.id);
    const botIds = (bots ?? []).map((b) => b.id);
    const activeBots = (bots ?? []).filter((b) => b.active).length;

    if (botIds.length === 0) {
      return {
        dailyTargetsReached: 0,
        forwardsPerDay: 0,
        forwardsLastHour: 0,
        activeBots: 0,
        health: { level: "healthy" as const, label: "HEALTHY (Low Spam Risk)" },
      };
    }

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data: dayEvents } = await supabaseAdmin
      .from("forward_events")
      .select("target_id, created_at")
      .in("userbot_id", botIds)
      .gte("created_at", since.toISOString());

    const events = dayEvents ?? [];
    const dailyTargetsReached = new Set(
      events.map((e) => e.target_id).filter(Boolean),
    ).size;
    const forwardsPerDay = events.length;
    const forwardsLastHour = events.filter(
      (e) => new Date(e.created_at) >= hourAgo,
    ).length;

    // Spam heuristic: > 60 fwd/hr per bot = high risk
    const ratePerBotHour = forwardsLastHour / Math.max(activeBots, 1);
    const health =
      ratePerBotHour > 60
        ? { level: "danger" as const, label: "WARNING (High Spam Risk)" }
        : ratePerBotHour > 30
          ? { level: "warn" as const, label: "CAUTION (Elevated Activity)" }
          : { level: "healthy" as const, label: "HEALTHY (Low Spam Risk)" };

    return {
      dailyTargetsReached,
      forwardsPerDay,
      forwardsLastHour,
      activeBots,
      health,
    };
  });

/**
 * Disconnects (logs out) every userbot owned by the caller.
 * Wipes the stored session_string and flips active=false, which forces the
 * worker layer to terminate the MTProto session on the user's physical device.
 */
export const disconnectMyUserbots = createServerFn({ method: "POST" })
  .inputValidator((d) => InitDataInput.parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);
    const { data: rows, error } = await supabaseAdmin
      .from("userbots")
      .update({ active: false, session_string: null })
      .eq("owner_telegram_id", user.id)
      .select("id");
    if (error) throw new Error(error.message);
    return { terminated: rows?.length ?? 0 };
  });

async function requireAdmin(initData: string) {
  const user = await authenticate(initData);
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("telegram_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
  return user;
}

export const adminGetOverview = createServerFn({ method: "POST" })
  .inputValidator((d) => InitDataInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.initData);
    const [{ count: totalUsers }, { count: activeForwards }, { data: bots }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
        supabaseAdmin
          .from("forward_targets")
          .select("*", { count: "exact", head: true })
          .eq("active", true),
        supabaseAdmin
          .from("userbots")
          .select(
            "id, username, phone, active, owner_telegram_id, created_at",
          )
          .order("created_at", { ascending: false }),
      ]);

    const userbots = bots ?? [];
    const botIds = userbots.map((b) => b.id);
    let forwardsPerBot: Record<string, number> = {};
    if (botIds.length) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: events } = await supabaseAdmin
        .from("forward_events")
        .select("userbot_id")
        .in("userbot_id", botIds)
        .gte("created_at", since);
      for (const e of events ?? []) {
        forwardsPerBot[e.userbot_id] = (forwardsPerBot[e.userbot_id] ?? 0) + 1;
      }
    }

    return {
      totalUsers: totalUsers ?? 0,
      activeForwards: activeForwards ?? 0,
      activeBots: userbots.filter((b) => b.active).length,
      userbots: userbots.map((b) => ({
        ...b,
        forwards24h: forwardsPerBot[b.id] ?? 0,
      })),
    };
  });

export const adminToggleUserbot = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ initData: z.string().min(1), id: z.string().uuid(), active: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.initData);
    const patch: { active: boolean; session_string?: null } = {
      active: data.active,
    };
    if (!data.active) patch.session_string = null;
    const { error } = await supabaseAdmin
      .from("userbots")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveUserbot = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ initData: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.initData);
    const { error } = await supabaseAdmin
      .from("userbots")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================================================
 * PROXY MAINFRAME — ingestion from t.me/V_Usproxy1
 * ============================================================ */

const PROXY_SOURCE_CHANNEL = "https://t.me/V_Usproxy1";

/** Parses raw lines like:
 *   socks5://ip:port:user:pass
 *   socks5://user:pass@ip:port
 *   ip:port:user:pass
 *   ip:port
 */
function parseProxyLine(line: string) {
  const raw = line.trim();
  if (!raw) return null;
  const stripped = raw.replace(/^[a-z0-9]+:\/\//i, "");

  // user:pass@ip:port
  const at = stripped.split("@");
  if (at.length === 2) {
    const [creds, hostPort] = at;
    const [username, password] = creds.split(":");
    const [ip, portStr] = hostPort.split(":");
    const port = Number(portStr);
    if (!ip || !port) return null;
    return { raw_text: raw, ip, port, username: username ?? null, password: password ?? null };
  }

  // ip:port[:user:pass]
  const parts = stripped.split(":");
  if (parts.length < 2) return null;
  const [ip, portStr, username, password] = parts;
  const port = Number(portStr);
  if (!ip || !port) return null;
  return {
    raw_text: raw,
    ip,
    port,
    username: username ?? null,
    password: password ?? null,
  };
}

/** Simulated ingestion from the source channel. In production, replace with
 *  the Telethon worker callback that posts new proxies into the table. */
function generateMockProxyBatch(count = 8): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const ip = `${10 + Math.floor(Math.random() * 240)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    const port = 1080 + Math.floor(Math.random() * 50000);
    const user = `u${Math.floor(Math.random() * 9999)}`;
    const pass = Math.random().toString(36).slice(2, 10);
    out.push(`socks5://${ip}:${port}:${user}:${pass}`);
  }
  return out;
}

export const adminGetProxyOverview = createServerFn({ method: "POST" })
  .inputValidator((d) => InitDataInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.initData);
    const [{ count: total }, { count: active }, { count: dead }, { data: recent }] =
      await Promise.all([
        supabaseAdmin.from("proxies").select("*", { count: "exact", head: true }),
        supabaseAdmin
          .from("proxies")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabaseAdmin
          .from("proxies")
          .select("*", { count: "exact", head: true })
          .eq("is_active", false),
        supabaseAdmin
          .from("proxies")
          .select("id, ip, port, is_active, last_tested_at, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
    return {
      sourceChannel: PROXY_SOURCE_CHANNEL,
      total: total ?? 0,
      active: active ?? 0,
      dead: dead ?? 0,
      recent: recent ?? [],
    };
  });

export const adminForceSyncProxies = createServerFn({ method: "POST" })
  .inputValidator((d) => InitDataInput.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.initData);
    const batch = generateMockProxyBatch(8 + Math.floor(Math.random() * 6));
    const rows = batch
      .map(parseProxyLine)
      .filter((p): p is NonNullable<ReturnType<typeof parseProxyLine>> => !!p);
    if (rows.length === 0) return { ingested: 0, skipped: 0 };
    const { data: inserted, error } = await supabaseAdmin
      .from("proxies")
      .upsert(rows, { onConflict: "raw_text", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    const ingested = inserted?.length ?? 0;
    return { ingested, skipped: rows.length - ingested, source: PROXY_SOURCE_CHANNEL };
  });
