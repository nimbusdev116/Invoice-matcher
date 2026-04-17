import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "default" | "green" | "amber" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-s2 border-border text-text hover:bg-s3 hover:border-border2",
  green:
    "bg-green/15 text-green border-green/25 font-semibold hover:bg-green/25",
  amber: "bg-amber/12 text-amber border-amber/25 hover:bg-amber/20",
  danger: "text-red border-red/25 bg-red/8 hover:bg-red/15",
  ghost: "bg-transparent text-muted border-transparent hover:text-text hover:bg-white/[0.04]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "py-1 px-2.5 text-[11px]",
  md: "py-1.5 px-3.5 text-xs",
};

export function Button({
  variant = "default",
  size = "md",
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg border cursor-pointer transition-all duration-150 font-[inherit] ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
