// Next.js instrumentation hook — runs once when the server process starts.
// Used to launch the background budget poller (PRD §36, FR-4).

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
