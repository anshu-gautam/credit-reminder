import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Gauge,
  Layers,
  TriangleAlert,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { HealthBadge, SeverityBadge, FeatureStateBadge } from "@/components/status-badge";
import {
  alertEvents,
  featureBudgets,
  overallState,
  providerRegistry,
} from "@/lib/store";
import { pollProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";
import { totals } from "@/lib/aggregate";
import type { ProviderBudgetSnapshot } from "@/lib/types";
import { formatRelativeTime, formatUsd } from "@/lib/utils";

function providerBudgetPct(p: ProviderBudgetSnapshot): number {
  if (p.remainingCreditsUsd !== undefined && p.totalCreditsUsd) {
    return Math.round((p.totalUsageUsd! / p.totalCreditsUsd) * 100);
  }
  if (p.monthToDateSpendUsd !== undefined && p.monthlyBudgetUsd) {
    return Math.round((p.monthToDateSpendUsd / p.monthlyBudgetUsd) * 100);
  }
  return 0;
}

function indicatorClass(state: string): string {
  if (state === "critical" || state === "emergency") return "bg-destructive";
  if (state === "warning" || state === "rate_limited") return "bg-warning";
  return "bg-success";
}

export default async function OverviewPage() {
  const snapshots = await pollProviders();
  const t = totals();
  const monthlySpend = featureBudgets.reduce((s, f) => s + f.currentMonthlyUsageUsd, 0);
  const monthlyBudget = featureBudgets.reduce((s, f) => s + f.monthlyBudgetUsd, 0);
  const activeAlerts = alertEvents.filter((a) => !a.resolvedAt);
  const pausedFeatures = featureBudgets.filter(
    (f) => f.state === "paused" || f.state === "disabled",
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Control Plane Overview"
        description="Provider health, spend, and runtime protection across OpenRouter, OpenAI, and Anthropic."
      >
        <HealthBadge state={overallState()} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Month-to-date spend
            </CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(monthlySpend)}</div>
            <p className="text-xs text-muted-foreground">
              of {formatUsd(monthlyBudget)} combined feature budget
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active alerts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlerts.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeAlerts.filter((a) => a.severity === "emergency").length} emergency ·{" "}
              {activeAlerts.filter((a) => a.severity === "critical").length} critical
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Requests (24h)
            </CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t.requests}</div>
            <p className="text-xs text-muted-foreground">{t.errors} normalized errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Protected features
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pausedFeatures.length}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {featureBudgets.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">paused or disabled by policy</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Provider health</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/providers">
                Details <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {snapshots.map((p) => {
              const reg = providerRegistry.find((r) => r.name === p.provider)!;
              const pct = providerBudgetPct(p);
              const remaining =
                p.remainingCreditsUsd ?? p.remainingMonthlyBudgetUsd ?? null;
              return (
                <div key={p.provider}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{reg.displayName}</span>
                      <HealthBadge state={p.state} />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatUsd(remaining)} remaining
                    </span>
                  </div>
                  <Progress value={pct} indicatorClassName={indicatorClass(p.state)} />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{pct}% used · top: {p.topFeature ?? "—"}</span>
                    <span>checked {formatRelativeTime(p.lastCheckedAt)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent alerts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/alerts">
                All <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {alertEvents.slice(0, 5).map((a, i) => (
              <div key={a.id}>
                {i > 0 ? <Separator className="mb-3" /> : null}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.provider ?? a.featureName} · {formatRelativeTime(a.sentAt)}
                    </p>
                  </div>
                  <SeverityBadge severity={a.severity} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-warning" />
            <CardTitle>Runtime protection state</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/features">
              Manage <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featureBudgets.map((f) => {
              const pct = Math.min(
                100,
                Math.round((f.currentMonthlyUsageUsd / f.monthlyBudgetUsd) * 100),
              );
              return (
                <div key={f.featureName} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium">{f.featureName}</span>
                    <FeatureStateBadge state={f.state} />
                  </div>
                  <Progress
                    className="mt-2"
                    value={pct}
                    indicatorClassName={pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-success"}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {formatUsd(f.currentMonthlyUsageUsd)} / {formatUsd(f.monthlyBudgetUsd)} ·{" "}
                    {f.currentProvider}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
