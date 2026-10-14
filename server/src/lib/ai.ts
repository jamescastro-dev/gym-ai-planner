import OpenAI from "openai";
import dotenv from "dotenv";
import type {
  DaySchedule,
  Exercise,
  TrainingPlan,
  UserProfile,
} from "../types/index.js";

dotenv.config();

type GeneratedPlan = Omit<TrainingPlan, "id" | "userId" | "version" | "createdAt">;

/**
 * Used only when OPENROUTER_MODELS is unset. Three different providers, so one busy upstream can't take out
 * every attempt. Nemotron and Dots were re-tested on 2026-10-14 (valid plan and meal plan, reasoning off);
 * Gemma passed earlier but was rate-limited upstream that day. Apodex was dropped: OpenRouter removed it.
 */
const DEFAULT_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "dots-studio/dots-3-note-preview:free",
  "google/gemma-4-26b-a4b-it:free",
];

/** Failed requests may count toward OpenRouter's free daily limit, so this is a hard cap. */
export const MAX_ATTEMPTS = 3;
/** Kept under ~100s so the reverse proxy in front of the host doesn't cut the request off. */
const GENERATION_DEADLINE_MS = 90_000;
const ATTEMPT_TIMEOUT_MS = 60_000;
const MIN_ATTEMPT_MS = 10_000;
/** Safety margin below OpenRouter's 50 requests/day free limit. */
const dailyRequestBudget = () => Number(process.env.AI_DAILY_BUDGET) || 45;

/** Every attempt failed (or was not allowed). `reason` decides which message the user sees. */
export class AiUnavailableError extends Error {
  constructor(
    public readonly reason: "busy" | "quota",
    public readonly failures: string[],
  ) {
    super(`AI unavailable (${reason}): ${failures.join("; ")}`);
    this.name = "AiUnavailableError";
  }
}

/** The model answered, but not with a usable plan. */
export class OutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputError";
  }
}

export type CompleteFn = (
  model: string,
  prompt: string,
  timeoutMs: number,
) => Promise<string | null | undefined>;

export interface GenerateOptions {
  /** Override the model call (used by tests). */
  complete?: CompleteFn;
  /** Override the model list (used by tests). */
  models?: string[];
  /** Override the time limits in ms (used by tests). */
  timing?: { attemptMs?: number; deadlineMs?: number; minAttemptMs?: number };
}

/** The attempt ran past its time limit. */
class AttemptTimeoutError extends Error {
  constructor(ms: number) {
    super(`no answer within ${Math.round(ms / 1000)}s`);
    this.name = "AttemptTimeoutError";
  }
}

/** Rejects after `ms` whatever the promise does (the caller has already given up on it). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AttemptTimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Ordered, free-only model list from OPENROUTER_MODELS (comma-separated). */
export function getModels(): string[] {
  const raw = process.env.OPENROUTER_MODELS;
  const configured = raw
    ? raw.split(",").map((m) => m.trim()).filter(Boolean)
    : DEFAULT_MODELS;
  const free = configured.filter((m) => m.endsWith(":free"));
  if (free.length < configured.length) {
    console.warn(
      "[AI] Ignoring non-free models in OPENROUTER_MODELS:",
      configured.filter((m) => !m.endsWith(":free")),
    );
  }
  return free.length > 0 ? free : DEFAULT_MODELS;
}

// ── Daily request budget (in-memory; resets at UTC midnight or on restart) ──
let budgetDay = "";
let budgetUsed = 0;

function takeBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    budgetUsed = 0;
  }
  if (budgetUsed >= dailyRequestBudget()) return false;
  budgetUsed++;
  return true;
}

/** Test hook. */
export function resetBudget() {
  budgetDay = "";
  budgetUsed = 0;
}

const TRAINER_ROLE = "You are an expert fitness trainer and program designer.";

/**
 * OpenRouter's reasoning switch (not in the OpenAI SDK's types). The free models "think" before answering by default,
 * which made a meal plan take 250s and plans 30-60s; with it off they answered in 5-8s (meals) and 22-47s (plans),
 * and the output still passed validation.
 */
const NO_REASONING = { reasoning: { enabled: false } } as Record<string, unknown>;

function createOpenRouterComplete(role: string): CompleteFn {
  const apiKey = process.env.OPEN_ROUTER_KEY;
  if (!apiKey) throw new Error("OPEN_ROUTER_KEY is not set");

  // maxRetries: 0 — the SDK would otherwise silently retry 429/5xx twice, burning the daily quota.
  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    maxRetries: 0,
    defaultHeaders: {
      "HTTP-Referer": process.env.BASE_URL || "http://localhost:3001",
      "X-Title": "GymAI Plan Generator",
    },
  });

  return async (model, prompt, timeoutMs) => {
    // The SDK's `timeout` only covers the wait for response headers. OpenRouter sends those at once and then
    // trickles keep-alive whitespace while the model works, so without this abort a slow model ran for minutes.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const completion = await client.chat.completions.create(
        {
          ...NO_REASONING,
          model,
          messages: [
            {
              role: "system",
              content: `${role} You must respond with valid JSON only. Do not include any markdown, reasoning, or additional text.`,
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        },
        { timeout: timeoutMs, maxRetries: 0, signal: abort.signal },
      );
      return completion.choices[0]?.message?.content;
    } finally {
      clearTimeout(timer);
    }
  };
}

interface Failure {
  reason: string;
  /** Don't try this model again in this generation (404 / 429). */
  skipModel?: boolean;
  /** No other model can fix this (bad API key). */
  fatal?: boolean;
  /** The model answered with unusable output. */
  badOutput?: boolean;
}

function classify(err: unknown): Failure {
  const e = err as { status?: number; name?: string; message?: string };
  if (e instanceof OutputError) return { reason: `bad output: ${e.message}`, badOutput: true };
  if (e?.status === 401 || e?.status === 403) return { reason: `HTTP ${e.status} (check OPEN_ROUTER_KEY)`, fatal: true };
  if (e?.status === 404 || e?.status === 429) return { reason: `HTTP ${e.status}`, skipModel: true };
  if (e?.status) return { reason: `HTTP ${e.status}` };
  if (e instanceof AttemptTimeoutError) return { reason: `timeout (${e.message})` };
  if (e?.name === "APIConnectionTimeoutError" || e?.name === "AbortError" || e?.name === "APIUserAbortError") return { reason: "timeout" };
  return { reason: e?.message ?? "unknown error" };
}

export async function generateTrainingPlan(
  profile: Partial<UserProfile>,
  options: GenerateOptions = {},
): Promise<GeneratedPlan> {
  const normalizedProfile = normalizeProfile(profile);
  return generateJson(
    {
      what: "plan",
      role: TRAINER_ROLE,
      prompt: buildPrompt(normalizedProfile),
      parse: (content) => parsePlan(content, normalizedProfile),
    },
    options,
  );
}

export interface JsonTask<T> {
  /** For log lines, e.g. "plan". */
  what: string;
  /** Who the model should be (system message). */
  role: string;
  prompt: string;
  /** Must throw OutputError for unusable output, so it gets one retry. */
  parse: (content: string | null | undefined) => T;
}

/**
 * Asks the free models in order for a JSON answer, with the same rules for every caller: at most MAX_ATTEMPTS
 * requests, skip a model on 404/429, stop on a bad key, one retry for unusable output, and the shared daily budget.
 */
export async function generateJson<T>(task: JsonTask<T>, options: GenerateOptions = {}): Promise<T> {
  const models = options.models ?? getModels();
  const complete = options.complete ?? createOpenRouterComplete(task.role);
  const attemptLimit = options.timing?.attemptMs ?? ATTEMPT_TIMEOUT_MS;
  const deadline = options.timing?.deadlineMs ?? GENERATION_DEADLINE_MS;
  const minAttempt = options.timing?.minAttemptMs ?? MIN_ATTEMPT_MS;

  const startedAt = Date.now();
  const failures: string[] = [];
  const tries = new Map<string, number>();
  const skipped = new Set<string>();
  let badOutputs = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - (Date.now() - startedAt);
    if (remaining < minAttempt) {
      failures.push("deadline reached");
      break;
    }

    // Least-tried model first; ties keep the configured order.
    const model = models
      .filter((m) => !skipped.has(m))
      .sort((a, b) => (tries.get(a) ?? 0) - (tries.get(b) ?? 0))[0];
    if (!model) {
      failures.push("no models left to try");
      break;
    }

    if (!takeBudget()) {
      failures.push("daily request budget used up");
      throw new AiUnavailableError("quota", failures);
    }

    tries.set(model, (tries.get(model) ?? 0) + 1);
    try {
      const limit = Math.min(attemptLimit, remaining);
      const content = await withTimeout(complete(model, task.prompt, limit), limit);
      const result = task.parse(content);
      console.log(`[AI] ${task.what} generated by ${model} on attempt ${attempt}/${MAX_ATTEMPTS}`);
      return result;
    } catch (err) {
      const failure = classify(err);
      failures.push(`${model}: ${failure.reason}`);
      console.warn(`[AI] ${task.what} attempt ${attempt}/${MAX_ATTEMPTS} failed — ${model}: ${failure.reason}`);
      if (failure.fatal) break;
      if (failure.skipModel) skipped.add(model);
      // Bad output gets one retry, then we stop.
      if (failure.badOutput && ++badOutputs > 1) break;
    }
  }

  throw new AiUnavailableError("busy", failures);
}

// ── Output parsing & validation ─────────────────────────────────────────────

export function extractJson(content: string): unknown {
  const stripped = content
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Some models wrap the JSON in prose.
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new OutputError("response was not valid JSON");
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const text = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

function toExercise(raw: Record<string, unknown>): Exercise {
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives.filter((a): a is string => typeof a === "string" && a.trim() !== "")
    : undefined;
  return {
    name: text(raw.name, "Exercise"),
    sets: Number(raw.sets) || 3,
    reps: raw.reps != null && String(raw.reps).trim() ? String(raw.reps).trim() : "8-12",
    rest: text(raw.rest, "60-90 sec"),
    rpe: Number(raw.rpe) || 7,
    notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : undefined,
    alternatives: alternatives?.length ? alternatives : undefined,
  };
}

/** Parses the model's reply and enforces the exact number of non-empty training days. */
export function parsePlan(
  content: string | null | undefined,
  profile: Pick<NormalizedProfile, "days_per_week" | "preferred_split" | "goal">,
): GeneratedPlan {
  if (!content || !content.trim()) throw new OutputError("empty response");

  const raw = extractJson(content);
  if (!isRecord(raw)) throw new OutputError("response was not a JSON object");

  const days: DaySchedule[] = [];
  for (const day of Array.isArray(raw.weeklySchedule) ? raw.weeklySchedule : []) {
    if (!isRecord(day)) continue;
    const exercises = (Array.isArray(day.exercises) ? day.exercises : [])
      .filter((e): e is Record<string, unknown> => isRecord(e) && typeof e.name === "string" && e.name.trim() !== "")
      .map(toExercise);
    if (exercises.length === 0) continue; // drop empty days
    days.push({
      day: text(day.day, `Day ${days.length + 1}`),
      focus: text(day.focus, "Full Body"),
      exercises,
    });
  }

  if (days.length !== profile.days_per_week) {
    throw new OutputError(`expected ${profile.days_per_week} training days, got ${days.length}`);
  }

  const overview = isRecord(raw.overview) ? raw.overview : {};
  return {
    overview: {
      goal: text(overview.goal, `Customized ${profile.goal} program`),
      frequency: text(overview.frequency, `${profile.days_per_week} days per week`),
      split: text(overview.split, profile.preferred_split),
      notes: text(overview.notes, "Follow the program consistently for best results."),
    },
    weeklySchedule: days,
    progression: text(
      raw.progression,
      "Increase weight by 2.5-5lbs when you can complete all sets with good form. Track your progress weekly.",
    ),
  };
}

// ── Prompt ──────────────────────────────────────────────────────────────────

function normalizeProfile(profile: Partial<UserProfile>) {
  return {
    goal: profile.goal || "bulk",
    experience: profile.experience || "intermediate",
    days_per_week: profile.days_per_week || 4,
    session_length: profile.session_length || 60,
    equipment: profile.equipment || "full_gym",
    // Free text goes into the prompt: single line, length-capped.
    injuries: profile.injuries?.replace(/\s+/g, " ").trim().slice(0, 300) || null,
    preferred_split: profile.preferred_split || "upper_lower",
  };
}

type NormalizedProfile = ReturnType<typeof normalizeProfile>;

function buildPrompt(profile: NormalizedProfile): string {
  const goalMap: Record<string, string> = {
    bulk: "build muscle and gain size",
    cut: "lose fat and maintain muscle",
    recomp: "simultaneously lose fat and build muscle",
    strength: "build maximum strength",
    endurance: "improve cardiovascular endurance and stamina",
  };

  const experienceMap: Record<string, string> = {
    beginner: "beginner (0-1 years of training experience)",
    intermediate: "intermediate (1-3 years of training experience)",
    advanced: "advanced (3+ years of training experience)",
  };

  const equipmentMap: Record<string, string> = {
    full_gym: "full gym access with all equipment",
    home: "home gym with limited equipment",
    dumbbells: "only dumbbells available",
  };

  const splitMap: Record<string, string> = {
    full_body: "full body workouts",
    upper_lower: "upper/lower split",
    ppl: "push/pull/legs split",
    custom: "best split for their goals",
  };

  const injuryProfileLine = profile.injuries ? `Injuries/Limitations: ${profile.injuries}\n` : "";
  const injuryRequirement = profile.injuries
    ? `- Avoid exercises that could aggravate: ${profile.injuries}\n  `
    : "";

  return `Create a personalized ${profile.days_per_week}-day per week training plan for someone with the following profile:

Goal: ${goalMap[profile.goal] || profile.goal}
Experience Level: ${experienceMap[profile.experience] || profile.experience}
Session Length: ${profile.session_length} minutes per session
Equipment: ${equipmentMap[profile.equipment] || profile.equipment}
Preferred Split: ${splitMap[profile.preferred_split] || profile.preferred_split}
${injuryProfileLine}
Generate a complete training plan in JSON format with this exact structure:
{
  "overview": {
    "goal": "brief description of the training goal",
    "frequency": "X days per week",
    "split": "training split name",
    "notes": "important notes about the program (2-3 sentences)"
  },
  "weeklySchedule": [
    {
      "day": "Monday",
      "focus": "muscle group or focus area",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 4,
          "reps": "6-8",
          "rest": "2-3 min",
          "rpe": 8,
          "notes": "form cues or tips (optional)",
          "alternatives": ["Alternative 1", "Alternative 2"]
        }
      ]
    }
  ],
  "progression": "detailed progression strategy (2-3 sentences explaining how to progress)"
}

  Requirements:
  - "weeklySchedule" must contain exactly ${profile.days_per_week} workout days, each with at least one exercise (no empty or rest days)
  - Each workout should fit within ${profile.session_length} minutes
  - Include 4-6 exercises per workout
  - RPE (Rate of Perceived Exertion) should be 6-9
  - Include compound movements for beginners/intermediate, advanced can have more isolation
  - Match the preferred split type: ${profile.preferred_split}
  ${injuryRequirement}- Provide exercise alternatives where appropriate
  - Make it progressive and suitable for ${experienceMap[profile.experience] || profile.experience} level

  Return ONLY the JSON object (no markdown, no extra text).
  `;
}
