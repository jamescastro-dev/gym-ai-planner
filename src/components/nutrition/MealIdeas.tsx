import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Apple, Clock, Lightbulb, Loader2, Moon, Sparkles, Sun, Sunrise, Utensils, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api } from "@/lib/api";
import type { Goal, NutritionTargets } from "@/lib/nutrition";
import { SAMPLE_MEALS_FOR, sampleMeals } from "@/data/sampleMeals";
import type { Diet, Meal, MealPlan } from "@/types";
import { MACROS, formatNumber } from "./macros";
import { Segmented } from "./Segmented";

const dietOptions: { value: Diet; label: string }[] = [
  { value: "any", label: "Anything" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
];
const mealCountOptions = [
  { value: "3", label: "3 meals" },
  { value: "4", label: "4 meals" },
  { value: "5", label: "5 meals" },
] as const;

interface Saved {
  diet: Diet;
  meals: "3" | "4" | "5";
  avoid: string;
  result?: { plan: MealPlan; forCalories: number };
}

const DEFAULT_SAVED: Saved = { diet: "any", meals: "4", avoid: "" };

/** "at 3:42 PM" today, otherwise "tomorrow at 3:42 PM". */
function formatWhen(iso: string): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return at.toDateString() === new Date().toDateString() ? `at ${time}` : `tomorrow at ${time}`;
}

// Per user, in this browser only (a convenience; nothing is stored on the server).
const storageKey = (userId: string) => `gymai.meals.v1.${userId}`;

function load(userId: string): Saved {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? { ...DEFAULT_SAVED, ...JSON.parse(raw) } : DEFAULT_SAVED;
  } catch {
    return DEFAULT_SAVED;
  }
}

export function MealIdeas({ targets, goal }: { targets: NutritionTargets | null; goal: Goal }) {
  const { user } = useAuth();

  return (
    <section className="mt-12" aria-labelledby="meal-ideas-heading">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
        <span className="text-xs tracking-widest uppercase" style={{ color: "var(--color-accent)" }}>
          AI meal ideas
        </span>
      </div>
      <h2 id="meal-ideas-heading" className="text-2xl font-bold tracking-tight mb-1" style={{ color: "var(--color-foreground)" }}>
        A day of food that hits your numbers
      </h2>
      <p className="text-sm mb-6 max-w-2xl" style={{ color: "var(--color-muted)" }}>
        Everyday supermarket foods with amounts, built around your targets and how you eat.
      </p>

      {user ? <SignedInMeals userId={user.id} targets={targets} goal={goal} /> : <SignedOutMeals />}
    </section>
  );
}

function SignedOutMeals() {
  return (
    <>
      <Card variant="bordered" className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-sm flex-1" style={{ color: "var(--color-muted)" }}>
          Below is a real example for {formatNumber(SAMPLE_MEALS_FOR.calories)} kcal over {SAMPLE_MEALS_FOR.meals} meals.{" "}
          <span style={{ color: "var(--color-foreground)" }}>Sign in to get ideas for your own targets</span>, choose
          a diet and leave out foods you don't eat.
        </p>
        <div className="flex gap-2 shrink-0">
          <Link to="/auth/sign-in">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/auth/sign-up">
            <Button size="sm">Create a free account</Button>
          </Link>
        </div>
      </Card>
      <MealDay plan={sampleMeals} targetCalories={SAMPLE_MEALS_FOR.calories} />
    </>
  );
}

function SignedInMeals({ userId, targets, goal }: { userId: string; targets: NutritionTargets | null; goal: Goal }) {
  const [saved, setSaved] = useState<Saved>(() => load(userId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // The server said the daily limit is reached (e.g. used up on another device).
  const [limitHit, setLimitHit] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(saved));
    } catch {
      // ignore: private mode or blocked storage
    }
  }, [saved, userId]);

  async function generate() {
    if (!targets) return;
    setLoading(true);
    setError("");
    try {
      const plan = await api.generateMeals({
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat,
        goal,
        diet: saved.diet,
        meals: Number(saved.meals) as 3 | 4 | 5,
        avoid: saved.avoid,
      });
      setSaved((s) => ({ ...s, result: { plan, forCalories: targets.calories } }));
      setNow(Date.now());
    } catch (err) {
      if (err instanceof ApiError && err.code === "DAILY_LIMIT") setLimitHit(true);
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const result = saved.result;
  const nextAt = result?.plan.nextAvailableAt;
  const waitingUntil = nextAt && Date.parse(nextAt) > now ? nextAt : undefined;
  const blocked = limitHit || Boolean(waitingUntil);
  const stale = result && targets && Math.abs(result.forCalories - targets.calories) >= 50;

  return (
    <>
      <Card variant="bordered" className="mb-6">
        <div className="grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 mb-4">
          <Segmented
            label="Diet"
            options={dietOptions}
            value={saved.diet}
            onChange={(diet) => setSaved((s) => ({ ...s, diet }))}
            columns="grid-cols-2 sm:grid-cols-4"
          />
          <Segmented
            label="Meals per day"
            options={[...mealCountOptions]}
            value={saved.meals}
            onChange={(meals) => setSaved((s) => ({ ...s, meals }))}
          />
        </div>
        <div className="flex flex-col gap-1.5 mb-4">
          <label htmlFor="avoid" className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--color-muted)" }}>
            Leave out (optional)
          </label>
          <input
            id="avoid"
            maxLength={120}
            placeholder="E.g. mushrooms, peanuts, tuna"
            value={saved.avoid}
            onChange={(e) => setSaved((s) => ({ ...s, avoid: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors border border-border focus:border-accent placeholder:text-muted"
            style={{ background: "color-mix(in srgb, var(--color-card) 40%, var(--color-border))", color: "var(--color-foreground)" }}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button onClick={generate} disabled={!targets || loading || blocked} className="gap-2 sm:w-auto w-full">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : blocked ? (
              <Clock className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {loading ? "Writing your meal ideas..." : blocked ? "Daily limit reached" : result ? "New meal ideas" : "Get meal ideas"}
          </Button>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            {blocked
              ? `You've used today's free meal plans. ${waitingUntil ? `The next one is available ${formatWhen(waitingUntil)}.` : "Try again tomorrow."}`
              : targets
                ? `For ${formatNumber(targets.calories)} kcal. Uses free AI: a few per day${
                    result?.plan.remainingToday !== undefined ? ` (${result.plan.remainingToday} left today)` : ""
                  }.`
                : "Fill in your details above first."}
          </p>
        </div>
      </Card>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6 text-sm border"
          style={{
            background: "color-mix(in srgb, #f87171 8%, transparent)",
            borderColor: "color-mix(in srgb, #f87171 30%, transparent)",
            color: "var(--color-foreground)",
          }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#f87171" }} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <MealSkeleton count={Number(saved.meals)} />
      ) : error && !result ? (
        // Like the training plan's sample-plan fallback: something useful to look at while the free AI is busy.
        <>
          <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
            Meanwhile, here is a real example day for {formatNumber(SAMPLE_MEALS_FOR.calories)} kcal over{" "}
            {SAMPLE_MEALS_FOR.meals} meals.
          </p>
          <MealDay plan={sampleMeals} targetCalories={SAMPLE_MEALS_FOR.calories} />
        </>
      ) : result ? (
        <>
          {stale && (
            <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
              These were made for {formatNumber(result.forCalories)} kcal; your targets have changed since. Get new ideas
              to match.
            </p>
          )}
          <MealDay plan={result.plan} targetCalories={result.forCalories} />
        </>
      ) : null}
    </>
  );
}

function MealDay({ plan, targetCalories }: { plan: MealPlan; targetCalories: number }) {
  return (
    <div>
      <div
        className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-4 text-sm"
        style={{ color: "var(--color-muted)" }}
      >
        <span>
          Day total{" "}
          <strong style={{ color: "var(--color-foreground)" }}>≈ {formatNumber(plan.totals.calories)} kcal</strong> (target{" "}
          {formatNumber(targetCalories)})
        </span>
        {MACROS.map((m) => (
          <span key={m.key} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5" style={{ background: m.color }} />
            {plan.totals[m.key]} g {m.name.toLowerCase()}
          </span>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {plan.meals.map((meal, i) => (
          <MealCard key={`${meal.name}-${i}`} meal={meal} />
        ))}
      </div>

      {plan.tips.length > 0 && (
        <Card variant="bordered" className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4" style={{ color: "var(--color-accent)" }} />
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
              Tips
            </h3>
          </div>
          <ul className="text-sm space-y-1 list-disc pl-5" style={{ color: "var(--color-muted)" }}>
            {plan.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-xs mt-4" style={{ color: "var(--color-muted)" }}>
        Written by AI. Calories and macros are estimates and can be off, so check food labels, and don't rely on it for
        allergies.
      </p>
    </div>
  );
}

const MEAL_ICONS: Record<string, LucideIcon> = { breakfast: Sunrise, lunch: Sun, dinner: Moon, snack: Apple };

function MealCard({ meal }: { meal: Meal }) {
  const Icon = MEAL_ICONS[meal.name.toLowerCase()] ?? Utensils;
  return (
    <Card variant="bordered" className="flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
        >
          <Icon className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            {meal.name}
          </p>
          <h3 className="font-semibold leading-snug" style={{ color: "var(--color-foreground)" }}>
            {meal.title}
          </h3>
        </div>
        <span className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--color-foreground)" }}>
          {formatNumber(meal.calories)} kcal
        </span>
      </div>

      <ul className="space-y-1.5 mb-4 flex-1">
        {meal.items.map((item, i) => (
          <li key={`${item.food}-${i}`} className="flex gap-3 text-sm">
            <span className="w-20 shrink-0 tabular-nums" style={{ color: "var(--color-muted)" }}>
              {item.amount}
            </span>
            <span className="first-letter:uppercase" style={{ color: "var(--color-foreground)" }}>
              {item.food}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-4 pt-3 text-xs border-t" style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}>
        {MACROS.map((m) => (
          <span key={m.key} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5" style={{ background: m.color }} />
            <span style={{ color: "var(--color-foreground)" }}>{meal[m.key]} g</span> {m.name.toLowerCase()}
          </span>
        ))}
      </div>
    </Card>
  );
}

function MealSkeleton({ count }: { count: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
        Writing your meal ideas. This can take up to a minute, so keep this tab open.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: count }, (_, i) => (
          <Card key={i} variant="bordered" className="animate-pulse">
            <div className="flex gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl" style={{ background: "var(--color-border)" }} />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-2.5 w-16 rounded" style={{ background: "var(--color-border)" }} />
                <div className="h-3.5 w-40 rounded" style={{ background: "var(--color-border)" }} />
              </div>
            </div>
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-3 rounded mb-2" style={{ background: "var(--color-border)", width: `${80 - j * 15}%` }} />
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
