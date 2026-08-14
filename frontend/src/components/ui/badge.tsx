import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-muted-foreground",
        accent: "border-primary/30 bg-primary/10 text-primary",
        success:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        warning:
          "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        destructive:
          "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
        info: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400",
        critical:
          "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400",
        high: "border-orange-500/40 bg-orange-500/15 text-orange-600 dark:text-orange-400",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/** Map a scan status to a semantic badge variant. */
export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "destructive";
    case "running":
      return "warning";
    case "pending":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Map a finding severity to a semantic badge variant. */
export function severityVariant(severity: string): BadgeVariant {
  switch (severity.toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "neutral";
  }
}

export { Badge, badgeVariants };
