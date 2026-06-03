import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { FeatureStateBadge, PriorityBadge } from "@/components/status-badge";
import { featureBudgets } from "@/lib/store";
import { formatUsd } from "@/lib/utils";

const behaviorLabel: Record<string, string> = {
  continue: "Continue",
  switch_to_cheaper_model: "Switch to cheaper model",
  queue_jobs: "Queue jobs",
  pause: "Pause",
  disable: "Disable",
};

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Feature Budgets"
        description="Cross-provider budgets, priorities, and runtime behavior per feature (PRD §6, §18)."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {featureBudgets.map((f) => {
          const pct = Math.min(
            100,
            Math.round((f.currentMonthlyUsageUsd / f.monthlyBudgetUsd) * 100),
          );
          const dailyPct = f.dailyBudgetUsd
            ? Math.min(100, Math.round((f.currentDailyUsageUsd / f.dailyBudgetUsd) * 100))
            : 0;
          return (
            <Card key={f.featureName}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{f.featureName}</CardTitle>
                    <CardDescription>Owner: {f.owner ?? "unassigned"}</CardDescription>
                  </div>
                  <div className="flex gap-1.5">
                    <PriorityBadge priority={f.priority} />
                    <FeatureStateBadge state={f.state} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Monthly budget</span>
                    <span className="font-medium">
                      {formatUsd(f.currentMonthlyUsageUsd)} / {formatUsd(f.monthlyBudgetUsd)}
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    indicatorClassName={
                      pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-success"
                    }
                  />
                </div>
                {f.dailyBudgetUsd ? (
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Daily budget</span>
                      <span className="font-medium">
                        {formatUsd(f.currentDailyUsageUsd)} / {formatUsd(f.dailyBudgetUsd)}
                      </span>
                    </div>
                    <Progress
                      value={dailyPct}
                      indicatorClassName={
                        dailyPct >= 90 ? "bg-destructive" : dailyPct >= 70 ? "bg-warning" : "bg-success"
                      }
                    />
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Preferred provider</p>
                    <p className="font-medium capitalize">{f.preferredProvider}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Low-budget behavior</p>
                    <p className="font-medium">{behaviorLabel[f.lowBudgetBehavior]}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Allowed providers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {f.allowedProviders.map((p) => (
                      <Badge
                        key={p}
                        variant={p === f.currentProvider ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {p}
                        {p === f.currentProvider ? " · active" : ""}
                      </Badge>
                    ))}
                    {f.fallbackProviders.length === 0 ? (
                      <Badge variant="outline">no fallback</Badge>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Fallback matrix</CardTitle>
          <CardDescription>
            Feature-specific provider fallback rules (PRD §9 FR-9).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Primary</TableHead>
                <TableHead>Fallback chain</TableHead>
                <TableHead>Low-budget behavior</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureBudgets.map((f) => (
                <TableRow key={f.featureName}>
                  <TableCell className="font-medium">{f.featureName}</TableCell>
                  <TableCell className="capitalize">{f.preferredProvider}</TableCell>
                  <TableCell>
                    {f.fallbackProviders.length > 0 ? (
                      <span className="capitalize text-muted-foreground">
                        {f.fallbackProviders.join(" → ")}
                      </span>
                    ) : (
                      <Badge variant="outline">none (pause/queue)</Badge>
                    )}
                  </TableCell>
                  <TableCell>{behaviorLabel[f.lowBudgetBehavior]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
