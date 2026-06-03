// Human-readable alert formatting (PRD §21 templates).

import { formatUsd } from "../utils";
import type { AlertEvent } from "../types";

const severityEmoji: Record<string, string> = {
  info: "ℹ️",
  warning: "⚠️",
  critical: "🔴",
  emergency: "🚨",
  recovery: "✅",
};

export function alertTitle(alert: AlertEvent): string {
  const provider = alert.provider ? alert.provider[0].toUpperCase() + alert.provider.slice(1) : "AI";
  switch (alert.alertType) {
    case "provider_budget_warning":
      return `${provider} budget warning`;
    case "provider_budget_critical":
      return `${provider} budget critical`;
    case "provider_budget_exhausted":
      return `${provider} budget exhausted`;
    case "provider_balance_low":
      return `${provider} balance low`;
    case "provider_rate_limited":
      return `${provider} rate limited`;
    case "provider_auth_failed":
      return `${provider} authentication failed`;
    case "provider_polling_failed":
      return `${provider} polling failed`;
    case "feature_budget_exceeded":
      return `Feature budget exceeded: ${alert.featureName}`;
    case "recovery":
      return `${provider} recovered`;
    default:
      return `${provider} ${alert.alertType.replace(/_/g, " ")}`;
  }
}

// Plain-text body in the spirit of PRD §21 templates.
export function alertText(alert: AlertEvent): string {
  const lines: string[] = [`${severityEmoji[alert.severity] ?? ""} ${alertTitle(alert)}`.trim(), ""];
  lines.push(alert.message);
  lines.push("");
  if (alert.provider) lines.push(`Provider: ${alert.provider}`);
  if (alert.featureName) lines.push(`Feature: ${alert.featureName}`);
  if (alert.model) lines.push(`Model: ${alert.model}`);
  if (alert.currentValueUsd != null) lines.push(`Current: ${formatUsd(alert.currentValueUsd)}`);
  if (alert.thresholdValueUsd != null) lines.push(`Threshold: ${formatUsd(alert.thresholdValueUsd)}`);
  lines.push(`Severity: ${alert.severity}`);
  if (alert.recommendedAction) {
    lines.push("", `Action: ${alert.recommendedAction}`);
  }
  return lines.join("\n");
}

// Slack message payload (Block Kit) for a webhook post.
export function slackPayload(alert: AlertEvent): Record<string, unknown> {
  const fields: { type: string; text: string }[] = [];
  if (alert.provider) fields.push({ type: "mrkdwn", text: `*Provider:*\n${alert.provider}` });
  if (alert.featureName) fields.push({ type: "mrkdwn", text: `*Feature:*\n${alert.featureName}` });
  if (alert.currentValueUsd != null)
    fields.push({ type: "mrkdwn", text: `*Current:*\n${formatUsd(alert.currentValueUsd)}` });
  if (alert.thresholdValueUsd != null)
    fields.push({ type: "mrkdwn", text: `*Threshold:*\n${formatUsd(alert.thresholdValueUsd)}` });

  return {
    text: `${severityEmoji[alert.severity] ?? ""} ${alertTitle(alert)} — ${alert.message}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${severityEmoji[alert.severity] ?? ""} ${alertTitle(alert)}`.trim() },
      },
      { type: "section", text: { type: "mrkdwn", text: alert.message } },
      ...(fields.length ? [{ type: "section", fields }] : []),
      ...(alert.recommendedAction
        ? [{ type: "context", elements: [{ type: "mrkdwn", text: `*Action:* ${alert.recommendedAction}` }] }]
        : []),
    ],
  };
}
