import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_FACTORS,
  GOAL_RULES,
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
} from "./nutrition.ts";

const base: NutritionInput = { sex: "female", age: 30, heightCm: 165, weightKg: 60, activity: "moderate", goal: "recomp" };

test("matches a hand-worked Mifflin-St Jeor example (female, recomp)", () => {
  // BMR = 10*60 + 6.25*165 - 5*30 - 161 = 1320.25; maintenance = 1320.25 * 1.55 = 2046.4
  const t = calculateTargets(base);
  assert.equal(t.bmr, 1320);
  assert.equal(t.maintenance, 2050);
  assert.equal(t.calories, 2050);
  assert.equal(t.protein, 120); // 2.0 g/kg
  assert.equal(t.fat, 57); // 25% of 2050 kcal / 9
  assert.equal(t.carbs, 264); // (2050 - 480 - 513) / 4
  assert.equal(t.raisedToMinimum, false);
});

test("matches a hand-worked example (male, bulk adds 10%)", () => {
  // BMR = 800 + 1125 - 150 + 5 = 1780; maintenance = 2759; bulk = 3034.9 -> 3030
  const t = calculateTargets({ sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "moderate", goal: "bulk" });
  assert.equal(t.bmr, 1780);
  assert.equal(t.maintenance, 2760);
  assert.equal(t.calories, 3030);
  assert.equal(t.adjustment, 0.1);
  assert.equal(t.protein, 144); // 1.8 g/kg
  assert.equal(t.fat, 84);
});

test("a cut is raised to the minimum daily calories when maintenance is above it", () => {
  // maintenance = 926.5 * 1.375 = 1274; a 20% cut (1019) would be under 1,200
  const t = calculateTargets({ sex: "female", age: 60, heightCm: 150, weightKg: 45, activity: "light", goal: "cut" });
  assert.equal(t.calories, MIN_CALORIES.female);
  assert.equal(t.raisedToMinimum, true);
  assert.equal(t.heldAtMaintenance, false);
});

test("the minimum never turns a cut into a surplus: below-minimum maintenance holds at maintenance", () => {
  // maintenance = 926.5 * 1.2 = 1112, already under 1,200
  const t = calculateTargets({ sex: "female", age: 60, heightCm: 150, weightKg: 45, activity: "sedentary", goal: "cut" });
  assert.equal(t.calories, 1110);
  assert.ok(t.calories <= t.maintenance);
  assert.equal(t.heldAtMaintenance, true);
});

test("a heavy person on a cut still gets room for carbs (protein and fat are capped)", () => {
  const t = calculateTargets({ sex: "male", age: 40, heightCm: 175, weightKg: 250, activity: "sedentary", goal: "cut" });
  assert.ok(t.protein * kcal.protein <= 0.4 * t.calories + kcal.protein, `protein ${t.protein} g is over 40% of ${t.calories} kcal`);
  assert.ok(t.carbs > 0);
});

test("invariants hold across the whole input range", () => {
  let cases = 0;
  for (const sex of ["female", "male"] as Sex[])
    for (const age of [18, 35, 55, 80])
      for (const heightCm of [120, 160, 190, 230])
        for (const weightKg of [35, 70, 120, 250])
          for (const activity of Object.keys(ACTIVITY_FACTORS) as Activity[])
            for (const goal of Object.keys(GOAL_RULES) as Goal[]) {
              const t = calculateTargets({ sex, age, heightCm, weightKg, activity, goal });
              const label = JSON.stringify({ sex, age, heightCm, weightKg, activity, goal });
              // rounded values, so allow one 10 kcal step either way
              assert.ok(t.calories >= Math.min(MIN_CALORIES[sex], t.maintenance) - 10, `below minimum: ${label}`);
              if (goal === "cut") assert.ok(t.calories <= t.maintenance + 10, `cut above maintenance: ${label}`);
              assert.ok(t.protein > 0 && t.fat > 0 && t.carbs >= 0, `negative macro: ${label}`);
              const fromMacros = t.protein * kcal.protein + t.carbs * kcal.carbs + t.fat * kcal.fat;
              assert.ok(Math.abs(fromMacros - t.calories) <= 9, `macros add up to ${fromMacros}, target ${t.calories}: ${label}`);
              cases++;
            }
  assert.equal(cases, 2 * 4 * 4 * 4 * 5 * 5);
});

test("goals move calories in the expected direction", () => {
  const at = (goal: Goal) => calculateTargets({ ...base, goal }).calories;
  assert.ok(at("cut") < at("recomp"));
  assert.ok(at("recomp") < at("strength"));
  assert.ok(at("strength") < at("bulk"));
});

test("validate rejects out-of-range and missing values", () => {
  assert.equal(validate(base), null);
  assert.match(validate({ ...base, age: 17 }) ?? "", /Age must be between 18 and 80/);
  assert.match(validate({ ...base, weightKg: Number.NaN }) ?? "", /Weight is required/);
  assert.match(validate({ ...base, heightCm: 300 }) ?? "", /Height must be between/);
  assert.match(validate({ ...base, goal: "keto" as Goal }) ?? "", /Choose a goal/);
  assert.throws(() => calculateTargets({ ...base, age: 12 }), /Age must be between/);
});

test("imperial conversions", () => {
  assert.equal(Math.round(feetInchesToCm(5, 10) * 10) / 10, 177.8);
  assert.equal(Math.round(lbToKg(176) * 100) / 100, 79.83);
});
