// Alert delivery channels (PRD FR-5, §11). Slack is a real webhook post; email
// and PagerDuty post to their respective webhooks/Events API when configured.
// When a channel is not configured the alert is logged to the server console so
// the system is fully exercisable in development.

import type { AlertEvent, AlertSeverity } from "../types";
import { alertText, slackPayload } from "./format";

export type Channel = "slack" | "email" | "pagerduty" | "console";

// Severity -> channels (PRD §11 escalation table).
export function channelsForSeverity(severity: AlertSeverity): Channel[] {
  switch (severity) {
    case "emergency":
      return ["slack", "email", "pagerduty"];
    case "critical":
      return ["slack", "email"];
    case "warning":
    case "recovery":
    case "info":
    default:
      return ["slack", "email"];
  }
}

async function postJson(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendSlack(alert: AlertEvent): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.info(`[alert:slack:console]\n${alertText(alert)}`);
    return true; // delivered to console fallback
  }
  return postJson(url, slackPayload(alert));
}

async function sendEmail(alert: AlertEvent): Promise<boolean> {
  // Email is sent via a configured webhook relay (no SMTP dependency here).
  const url = process.env.ALERT_EMAIL_WEBHOOK_URL;
  const to = process.env.ALERT_EMAIL_TO;
  if (!url) {
    console.info(`[alert:email:console] to=${to ?? "unset"}\n${alertText(alert)}`);
    return true;
  }
  return postJson(url, { to, subject: alert.message, text: alertText(alert) });
}

async function sendPagerDuty(alert: AlertEvent): Promise<boolean> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  if (!routingKey) {
    console.info(`[alert:pagerduty:console]\n${alertText(alert)}`);
    return true;
  }
  return postJson("https://events.pagerduty.com/v2/enqueue", {
    routing_key: routingKey,
    event_action: alert.severity === "recovery" ? "resolve" : "trigger",
    dedup_key: alert.dedupeKey,
    payload: {
      summary: `${alert.alertType}: ${alert.message}`,
      severity: alert.severity === "emergency" ? "critical" : alert.severity === "recovery" ? "info" : alert.severity,
      source: alert.provider ?? alert.featureName ?? "ai-budget-monitor",
    },
  });
}

// Dispatches an alert to the given channels; returns the channels that accepted.
export async function deliver(alert: AlertEvent, channels: Channel[]): Promise<Channel[]> {
  const delivered: Channel[] = [];
  await Promise.all(
    channels.map(async (ch) => {
      let ok = false;
      if (ch === "slack") ok = await sendSlack(alert);
      else if (ch === "email") ok = await sendEmail(alert);
      else if (ch === "pagerduty") ok = await sendPagerDuty(alert);
      else if (ch === "console") {
        console.info(`[alert:console]\n${alertText(alert)}`);
        ok = true;
      }
      if (ok) delivered.push(ch);
    }),
  );
  return delivered;
}
