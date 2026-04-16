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
  default: "bg-s2 border-border2 text-text hover:bg-s3",
  green:
    "bg-green text-[#0d1117] border-green font-semibold hover:brightness-110",
  amber: "bg-amber-d text-amber border-amber/30",
  danger: "text-red border-red/30 bg-transparent",
  ghost: "bg-transparent text-muted border-transparent hover:text-text",
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
      className={`inline-flex items-center gap-1.5 rounded-md border cursor-pointer transition font-[inherit] ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
