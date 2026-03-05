import { RedirectToSignIn, SignedIn } from "@neondatabase/neon-js/auth/react";
import { useAuth } from "../context/AuthContext";
import { Select } from "../components/ui/Select";
import { useState } from "react";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ArrowRight, Dumbbell, Zap, Target, Clock } from "lucide-react";
import type { UserProfile } from "../types";
import { useNavigate } from "react-router-dom";

const goalOptions = [
  { value: "bulk", label: "Build Muscle (Bulk)" },
  { value: "cut", label: "Lose Fat (Cut)" },
  { value: "recomp", label: "Body Recomposition" },
  { value: "strength", label: "Build Strength" },
  { value: "endurance", label: "Improve Endurance" },
];

const experienceOptions = [
  { value: "beginner", label: "Beginner (0-1 years)" },
  { value: "intermediate", label: "Intermediate (1-3 years)" },
  { value: "advanced", label: "Advanced (3+ years)" },
];

const daysOptions = [
  { value: "2", label: "2 days / week" },
  { value: "3", label: "3 days / week" },
  { value: "4", label: "4 days / week" },
  { value: "5", label: "5 days / week" },
  { value: "6", label: "6 days / week" },
];

const sessionOptions = [
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "90", label: "90 min" },
];

const equipmentOptions = [
  { value: "full_gym", label: "Full Gym Access" },
  { value: "home", label: "Home Gym" },
  { value: "dumbbells", label: "Dumbbells Only" },
];

const splitOptions = [
  { value: "full_body", label: "Full Body" },
  { value: "upper_lower", label: "Upper / Lower Split" },
  { value: "ppl", label: "Push / Pull / Legs" },
  { value: "custom", label: "Let AI Decide" },
];

function SectionLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center"
        style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--color-accent)" }} />
      </div>
      <span
        className="text-xs font-semibold tracking-widest uppercase"
        style={{ color: "var(--color-accent)" }}
      >
        {label}
      </span>
    </div>
  );
}

export default function Onboarding() {
  const { user, saveProfile, generatePlan } = useAuth();
  const [formData, setFormData] = useState({
    goal: "bulk",
    experience: "intermediate",
    daysPerWeek: "4",
    sessionLength: "60",
    equipment: "full_gym",
    injuries: "",
    preferredSplit: "upper_lower",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function updateForm(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleQuestionnaire(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const profile: Omit<UserProfile, "userId" | "updatedAt"> = {
      goal: formData.goal as UserProfile["goal"],
      experience: formData.experience as UserProfile["experience"],
      daysPerWeek: parseInt(formData.daysPerWeek),
      sessionLength: parseInt(formData.sessionLength),
      equipment: formData.equipment as UserProfile["equipment"],
      injuries: formData.injuries || undefined,
      preferredSplit: formData.preferredSplit as UserProfile["preferredSplit"],
    };
    try {
      await saveProfile(profile);
      setIsGenerating(true);
      await generatePlan();
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!user) return <RedirectToSignIn />;

  if (isGenerating) {
    return (
      <SignedIn>
        <div
          className="min-h-screen flex items-center justify-center px-6"
          style={{ background: "var(--color-background)" }}
        >
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full blur-[120px] opacity-10 pointer-events-none"
            style={{ background: "var(--color-accent)" }}
          />
          <div className="relative text-center max-w-sm">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border-2 opacity-10" style={{ borderColor: "var(--color-accent)" }} />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: "var(--color-accent)", animationDuration: "1s" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-8 h-8" style={{ color: "var(--color-accent)" }} />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--color-foreground)" }}>
              Building your plan
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
              Our AI is crafting a personalized training program based on your goals and schedule...
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-8">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "var(--color-accent)", animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </SignedIn>
    );
  }

  return (
    <SignedIn>
      <div
        className="min-h-screen flex items-center justify-center px-6 py-24"
        style={{ background: "var(--color-background)" }}
      >
        {/* bg glow */}
        <div
          className="fixed top-0 right-0 w-125 h-125 rounded-full blur-[140px] opacity-5 pointer-events-none"
          style={{ background: "var(--color-accent)" }}
        />

        <div className="relative w-full max-w-3xl">

          {/* Header */}
          <div className="mb-8">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4 border"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                borderColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              <Zap className="w-3 h-3" />
              Quick Setup
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--color-foreground)" }}>
              Let's build your plan.
            </h1>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Answer a few questions and we'll generate a program built for you.
            </p>
          </div>

          {/* Form card */}
          <form onSubmit={handleQuestionnaire}>
            <Card variant="bordered">

              {/* Row 1: Goals | Schedule side by side */}
              <div className="grid grid-cols-2 gap-x-8 mb-6">
                <div>
                  <SectionLabel icon={Target} label="Your Goal" />
                  <div className="space-y-4">
                    <Select
                      id="goal"
                      label="Primary goal"
                      options={goalOptions}
                      value={formData.goal}
                      onChange={(e) => updateForm("goal", e.target.value)}
                    />
                    <Select
                      id="experience"
                      label="Training experience"
                      options={experienceOptions}
                      value={formData.experience}
                      onChange={(e) => updateForm("experience", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <SectionLabel icon={Clock} label="Schedule" />
                  <div className="space-y-4">
                    <Select
                      id="daysPerWeek"
                      label="Days per week"
                      options={daysOptions}
                      value={formData.daysPerWeek}
                      onChange={(e) => updateForm("daysPerWeek", e.target.value)}
                    />
                    <Select
                      id="sessionLength"
                      label="Session length"
                      options={sessionOptions}
                      value={formData.sessionLength}
                      onChange={(e) => updateForm("sessionLength", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="mb-6" style={{ borderTop: "1px solid var(--color-border)" }} />

              {/* Row 2: Equipment + Split + Injuries */}
              <div>
                <SectionLabel icon={Dumbbell} label="Equipment & Training" />
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <Select
                    id="equipment"
                    label="Equipment access"
                    options={equipmentOptions}
                    value={formData.equipment}
                    onChange={(e) => updateForm("equipment", e.target.value)}
                  />
                  <Select
                    id="preferredSplit"
                    label="Preferred training split"
                    options={splitOptions}
                    value={formData.preferredSplit}
                    onChange={(e) => updateForm("preferredSplit", e.target.value)}
                  />
                  <div className="col-span-2">
                    <Textarea
                      id="injuries"
                      label="Injuries or limitations (optional)"
                      placeholder="E.g., lower back issues, shoulder impingement..."
                      rows={3}
                      value={formData.injuries}
                      onChange={(e) => updateForm("injuries", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p
                  className="text-sm px-4 py-3 rounded-xl mt-6"
                  style={{
                    color: "#f87171",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {error}
                </p>
              )}

              {/* Submit */}
              <div className="mt-8">
                <Button type="submit" className="w-full gap-2 group" size="lg">
                  Generate My Plan
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>

            </Card>
          </form>

          <p className="text-center text-xs mt-4" style={{ color: "var(--color-muted)" }}>
            You can update your preferences anytime from your profile.
          </p>
        </div>
      </div>
    </SignedIn>
  );
}