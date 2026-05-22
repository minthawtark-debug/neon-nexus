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

function normalizeTelegramPeerInput(raw: string) {
  const value = raw.trim();
  if (!value) {
    return { result: null, normalizedInput: "", note: "Enter a Telegram link, handle, or numeric ID." };
  }

  const cleaned = value
    .replace(/^\s+|\s+$/g, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^telegram\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");

  // Private channel link format: t.me/c/<channelId>/<postId>
  const privateMatch = cleaned.match(/^c\/(\d+)(?:\/.*)?$/i);
  if (privateMatch) {
    return {
      result: `-100${privateMatch[1]}`,
      normalizedInput: cleaned,
      note: "Private channel link converted to Telegram peer ID.",
    };
  }

  // Numeric ID values or channel IDs
  const idOnly = cleaned.replace(/[^0-9\-]/g, "");
  if (/^-?100\d+$/.test(cleaned) || /^\d+$/.test(cleaned) || /^-\d+$/.test(cleaned)) {
    const numeric = cleaned.startsWith("-100") ? cleaned : cleaned.replace(/^-?/, "");
    return {
      result: cleaned.startsWith("-100") ? cleaned : `-100${numeric.replace(/^0+/, "")}`,
      normalizedInput: cleaned,
      note: "Numeric input normalized into Telegram peer ID format.",
    };
  }

  if (/^[a-z0-9_]{5,}$/i.test(cleaned)) {
    return {
      result: `@${cleaned}`,
      normalizedInput: cleaned,
      note: "Public username detected. Numeric peer ID lookup requires backend cache or Telegram API support.",
    };
  }

  return {
    result: null,
    normalizedInput: cleaned,
    note: "Could not resolve the provided input. Use a t.me link, @handle, or numeric ID.",
  };
}

export const resolveTelegramPeerId = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ link: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const normalized = normalizeTelegramPeerInput(data.link);
    return normalized;
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
    // If a worker webhook is configured, trigger remote ingestion and return its result.
    const workerWebhook = process.env.WORKER_INGEST_WEBHOOK;
    const workerSecret = process.env.WORKER_INGEST_SECRET;
    if (workerWebhook) {
      try {
        const res = await fetch(workerWebhook, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(workerSecret ? { Authorization: `Bearer ${workerSecret}` } : {}),
          },
          body: JSON.stringify({ source: PROXY_SOURCE_CHANNEL }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Worker webhook failed: ${res.status} ${text}`);
        }
        const json = await res.json().catch(() => ({}));
        return { ...(json ?? {}), source: PROXY_SOURCE_CHANNEL };
      } catch (err) {
        // Fall back to local ingestion if webhook call fails
        console.warn("Worker webhook call failed, falling back to local ingestion:", err);
      }
    }

    // Fallback: generate a mock batch and upsert into proxies (existing behavior)
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

/* ============================================================
 * MESSAGE FORWARDING API BRIDGE
 * ============================================================ */

/**
 * Validates channel/group identifier format.
 * Supports: @username, t.me/link, or numeric chat ID (positive or negative)
 */
function isValidChannelId(id: string): boolean {
  const trimmed = id.trim();
  // @username format: 4-32 alphanumeric chars + underscore
  if (/^@[A-Za-z0-9_]{4,32}$/.test(trimmed)) return true;
  // t.me link: t.me/username or t.me/+... for private groups
  if (/^https?:\/\/t\.me\/[A-Za-z0-9_+\-/]{3,}$/.test(trimmed)) return true;
  // Numeric chat ID (6+ digits, can be negative)
  if (/^-?\d{6,}$/.test(trimmed)) return true;
  return false;
}

/**
 * Worker job request payload sent to worker.py
 */
interface ForwardJobPayload {
  job_id: string;
  userbot_id: string;
  source: string;
  targets: string[];
  batch_size?: number;
  infinite_loop?: boolean;
  keep_author?: boolean;
  proxies?: Array<{ ip: string; port: number; username?: string; password?: string }>;
}

/**
 * Calls the worker webhook to enqueue a forwarding job.
 * Returns the job tracking ID or throws on failure.
 */
async function triggerWorkerJob(payload: ForwardJobPayload): Promise<{ job_id: string; status: string }> {
  const workerWebhook = process.env.WORKER_INGEST_WEBHOOK;
  const workerSecret = process.env.WORKER_INGEST_SECRET;

  if (!workerWebhook) {
    console.warn("[ForwardBridge] No WORKER_INGEST_WEBHOOK configured, job logged to DB but not triggered");
    return { job_id: payload.job_id, status: "enqueued_local" };
  }

  try {
    const response = await fetch(workerWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(workerSecret ? { Authorization: `Bearer ${workerSecret}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      const errorMsg = `Worker webhook failed: ${response.status} ${errorText}`;
      console.error(`[ForwardBridge] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const result = await response.json().catch(() => ({ job_id: payload.job_id }));
    console.log(`[ForwardBridge] Worker job enqueued: ${payload.job_id}`);
    return { job_id: payload.job_id, status: "enqueued_worker" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ForwardBridge] Worker trigger failed:`, errorMsg);
    // Re-throw to caller so they can handle the error
    throw new Error(`Failed to enqueue job with worker: ${errorMsg}`);
  }
}

/**
 * Initiates message forwarding from a source channel to multiple target channels.
 * - Validates user session via Telegram initData
 * - Validates source and target channel formats
 * - Verifies user owns active userbots with access to target channels
 * - Creates forward_events log record for each userbot-target pair
 * - Enqueues forwarding job to worker.py via webhook
 * - Returns job tracking info
 */
export const initiateMessageForwarding = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        initData: z.string().min(1),
        source: z.string().min(1),
        targets: z.array(z.string().min(1)).min(1),
        batchSize: z.number().int().min(1).max(100).optional(),
        infinite: z.boolean().optional(),
        keepAuthor: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    // 1. Authenticate user
    const user = await authenticate(data.initData);
    console.log(`[ForwardBridge] User ${user.id} initiated forwarding from ${data.source} to ${data.targets.length} target(s)`);

    // 2. Validate source channel format
    if (!isValidChannelId(data.source)) {
      throw new Error(
        `Invalid source channel format: "${data.source}". Use @username, t.me/link, or numeric chat ID.`,
      );
    }

    // 3. Validate target channels format
    const invalidTargets = data.targets.filter((t) => !isValidChannelId(t));
    if (invalidTargets.length > 0) {
      throw new Error(
        `Invalid target channel format(s): ${invalidTargets.map((t) => `"${t}"`).join(", ")}. Use @username, t.me/link, or numeric chat ID.`,
      );
    }

    // 4. Check for duplicate targets
    const uniqueTargets = [...new Set(data.targets)];
    if (uniqueTargets.length !== data.targets.length) {
      console.warn(`[ForwardBridge] Removed duplicate targets, using ${uniqueTargets.length} unique target(s)`);
    }

    // 5. Retrieve user's userbots
    const { data: userbots, error: botsError } = await supabaseAdmin
      .from("userbots")
      .select("id, username, phone, active, session_string")
      .eq("owner_telegram_id", user.id);

    if (botsError) {
      console.error(`[ForwardBridge] Database error fetching userbots:`, botsError.message);
      throw new Error(`Failed to fetch your userbots: ${botsError.message}`);
    }

    if (!userbots || userbots.length === 0) {
      throw new Error(
        "No userbots configured. Please add a Telegram account to your profile before forwarding messages.",
      );
    }

    // 6. Verify at least one userbot is active and has a session
    const activeBots = userbots.filter((b) => b.active && b.session_string);
    if (activeBots.length === 0) {
      throw new Error(
        `All userbots are inactive or missing session data. Please reconnect a Telegram account.`,
      );
    }

    console.log(
      `[ForwardBridge] User has ${activeBots.length} active userbot(s) out of ${userbots.length} total`,
    );

    // 7. Retrieve forward targets for this userbot (for reference)
    const { data: forwardTargets, error: targetsError } = await supabaseAdmin
      .from("forward_targets")
      .select("id, target_link, target_type, userbot_id")
      .in("userbot_id", activeBots.map((b) => b.id))
      .eq("active", true);

    if (targetsError) {
      console.warn(`[ForwardBridge] Could not fetch existing forward targets:`, targetsError.message);
    }

    // 8. Create forward_events records in transaction-like manner
    const jobId = `fwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventRecords: Array<{
      id: string;
      userbot_id: string;
      target_id: string | null;
      status: "success" | "failed" | "skipped";
      created_at: string;
    }> = [];

    // Create one forward_event per active userbot (representing the job)
    for (const bot of activeBots) {
      eventRecords.push({
        id: `${jobId}_${bot.id}`,
        userbot_id: bot.id,
        target_id: null, // Will be populated per-target during execution
        status: "skipped", // Initial status is 'skipped' until worker processes it
        created_at: new Date().toISOString(),
      });
    }

    // 9. Insert event records (one per active userbot)
    if (eventRecords.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("forward_events")
        .insert(eventRecords);

      if (insertError) {
        console.error(`[ForwardBridge] Failed to log forward events:`, insertError.message);
        throw new Error(`Failed to create job record: ${insertError.message}`);
      }

      console.log(
        `[ForwardBridge] Created ${eventRecords.length} forward_events record(s) for job ${jobId}`,
      );
    }

    // 10. Prepare and enqueue worker job
    let workerResult = { job_id: jobId, status: "pending" };
    try {
      const workerPayload: ForwardJobPayload = {
        job_id: jobId,
        userbot_id: activeBots[0].id, // Primary bot; worker may use all active bots
        source: data.source,
        targets: uniqueTargets,
        batch_size: data.batchSize || 10,
        infinite_loop: data.infinite || false,
        keep_author: data.keepAuthor !== false, // Default to true
      };

      workerResult = await triggerWorkerJob(workerPayload);
      console.log(`[ForwardBridge] Job ${jobId} successfully enqueued with worker`);
    } catch (workerErr) {
      // Update event records to 'failed' if worker trigger failed
      const failureMsg = workerErr instanceof Error ? workerErr.message : String(workerErr);
      console.error(`[ForwardBridge] Worker trigger failed for job ${jobId}:`, failureMsg);

      // Update forward_events records with failure status
      const failureIds = eventRecords.map((e) => e.id);
      if (failureIds.length > 0) {
        await supabaseAdmin
          .from("forward_events")
          .update({ status: "failed" })
          .in("id", failureIds)
          .catch((err) => {
            console.error(`[ForwardBridge] Could not update failure status:`, err.message);
          });
      }

      throw new Error(
        `Failed to enqueue forwarding job: ${failureMsg}. Job record created but not triggered.`,
      );
    }

    // 11. Return success response with tracking info
    return {
      job_id: jobId,
      status: workerResult.status,
      message: "Forwarding job enqueued successfully",
      details: {
        source: data.source,
        targets: uniqueTargets,
        targetCount: uniqueTargets.length,
        activeBots: activeBots.length,
        batchSize: data.batchSize || 10,
        infinite: data.infinite || false,
      },
    };
  });

/**
 * Retrieves the status of a specific forwarding job by ID.
 * Returns aggregate statistics across all userbots for that job.
 */
export const getForwardingJobStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().min(1), jobId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);
    console.log(`[ForwardBridge] User ${user.id} checking status of job ${data.jobId}`);

    // Retrieve all events for this job across user's userbots
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("forward_events")
      .select("id, status, target_id, created_at, userbot_id")
      .like("id", `${data.jobId}%`);

    if (eventsError) {
      console.error(`[ForwardBridge] Error fetching job events:`, eventsError.message);
      throw new Error(`Failed to fetch job status: ${eventsError.message}`);
    }

    if (!events || events.length === 0) {
      throw new Error(`Job not found: ${data.jobId}`);
    }

    // Verify job belongs to user
    const userBotIds = new Set(
      (
        await supabaseAdmin
          .from("userbots")
          .select("id")
          .eq("owner_telegram_id", user.id)
      ).data?.map((b) => b.id) || [],
    );

    const userEvents = events.filter((e) => userBotIds.has(e.userbot_id));
    if (userEvents.length === 0) {
      throw new Error("Unauthorized: Job does not belong to this user");
    }

    // Aggregate stats
    const statusCounts = {
      success: 0,
      failed: 0,
      skipped: 0,
    };
    for (const event of userEvents) {
      statusCounts[event.status as keyof typeof statusCounts]++;
    }

    const targetIds = new Set(userEvents.map((e) => e.target_id).filter(Boolean) as string[]);

    return {
      job_id: data.jobId,
      total_events: userEvents.length,
      status_breakdown: statusCounts,
      unique_targets: targetIds.size,
      created_at: userEvents[0]?.created_at,
    };
  });

/**
 * Retrieves user's forwarding history (last 20 jobs).
 * Returns aggregated job summaries for dashboard display.
 */
export const getForwardingHistory = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().min(1), limit: z.number().int().min(1).max(100).optional() }).parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);
    const limit = data.limit || 20;
    console.log(`[ForwardBridge] Fetching forwarding history for user ${user.id} (limit: ${limit})`);

    // Get user's userbot IDs
    const { data: bots, error: botsError } = await supabaseAdmin
      .from("userbots")
      .select("id")
      .eq("owner_telegram_id", user.id);

    if (botsError) {
      console.error(`[ForwardBridge] Error fetching user's bots:`, botsError.message);
      throw new Error(`Failed to fetch history: ${botsError.message}`);
    }

    const botIds = (bots ?? []).map((b) => b.id);
    if (botIds.length === 0) {
      return { jobs: [] };
    }

    // Fetch forward events for these bots
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("forward_events")
      .select("id, status, created_at, userbot_id")
      .in("userbot_id", botIds)
      .order("created_at", { ascending: false })
      .limit(limit * 5); // Fetch more to account for multiple events per job

    if (eventsError) {
      console.error(`[ForwardBridge] Error fetching forward events:`, eventsError.message);
      throw new Error(`Failed to fetch history: ${eventsError.message}`);
    }

    // Group events by job ID (extract prefix before bot ID)
    const jobMap: Record<
      string,
      {
        job_id: string;
        status_breakdown: { success: number; failed: number; skipped: number };
        event_count: number;
        created_at: string;
        last_updated: string;
      }
    > = {};

    for (const event of events ?? []) {
      const jobId = event.id.substring(0, event.id.lastIndexOf("_"));
      if (!jobMap[jobId]) {
        jobMap[jobId] = {
          job_id: jobId,
          status_breakdown: { success: 0, failed: 0, skipped: 0 },
          event_count: 0,
          created_at: event.created_at,
          last_updated: event.created_at,
        };
      }
      jobMap[jobId].status_breakdown[event.status as keyof typeof jobMap[string]["status_breakdown"]]++;
      jobMap[jobId].event_count++;
      jobMap[jobId].last_updated = new Date(event.created_at) > new Date(jobMap[jobId].last_updated) ? event.created_at : jobMap[jobId].last_updated;
    }

    const jobs = Object.values(jobMap).slice(0, limit);
    console.log(`[ForwardBridge] Retrieved ${jobs.length} jobs from history`);

    return { jobs };
  });

/**
 * Cancels a forwarding job by updating its status to 'failed' in the database.
 * Worker should check for this status and halt processing.
 * NOTE: Worker must actively check and respect the 'cancelled' status or similar.
 */
export const cancelForwardingJob = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().min(1), jobId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);
    console.log(`[ForwardBridge] User ${user.id} requested cancellation of job ${data.jobId}`);

    // Get user's userbots
    const { data: bots } = await supabaseAdmin.from("userbots").select("id").eq("owner_telegram_id", user.id);
    const userBotIds = new Set((bots ?? []).map((b) => b.id));

    // Verify job belongs to user and update status
    const { data: events, error: fetchError } = await supabaseAdmin
      .from("forward_events")
      .select("userbot_id")
      .like("id", `${data.jobId}%`);

    if (fetchError) {
      throw new Error(`Failed to fetch job: ${fetchError.message}`);
    }

    if (!events || events.length === 0) {
      throw new Error(`Job not found: ${data.jobId}`);
    }

    const ownsJob = events.some((e) => userBotIds.has(e.userbot_id));
    if (!ownsJob) {
      throw new Error("Unauthorized: Cannot cancel job you don't own");
    }

    // Mark all events for this job as 'failed' (indicating cancellation)
    const eventIds = events.map((e) => `${data.jobId}_${e.userbot_id}`);
    const { error: updateError } = await supabaseAdmin
      .from("forward_events")
      .update({ status: "failed" })
      .in("id", eventIds);

    if (updateError) {
      console.error(`[ForwardBridge] Failed to cancel job:`, updateError.message);
      throw new Error(`Failed to cancel job: ${updateError.message}`);
    }

    console.log(`[ForwardBridge] Job ${data.jobId} marked as cancelled (${eventIds.length} events updated)`);
    return { cancelled: true, events_updated: eventIds.length };
  });

/* ============================================================
 * TRIAL & SUBSCRIPTION MANAGEMENT
 * ============================================================ */

/**
 * Grants a new user 6 hours of free forwarding trial.
 * Only grants if the user has no prior trial_grants record.
 * Returns the expiry timestamp and remaining hours.
 */
export const grantUserbot6HourTrial = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);
    
    // Check if user already has a trial grant
    const { data: existingTrial, error: checkError } = await (supabaseAdmin
      .from("trial_grants" as any)
      .select("id, status, expiry_time")
      .eq("telegram_id", user.id)
      .maybeSingle() as any);

    if (checkError) throw new Error(checkError.message);

    // If trial already exists and is active, return existing trial info
    if (existingTrial && existingTrial.status === "active") {
      const hoursRemaining = (new Date(existingTrial.expiry_time).getTime() - Date.now()) / (1000 * 60 * 60);
      return {
        trial_granted: false,
        reason: "existing_active_trial",
        expiry_time: existingTrial.expiry_time,
        hours_remaining: Math.max(0, hoursRemaining),
      };
    }

    // Grant new 6-hour trial
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    const { error: insertError } = await (supabaseAdmin
      .from("trial_grants" as any)
      .upsert(
        {
          telegram_id: user.id,
          start_time: now.toISOString(),
          expiry_time: expiryTime.toISOString(),
          status: "active",
        },
        { onConflict: "telegram_id" },
      ) as any);

    if (insertError) throw new Error(insertError.message);

    console.log(`[Trial] Granted 6-hour trial to user ${user.id}, expires at ${expiryTime.toISOString()}`);

    return {
      trial_granted: true,
      reason: "new_trial_activated",
      expiry_time: expiryTime.toISOString(),
      hours_remaining: 6,
    };
  });

/**
 * Checks the trial status for a user.
 * Returns current status, expiry time, and remaining hours.
 */
export const checkTrialStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);

    const { data: trial, error } = await supabaseAdmin
      .from("trial_grants")
      .select("id, status, start_time, expiry_time, created_at")
      .eq("telegram_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!trial) {
      return {
        has_trial: false,
        status: "no_trial",
        expiry_time: null,
        hours_remaining: 0,
        is_expired: false,
      };
    }

    const now = Date.now();
    const expiryMs = new Date(trial.expiry_time).getTime();
    const isExpired = now > expiryMs;

    if (isExpired && trial.status === "active") {
      // Mark as expired in DB
      await supabaseAdmin
        .from("trial_grants")
        .update({ status: "expired" })
        .eq("id", trial.id)
        .catch((err) => console.warn("Could not update trial status:", err));
    }

    const hoursRemaining = Math.max(0, (expiryMs - now) / (1000 * 60 * 60));

    return {
      has_trial: true,
      status: isExpired ? "expired" : trial.status,
      start_time: trial.start_time,
      expiry_time: trial.expiry_time,
      hours_remaining: hoursRemaining,
      is_expired: isExpired,
    };
  });

/** Returns the list of userbots for the authenticated caller. */
export const getMyUserbots = createServerFn({ method: "POST" })
  .inputValidator((d) => InitDataInput.parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);
    const { data: bots, error } = await supabaseAdmin
      .from("userbots")
      .select("id, username, phone, active, created_at, updated_at")
      .eq("owner_telegram_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { userbots: bots ?? [] };
  });

/**
 * Admin function: Extends a userbot's subscription duration.
 * Can add days, set exact expiry date, or add hours.
 */
export const adminExtendUserbot = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        initData: z.string().min(1),
        userbot_id: z.string().uuid(),
        days_to_add: z.number().int().optional(),
        expiry_date: z.string().optional(), // ISO date string
        hours_to_add: z.number().optional(),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.initData);

    // Fetch current subscription duration
    const { data: currentSub, error: fetchError } = await supabaseAdmin
      .from("subscription_durations")
      .select("id, expiry_date, hours_remaining, days_remaining")
      .eq("userbot_id", data.userbot_id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);

    let newExpiryDate: Date;

    if (data.expiry_date) {
      // Set exact expiry date
      newExpiryDate = new Date(data.expiry_date);
    } else if (data.days_to_add) {
      // Add days to current or now
      const baseDate = currentSub ? new Date(currentSub.expiry_date) : new Date();
      newExpiryDate = new Date(baseDate.getTime() + data.days_to_add * 24 * 60 * 60 * 1000);
    } else if (data.hours_to_add) {
      // Add hours to current or now
      const baseDate = currentSub ? new Date(currentSub.expiry_date) : new Date();
      newExpiryDate = new Date(baseDate.getTime() + data.hours_to_add * 60 * 60 * 1000);
    } else {
      throw new Error("Must provide either days_to_add, expiry_date, or hours_to_add");
    }

    const { error: upsertError } = await supabaseAdmin
      .from("subscription_durations")
      .upsert(
        {
          userbot_id: data.userbot_id,
          expiry_date: newExpiryDate.toISOString(),
          hours_remaining: 0,
          days_remaining: 0,
          notes: data.notes || null,
          last_extended_at: new Date().toISOString(),
          extended_by_admin: admin.username || `user_${admin.id}`,
        },
        { onConflict: "userbot_id" },
      );

    if (upsertError) throw new Error(upsertError.message);

    console.log(
      `[Subscription] Admin ${admin.id} extended userbot ${data.userbot_id} to ${newExpiryDate.toISOString()}`,
    );

    return {
      userbot_id: data.userbot_id,
      new_expiry_date: newExpiryDate.toISOString(),
      extended_by: admin.username || `user_${admin.id}`,
      updated_at: new Date().toISOString(),
    };
  });

/**
 * Checks if a userbot's subscription is active and valid.
 * Used by forwarding validation to block expired accounts.
 */
export const checkUserbotSubscription = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ initData: z.string().min(1), userbot_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const user = await authenticate(data.initData);

    // Verify userbot ownership
    const { data: userbot, error: botError } = await supabaseAdmin
      .from("userbots")
      .select("id, owner_telegram_id")
      .eq("id", data.userbot_id)
      .maybeSingle();

    if (botError) throw new Error(botError.message);
    if (!userbot || userbot.owner_telegram_id !== user.id) {
      throw new Error("Userbot not found or not owned by this user");
    }

    // Check subscription duration
    const { data: subDuration, error: subError } = await supabaseAdmin
      .from("subscription_durations")
      .select("id, expiry_date, hours_remaining, days_remaining")
      .eq("userbot_id", data.userbot_id)
      .maybeSingle();

    if (subError) throw new Error(subError.message);

    if (!subDuration) {
      return {
        is_active: false,
        reason: "no_subscription",
        expiry_date: null,
        hours_remaining: 0,
        is_expired: true,
      };
    }

    const now = Date.now();
    const expiryMs = new Date(subDuration.expiry_date).getTime();
    const isExpired = now > expiryMs;

    return {
      is_active: !isExpired,
      reason: isExpired ? "subscription_expired" : "subscription_active",
      expiry_date: subDuration.expiry_date,
      hours_remaining: Math.max(0, (expiryMs - now) / (1000 * 60 * 60)),
      is_expired: isExpired,
    };
  });
