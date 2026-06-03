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
| `POST` | `/api/admin/ai/poll` | Trigger a provider poll; returns refreshed snapshots, liveness, and polling-failure counts |
| `POST` | `/api/ai/gateway` | Internal AI Gateway — budget-checks a feature and returns the runtime decision (PRD §35) |

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

## Known limitations (prototype)

This is a Phase-1 foundation. Be aware that:

- **State is in-memory and per-instance.** The store (`src/lib/store.ts`) is a
  module-level array, so the `POST` admin endpoints (`/features/{name}/state`,
  `/providers/{provider}/policy`) mutate process memory only. On a serverless or
  multi-instance deployment these changes are **not shared across instances and
  are lost on cold start** — they are illustrative until the store is backed by a
  real database. Within a single long-lived server they persist as expected.
- **Live adapters, but on-request polling.** The three provider adapters call the
  real APIs when keys are set; polling currently happens on each admin
  request/page load rather than via a background scheduler/cron (PRD §36).
- **Usage breakdown is seeded.** `fetchBudgetSnapshot` is live; `fetchUsageBreakdown`
  still reports from the gateway event log pending per-provider usage-API wiring.
- **No alert delivery, no test suite.** Alert channels and the PRD §29 test cases
  are not yet implemented.
