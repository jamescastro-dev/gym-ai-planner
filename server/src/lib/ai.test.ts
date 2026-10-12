import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  AiUnavailableError,
  MAX_ATTEMPTS,
  generateTrainingPlan,
  getModels,
  parsePlan,
  resetBudget,
} from "./ai.js";

const profile = {
  goal: "bulk",
  experience: "intermediate",
  days_per_week: 4,
  session_length: 60,
  equipment: "full_gym",
  injuries: null,
  preferred_split: "upper_lower",
};

const day = (name: string, exercises: number) => ({
  day: name,
  focus: "Focus",
  exercises: Array.from({ length: exercises }, (_, i) => ({
    name: `Exercise ${i + 1}`,
    sets: 3,
    reps: "8-10",
    rest: "60 sec",
    rpe: 8,
  })),
});

const reply = (days: ReturnType<typeof day>[]) =>
  JSON.stringify({
    overview: { goal: "Goal", frequency: "4 days per week", split: "Upper/Lower", notes: "Notes" },
    weeklySchedule: days,
    progression: "Progress.",
  });

const GOOD = reply([day("Mon", 5), day("Tue", 5), day("Thu", 5), day("Fri", 5)]);
const MODELS = ["a/one:free", "b/two:free", "c/three:free"];

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

/** A scripted stand-in for the OpenRouter call: replies are consumed in order. */
function scripted(replies: Array<string | null | Error>) {
  const calls: string[] = [];
  const complete = async (model: string) => {
    calls.push(model);
    const next = replies[calls.length - 1];
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, complete };
}

beforeEach(() => {
  resetBudget();
  delete process.env.AI_DAILY_BUDGET;
});

test("first model works: one request", async () => {
  const { calls, complete } = scripted([GOOD]);
  const plan = await generateTrainingPlan(profile, { complete, models: MODELS });
  assert.deepEqual(calls, ["a/one:free"]);
  assert.equal(plan.weeklySchedule.length, 4);
});

test("404 then 429 then success: moves down the list, 3 requests", async () => {
  const { calls, complete } = scripted([httpError(404), httpError(429), GOOD]);
  const plan = await generateTrainingPlan(profile, { complete, models: MODELS });
  assert.deepEqual(calls, MODELS);
  assert.equal(plan.weeklySchedule.length, 4);
});

test("empty output falls through to the next model", async () => {
  const { calls, complete } = scripted([null, GOOD]);
  await generateTrainingPlan(profile, { complete, models: MODELS });
  assert.deepEqual(calls, ["a/one:free", "b/two:free"]);
});

test("invalid JSON falls through to the next model", async () => {
  const { calls, complete } = scripted(["Sorry, I can't do that.", GOOD]);
  await generateTrainingPlan(profile, { complete, models: MODELS });
  assert.equal(calls.length, 2);
});

test("never makes more than MAX_ATTEMPTS requests, even with more models", async () => {
  const { calls, complete } = scripted([httpError(429), httpError(429), httpError(429), httpError(429), GOOD]);
  const many = [...MODELS, "d/four:free", "e/five:free"];
  await assert.rejects(generateTrainingPlan(profile, { complete, models: many }), AiUnavailableError);
  assert.equal(MAX_ATTEMPTS, 3);
  assert.equal(calls.length, 3);
});

test("a single model that returns 429 is not hit again", async () => {
  const { calls, complete } = scripted([httpError(429), GOOD, GOOD]);
  await assert.rejects(generateTrainingPlan(profile, { complete, models: ["only/one:free"] }), AiUnavailableError);
  assert.equal(calls.length, 1);
});

test("a single model with bad output is retried once, then stops", async () => {
  const { calls, complete } = scripted([null, null, GOOD]);
  await assert.rejects(generateTrainingPlan(profile, { complete, models: ["only/one:free"] }), AiUnavailableError);
  assert.equal(calls.length, 2);
});

test("bad output gets exactly one retry across models", async () => {
  const { calls, complete } = scripted(["nope", "still nope", GOOD]);
  await assert.rejects(generateTrainingPlan(profile, { complete, models: MODELS }), AiUnavailableError);
  assert.equal(calls.length, 2);
});

test("a rejected API key stops immediately", async () => {
  const { calls, complete } = scripted([httpError(401), GOOD]);
  await assert.rejects(generateTrainingPlan(profile, { complete, models: MODELS }), AiUnavailableError);
  assert.equal(calls.length, 1);
});

test("a timeout moves on to the next model", async () => {
  const timeout = Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" });
  const { calls, complete } = scripted([timeout, GOOD]);
  await generateTrainingPlan(profile, { complete, models: MODELS });
  assert.equal(calls.length, 2);
});

test("all models failing reports 'busy' and lists every failure", async () => {
  const { complete } = scripted([httpError(404), httpError(429), httpError(500)]);
  await assert.rejects(generateTrainingPlan(profile, { complete, models: MODELS }), (err: unknown) => {
    assert.ok(err instanceof AiUnavailableError);
    assert.equal(err.reason, "busy");
    assert.equal(err.failures.length, 3);
    return true;
  });
});

test("daily budget exhausted: no request is made and the reason is 'quota'", async () => {
  process.env.AI_DAILY_BUDGET = "1";
  const first = scripted([GOOD]);
  await generateTrainingPlan(profile, { complete: first.complete, models: MODELS });
  const second = scripted([GOOD]);
  await assert.rejects(
    generateTrainingPlan(profile, { complete: second.complete, models: MODELS }),
    (err: unknown) => err instanceof AiUnavailableError && err.reason === "quota",
  );
  assert.equal(second.calls.length, 0);
});

// ── validation ──

test("an empty trailing day is dropped (seen from nemotron-3-super)", () => {
  const plan = parsePlan(reply([day("Mon", 5), day("Tue", 5), day("Thu", 5), day("Fri", 5), day("Sat", 0)]), profile);
  assert.equal(plan.weeklySchedule.length, 4);
  assert.deepEqual(plan.weeklySchedule.map((d) => d.day), ["Mon", "Tue", "Thu", "Fri"]);
});

test("too few days is rejected", () => {
  assert.throws(() => parsePlan(reply([day("Mon", 5), day("Tue", 5), day("Thu", 5)]), profile), /expected 4 training days, got 3/);
});

test("too many non-empty days is rejected", () => {
  const five = reply([day("Mon", 5), day("Tue", 5), day("Wed", 5), day("Thu", 5), day("Fri", 5)]);
  assert.throws(() => parsePlan(five, profile), /expected 4 training days, got 5/);
});

test("markdown fences and surrounding prose are tolerated", () => {
  assert.equal(parsePlan("```json\n" + GOOD + "\n```", profile).weeklySchedule.length, 4);
  assert.equal(parsePlan("Here is your plan:\n" + GOOD + "\nEnjoy!", profile).weeklySchedule.length, 4);
});

test("exercises without a name are dropped, missing fields get defaults", () => {
  const messy = JSON.stringify({
    weeklySchedule: [
      { day: "Mon", exercises: [{ name: "Squat" }, { sets: 3 }, "junk"] },
    ],
  });
  const plan = parsePlan(messy, { ...profile, days_per_week: 1 });
  assert.equal(plan.weeklySchedule[0].exercises.length, 1);
  assert.deepEqual(plan.weeklySchedule[0].exercises[0], {
    name: "Squat",
    sets: 3,
    reps: "8-12",
    rest: "60-90 sec",
    rpe: 7,
    notes: undefined,
    alternatives: undefined,
  });
  assert.equal(plan.weeklySchedule[0].focus, "Full Body");
});

test("non-object and empty responses are rejected", () => {
  assert.throws(() => parsePlan("[1,2,3]", profile), /not a JSON object/);
  assert.throws(() => parsePlan("", profile), /empty response/);
  assert.throws(() => parsePlan(undefined, profile), /empty response/);
});

// ── model list ──

test("OPENROUTER_MODELS is parsed in order and trimmed", () => {
  process.env.OPENROUTER_MODELS = " x/one:free , y/two:free ,, ";
  assert.deepEqual(getModels(), ["x/one:free", "y/two:free"]);
  delete process.env.OPENROUTER_MODELS;
});

test("paid (non-:free) models are ignored so credits can never be spent", () => {
  process.env.OPENROUTER_MODELS = "x/one:free,paid/model";
  assert.deepEqual(getModels(), ["x/one:free"]);
  process.env.OPENROUTER_MODELS = "paid/only";
  assert.ok(getModels().every((m) => m.endsWith(":free")), "falls back to the free defaults");
  delete process.env.OPENROUTER_MODELS;
});

test("with OPENROUTER_MODELS unset the defaults are all :free", () => {
  delete process.env.OPENROUTER_MODELS;
  const models = getModels();
  assert.ok(models.length >= 1);
  assert.ok(models.every((m) => m.endsWith(":free")));
});
