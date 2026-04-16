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
  pending: "bg-amber-d text-amber",
  processing: "bg-blue-d text-blue",
  awaiting: "bg-orange-d text-orange",
  shipped: "bg-purple-d text-purple",
  delivered: "bg-green-d text-green",
  cancelled: "bg-s3 text-muted",
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`text-[10px] font-semibold py-0.5 px-2 rounded-full ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}

export default Badge;
