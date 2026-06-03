import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  SpendByFeatureChart,
  SpendByProviderChart,
  ChartLegend,
} from "@/components/usage-charts";
import { groupUsage, totals } from "@/lib/aggregate";
import { usageEvents } from "@/lib/store";
import { formatNumber, formatRelativeTime, formatUsd } from "@/lib/utils";

function statusVariant(status: string) {
  switch (status) {
    case "success":
      return "success" as const;
    case "error":
      return "destructive" as const;
    case "blocked":
      return "destructive" as const;
    default:
      return "warning" as const;
  }
}

export default function UsagePage() {
  const byProvider = groupUsage("provider");
  const byFeature = groupUsage("feature");
  const byModel = groupUsage("model");
  const t = totals();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Usage & Cost"
        description="Normalized usage attributed by provider, feature, and model (PRD §15 FR-2, §20.3)."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estimated spend (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(t.cost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(t.requests)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Error rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((t.errors / t.requests) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend by provider</CardTitle>
            <CardDescription>Estimated cost over the last 24h</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendByProviderChart data={byProvider} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Spend by feature</CardTitle>
            <CardDescription>Top-consuming features</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendByFeatureChart data={byFeature} />
            <ChartLegend data={byFeature} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Spend by model</CardTitle>
          <CardDescription>Cost, requests, and tokens per model</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Input tokens</TableHead>
                <TableHead className="text-right">Output tokens</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="text-right">Est. cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byModel.map((m) => (
                <TableRow key={m.name}>
                  <TableCell className="font-mono text-xs">{m.name}</TableCell>
                  <TableCell className="text-right">{formatNumber(m.requests)}</TableCell>
                  <TableCell className="text-right">{formatNumber(m.inputTokens)}</TableCell>
                  <TableCell className="text-right">{formatNumber(m.outputTokens)}</TableCell>
                  <TableCell className="text-right">{m.errors}</TableCell>
                  <TableCell className="text-right font-medium">{formatUsd(m.cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent gateway events</CardTitle>
          <CardDescription>
            Every request is tagged with feature, provider, model, and environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Feature</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageEvents.slice(0, 25).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(e.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">{e.featureName}</TableCell>
                  <TableCell className="text-sm capitalize">{e.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{e.model}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(e.status)} className="capitalize">
                      {e.status}
                      {e.normalizedError ? ` · ${e.normalizedError}` : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatUsd(e.estimatedCostUsd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
