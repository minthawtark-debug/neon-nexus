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
