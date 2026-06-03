// Background poller (PRD §36, FR-4). Runs pollAndAlert on an interval so
// provider budgets are checked and alerts fired without a user request. Started
// from Next.js instrumentation (src/instrumentation.ts).

import { pollAndAlert } from "./providers";
import { providerRegistry } from "./store";

// Guard against duplicate intervals across HMR / multiple register() calls.
const GLOBAL_KEY = Symbol.for("ai-budget-monitor.scheduler");
type GlobalWithScheduler = typeof globalThis & { [GLOBAL_KEY]?: NodeJS.Timeout };

function intervalMs(): number {
  const min = Math.min(...providerRegistry.map((p) => p.pollIntervalMinutes), 5);
  return Math.max(min, 1) * 60_000;
}

export function startScheduler(): void {
  if (process.env.AI_BUDGET_MONITOR_ENABLED === "false") return;

  const g = globalThis as GlobalWithScheduler;
  if (g[GLOBAL_KEY]) return; // already running

  const tick = async () => {
    try {
      const { alerts } = await pollAndAlert({ force: true });
      if (alerts.length) {
        console.info(`[scheduler] dispatched ${alerts.length} alert(s)`);
      }
    } catch (error) {
      console.error("[scheduler] poll cycle failed", error);
    }
  };

  // Kick off an initial poll shortly after boot, then on the interval.
  setTimeout(tick, 3_000);
  g[GLOBAL_KEY] = setInterval(tick, intervalMs());
  console.info(`[scheduler] started; interval ${intervalMs() / 1000}s`);
}
