import { useEffect, useState, type InputHTMLAttributes } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Beef, Droplet, Flame, Info, Utensils, Wheat, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/context/AuthContext";
import { goalOptions } from "@/data/goalOptions";
import {
  GOAL_RULES,
  LIMITS,
  MIN_CALORIES,
  calculateTargets,
  feetInchesToCm,
  kcal,
  lbToKg,
  validate,
  type Activity,
  type Goal,
  type NutritionInput,
  type Sex,
} from "@/lib/nutrition";

const activityOptions: { value: Activity; label: string }[] = [
  { value: "sedentary", label: "Sedentary (little or no exercise)" },
  { value: "light", label: "Light (1–3 workouts a week)" },
  { value: "moderate", label: "Moderate (3–5 workouts a week)" },
  { value: "very", label: "Very active (6–7 workouts a week)" },
  { value: "extra", label: "Extra active (physical job + training)" },
];

const sexOptions: { value: Sex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

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

const formatNumber = (n: number) => n.toLocaleString("en-US");

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
            Daily calories and macros for your goal, worked out from your body and how active you are. Free, instant,
            and no account needed.
          </p>
        </div>

        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
          {/* ── FORM ── */}
          <Card variant="bordered">
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--color-muted)" }}>
                  Units
                </span>
                <div
                  className="grid grid-cols-2 p-1 rounded-xl"
                  style={{ background: "color-mix(in srgb, var(--color-card) 40%, var(--color-border))" }}
                >
                  {(["metric", "imperial"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={form.units === u}
                      onClick={() => update("units", u)}
                      className="py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                      style={
                        form.units === u
                          ? { background: "var(--color-accent)", color: "var(--color-background)" }
                          : { color: "var(--color-muted)" }
                      }
                    >
                      {u === "metric" ? "Metric (kg, cm)" : "Imperial (lb, ft)"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  id="sex"
                  label="Sex"
                  options={sexOptions}
                  value={form.sex}
                  onChange={(e) => update("sex", e.target.value as Sex)}
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

              {imperial ? (
                <div className="grid grid-cols-3 gap-4">
                  <NumberField
                    id="feet"
                    label="Height"
                    suffix="ft"
                    min={4}
                    max={7}
                    value={form.feet}
                    onChange={(e) => update("feet", e.target.value)}
                  />
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
                  <NumberField
                    id="weightLb"
                    label="Weight"
                    suffix="lb"
                    min={77}
                    max={550}
                    value={form.weightLb}
                    onChange={(e) => update("weightLb", e.target.value)}
                  />
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
              <Select
                id="goal"
                label="Goal"
                options={goalOptions}
                value={form.goal}
                onChange={(e) => update("goal", e.target.value as Goal)}
              />
            </div>
          </Card>

          {/* ── RESULTS ── */}
          <div className="space-y-4" aria-live="polite">
            {targets ? (
              <>
                <Card variant="bordered" className="flex items-center gap-4">
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
                    <p className="text-3xl font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>
                      {formatNumber(targets.calories)} kcal
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                      {goalExplanation[form.goal]} (maintenance ≈ {formatNumber(targets.maintenance)} kcal)
                    </p>
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
                      ? `Your maintenance is already under ${formatNumber(MIN_CALORIES[form.sex])} kcal, so the target stays at maintenance instead of cutting. More daily activity is the safer way to lose fat; talk to a doctor or dietitian before eating less.`
                      : `A 20% cut would go below ${formatNumber(MIN_CALORIES[form.sex])} kcal, so the target is held there. A smaller deficit or more daily activity is safer than eating less.`}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <MacroCard icon={Beef} name="Protein" grams={targets.protein} perGram={kcal.protein} total={targets.calories} />
                  <MacroCard icon={Wheat} name="Carbs" grams={targets.carbs} perGram={kcal.carbs} total={targets.calories} />
                  <MacroCard icon={Droplet} name="Fat" grams={targets.fat} perGram={kcal.fat} total={targets.calories} />
                </div>

                <MacroBar protein={targets.protein} carbs={targets.carbs} fat={targets.fat} />

                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Spread over 4 meals, that is about{" "}
                  <span style={{ color: "var(--color-foreground)" }}>{Math.round(targets.protein / 4)} g of protein</span> per
                  meal.
                </p>
              </>
            ) : (
              <Card variant="bordered">
                <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                  {problem}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                  Your targets appear here as soon as every field is valid.
                </p>
              </Card>
            )}

            <Card variant="bordered">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
                  How this is calculated
                </h2>
              </div>
              <ul className="text-sm space-y-1.5 list-disc pl-5" style={{ color: "var(--color-muted)" }}>
                <li>Resting energy uses the Mifflin-St Jeor equation, multiplied by your activity level.</li>
                <li>Your goal moves that up or down (see above), never below {formatNumber(MIN_CALORIES.female)} kcal (women) or{" "}
                  {formatNumber(MIN_CALORIES.male)} kcal (men).
                </li>
                <li>Protein is 1.4–2.2 g per kg of body weight depending on the goal, highest when cutting.</li>
                <li>Fat is 20–25% of calories, carbs make up the rest.</li>
              </ul>
              <p className="text-xs mt-3" style={{ color: "var(--color-muted)" }}>
                These are estimates for healthy adults, not medical advice. Check your weight trend over 2–3 weeks and adjust
                by 100–200 kcal if it is not moving the way you want.
              </p>
            </Card>

            <Link to={user ? (plan ? "/profile" : "/onboarding") : "/sample"} className="block">
              <Button variant="secondary" className="gap-2 group w-full">
                {user ? (plan ? "Back to my training plan" : "Build my training plan") : "See a sample training plan"}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
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

function MacroCard({
  icon: Icon,
  name,
  grams,
  perGram,
  total,
}: {
  icon: LucideIcon;
  name: string;
  grams: number;
  perGram: number;
  total: number;
}) {
  const calories = grams * perGram;
  return (
    <Card variant="bordered" className="rounded-xl! p-3! sm:p-4!">
      <Icon className="w-4 h-4 mb-2" style={{ color: "var(--color-accent)" }} />
      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
        {name}
      </p>
      <p className="text-xl font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>
        {grams} g
      </p>
      <p className="text-[11px] leading-tight" style={{ color: "var(--color-muted)" }}>
        {formatNumber(calories)} kcal · {Math.round((calories / total) * 100)}%
      </p>
    </Card>
  );
}

function MacroBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const parts = [
    { name: "Protein", kcal: protein * kcal.protein, color: "var(--color-accent)" },
    { name: "Carbs", kcal: carbs * kcal.carbs, color: "color-mix(in srgb, var(--color-accent) 55%, var(--color-card))" },
    { name: "Fat", kcal: fat * kcal.fat, color: "color-mix(in srgb, var(--color-accent) 25%, var(--color-card))" },
  ];
  const total = parts.reduce((sum, p) => sum + p.kcal, 0);
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden" role="img" aria-label="Share of calories from each macro">
        {parts.map((p) => (
          <div key={p.name} style={{ width: `${(p.kcal / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
        {parts.map((p) => (
          <span key={p.name} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
