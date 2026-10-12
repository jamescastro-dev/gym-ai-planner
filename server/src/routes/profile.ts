import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { getUserId, requireAuth } from "../lib/auth.js";

export const profileRouter = Router();

profileRouter.use(requireAuth);

const GOALS = ["bulk", "cut", "recomp", "strength", "endurance"];
const EXPERIENCE = ["beginner", "intermediate", "advanced"];
const EQUIPMENT = ["full_gym", "home", "dumbbells"];
const SPLITS = ["full_body", "upper_lower", "ppl", "custom"];

function invalid(res: Response, field: string) {
  return res.status(400).json({ error: `Invalid or missing field: ${field}`, code: "INVALID_PROFILE" });
}

profileRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(res);
    const { goal, experience, daysPerWeek, sessionLength, equipment, injuries, preferredSplit } =
      req.body ?? {};

    // These values are interpolated into the AI prompt, so they're checked against known options.
    if (!GOALS.includes(goal)) return invalid(res, "goal");
    if (!EXPERIENCE.includes(experience)) return invalid(res, "experience");
    if (!Number.isInteger(daysPerWeek) || daysPerWeek < 2 || daysPerWeek > 6) return invalid(res, "daysPerWeek");
    if (!Number.isInteger(sessionLength) || sessionLength < 15 || sessionLength > 180) return invalid(res, "sessionLength");
    if (!EQUIPMENT.includes(equipment)) return invalid(res, "equipment");
    if (!SPLITS.includes(preferredSplit)) return invalid(res, "preferredSplit");
    if (injuries != null && (typeof injuries !== "string" || injuries.length > 500)) return invalid(res, "injuries");

    await prisma.user_profiles.upsert({
      where: { user_id: userId },
      update: {
        goal,
        experience,
        days_per_week: daysPerWeek,
        session_length: sessionLength,
        equipment,
        injuries: injuries?.trim() || null,
        preferred_split: preferredSplit,
        updated_at: new Date(),
      },
      create: {
        user_id: userId,
        goal,
        experience,
        days_per_week: daysPerWeek,
        session_length: sessionLength,
        equipment,
        injuries: injuries?.trim() || null,
        preferred_split: preferredSplit,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving profile:", error);
    res.status(500).json({ error: "Failed to save profile", code: "INTERNAL" });
  }
});
