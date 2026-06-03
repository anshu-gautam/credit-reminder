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

## Core modules

- `src/lib/types.ts` — the Provider Adapter Contract and data model (PRD §14, §19).
- `src/lib/policy.ts` — normalized error classification, retry safety, and the
  runtime budget decision engine (PRD FR-7, FR-8).
- `src/lib/store.ts` — in-memory normalized data store seeded with representative
  data (stands in for the DB tables in PRD §19).
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

The dashboard currently runs on a seeded in-memory store so it is fully
explorable without credentials. To connect real data:

1. Implement the `ProviderAdapter` interface (PRD §14) for each provider, calling
   the OpenRouter Credits API, OpenAI Costs/Usage Admin API, and Anthropic
   Usage/Cost Admin API.
2. Replace the in-memory arrays in `src/lib/store.ts` with a database
   (tables in PRD §19) and a scheduled poller (PRD §36).
3. Wire alert channels (Slack/email/PagerDuty) via the env vars in `.env.example`.

> Provider admin/management keys must remain server-side only and never be
> exposed to the client (PRD §23).
