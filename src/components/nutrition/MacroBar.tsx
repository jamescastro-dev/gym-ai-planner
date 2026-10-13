import { useState } from "react";
import { INK_ON_MACRO, MACROS, formatNumber, type MacroKey } from "./macros";

/**
 * Share of the day's calories from each macro: one stacked bar (part-to-whole), 2px surface gaps between segments,
 * percentages inside when they fit, a legend, and a hover/focus tooltip with the grams. The macro cards above it are
 * the table view, so nothing here is only reachable by hovering.
 */
export function MacroBar({ grams }: { grams: Record<MacroKey, number> }) {
  const [active, setActive] = useState<MacroKey | null>(null);
  const parts = MACROS.map((m) => ({ ...m, grams: grams[m.key], kcal: grams[m.key] * m.kcalPerGram }));
  const total = parts.reduce((sum, p) => sum + p.kcal, 0) || 1;
  const pcts = parts.map((p) => (p.kcal / total) * 100);
  // Where each segment starts (%), so a tooltip near the right edge opens leftwards.
  const starts = pcts.map((_, i) => pcts.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <figure className="m-0">
      <figcaption className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>
        Where the calories come from
      </figcaption>
      <div className="relative">
        <div className="flex gap-0.5 h-6">
          {parts.map((p, i) => {
            const pct = pcts[i];
            const left = starts[i];
            const rounded = `${i === 0 ? "rounded-l" : ""} ${i === parts.length - 1 ? "rounded-r" : ""}`;
            return (
              <div
                key={p.key}
                tabIndex={0}
                aria-label={`${p.name}: ${p.grams} grams, ${Math.round(pct)}% of calories`}
                onPointerEnter={() => setActive(p.key)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(p.key)}
                onBlur={() => setActive(null)}
                className={`relative flex items-center justify-center text-[11px] font-semibold outline-none transition-[filter] cursor-default focus-visible:ring-2 focus-visible:ring-foreground ${rounded}`}
                style={{
                  width: `${pct}%`,
                  background: p.color,
                  color: INK_ON_MACRO,
                  filter: active === p.key ? "brightness(1.15)" : undefined,
                }}
              >
                {/* Label only where it fits with padding; otherwise the legend and tooltip carry it. */}
                {pct >= 12 && <span aria-hidden>{Math.round(pct)}%</span>}
                {active === p.key && (
                  <span
                    role="tooltip"
                    className="absolute bottom-full mb-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs shadow-lg pointer-events-none z-10"
                    style={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-foreground)",
                      left: left > 70 ? "auto" : 0,
                      right: left > 70 ? 0 : "auto",
                    }}
                  >
                    <span className="inline-block w-3 h-0.5 align-middle mr-1.5" style={{ background: p.color }} />
                    <strong>{p.grams} g</strong>
                    <span style={{ color: "var(--color-muted)" }}>
                      {" "}
                      {p.name.toLowerCase()} · {formatNumber(p.kcal)} kcal
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
        ))}
      </div>
    </figure>
  );
}
