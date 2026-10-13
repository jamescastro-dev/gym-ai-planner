import { OutputError, extractJson, generateJson, isRecord, type GenerateOptions } from "./ai.js";

// ── Request ─────────────────────────────────────────────────────────────────

export const DIETS = ["any", "vegetarian", "vegan", "pescatarian"] as const;
export type Diet = (typeof DIETS)[number];
const GOALS = ["bulk", "cut", "recomp", "strength", "endurance"] as const;

export interface MealRequest {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goal: (typeof GOALS)[number];
  diet: Diet;
  meals: number;
  /** Foods to leave out, already split and cleaned. */
  avoid: string[];
}

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Validates the request body. Returns the cleaned request, or an error message for the user. */
export function parseMealRequest(body: unknown): MealRequest | string {
  if (!isRecord(body)) return "Send the targets as JSON.";
  const { calories, protein, carbs, fat, goal, diet, meals, avoid } = body;
  if (!isInt(calories, 1000, 6000)) return "Calories must be a whole number between 1,000 and 6,000.";
  if (!isInt(protein, 30, 400) || !isInt(carbs, 0, 900) || !isInt(fat, 20, 300)) return "Macros are out of range.";
  // The targets come from the calculator, so they should add up; anything else is not a real request.
  const fromMacros = protein * 4 + carbs * 4 + fat * 9;
  if (Math.abs(fromMacros - calories) > calories * 0.1) return "Macros don't add up to the calorie target.";
  if (typeof goal !== "string" || !(GOALS as readonly string[]).includes(goal)) return "Unknown goal.";
  if (typeof diet !== "string" || !(DIETS as readonly string[]).includes(diet)) return "Unknown diet.";
  if (!isInt(meals, 3, 5)) return "Meals per day must be 3, 4 or 5.";
  if (avoid !== undefined && typeof avoid !== "string") return "Foods to avoid must be text.";
  if (typeof avoid === "string" && avoid.length > 120) return "Keep foods to avoid under 120 characters.";
  return {
    calories,
    protein,
    carbs,
    fat,
    goal: goal as MealRequest["goal"],
    diet: diet as Diet,
    meals,
    // Free text goes into the prompt: letters, spaces and a few separators only, max 8 items.
    avoid: (typeof avoid === "string" ? avoid : "")
      .split(/[,;\n]/)
      .map((a) => a.replace(/[^\p{L}\p{N} '-]/gu, "").replace(/\s+/g, " ").trim().toLowerCase())
      .filter((a) => a.length >= 2)
      .slice(0, 8),
  };
}

// ── Result ──────────────────────────────────────────────────────────────────

export interface MealItem {
  food: string;
  amount: string;
}

export interface Meal {
  name: string;
  title: string;
  items: MealItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlan {
  meals: Meal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  tips: string[];
}

/** The day's calories may miss the target by this much before the answer is rejected (models are poor at sums). */
export const CALORIE_TOLERANCE = 0.2;

// Whole words, so "eggplant" is not an egg and "fishing" never appears in food anyway.
const MEAT = ["chicken", "beef", "pork", "turkey", "ham", "bacon", "lamb", "steak", "sausage", "veal", "duck", "mince", "jerky", "prosciutto", "salami", "pepperoni"];
const SEAFOOD = ["fish", "salmon", "tuna", "cod", "tilapia", "shrimp", "prawn", "prawns", "sardines", "mackerel", "anchovies", "crab", "lobster", "trout", "seafood"];
const ANIMAL_PRODUCTS = ["egg", "eggs", "whey", "honey", "gelatin", "casein"];

const FORBIDDEN: Record<Diet, string[]> = {
  any: [],
  pescatarian: MEAT,
  vegetarian: [...MEAT, ...SEAFOOD],
  vegan: [...MEAT, ...SEAFOOD, ...ANIMAL_PRODUCTS],
};

const wordIn = (word: string, text: string) =>
  new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu").test(text);

const text = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
const amount = (value: unknown): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Parses the model's reply; rejects (OutputError, so it gets one retry) anything that breaks the request. */
export function parseMealPlan(content: string | null | undefined, req: MealRequest): MealPlan {
  if (!content || !content.trim()) throw new OutputError("empty response");
  const raw = extractJson(content);
  if (!isRecord(raw)) throw new OutputError("response was not a JSON object");

  const meals: Meal[] = [];
  for (const m of Array.isArray(raw.meals) ? raw.meals : []) {
    if (!isRecord(m)) continue;
    const items = (Array.isArray(m.items) ? m.items : [])
      .filter(isRecord)
      .map((i) => ({ food: text(i.food), amount: text(i.amount) }))
      .filter((i) => i.food !== "");
    const title = text(m.title);
    if (!title || items.length === 0) continue;
    meals.push({
      name: text(m.name) || `Meal ${meals.length + 1}`,
      title,
      items,
      calories: amount(m.calories),
      protein: amount(m.protein),
      carbs: amount(m.carbs),
      fat: amount(m.fat),
    });
  }
  if (meals.length !== req.meals) throw new OutputError(`expected ${req.meals} meals, got ${meals.length}`);

  const totals = {
    calories: meals.reduce((s, m) => s + m.calories, 0),
    protein: meals.reduce((s, m) => s + m.protein, 0),
    carbs: meals.reduce((s, m) => s + m.carbs, 0),
    fat: meals.reduce((s, m) => s + m.fat, 0),
  };
  if (Math.abs(totals.calories - req.calories) > req.calories * CALORIE_TOLERANCE) {
    throw new OutputError(`day totals ${totals.calories} kcal, target ${req.calories}`);
  }

  const everything = meals.flatMap((m) => [m.title, ...m.items.map((i) => i.food)]).join(" | ");
  const brokeDiet = FORBIDDEN[req.diet].find((w) => wordIn(w, everything));
  if (brokeDiet) throw new OutputError(`"${brokeDiet}" in a ${req.diet} plan`);
  const brokeAvoid = req.avoid.find((w) => wordIn(w, everything));
  if (brokeAvoid) throw new OutputError(`contains "${brokeAvoid}", which the user asked to avoid`);

  const tips = (Array.isArray(raw.tips) ? raw.tips : []).map(text).filter(Boolean).slice(0, 3);
  return { meals, totals, tips };
}

// ── Prompt ──────────────────────────────────────────────────────────────────

const MEAL_NAMES: Record<number, string[]> = {
  3: ["Breakfast", "Lunch", "Dinner"],
  4: ["Breakfast", "Lunch", "Snack", "Dinner"],
  5: ["Breakfast", "Snack", "Lunch", "Snack", "Dinner"],
};

const DIET_TEXT: Record<Diet, string> = {
  any: "no restrictions",
  vegetarian: "vegetarian (no meat, poultry or seafood)",
  vegan: "vegan (no animal products at all: no meat, seafood, eggs, dairy, honey or whey)",
  pescatarian: "pescatarian (seafood allowed, no meat or poultry)",
};

const GOAL_TEXT: Record<MealRequest["goal"], string> = {
  bulk: "building muscle",
  cut: "losing fat while keeping muscle",
  recomp: "losing fat and building muscle at the same time",
  strength: "getting stronger",
  endurance: "endurance training",
};

export function buildMealPrompt(req: MealRequest): string {
  const names = MEAL_NAMES[req.meals];
  return `Create one day of meals for someone ${GOAL_TEXT[req.goal]}.

Daily targets: ${req.calories} kcal, ${req.protein} g protein, ${req.carbs} g carbs, ${req.fat} g fat.
Diet: ${DIET_TEXT[req.diet]}.
${req.avoid.length ? `Never include: ${req.avoid.join(", ")}.\n` : ""}
Return JSON with this exact structure:
{
  "meals": [
    {
      "name": "${names[0]}",
      "title": "short appetizing name of the meal",
      "items": [{ "food": "food name", "amount": "amount in grams, ml or pieces" }],
      "calories": 500,
      "protein": 35,
      "carbs": 55,
      "fat": 15
    }
  ],
  "tips": ["one short practical tip", "another short tip"]
}

Requirements:
- Exactly ${req.meals} meals, named in this order: ${names.join(", ")}
- The meals' calories and macros must add up to the daily targets (within 5%)
- 2-5 items per meal, everyday supermarket foods, simple to prepare
- Spread protein across the meals
- Amounts in grams or ml where possible
- At most 2 tips

Return ONLY the JSON object (no markdown, no extra text).`;
}

export function generateMealPlan(req: MealRequest, options: GenerateOptions = {}): Promise<MealPlan> {
  return generateJson(
    {
      what: "meal plan",
      role: "You are a sports nutritionist who writes simple, realistic meal plans.",
      prompt: buildMealPrompt(req),
      parse: (content) => parseMealPlan(content, req),
    },
    options,
  );
}
