import { type SelectHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, error, id, options, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-medium tracking-wide uppercase"
            style={{ color: "var(--color-muted)" }}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={`w-full px-4 py-2.5 rounded-xl text-sm appearance-none cursor-pointer transition-all outline-none ${className}`}
            style={{
              background:
                "color-mix(in srgb, var(--color-card) 40%, var(--color-border))",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-accent)";
              e.currentTarget.style.boxShadow =
                "0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.boxShadow = "none";
            }}
            {...props}>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                style={{
                  background: "var(--color-card)",
                  color: "var(--color-foreground)",
                }}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "var(--color-muted)" }}
          />
        </div>
        {error && (
          <span className="text-xs px-1" style={{ color: "#f87171" }}>
            {error}
          </span>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
