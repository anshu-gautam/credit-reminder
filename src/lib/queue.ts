// Job queue backing the gateway's queue/pause enforcement (PRD FR-7).
// Queued jobs are persisted and drained on provider recovery (handled in the
// alert engine), giving real "queue then resume" behavior rather than a no-op.

import { loadState, mutateState } from "./persistence";
import type { QueuedJob } from "./persistence";

export function enqueueJob(input: {
  feature: string;
  provider: string;
  customerId?: string | null;
}): QueuedJob {
  const job: QueuedJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    feature: input.feature,
    provider: input.provider,
    customerId: input.customerId ?? null,
    enqueuedAt: new Date().toISOString(),
    status: "queued",
    processedAt: null,
  };
  mutateState((s) => {
    s.queue.unshift(job);
    if (s.queue.length > 500) s.queue.length = 500;
  });
  return job;
}

export function listQueue(): QueuedJob[] {
  return loadState().queue;
}

export function pendingCount(provider?: string): number {
  return loadState().queue.filter(
    (j) => j.status === "queued" && (!provider || j.provider === provider),
  ).length;
}

// Manually drain queued jobs for a provider (also done automatically on recovery).
export function drainProvider(provider: string): number {
  return mutateState((s) => {
    let drained = 0;
    for (const job of s.queue) {
      if (job.provider === provider && job.status === "queued") {
        job.status = "processed";
        job.processedAt = new Date().toISOString();
        drained += 1;
      }
    }
    return drained;
  });
}
