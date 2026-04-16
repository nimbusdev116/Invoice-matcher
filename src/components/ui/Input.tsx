import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", ...rest }, ref) => {
    return (
      <div className={className}>
        {label && (
          <label className="text-[11px] text-muted uppercase tracking-wider mb-1.5 block">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className="w-full bg-s2 border border-border rounded-md py-2 px-3 text-text text-[13px] outline-none focus:border-green/50 transition"
          {...rest}
        />
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
