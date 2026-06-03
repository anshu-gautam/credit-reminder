import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { SeverityBadge } from "@/components/status-badge";
import { alertEvents } from "@/lib/store";
import { formatRelativeTime, formatUsd } from "@/lib/utils";

const channelLabel: Record<string, string> = {
  slack: "Slack",
  email: "Email",
  pagerduty: "PagerDuty",
  discord: "Discord",
};

export default function AlertsPage() {
  const active = alertEvents.filter((a) => !a.resolvedAt);
  const resolved = alertEvents.filter((a) => a.resolvedAt);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Alerts"
        description="Threshold, runtime-error, and recovery alerts with dedupe and escalation (PRD §5, §11, §21)."
      />

      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Active
            </h2>
            <Badge variant="secondary">{active.length}</Badge>
          </div>
          <div className="space-y-3">
            {active.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
            {active.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No active alerts. All providers and features are healthy.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Resolved
            </h2>
            <Badge variant="secondary">{resolved.length}</Badge>
          </div>
          <div className="space-y-3">
            {resolved.map((a) => (
              <AlertRow key={a.id} alert={a} resolved />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  resolved,
}: {
  alert: (typeof alertEvents)[number];
  resolved?: boolean;
}) {
  return (
    <Card className={resolved ? "opacity-75" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <CardTitle className="text-sm font-medium">
              {alert.alertType.replace(/_/g, " ")}
            </CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {resolved && alert.resolvedAt
              ? `resolved ${formatRelativeTime(alert.resolvedAt)}`
              : formatRelativeTime(alert.sentAt)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{alert.message}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {alert.provider ? (
            <span>
              Provider: <span className="capitalize text-foreground">{alert.provider}</span>
            </span>
          ) : null}
          {alert.featureName ? (
            <span>
              Feature: <span className="text-foreground">{alert.featureName}</span>
            </span>
          ) : null}
          {alert.model ? (
            <span>
              Model: <span className="font-mono text-foreground">{alert.model}</span>
            </span>
          ) : null}
          {alert.currentValueUsd != null ? (
            <span>
              Current: <span className="text-foreground">{formatUsd(alert.currentValueUsd)}</span>
            </span>
          ) : null}
          {alert.thresholdValueUsd != null ? (
            <span>
              Threshold:{" "}
              <span className="text-foreground">{formatUsd(alert.thresholdValueUsd)}</span>
            </span>
          ) : null}
        </div>
        {alert.recommendedAction ? (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Recommended action: </span>
              {alert.recommendedAction}
            </p>
          </>
        ) : null}
        <div className="flex items-center gap-1.5">
          {alert.sentTo.map((c) => (
            <Badge key={c} variant="outline" className="text-xs">
              {channelLabel[c] ?? c}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
