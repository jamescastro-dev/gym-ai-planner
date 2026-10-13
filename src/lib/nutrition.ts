// Daily calorie and macro targets. Pure functions, no network: the nutrition page works without an account or any AI quota.
//
// BMR: Mifflin-St Jeor. Maintenance: BMR x a standard activity multiplier. The goal then moves calories up or down and
// sets protein per kg of body weight. Fat is a share of calories (with a floor per kg), carbs fill the rest.

export type Sex = "female" | "male";
export type Goal = "bulk" | "cut" | "recomp" | "strength" | "endurance";
export type Activity = "sedentary" | "light" | "moderate" | "very" | "extra";

export interface NutritionInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
}

export interface NutritionTargets {
  bmr: number;
  maintenance: number;
  calories: number;
  /** Fraction of maintenance added (+) or removed (-) for the goal, e.g. 0.1. */
  adjustment: number;
  /** True when the goal would have gone below the minimum daily calories, so the target was raised. */
  raisedToMinimum: boolean;
  /** True when maintenance itself is under the minimum: the target is then maintenance, so a cut never means eating more. */
  heldAtMaintenance: boolean;
  protein: number;
  fat: number;
  carbs: number;
}

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export const GOAL_RULES: Record<Goal, { adjustment: number; proteinPerKg: number; fatShare: number }> = {
  bulk: { adjustment: 0.1, proteinPerKg: 1.8, fatShare: 0.25 },
  cut: { adjustment: -0.2, proteinPerKg: 2.2, fatShare: 0.25 },
  recomp: { adjustment: 0, proteinPerKg: 2.0, fatShare: 0.25 },
  strength: { adjustment: 0.05, proteinPerKg: 1.8, fatShare: 0.25 },
  endurance: { adjustment: 0, proteinPerKg: 1.4, fatShare: 0.2 },
};

/** Common lower bounds for unsupervised diets. */
export const MIN_CALORIES: Record<Sex, number> = { female: 1200, male: 1500 };

/** Inputs outside these ranges are rejected. The formula is for adults. */
export const LIMITS = {
  age: { min: 18, max: 80 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 250 },
} as const;

const MIN_FAT_PER_KG = 0.6;
const MAX_PROTEIN_SHARE = 0.4; // keeps a heavy person on a cut from getting a protein target that leaves no room for carbs
const MAX_FAT_FLOOR_SHARE = 0.35;

export const kcal = { protein: 4, carbs: 4, fat: 9 } as const;

export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

/** Returns a message for the first invalid field, or null when the input can be calculated. */
export function validate(input: NutritionInput): string | null {
  const checks: [keyof typeof LIMITS, string, string][] = [
    ["age", "Age", "years"],
    ["heightCm", "Height", "cm"],
    ["weightKg", "Weight", "kg"],
  ];
  for (const [key, name, unit] of checks) {
    const value = input[key];
    const { min, max } = LIMITS[key];
    if (!Number.isFinite(value)) return `${name} is required.`;
    if (value < min || value > max) return `${name} must be between ${min} and ${max} ${unit}.`;
  }
  if (!(input.activity in ACTIVITY_FACTORS)) return "Choose an activity level.";
  if (!(input.goal in GOAL_RULES)) return "Choose a goal.";
  return null;
}

export function calculateTargets(input: NutritionInput): NutritionTargets {
  const problem = validate(input);
  if (problem) throw new Error(problem);

  const { sex, age, heightCm, weightKg, activity, goal } = input;
  const rules = GOAL_RULES[goal];

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  const maintenance = bmr * ACTIVITY_FACTORS[activity];
  const wanted = maintenance * (1 + rules.adjustment);
  // The minimum never lifts the target above maintenance: for a small, inactive person a "cut" at 1,200 kcal could be a surplus.
  const floor = Math.min(MIN_CALORIES[sex], maintenance);
  const raisedToMinimum = wanted < MIN_CALORIES[sex];
  const heldAtMaintenance = raisedToMinimum && maintenance < MIN_CALORIES[sex];
  const calories = roundTo(Math.max(wanted, floor), 10);

  const protein = Math.round(Math.min(rules.proteinPerKg * weightKg, (MAX_PROTEIN_SHARE * calories) / kcal.protein));
  const fatFloor = Math.min(MIN_FAT_PER_KG * weightKg, (MAX_FAT_FLOOR_SHARE * calories) / kcal.fat);
  const fat = Math.round(Math.max((rules.fatShare * calories) / kcal.fat, fatFloor));
  const carbs = Math.max(0, Math.round((calories - protein * kcal.protein - fat * kcal.fat) / kcal.carbs));

  return {
    bmr: Math.round(bmr),
    maintenance: roundTo(maintenance, 10),
    calories,
    adjustment: rules.adjustment,
    raisedToMinimum,
    heldAtMaintenance,
    protein,
    fat,
    carbs,
  };
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
