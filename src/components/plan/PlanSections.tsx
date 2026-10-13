import { useState } from "react";
import { Calendar, Dumbbell, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PlanDisplay } from "@/components/plan/PlanDisplay";
import type { DaySchedule, PlanOverview } from "@/types";

interface PlanSectionsProps {
  overview: PlanOverview;
  progression: string;
  weeklySchedule: DaySchedule[];
  /** Shown in the fourth stat card, e.g. "v2" or "Sample". */
  versionLabel: string;
}

/** Stat cards, notes, progression and the weekly schedule. Shared by the user's plan and the sample plan. */
export function PlanSections({
  overview,
  progression,
  weeklySchedule,
  versionLabel,
}: PlanSectionsProps) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const stats = [
    { icon: Target, label: "Goal", value: overview.goal },
    { icon: Calendar, label: "Frequency", value: overview.frequency },
    { icon: Dumbbell, label: "Split", value: overview.split },
    { icon: TrendingUp, label: "Version", value: versionLabel },
  ];

  return (
    <>
      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            variant="bordered"
            className="rounded-xl! p-4! flex items-center gap-3"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
            >
              <stat.icon className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>
                {stat.label}
              </p>
              <p
                className="text-sm font-semibold line-clamp-2 wrap-anywhere cursor-default"
                style={{ color: "var(--color-foreground)" }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ text: stat.value, x: rect.left, y: rect.bottom + 6 });
                }}
                onMouseLeave={() => setTooltip(null)}
                onTouchStart={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ text: stat.value, x: rect.left, y: rect.bottom + 6 });
                }}
                onTouchEnd={() => setTimeout(() => setTooltip(null), 2000)}
              >
                {stat.value}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* ── NOTES + PROGRESSION side by side ── */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card variant="bordered">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "var(--color-accent)" }} />
            <h2 className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>
              Program Notes
            </h2>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
            {overview.notes}
          </p>
        </Card>

        <Card variant="bordered">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ background: "var(--color-accent)" }} />
            <h2 className="font-semibold text-sm" style={{ color: "var(--color-foreground)" }}>
              Progression Strategy
            </h2>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
            {progression}
          </p>
        </Card>
      </div>

      {/* ── WEEKLY SCHEDULE ── */}
      <div className="mb-2">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px w-8" style={{ background: "var(--color-accent)" }} />
          <span
            className="text-xs tracking-widest uppercase font-semibold"
            style={{ color: "var(--color-accent)" }}
          >
            Weekly Schedule
          </span>
        </div>
        <PlanDisplay weeklySchedule={weeklySchedule} />
      </div>

      {/* ── TOOLTIP ── */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg text-xs max-w-56 shadow-lg border pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            background: "var(--color-background)",
            borderColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)",
            color: "var(--color-foreground)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
}
