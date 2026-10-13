import { useEffect, useState, type InputHTMLAttributes } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Dumbbell,
  Flame,
  Info,
  Repeat,
  Timer,
  Trophy,
  TrendingDown,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { MacroBar } from "@/components/nutrition/MacroBar";
import { MealIdeas } from "@/components/nutrition/MealIdeas";
import { Segmented } from "@/components/nutrition/Segmented";
import { MACROS, formatNumber } from "@/components/nutrition/macros";
import { useAuth } from "@/context/AuthContext";
import { goalOptions } from "@/data/goalOptions";
import {
  GOAL_RULES,
  LIMITS,
  MIN_CALORIES,
  calculateTargets,
  feetInchesToCm,
  lbToKg,
  validate,
  type Activity,
  type Goal,
  type NutritionInput,
  type NutritionTargets,
  type Sex,
} from "@/lib/nutrition";

const activityOptions: { value: Activity; label: string }[] = [
  { value: "sedentary", label: "Sedentary (little or no exercise)" },
  { value: "light", label: "Light (1–3 workouts a week)" },
  { value: "moderate", label: "Moderate (3–5 workouts a week)" },
  { value: "very", label: "Very active (6–7 workouts a week)" },
  { value: "extra", label: "Extra active (physical job + training)" },
];

const GOAL_ICONS: Record<Goal, LucideIcon> = {
  bulk: Dumbbell,
  cut: TrendingDown,
  recomp: Repeat,
  strength: Trophy,
  endurance: Timer,
};
const goalChoices = goalOptions.map((g) => ({ value: g.value as Goal, label: g.short, icon: GOAL_ICONS[g.value as Goal] }));

const goalExplanation: Record<Goal, string> = {
  bulk: "10% above maintenance for a lean bulk",
  cut: "Below maintenance to lose fat",
  recomp: "At maintenance for body recomposition",
  strength: "5% above maintenance to support heavy training",
  endurance: "At maintenance, with more of it from carbs",
};

interface FormState {
  units: "metric" | "imperial";
  sex: Sex;
  age: string;
  heightCm: string;
  feet: string;
  inches: string;
  weightKg: string;
  weightLb: string;
  activity: Activity;
  goal: Goal;
}

// Example values so the page shows a result straight away.
const DEFAULTS: FormState = {
  units: "metric",
  sex: "female",
  age: "30",
  heightCm: "165",
  feet: "5",
  inches: "5",
  weightKg: "60",
  weightLb: "132",
  activity: "moderate",
  goal: "recomp",
};

// Remembered in this browser only (a convenience; the page works without it).
const STORAGE_KEY = "gymai.nutrition.v1";

const isGoal = (value: string | null): value is Goal => value !== null && value in GOAL_RULES;

function loadForm(goalParam: string | null): FormState {
  let form = DEFAULTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) form = { ...DEFAULTS, ...JSON.parse(saved) };
  } catch {
    // storage unavailable or corrupt: keep the defaults
  }
  return isGoal(goalParam) ? { ...form, goal: goalParam } : form;
}

function toInput(form: FormState): NutritionInput {
  const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
  const metric = form.units === "metric";
  return {
    sex: form.sex,
    age: num(form.age),
    heightCm: metric ? num(form.heightCm) : feetInchesToCm(num(form.feet), form.inches.trim() === "" ? 0 : num(form.inches)),
    weightKg: metric ? num(form.weightKg) : lbToKg(num(form.weightLb)),
    activity: form.activity,
    goal: form.goal,
  };
}

export default function Nutrition() {
  const { user, plan } = useAuth();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormState>(() => loadForm(searchParams.get("goal")));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      // ignore: private mode or blocked storage
    }
  }, [form]);

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const input = toInput(form);
  const problem = validate(input);
  const targets = problem ? null : calculateTargets(input);
  const imperial = form.units === "imperial";

  return (
    <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: "var(--color-background)" }}>
      {/* bg glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-175 h-75 rounded-full blur-[120px] opacity-5 pointer-events-none"
        style={{ background: "var(--color-accent)" }}
      />

      <div className="relative max-w-5xl mx-auto">
        {/* ── HEADER ── */}
        <div className="mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4 border"
            style={{
              background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)",
              color: "var(--color-accent)",
            }}
          >
            <Utensils className="w-3 h-3" />
            Nutrition
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-1" style={{ color: "var(--color-foreground)" }}>
            Fuel your training
          </h1>
          <p className="text-sm max-w-xl" style={{ color: "var(--color-muted)" }}>
            Daily calories and macros for your goal, worked out from your body and how active you are. Then get AI meal
            ideas that hit them.
          </p>
        </div>

        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-6 items-start">
          {/* ── FORM ── */}
          <Card variant="bordered">
            <div className="space-y-5">
              <Segmented
                label="Goal"
                options={goalChoices}
                value={form.goal}
                onChange={(goal) => update("goal", goal)}
                columns="grid-cols-3"
              />

              <div className="grid grid-cols-2 gap-4">
                <Segmented
                  label="Sex"
                  options={[
                    { value: "female", label: "Female" },
                    { value: "male", label: "Male" },
                  ]}
                  value={form.sex}
                  onChange={(sex) => update("sex", sex)}
                />
                <NumberField
                  id="age"
                  label="Age"
                  suffix="yrs"
                  min={LIMITS.age.min}
                  max={LIMITS.age.max}
                  value={form.age}
                  onChange={(e) => update("age", e.target.value)}
                />
              </div>

              <Segmented
                label="Units"
                options={[
                  { value: "metric", label: "Metric (kg, cm)" },
                  { value: "imperial", label: "Imperial (lb, ft)" },
                ]}
                value={form.units}
                onChange={(units) => update("units", units)}
              />

              {imperial ? (
                <div className="grid grid-cols-3 gap-4">
                  <NumberField id="feet" label="Height" suffix="ft" min={4} max={7} value={form.feet} onChange={(e) => update("feet", e.target.value)} />
                  <NumberField
                    id="inches"
                    label="Height, inches"
                    hideLabel
                    suffix="in"
                    min={0}
                    max={11}
                    value={form.inches}
                    onChange={(e) => update("inches", e.target.value)}
                  />
                  <NumberField id="weightLb" label="Weight" suffix="lb" min={77} max={550} value={form.weightLb} onChange={(e) => update("weightLb", e.target.value)} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <NumberField
                    id="heightCm"
                    label="Height"
                    suffix="cm"
                    min={LIMITS.heightCm.min}
                    max={LIMITS.heightCm.max}
                    value={form.heightCm}
                    onChange={(e) => update("heightCm", e.target.value)}
                  />
                  <NumberField
                    id="weightKg"
                    label="Weight"
                    suffix="kg"
                    min={LIMITS.weightKg.min}
                    max={LIMITS.weightKg.max}
                    value={form.weightKg}
                    onChange={(e) => update("weightKg", e.target.value)}
                  />
                </div>
              )}

              <Select
                id="activity"
                label="Activity level"
                options={activityOptions}
                value={form.activity}
                onChange={(e) => update("activity", e.target.value as Activity)}
              />
            </div>
          </Card>

          {/* ── RESULTS (stays in view on desktop while you edit) ── */}
          <div className="space-y-4 md:sticky md:top-24" aria-live="polite">
            {targets ? <Targets targets={targets} goal={form.goal} sex={form.sex} /> : <InvalidInput problem={problem} />}
          </div>
        </div>

        <MealIdeas targets={targets} goal={form.goal} />

        {/* ── METHOD ── */}
        <Card variant="bordered" className="mt-12">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
              How the targets are calculated
            </h2>
          </div>
          <ul className="text-sm space-y-1.5 list-disc pl-5" style={{ color: "var(--color-muted)" }}>
            <li>Resting energy uses the Mifflin-St Jeor equation, multiplied by your activity level.</li>
            <li>
              Your goal moves that up or down, never below {formatNumber(MIN_CALORIES.female)} kcal (women) or{" "}
              {formatNumber(MIN_CALORIES.male)} kcal (men), and a cut never goes above maintenance.
            </li>
            <li>Protein is 1.4–2.2 g per kg of body weight depending on the goal, highest when cutting.</li>
            <li>Fat is 20–25% of calories, carbs make up the rest.</li>
          </ul>
          <p className="text-xs mt-3" style={{ color: "var(--color-muted)" }}>
            These are estimates for healthy adults, not medical advice. Check your weight trend over 2–3 weeks and adjust by
            100–200 kcal if it is not moving the way you want.
          </p>
        </Card>

        <Link to={user ? (plan ? "/profile" : "/onboarding") : "/sample"} className="block mt-6">
          <Button variant="secondary" className="gap-2 group w-full">
            {user ? (plan ? "Back to my training plan" : "Build my training plan") : "See a sample training plan"}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Targets({ targets, goal, sex }: { targets: NutritionTargets; goal: Goal; sex: Sex }) {
  return (
    <>
      <Card variant="bordered" className="relative overflow-hidden">
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: "var(--color-accent)" }}
        />
        <div className="relative flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
          >
            <Flame className="w-6 h-6" style={{ color: "var(--color-accent)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: "var(--color-muted)" }}>
              Daily target
            </p>
            <p className="text-4xl font-bold tracking-tight leading-tight" style={{ color: "var(--color-foreground)" }}>
              {formatNumber(targets.calories)}{" "}
              <span className="text-lg font-semibold ml-0.5" style={{ color: "var(--color-muted)" }}>
                kcal
              </span>
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
              {goalExplanation[goal]} · maintenance ≈ {formatNumber(targets.maintenance)} kcal
            </p>
          </div>
        </div>
      </Card>

      {targets.raisedToMinimum && (
        <div
          role="note"
          className="rounded-xl px-4 py-3 text-sm border"
          style={{
            background: "color-mix(in srgb, #f59e0b 8%, transparent)",
            borderColor: "color-mix(in srgb, #f59e0b 30%, transparent)",
            color: "var(--color-foreground)",
          }}
        >
          {targets.heldAtMaintenance
            ? `Your maintenance is already under ${formatNumber(MIN_CALORIES[sex])} kcal, so the target stays at maintenance instead of cutting. More daily activity is the safer way to lose fat; talk to a doctor or dietitian before eating less.`
            : `A 20% cut would go below ${formatNumber(MIN_CALORIES[sex])} kcal, so the target is held there. A smaller deficit or more daily activity is safer than eating less.`}
        </div>
      )}

      <Card variant="bordered">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {MACROS.map((m) => {
            const grams = targets[m.key];
            return (
              <div key={m.key}>
                <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-muted)" }}>
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: m.color }} />
                  {m.name}
                </p>
                <p className="text-2xl font-bold tracking-tight mt-0.5" style={{ color: "var(--color-foreground)" }}>
                  {grams}{" "}
                  <span className="text-sm font-semibold" style={{ color: "var(--color-muted)" }}>
                    g
                  </span>
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-muted)" }}>
                  {formatNumber(grams * m.kcalPerGram)} kcal
                </p>
              </div>
            );
          })}
        </div>
        <MacroBar grams={{ protein: targets.protein, carbs: targets.carbs, fat: targets.fat }} />
        <p className="text-xs mt-4 pt-3 border-t" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
          Over 4 meals that is about{" "}
          <span style={{ color: "var(--color-foreground)" }}>{Math.round(targets.protein / 4)} g of protein</span> each.
        </p>
      </Card>
    </>
  );
}

function InvalidInput({ problem }: { problem: string | null }) {
  return (
    <Card variant="bordered">
      <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
        {problem}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
        Your targets appear here as soon as every field is valid.
      </p>
    </Card>
  );
}

function NumberField({
  id,
  label,
  hideLabel = false,
  suffix,
  ...props
}: { id: string; label: string; hideLabel?: boolean; suffix: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* A hidden label still takes up its line, so fields in the same row stay aligned. */}
      <label
        htmlFor={id}
        className={`text-xs font-medium tracking-wide uppercase ${hideLabel ? "invisible" : ""}`}
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          aria-label={hideLabel ? label : undefined}
          className="w-full pl-4 pr-10 py-2.5 rounded-xl text-sm outline-none transition-colors border border-border focus:border-accent"
          style={{
            background: "color-mix(in srgb, var(--color-card) 40%, var(--color-border))",
            color: "var(--color-foreground)",
          }}
          {...props}
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
          style={{ color: "var(--color-muted)" }}
        >
          {suffix}
        </span>
      </div>
    </div>
  );
}
