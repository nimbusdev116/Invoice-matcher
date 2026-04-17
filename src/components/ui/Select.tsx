import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  className?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className = "", ...rest }, ref) => {
    return (
      <div className={className}>
        {label && (
          <label className="text-[10px] text-muted/60 uppercase tracking-wider font-semibold mb-1.5 block">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className="w-full bg-s2 border border-border rounded-lg py-2 px-3 text-text text-[13px] outline-none focus:border-blue/40 transition-all appearance-none cursor-pointer"
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
