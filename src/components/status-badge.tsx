import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  AlertSeverity,
  FeatureState,
  ProviderHealthState,
} from "@/lib/types";

type Variant = "default" | "secondary" | "destructive" | "success" | "warning" | "outline";

const stateConfig: Record<ProviderHealthState, { label: string; variant: Variant }> = {
  healthy: { label: "Healthy", variant: "success" },
  warning: { label: "Warning", variant: "warning" },
  critical: { label: "Critical", variant: "destructive" },
  emergency: { label: "Emergency", variant: "destructive" },
  rate_limited: { label: "Rate limited", variant: "warning" },
  auth_error: { label: "Auth error", variant: "destructive" },
  provider_down: { label: "Provider down", variant: "destructive" },
  unknown: { label: "Unknown", variant: "secondary" },
};

export function HealthBadge({
  state,
  className,
}: {
  state: ProviderHealthState;
  className?: string;
}) {
  const cfg = stateConfig[state];
  return (
    <Badge variant={cfg.variant} className={cn("capitalize", className)}>
      {cfg.label}
    </Badge>
  );
}

const featureConfig: Record<FeatureState, { label: string; variant: Variant }> = {
  enabled: { label: "Enabled", variant: "success" },
  degraded: { label: "Degraded", variant: "warning" },
  paused: { label: "Paused", variant: "warning" },
  disabled: { label: "Disabled", variant: "destructive" },
};

export function FeatureStateBadge({ state }: { state: FeatureState }) {
  const cfg = featureConfig[state];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const severityConfig: Record<AlertSeverity, { label: string; variant: Variant }> = {
  info: { label: "Info", variant: "secondary" },
  warning: { label: "Warning", variant: "warning" },
  critical: { label: "Critical", variant: "destructive" },
  emergency: { label: "Emergency", variant: "destructive" },
  recovery: { label: "Recovery", variant: "success" },
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const cfg = severityConfig[severity];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const priorityConfig: Record<string, Variant> = {
  critical: "destructive",
  high: "warning",
  medium: "secondary",
  low: "outline",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant={priorityConfig[priority] ?? "secondary"} className="capitalize">
      {priority}
    </Badge>
  );
}

const decisionConfig: Record<string, { label: string; variant: Variant }> = {
  allow: { label: "Allow", variant: "success" },
  allow_with_cheaper_model: { label: "Downgrade model", variant: "warning" },
  fallback_provider: { label: "Fallback provider", variant: "warning" },
  queue: { label: "Queue", variant: "warning" },
  pause: { label: "Pause", variant: "destructive" },
  block_with_graceful_message: { label: "Block", variant: "destructive" },
};

export function DecisionBadge({ decision }: { decision: string }) {
  const cfg = decisionConfig[decision] ?? { label: decision, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
