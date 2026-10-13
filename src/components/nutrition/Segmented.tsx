import type { LucideIcon } from "lucide-react";

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/** A row of mutually exclusive choices (a radio group that looks like buttons). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  columns,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Grid columns; defaults to one per option. */
  columns?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--color-muted)" }}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className={`grid gap-1 p-1 rounded-xl ${columns ?? ""}`}
        style={{
          gridTemplateColumns: columns ? undefined : `repeat(${options.length}, minmax(0, 1fr))`,
          background: "color-mix(in srgb, var(--color-card) 40%, var(--color-border))",
        }}
      >
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={
                selected
                  ? { background: "var(--color-accent)", color: "var(--color-background)" }
                  : { color: "var(--color-muted)" }
              }
            >
              {/* Icons only where there's room: on a phone the words need the whole button. */}
              {o.icon && <o.icon className="w-4 h-4 shrink-0 hidden sm:block" />}
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
