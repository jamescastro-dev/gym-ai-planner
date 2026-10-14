import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { resetBudget, type CompleteFn } from "./ai.js";
import { DailyCounter } from "./limits.js";
import { generateMealPlan, parseMealPlan, parseMealRequest, withUnit, type MealRequest } from "./meals.js";

beforeEach(() => resetBudget());

// 2,050 kcal = 120*4 + 264*4 + 57*9 (the calculator's own example)
const body = { calories: 2050, protein: 120, carbs: 264, fat: 57, goal: "recomp", diet: "any", meals: 3, avoid: "" };
const req = (over: Partial<MealRequest> = {}): MealRequest => ({ ...(parseMealRequest(body) as MealRequest), ...over });

const meal = (name: string, title: string, foods: string[], calories: number) => ({
  name,
  title,
  items: foods.map((food) => ({ food, amount: "100 g" })),
  calories,
  protein: 40,
  carbs: 88,
  fat: 19,
});
const reply = (meals: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ meals, tips: ["Drink water."], ...extra });
const goodDay = () =>
  reply([
    meal("Breakfast", "Oat bowl", ["Rolled oats", "Banana", "Greek yogurt"], 650),
    meal("Lunch", "Rice and beans", ["Brown rice", "Black beans", "Avocado"], 700),
    meal("Dinner", "Stir-fry", ["Tofu", "Noodles", "Eggplant"], 690),
  ]);

// ── request validation ──

test("a calculator result is a valid request", () => {
  const r = parseMealRequest(body);
  assert.ok(typeof r !== "string", String(r));
  assert.equal(r.meals, 3);
  assert.deepEqual(r.avoid, []);
});

test("rejects out-of-range or inconsistent targets", () => {
  assert.match(String(parseMealRequest({ ...body, calories: 500 })), /between 1,000 and 6,000/);
  assert.match(String(parseMealRequest({ ...body, calories: 2050.5 })), /whole number/);
  assert.match(String(parseMealRequest({ ...body, protein: 900 })), /out of range/);
  assert.match(String(parseMealRequest({ ...body, calories: 3000 })), /don't add up/);
  assert.match(String(parseMealRequest({ ...body, diet: "carnivore" })), /Unknown diet/);
  assert.match(String(parseMealRequest({ ...body, goal: "keto" })), /Unknown goal/);
  assert.match(String(parseMealRequest({ ...body, meals: 7 })), /3, 4 or 5/);
  assert.match(String(parseMealRequest({ ...body, avoid: "x".repeat(121) })), /under 120/);
  assert.match(String(parseMealRequest("nope")), /JSON/);
});

test("foods to avoid are split, cleaned and capped before they reach the prompt", () => {
  const r = parseMealRequest({ ...body, avoid: "Peanuts, shellfish;  {\"role\":\"system\"} , a, mushrooms" }) as MealRequest;
  assert.deepEqual(r.avoid, ["peanuts", "shellfish", "rolesystem", "mushrooms"]);
  const many = parseMealRequest({ ...body, avoid: "a1,b2,c3,d4,e5,f6,g7,h8,i9,j10" }) as MealRequest;
  assert.equal(many.avoid.length, 8);
});

// ── output validation ──

test("accepts a good day and computes the totals itself", () => {
  const plan = parseMealPlan(goodDay(), req());
  assert.equal(plan.meals.length, 3);
  assert.equal(plan.totals.calories, 2040);
  assert.equal(plan.totals.protein, 120);
  assert.deepEqual(plan.tips, ["Drink water."]);
});

test("accepts JSON wrapped in a code fence or prose", () => {
  assert.equal(parseMealPlan("```json\n" + goodDay() + "\n```", req()).meals.length, 3);
  assert.equal(parseMealPlan("Here you go:\n" + goodDay() + "\nEnjoy!", req()).meals.length, 3);
});

test("rejects the wrong number of meals (meals without a title or items don't count)", () => {
  const two = reply([meal("Breakfast", "Oats", ["Oats"], 1000), meal("Lunch", "Rice", ["Rice"], 1050), meal("Dinner", "", ["Pasta"], 0)]);
  assert.throws(() => parseMealPlan(two, req()), /expected 3 meals, got 2/);
  assert.throws(() => parseMealPlan(goodDay(), req({ meals: 4 })), /expected 4 meals, got 3/);
});

test("rejects a day that misses the calorie target by more than 20%", () => {
  const low = reply([meal("B", "Oats", ["Oats"], 400), meal("L", "Rice", ["Rice"], 400), meal("D", "Pasta", ["Pasta"], 400)]);
  assert.throws(() => parseMealPlan(low, req()), /day totals 1200 kcal, target 2050/);
});

test("enforces the diet with whole-word matching", () => {
  const withEgg = reply([meal("B", "Scramble", ["Eggs", "Toast"], 680), meal("L", "Rice bowl", ["Rice"], 680), meal("D", "Pasta", ["Pasta"], 680)]);
  assert.throws(() => parseMealPlan(withEgg, req({ diet: "vegan" })), /"eggs" in a vegan plan/);
  assert.equal(parseMealPlan(withEgg, req({ diet: "vegetarian" })).meals.length, 3);
  // "Eggplant" is not an egg, "Greek yogurt" is fine for a vegetarian
  assert.equal(parseMealPlan(goodDay(), req({ diet: "vegetarian" })).meals.length, 3);
  const salmon = reply([meal("B", "Oats", ["Oats"], 680), meal("L", "Salmon bowl", ["Salmon fillet", "Rice"], 680), meal("D", "Pasta", ["Pasta"], 680)]);
  assert.throws(() => parseMealPlan(salmon, req({ diet: "vegetarian" })), /"salmon" in a vegetarian plan/);
  assert.equal(parseMealPlan(salmon, req({ diet: "pescatarian" })).meals.length, 3);
  const chicken = reply([meal("B", "Oats", ["Oats"], 680), meal("L", "Chicken wrap", ["Wrap"], 680), meal("D", "Pasta", ["Pasta"], 680)]);
  assert.throws(() => parseMealPlan(chicken, req({ diet: "pescatarian" })), /"chicken" in a pescatarian plan/);
});

test("rejects foods the user asked to avoid", () => {
  assert.throws(() => parseMealPlan(goodDay(), req({ avoid: ["black beans"] })), /asked to avoid/);
  assert.throws(() => parseMealPlan(goodDay(), req({ avoid: ["tofu"] })), /"tofu"/);
  assert.equal(parseMealPlan(goodDay(), req({ avoid: ["beef"] })).meals.length, 3);
});

// ── through the shared fallback loop ──

test("bad output gets one retry through the shared fallback loop", async () => {
  const replies = [reply([meal("B", "Omelette", ["Eggs"], 2040)]), goodDay()];
  const calls: string[] = [];
  const complete: CompleteFn = async (model, prompt) => {
    calls.push(model);
    assert.match(prompt, /Exactly 3 meals, named in this order: Breakfast, Lunch, Dinner/);
    assert.match(prompt, /2050 kcal, 120 g protein, 264 g carbs, 57 g fat/);
    return replies.shift();
  };
  const plan = await generateMealPlan(req(), { complete, models: ["a:free", "b:free"] });
  assert.equal(plan.meals.length, 3);
  assert.deepEqual(calls, ["a:free", "b:free"]);
});

test("the prompt names the diet and the foods to avoid", async () => {
  let seen = "";
  const complete: CompleteFn = async (_m, prompt) => ((seen = prompt), goodDay());
  await generateMealPlan(req({ diet: "vegan", avoid: ["peanuts", "soy"] }), { complete, models: ["a:free"] });
  assert.match(seen, /vegan \(no animal products/);
  assert.match(seen, /Never include: peanuts, soy\./);
});

// ── per-user counter ──

test("DailyCounter counts a rolling 24 hours", () => {
  let now = 0;
  const c = new DailyCounter(() => now);
  c.add("u");
  now = 10 * 60 * 60 * 1000;
  c.add("u");
  assert.equal(c.count("u"), 2);
  now = 25 * 60 * 60 * 1000; // the first one is now older than 24h
  assert.equal(c.count("u"), 1);
  assert.equal(c.count("someone-else"), 0);
});

test("bare-number amounts get grams; amounts with a unit are left alone", () => {
  assert.equal(withUnit(80), "80 g");
  assert.equal(withUnit("250"), "250 g");
  assert.equal(withUnit("12.5"), "12.5 g");
  assert.equal(withUnit("250 ml"), "250 ml");
  assert.equal(withUnit("1 medium"), "1 medium");
  assert.equal(withUnit(null), "");
  const bare = JSON.stringify({ meals: [1, 2, 3].map((n) => ({ name: "M" + n, title: "Meal " + n, items: [{ food: "Oats", amount: 80 }], calories: 680, protein: 40, carbs: 88, fat: 19 })) });
  assert.equal(parseMealPlan(bare, req()).meals[0].items[0].amount, "80 g");
});
