import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Calendar,
  Dumbbell,
  RefreshCcw,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { PlanDisplay } from "@/components/plan/PlanDisplay";
import { useState } from "react";

export default function Profile() {
  const { user, isLoading, plan, generatePlan } = useAuth();
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!user && !isLoading) return <Navigate to="/auth/sign-in" replace />;
  if (!plan) return <Navigate to="/onboarding" replace />;

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const stats = [
    { icon: Target, label: "Goal", value: plan.overview.goal },
    { icon: Calendar, label: "Frequency", value: plan.overview.frequency },
    { icon: Dumbbell, label: "Split", value: plan.overview.split },
    { icon: TrendingUp, label: "Version", value: `v${plan.version}` },
  ];

  return (
    <div
      className="min-h-screen pt-24 pb-16 px-6"
      style={{ background: "var(--color-background)" }}
    >
      {/* bg glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-175 h-75 rounded-full blur-[120px] opacity-5 pointer-events-none"
        style={{ background: "var(--color-accent)" }}
      />

      <div className="relative max-w-5xl mx-auto">

        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4 border"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                borderColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              <Zap className="w-3 h-3" />
              AI Generated • {formatDate(plan.createdAt)}
            </div>
            <h1
              className="text-4xl font-bold tracking-tight mb-1"
              style={{ color: "var(--color-foreground)" }}
            >
              Your Training Plan
            </h1>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Personalized program • Version {plan.version}
            </p>
          </div>

          <Button
            variant="secondary"
            className="gap-2 shrink-0"
            disabled={isRegenerating}
            onClick={async () => {
              setIsRegenerating(true);
              try {
                await generatePlan();
              } finally {
                setIsRegenerating(false);
              }
            }}
          >
            <RefreshCcw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
            {isRegenerating ? "Regenerating..." : "Regenerate Plan"}
          </Button>
        </div>

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
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--color-foreground)" }}
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
              {plan.overview.notes}
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
              {plan.progression}
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
          <PlanDisplay weeklySchedule={plan.weeklySchedule} />
        </div>

      </div>
    </div>
  );
}