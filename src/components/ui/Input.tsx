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
          <label className="text-[10px] text-muted/60 uppercase tracking-wider font-semibold mb-1.5 block">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className="w-full bg-s2 border border-border rounded-lg py-2 px-3 text-text text-[13px] outline-none focus:border-blue/40 focus:ring-1 focus:ring-blue/15 transition-all"
          {...rest}
        />
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
