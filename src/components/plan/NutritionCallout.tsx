import { Link } from "react-router-dom";
import { ArrowRight, Utensils } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Goal } from "@/lib/nutrition";

/** Shown under a plan: links to the nutrition calculator, optionally with the plan's goal pre-selected. */
export function NutritionCallout({ goal }: { goal?: Goal }) {
  return (
    <Link to={goal ? `/nutrition?goal=${goal}` : "/nutrition"} className="block mt-8 group">
      <Card variant="bordered" className="flex items-center gap-4 transition-colors group-hover:border-accent">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
        >
          <Utensils className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold" style={{ color: "var(--color-foreground)" }}>
            Fuel this plan
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Daily calories and macros for your goal.
          </p>
        </div>
        <ArrowRight
          className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-1"
          style={{ color: "var(--color-accent)" }}
        />
      </Card>
    </Link>
  );
}
