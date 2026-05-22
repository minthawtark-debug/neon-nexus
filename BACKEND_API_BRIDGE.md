# Message Forwarding API Bridge - Backend Implementation

## Overview

This document describes the complete backend logic for the **Message Forwarding API Bridge** implemented in the Neon-Nexus application. The system handles user-initiated message forwarding requests from a source Telegram channel to multiple target channels.

## Architecture

### Component Stack

```
Frontend (React Router) 
    ↓ 
Server Functions (TanStack React Start)
    ↓
API Bridge Layer (app.functions.ts)
    ↓
Database Layer (Supabase)
    ↓
Worker Bridge (worker-bridge.ts)
    ↓
External Worker (worker.py via webhook)
```

### Data Flow

1. **User Initiation**: User submits forwarding request via UI
2. **Server Function Invocation**: `initiateMessageForwarding()` is called with init data, source, targets
3. **Authentication**: Telegram init data is verified and user profile is loaded
4. **Validation**: Source/target channels are validated, user's userbots are verified
5. **Job Creation**: Forward event records are created in the database
6. **Worker Enqueue**: Job is sent to worker via webhook with Bearer token authentication
7. **Async Processing**: Worker processes the job and updates status asynchronously
8. **Status Tracking**: User can poll job status via `getForwardingJobStatus()`

## API Functions

### 1. `initiateMessageForwarding()`

**Purpose**: Initiates a new message forwarding job

**Input**:
```typescript
{
  initData: string;           // Telegram init data
  source: string;             // Source channel (@handle, t.me/link, or numeric ID)
  targets: string[];          // Target channels (array of @handle, t.me/link, or numeric IDs)
  batchSize?: number;         // Batch size for splitting (1-100, default: 10)
  infinite?: boolean;         // Loop infinitely (default: false)
  keepAuthor?: boolean;       // Keep original author (default: true)
}
```

**Output**:
```typescript
{
  job_id: string;             // Unique job identifier (e.g., "fwd_1234567890_abc123def")
  status: string;             // "enqueued_worker" | "enqueued_local"
  message: string;            // Human-readable status message
  details: {
    source: string;
    targets: string[];
    targetCount: number;
    activeBots: number;
    batchSize: number;
    infinite: boolean;
  };
}
```

**Validations**:
- ✓ Telegram init data is valid
- ✓ Source channel format is valid
- ✓ All target channels have valid format
- ✓ No duplicate targets
- ✓ User owns at least one active userbot with session
- ✓ Database transaction succeeds

**Error Handling**:
- Invalid channel formats → HTTP 400
- No active userbots → HTTP 400
- Database errors → HTTP 500 with descriptive message
- Worker webhook failure → Job created but marked as failed

### 2. `getForwardingJobStatus()`

**Purpose**: Retrieves the current status of a forwarding job

**Input**:
```typescript
{
  initData: string;
  jobId: string;              // Job ID returned from initiateMessageForwarding()
}
```

**Output**:
```typescript
{
  job_id: string;
  total_events: number;       // Total forward_events records for this job
  status_breakdown: {
    success: number;
    failed: number;
    skipped: number;
  };
  unique_targets: number;     // Unique target channels reached
  created_at: string;         // ISO timestamp
}
```

**Validations**:
- ✓ Telegram init data is valid
- ✓ Job ID exists in database
- ✓ User owns the job (can only see their own jobs)

### 3. `getForwardingHistory()`

**Purpose**: Retrieves user's forwarding job history

**Input**:
```typescript
{
  initData: string;
  limit?: number;             // Max jobs to return (1-100, default: 20)
}
```

**Output**:
```typescript
{
  jobs: Array<{
    job_id: string;
    status_breakdown: {
      success: number;
      failed: number;
      skipped: number;
    };
    event_count: number;
    created_at: string;
    last_updated: string;
  }>;
}
```

### 4. `cancelForwardingJob()`

**Purpose**: Cancels a forwarding job by marking it as failed

**Input**:
```typescript
{
  initData: string;
  jobId: string;
}
```

**Output**:
```typescript
{
  cancelled: boolean;
  events_updated: number;
}
```

**Note**: Worker must actively check and respect cancellation status.

## Database Schema

### `forward_events` Table

```sql
CREATE TABLE public.forward_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  userbot_id uuid NOT NULL REFERENCES public.userbots(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.forward_targets(id) ON DELETE SET NULL,
  status public.forward_status NOT NULL,  -- 'success', 'failed', 'skipped'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_userbot_time ON public.forward_events(userbot_id, created_at DESC);
```

### Job ID Format

```
fwd_{timestamp}_{random_string}

Example: fwd_1704067200000_a1b2c3d4e5
```

### Event ID Format

```
{job_id}_{userbot_id_first_8_chars}...

Example: fwd_1704067200000_a1b2c3d4_550e8400-e29b...
```

## Worker Communication

### Webhook Configuration

**Environment Variables**:
- `WORKER_INGEST_WEBHOOK`: URL to worker webhook endpoint
- `WORKER_INGEST_SECRET`: Bearer token for authentication (optional)

### Request Format

**Endpoint**: `POST ${WORKER_INGEST_WEBHOOK}`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer ${WORKER_INGEST_SECRET}
X-Job-ID: {job_id}
X-Timestamp: {ISO_8601_timestamp}
```

**Body**:
```json
{
  "type": "forward_job",
  "job_id": "fwd_1704067200000_a1b2c3d4e5",
  "userbot_id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "@source_channel",
  "targets": ["@target_one", "@target_two", "@target_three"],
  "batch_size": 10,
  "infinite_loop": false,
  "keep_author": true
}
```

### Response Format

**Success (200 OK)**:
```json
{
  "job_id": "fwd_1704067200000_a1b2c3d4e5",
  "status": "enqueued",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Error (4xx/5xx)**:
```
Plain text or JSON with error details
```

### Webhook Fallback Behavior

If webhook is unreachable or returns error:
1. Event records are created with status = `'skipped'`
2. Error is logged with `[ForwardBridge]` prefix
3. Response indicates local queueing only
4. User can retry or cancel the job

## Error Handling

### Error Categories

| Category | Status | Message | Recovery |
|----------|--------|---------|----------|
| **Validation** | 400 | Invalid channel format | User must fix input |
| **Authentication** | 401 | Invalid Telegram init data | User must re-authenticate |
| **Authorization** | 403 | User doesn't own this resource | Check user identity |
| **Not Found** | 404 | Job not found | Check job ID |
| **Database** | 500 | Database error details | Retry operation |
| **Worker** | 502 | Worker webhook failed | Check worker service |

### Logging Pattern

All operations log with `[ForwardBridge]` prefix:

```
[ForwardBridge] User 123456 initiated forwarding from @source to 3 target(s)
[ForwardBridge] Created 1 forward_events record(s) for job fwd_1704067200000_a1b2c3d4e5
[ForwardBridge] Job enqueued with worker successfully
[ForwardBridge] Worker job enqueued: fwd_1704067200000_a1b2c3d4e5
```

## Security Considerations

### Authentication

- ✓ All API functions require valid Telegram init data
- ✓ `authenticate()` verifies data signature against TELEGRAM_BOT_TOKEN
- ✓ In dev mode (no bot token), debug bypass allowed with numeric user ID

### Authorization

- ✓ Users can only see their own userbots
- ✓ Users can only cancel their own jobs
- ✓ Job history is filtered to user's userbots only
- ✓ Database-level RLS prevents cross-user access

### Worker Authentication

- ✓ Worker calls authenticated via Bearer token
- ✓ Token passed in Authorization header
- ✓ Secret configured via environment variable

### Data Validation

- ✓ Input sanitized via Zod schemas
- ✓ Channel IDs validated against regex patterns
- ✓ Batch size constrained to 1-100
- ✓ Target count validated

## Performance Optimization

### Database Queries

1. **Indexes**: `idx_events_userbot_time` for fast history retrieval
2. **Batch Operations**: All event inserts done in single query
3. **Select Minimization**: Only fetch necessary fields

### Worker Communication

1. **Async Invocation**: Worker call doesn't block response
2. **No Polling**: Status retrieved on-demand by user
3. **Webhook Timeout**: Default 30 seconds (configurable in fetch)

### Rate Limiting

- Not implemented yet (future enhancement)
- Consider: 10 jobs/min per user, 1000 jobs/min globally

## Testing

### Unit Tests

```typescript
// Test channel ID validation
isValidChannelId("@valid_channel")        // true
isValidChannelId("https://t.me/channel")  // true
isValidChannelId("invalid!")              // false
```

### Integration Tests

```typescript
// Test full job flow
1. Call initiateMessageForwarding()
2. Verify forward_events created
3. Call getForwardingJobStatus()
4. Verify correct counts
5. Call cancelForwardingJob()
6. Verify status updated
```

### Mock Worker

```json
{
  "job_id": "fwd_1704067200000_a1b2c3d4e5",
  "status": "enqueued",
  "forwarded_count": 42,
  "failed_count": 0
}
```

## Future Enhancements

1. **Job Monitoring Dashboard**: Real-time progress tracking
2. **Retry Logic**: Automatic retry for transient failures
3. **Rate Limiting**: Per-user and global rate limits
4. **Job Scheduling**: Schedule forwarding for specific times
5. **Proxy Support**: Use proxy pool for forwarding
6. **Error Recovery**: Automatic resume on failures
7. **Analytics**: Track forwarding success rates per user
8. **Webhooks**: Push notifications when jobs complete

## Troubleshooting

### Job Not Triggering

1. Check `WORKER_INGEST_WEBHOOK` is set
2. Verify `WORKER_INGEST_SECRET` matches worker expectations
3. Check worker service logs for connection errors
4. Verify job was created in `forward_events` table

### Status Shows "skipped"

1. Worker webhook unreachable
2. Worker returned error response
3. Check worker service health

### Permission Denied Errors

1. Verify user owns the userbot
2. Verify user owns the job
3. Check Telegram init data validity

## Related Files

- **Main Implementation**: `src/lib/app.functions.ts`
- **Worker Bridge**: `src/lib/worker-bridge.ts`
- **Database Ops**: `src/lib/forwarding-db.ts`
- **Database Schema**: `supabase/migrations/20260521140810_*`
- **Frontend Router**: `src/routes/forward.tsx`
- **Worker Implementation**: `worker.py` (Python)

## Deployment Checklist

- [ ] `WORKER_INGEST_WEBHOOK` environment variable set
- [ ] `WORKER_INGEST_SECRET` environment variable set
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `TELEGRAM_BOT_TOKEN` set for production
- [ ] Database migrations applied
- [ ] Worker service running and healthy
- [ ] Webhook endpoint accessible from API server
- [ ] Error logging configured
- [ ] Monitoring and alerting setup
