import { Clock, Zap } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/page-header";
import { HealthBadge } from "@/components/status-badge";
import { providerRegistry } from "@/lib/store";
import { pollProviders } from "@/lib/providers";
import { formatRelativeTime, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";

const billingLabel: Record<string, string> = {
  prepaid_credits: "Prepaid credits",
  monthly_usage: "Monthly usage",
  monthly_usage_with_spend_limit: "Monthly usage + spend limit",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export default async function ProvidersPage() {
  const snapshots = await pollProviders();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Providers"
        description="Normalized budget snapshots and polling status per provider (PRD §9, §14)."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {snapshots.map((p) => {
          const reg = providerRegistry.find((r) => r.name === p.provider)!;
          const isPrepaid = p.remainingCreditsUsd !== undefined;
          const pct = isPrepaid
            ? Math.round((p.totalUsageUsd! / p.totalCreditsUsd!) * 100)
            : Math.round((p.monthToDateSpendUsd! / p.monthlyBudgetUsd!) * 100);
          return (
            <Card key={p.provider} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{reg.displayName}</CardTitle>
                    <CardDescription>{billingLabel[reg.billingType]}</CardDescription>
                  </div>
                  <HealthBadge state={p.state} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {isPrepaid ? "Credits used" : "Budget used"}
                    </span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <Progress
                    value={pct}
                    indicatorClassName={
                      p.state === "critical" || p.state === "emergency"
                        ? "bg-destructive"
                        : p.state === "warning"
                          ? "bg-warning"
                          : "bg-success"
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {isPrepaid ? (
                    <>
                      <Metric label="Remaining" value={formatUsd(p.remainingCreditsUsd)} />
                      <Metric label="Total credits" value={formatUsd(p.totalCreditsUsd)} />
                      <Metric label="Used" value={formatUsd(p.totalUsageUsd)} />
                      <Metric
                        label="Est. runway"
                        value={
                          p.estimatedHoursRemaining
                            ? `${p.estimatedHoursRemaining.toFixed(1)}h`
                            : "—"
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Metric label="MTD spend" value={formatUsd(p.monthToDateSpendUsd)} />
                      <Metric
                        label={reg.billingType.includes("limit") ? "Spend limit" : "Budget"}
                        value={formatUsd(p.monthlySpendLimitUsd ?? p.monthlyBudgetUsd)}
                      />
                      <Metric label="Remaining" value={formatUsd(p.remainingMonthlyBudgetUsd)} />
                      <Metric
                        label="Est. runway"
                        value={
                          p.estimatedHoursRemaining
                            ? `${Math.round(p.estimatedHoursRemaining)}h`
                            : "—"
                        }
                      />
                    </>
                  )}
                </div>

                <Separator />

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Top feature</span>
                    <span className="font-medium">{p.topFeature ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Top model</span>
                    <span className="font-mono text-xs">{p.topModel ?? "—"}</span>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Polls every {reg.pollIntervalMinutes}m
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatRelativeTime(p.lastCheckedAt)}
                  </span>
                  {reg.consecutivePollingFailures > 0 ? (
                    <Badge variant="destructive">
                      {reg.consecutivePollingFailures} polling failures
                    </Badge>
                  ) : (
                    <Badge variant="outline">priority {reg.priority}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Default thresholds</CardTitle>
          <CardDescription>
            Warning / critical / emergency boundaries per provider (PRD §9, §25).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {providerRegistry.map((r) => (
              <div key={r.name} className="rounded-lg border p-4">
                <p className="font-medium">{r.displayName}</p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {r.billingType === "prepaid_credits" ? (
                    <>
                      <p>Warning: ≤ {formatUsd(r.warningThresholdUsd)}</p>
                      <p>Critical: ≤ {formatUsd(r.criticalThresholdUsd)}</p>
                      <p>Emergency: ≤ {formatUsd(r.emergencyThresholdUsd)} or HTTP 402</p>
                    </>
                  ) : (
                    <>
                      <p>Warning: {r.warnPercent}% of budget</p>
                      <p>Critical: {r.criticalPercent}% of budget</p>
                      <p>Emergency: {r.emergencyPercent}% or billing error</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
