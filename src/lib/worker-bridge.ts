/**
 * Worker Bridge Module
 * ====================
 * Handles all communication with worker.py via webhook.
 * Manages job enqueuing, status polling, and error recovery.
 */

export interface WorkerJobConfig {
  job_id: string;
  userbot_id: string;
  source: string;
  targets: string[];
  batch_size?: number;
  infinite_loop?: boolean;
  keep_author?: boolean;
  proxies?: Array<{
    ip: string;
    port: number;
    username?: string;
    password?: string;
  }>;
}

export interface WorkerJobResponse {
  job_id: string;
  status: "enqueued_worker" | "enqueued_local" | "pending";
  timestamp?: string;
  error?: string;
}

export class WorkerBridgeError extends Error {
  constructor(
    public code: string,
    message: string,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = "WorkerBridgeError";
  }
}

/**
 * Enqueues a forwarding job with the worker.
 * Sends job configuration via webhook with authentication.
 */
export async function enqueueWorkerJob(config: WorkerJobConfig): Promise<WorkerJobResponse> {
  const webhookUrl = process.env.WORKER_INGEST_WEBHOOK;
  const webhookSecret = process.env.WORKER_INGEST_SECRET;

  if (!webhookUrl) {
    console.warn("[WorkerBridge] No webhook URL configured, returning local status");
    return {
      job_id: config.job_id,
      status: "enqueued_local",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Job-ID": config.job_id,
        "X-Timestamp": new Date().toISOString(),
        ...(webhookSecret && { Authorization: `Bearer ${webhookSecret}` }),
      },
      body: JSON.stringify({
        type: "forward_job",
        ...config,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new WorkerBridgeError(
        "WEBHOOK_ERROR",
        `Worker webhook returned ${response.status}: ${errorBody}`,
      );
    }

    const result = await response.json();
    console.log(`[WorkerBridge] Job enqueued successfully: ${config.job_id}`);

    return {
      job_id: config.job_id,
      status: "enqueued_worker",
      timestamp: new Date().toISOString(),
      ...result,
    };
  } catch (error) {
    if (error instanceof WorkerBridgeError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new WorkerBridgeError("WEBHOOK_FAILED", `Failed to reach worker webhook: ${message}`, error);
  }
}

/**
 * Validates worker webhook connectivity.
 * Useful for health checks and diagnostics.
 */
export async function checkWorkerHealth(): Promise<{ healthy: boolean; message: string }> {
  const webhookUrl = process.env.WORKER_INGEST_WEBHOOK;
  if (!webhookUrl) {
    return { healthy: false, message: "No webhook URL configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "OPTIONS",
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      return { healthy: true, message: "Worker webhook is reachable" };
    }

    return { healthy: false, message: `Worker returned status ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { healthy: false, message: `Worker unreachable: ${message}` };
  }
}

/**
 * Formats job config for logging.
 * Masks sensitive information like auth tokens.
 */
export function sanitizeJobConfig(config: WorkerJobConfig): Partial<WorkerJobConfig> {
  return {
    job_id: config.job_id,
    userbot_id: config.userbot_id.substring(0, 8) + "...",
    source: config.source,
    targets: config.targets.slice(0, 3).map((t) => t.substring(0, 20)),
    batch_size: config.batch_size,
    infinite_loop: config.infinite_loop,
  };
}
