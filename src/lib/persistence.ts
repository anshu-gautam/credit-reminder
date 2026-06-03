// Lightweight JSON-file persistence for the dynamic operational data
// (alert history, dedupe state, the job queue, runtime-state events).
//
// This is a pragmatic stand-in for the database tables in PRD §19: it survives
// process restarts on a normal filesystem, and degrades gracefully to in-memory
// only when the filesystem is read-only (e.g. some serverless runtimes). The
// seeded reference data (registry, feature config) still lives in code.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { AlertEvent } from "./types";

export interface QueuedJob {
  id: string;
  feature: string;
  provider: string;
  customerId?: string | null;
  enqueuedAt: string;
  status: "queued" | "processed";
  processedAt?: string | null;
}

export interface RuntimeStateEvent {
  id: string;
  scopeType: "provider" | "feature" | "global";
  scopeId: string;
  previousState: string | null;
  newState: string;
  reason: string;
  actor: string;
  createdAt: string;
}

export interface PersistedState {
  alertHistory: AlertEvent[];
  // dedupeKey -> ISO timestamp the alert was last sent.
  dedupe: Record<string, string>;
  // dedupeKey -> active (unresolved) AlertEvent id, used to emit recovery once.
  activeAlerts: Record<string, string>;
  queue: QueuedJob[];
  runtimeStateEvents: RuntimeStateEvent[];
}

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), ".data");
const STATE_FILE = join(DATA_DIR, "state.json");

function emptyState(): PersistedState {
  return {
    alertHistory: [],
    dedupe: {},
    activeAlerts: {},
    queue: [],
    runtimeStateEvents: [],
  };
}

// Cached in-memory copy; written through to disk on every mutation.
let cache: PersistedState | null = null;
let writable = true;

export function loadState(): PersistedState {
  if (cache) return cache;
  try {
    if (existsSync(STATE_FILE)) {
      const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<PersistedState>;
      const loaded: PersistedState = { ...emptyState(), ...parsed };
      cache = loaded;
      return loaded;
    }
  } catch {
    // Corrupt or unreadable file — start fresh.
  }
  const fresh = emptyState();
  cache = fresh;
  return fresh;
}

export function saveState(next: PersistedState): void {
  cache = next;
  if (!writable) return;
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), "utf8");
  } catch {
    // Read-only filesystem — keep operating from the in-memory cache only.
    writable = false;
  }
}

// Apply a mutation to the persisted state and write it through.
export function mutateState<T>(fn: (state: PersistedState) => T): T {
  const state = loadState();
  const result = fn(state);
  saveState(state);
  return result;
}

export function isWritable(): boolean {
  return writable;
}
