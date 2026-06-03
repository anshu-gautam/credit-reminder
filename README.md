# AI Provider Budget & Availability Monitor

A provider-agnostic monitoring and control-plane dashboard for AI spend, credits,
usage, and limits across **OpenRouter, OpenAI, and Anthropic**. Built with
**Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui**.

This is an implementation of the PRD *"Multi-Provider AI Spend, Credit, Usage,
and Limit Monitoring System"* — the internal **AI Gateway + Budget Monitor**
described there, surfaced as an admin dashboard plus admin APIs.

## Features

- **Overview dashboard** — combined spend, active alerts, request volume, and
  runtime protection state at a glance.
- **Providers** — normalized budget snapshots per provider (prepaid credits for
  OpenRouter; monthly usage / spend limits for OpenAI and Anthropic), polling
  status, and default warning/critical/emergency thresholds.
- **Feature budgets** — cross-provider budgets, priorities, allowed/fallback
  providers, low-budget behavior, and a fallback matrix (PRD FR-6, FR-9).
- **Alerts** — threshold, runtime-error, rate-limit, and recovery alerts with
  severity, dedupe channels, and recommended actions (PRD FR-5, §21).
- **Usage & cost** — spend attributed by provider, feature, and model, plus a
  live gateway event log (PRD FR-2).

## Admin APIs (PRD §20)

| Method | Route | Description |
|---|---|---|
| `GET`  | `/api/admin/ai/providers/status` | Provider health and budget status |
| `GET`  | `/api/admin/ai/features/status` | Feature state, usage, and budgets |
| `GET`  | `/api/admin/ai/usage?start=&end=&groupBy=provider,feature,model` | Normalized usage breakdown |
| `POST` | `/api/admin/ai/features/{featureName}/state` | Update feature runtime state |
| `POST` | `/api/admin/ai/providers/{provider}/policy` | Update provider thresholds/policy |
| `POST` | `/api/admin/ai/poll` | Force a provider poll + alert evaluation; returns snapshots, liveness, failure counts, alerts dispatched |
| `GET`  | `/api/admin/ai/alerts` | Dispatched alert history (PRD §19.4) |
| `GET`  | `/api/admin/ai/forecast` | Burn rate and time-to-exhaustion per provider (PRD FR-12) |
| `GET`  | `/api/admin/ai/queue` | List queued/processed jobs |
| `POST` | `/api/admin/ai/queue` | Drain a provider's queued jobs (`{ "provider": "..." }`) |
| `POST` | `/api/ai/gateway` | Internal AI Gateway — budget-checks a feature, enqueues when policy says queue, returns the runtime decision (PRD §35) |

Admin routes are guarded by `requireAdmin` (`src/lib/auth.ts`): when `ADMIN_API_TOKEN`
is set they require `Authorization: Bearer <token>`; when unset they stay open for
local exploration.

Example gateway call:

```bash
curl -s -X POST http://localhost:3000/api/ai/gateway \
  -H 'Content-Type: application/json' \
  -d '{"feature":"background-enrichment"}'
# -> { ..., "decision":"pause", "status":"unavailable", "message":"AI is temporarily unavailable..." }
```

## Provider adapters (PRD §14, §9)

`src/lib/providers/` implements the `ProviderAdapter` contract for **all three**
providers, each calling the real provider API when a credential is configured and
falling back to seeded mock data otherwise:

| Adapter | Live endpoint | Credential |
|---|---|---|
| `openrouter.ts` | `GET /api/v1/credits` (prepaid credits) | `OPENROUTER_MANAGEMENT_KEY` |
| `openai.ts` | `GET /v1/organization/costs` (month-to-date cost) | `OPENAI_ADMIN_KEY` |
| `anthropic.ts` | `GET /v1/organizations/cost_report` (month-to-date cost) | `ANTHROPIC_ADMIN_KEY` |

`src/lib/providers/index.ts` holds the registry and `pollProviders()`, which polls
every enabled provider, derives health state from the registry thresholds, updates
the snapshot cache, and tracks consecutive polling failures (PRD FR-3, FR-4). A
failed provider degrades to `auth_error`/`unknown` without taking down the others.
Calls have a bounded timeout; billing/credit errors are never retried (FR-8).

## Alerting, scheduler, queue, forecasting

- **Alert engine** (`src/lib/alerts/`) — turns provider/feature state into
  deduplicated, escalated, recovery-aware alerts (PRD FR-5, FR-11, §21).
  Severity drives channels: warning/critical → Slack + email; emergency →
  Slack + email + PagerDuty. **Slack** posts Block Kit messages to
  `SLACK_WEBHOOK_URL`; email relays via `ALERT_EMAIL_WEBHOOK_URL`; PagerDuty uses
  the Events API. With no channel configured an alert is logged to the server
  console, so the flow is fully exercisable offline. Dedupe windows: warning 6h,
  critical 45m, emergency always; recovery fires once and clears the dedupe state.
- **Background scheduler** (`src/lib/scheduler.ts`, started from
  `src/instrumentation.ts`) — runs `pollAndAlert` on the shortest provider
  interval so budgets are checked and alerts fire without a user request (FR-4).
  Disable with `AI_BUDGET_MONITOR_ENABLED=false`.
- **Job queue** (`src/lib/queue.ts`) — when the gateway decides `queue`, the job
  is persisted; on provider recovery the queue is drained automatically (FR-7).
- **Forecasting** (`src/lib/forecast.ts`) — burn rate over 15m/1h/24h/7d windows,
  time-to-exhaustion, and 3× spike detection from the gateway log (FR-12).
- **Persistence** (`src/lib/persistence.ts`) — alert history, dedupe state, and
  the queue are written to a JSON file (`DATA_DIR`, default `./.data`), falling
  back to in-memory only on a read-only filesystem.

## Tests

`npm test` runs the Node built-in test runner (via `tsx`) over `test/*.test.ts`,
covering the threshold engine, error classification/retry safety, runtime
decisions, burn-rate forecasting, and alert dedupe/escalation — mapping to the
PRD §29 scenarios.

## Core modules

- `src/lib/types.ts` — the Provider Adapter Contract and data model (PRD §14, §19).
- `src/lib/policy.ts` — normalized error classification, retry safety, and the
  runtime budget decision engine (PRD FR-7, FR-8).
- `src/lib/store.ts` — in-memory normalized data store seeded with representative
  data and the snapshot cache (stands in for the DB tables in PRD §19).
- `src/lib/aggregate.ts` — usage aggregation by provider/feature/model.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in provider admin keys to go live
npm run dev                  # http://localhost:3000
```

Build for production:

```bash
npm run build && npm run start
```

## Going live

The dashboard is fully explorable without credentials (adapters serve mock data).
To go live:

1. Set the provider credentials in `.env.local` (`OPENROUTER_MANAGEMENT_KEY`,
   `OPENAI_ADMIN_KEY`, `ANTHROPIC_ADMIN_KEY`). Each adapter automatically switches
   from mock to its real API once its key is present — no code change needed.
2. Replace the in-memory arrays in `src/lib/store.ts` with a database
   (tables in PRD §19) and run `pollProviders()` on a scheduler/cron (PRD §36)
   instead of on each request.
3. Wire alert channels (Slack/email/PagerDuty) via the env vars in `.env.example`.

> Provider admin/management keys must remain server-side only and never be
> exposed to the client (PRD §23).

## Known limitations

- **Reference config lives in code.** The provider registry and feature catalog
  in `src/lib/store.ts` are seeded; their `POST`-mutated runtime fields (feature
  state, provider thresholds) are in-memory. Alert history and the job queue are
  persisted to disk, but on a read-only/multi-instance serverless deployment the
  file store degrades to in-memory per instance — a real database (PRD §19) is
  the production form.
- **Usage breakdown is seeded.** `fetchBudgetSnapshot` is live; `fetchUsageBreakdown`
  reports from the gateway event log pending per-provider usage-API wiring.
- **Forecasting uses the gateway log.** Burn rate is computed from the seeded
  usage events rather than live per-provider usage data.
