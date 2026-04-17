import { type ReactNode } from "react";

type BadgeVariant =
  | "pending"
  | "processing"
  | "awaiting"
  | "shipped"
  | "delivered"
  | "cancelled";

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  pending: "bg-amber/12 text-amber border-amber/20",
  processing: "bg-blue/12 text-blue border-blue/20",
  awaiting: "bg-orange/12 text-orange border-orange/20",
  shipped: "bg-purple/12 text-purple border-purple/20",
  delivered: "bg-green/12 text-green border-green/20",
  cancelled: "bg-s3 text-muted border-border",
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`text-[10px] font-semibold py-0.5 px-2 rounded-md border ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}

export default Badge;
