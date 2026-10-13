import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { RefreshCcw, Zap } from "lucide-react";
import { PlanSections } from "@/components/plan/PlanSections";
import { PlanError } from "@/components/plan/PlanError";
import { NutritionCallout } from "@/components/plan/NutritionCallout";
import { useState } from "react";

export default function Profile() {
  const { user, isLoading, isPlanLoading, plan, generatePlan } = useAuth();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState("");

  if (!user && !isLoading) return <Navigate to="/auth/sign-in" replace />;
  if (isLoading || isPlanLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-background)" }}
        role="status"
        aria-label="Loading your plan"
      >
        <Zap className="w-8 h-8 animate-pulse" style={{ color: "var(--color-accent)" }} />
      </div>
    );
  }
  if (!plan) return <Navigate to="/onboarding" replace />;

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

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
              setError("");
              try {
                await generatePlan();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't regenerate your plan.");
              } finally {
                setIsRegenerating(false);
              }
            }}
          >
            <RefreshCcw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
            {isRegenerating ? "Regenerating..." : "Regenerate Plan"}
          </Button>
        </div>

        {error && (
          <div className="mb-8">
            <PlanError message={error} note="Your current plan is unchanged." />
          </div>
        )}

        <PlanSections
          overview={plan.overview}
          progression={plan.progression}
          weeklySchedule={plan.weeklySchedule}
          versionLabel={`v${plan.version}`}
        />

        <NutritionCallout />
      </div>
    </div>
  );
}
