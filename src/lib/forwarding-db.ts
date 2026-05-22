/**
 * Forwarding Database Module
 * ==========================
 * Handles all database operations related to forwarding jobs.
 * Ensures consistency and proper error logging.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type ForwardStatus = Database["public"]["Enums"]["forward_status"];

export interface ForwardEventRecord {
  id: string;
  userbot_id: string;
  target_id: string | null;
  status: ForwardStatus;
  created_at: string;
}

export interface JobSummary {
  job_id: string;
  total_events: number;
  succeeded: number;
  failed: number;
  skipped: number;
  created_at: string;
  last_updated: string;
}

/**
 * Creates forward_events records for a new forwarding job.
 * One record per active userbot to track job progress.
 */
export async function createForwardEventRecords(
  jobId: string,
  userBotIds: string[],
): Promise<ForwardEventRecord[]> {
  if (userBotIds.length === 0) {
    throw new Error("Cannot create event records with no userbots");
  }

  const records: ForwardEventRecord[] = userBotIds.map((botId) => ({
    id: `${jobId}_${botId}`,
    userbot_id: botId,
    target_id: null,
    status: "skipped" as ForwardStatus,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin.from("forward_events").insert(records);

  if (error) {
    console.error("[ForwardingDB] Failed to create event records:", error.message);
    throw new Error(`Failed to create job records: ${error.message}`);
  }

  console.log(`[ForwardingDB] Created ${records.length} forward_events record(s) for job ${jobId}`);
  return records;
}

/**
 * Updates the status of forward_events records.
 * Used to mark jobs as successful, failed, or skipped.
 */
export async function updateForwardEventStatus(
  jobId: string,
  status: ForwardStatus,
  targetId?: string | null,
): Promise<number> {
  const updateData: any = { status };
  if (targetId !== undefined) {
    updateData.target_id = targetId;
  }

  const { data, error } = await supabaseAdmin
    .from("forward_events")
    .update(updateData)
    .like("id", `${jobId}%`)
    .select();

  if (error) {
    console.error("[ForwardingDB] Failed to update event status:", error.message);
    throw new Error(`Failed to update job status: ${error.message}`);
  }

  const updatedCount = data?.length || 0;
  console.log(
    `[ForwardingDB] Updated ${updatedCount} event(s) for job ${jobId} to status="${status}"`,
  );
  return updatedCount;
}

/**
 * Retrieves job summary (aggregated stats across all events).
 */
export async function getJobSummary(jobId: string, userBotIds: string[]): Promise<JobSummary> {
  const { data: events, error } = await supabaseAdmin
    .from("forward_events")
    .select("status, created_at")
    .like("id", `${jobId}%`)
    .in("userbot_id", userBotIds);

  if (error) {
    console.error("[ForwardingDB] Failed to fetch job summary:", error.message);
    throw new Error(`Failed to fetch job summary: ${error.message}`);
  }

  const eventList = events ?? [];
  const summary: JobSummary = {
    job_id: jobId,
    total_events: eventList.length,
    succeeded: eventList.filter((e) => e.status === "success").length,
    failed: eventList.filter((e) => e.status === "failed").length,
    skipped: eventList.filter((e) => e.status === "skipped").length,
    created_at: eventList[0]?.created_at || new Date().toISOString(),
    last_updated: eventList[eventList.length - 1]?.created_at || new Date().toISOString(),
  };

  return summary;
}

/**
 * Retrieves all forward events for a specific job.
 */
export async function getForwardEvents(
  jobId: string,
  userBotIds: string[],
): Promise<ForwardEventRecord[]> {
  const { data: events, error } = await supabaseAdmin
    .from("forward_events")
    .select("*")
    .like("id", `${jobId}%`)
    .in("userbot_id", userBotIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ForwardingDB] Failed to fetch forward events:", error.message);
    throw new Error(`Failed to fetch job events: ${error.message}`);
  }

  return (events ?? []) as ForwardEventRecord[];
}

/**
 * Retrieves user's userbots with necessary session data.
 */
export async function getUserUserbots(
  telegramId: number,
  activeOnly = true,
): Promise<
  Array<{
    id: string;
    username: string | null;
    phone: string | null;
    active: boolean;
    session_string: string | null;
  }>
> {
  let query = supabaseAdmin
    .from("userbots")
    .select("id, username, phone, active, session_string")
    .eq("owner_telegram_id", telegramId);

  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ForwardingDB] Failed to fetch userbots:", error.message);
    throw new Error(`Failed to fetch userbots: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Logs an error or status update to the application error log.
 * Useful for debugging worker failures.
 */
export async function logForwardingError(
  jobId: string,
  userBotId: string,
  errorMessage: string,
  context?: Record<string, unknown>,
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    job_id: jobId,
    userbot_id: userBotId,
    error: errorMessage,
    context: context || {},
  };

  console.error("[ForwardingDB] Forward job error:", logEntry);

  // TODO: Implement error logging table if needed in future migrations
  // await supabaseAdmin.from("forward_errors").insert(logEntry);
}

/**
 * Cleanup function to remove old forward_events records.
 * Can be scheduled as a maintenance task.
 */
export async function cleanupOldForwardEvents(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("forward_events")
    .delete()
    .lt("created_at", cutoffDate)
    .select();

  if (error) {
    console.error("[ForwardingDB] Failed to cleanup old events:", error.message);
    throw new Error(`Failed to cleanup events: ${error.message}`);
  }

  const deletedCount = data?.length || 0;
  console.log(`[ForwardingDB] Cleaned up ${deletedCount} old forward_events record(s)`);
  return deletedCount;
}
