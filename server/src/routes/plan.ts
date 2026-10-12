import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AiUnavailableError, generateTrainingPlan } from "../lib/ai.js";
import { getUserId, requireAuth } from "../lib/auth.js";
import { USER_DAILY_PLAN_LIMIT, generateIpLimiter, logProxyOnce } from "../lib/limits.js";

export const planRouter = Router();

planRouter.use(requireAuth);

const DAY_MS = 24 * 60 * 60 * 1000;
/** Users with a generation currently running (one at a time per user; stops double-click quota burn). */
const generating = new Set<string>();

planRouter.post("/generate", logProxyOnce, generateIpLimiter, async (_req: Request, res: Response) => {
  const userId = getUserId(res);

  if (generating.has(userId)) {
    return res.status(429).json({
      error: "Your plan is already being generated. Hang tight.",
      code: "IN_PROGRESS",
    });
  }
  generating.add(userId);

  try {
    const profile = await prisma.user_profiles.findUnique({
      where: { user_id: userId },
    });

    if (!profile) {
      return res.status(400).json({
        error: "User profile not found. Complete onboarding first.",
        code: "PROFILE_REQUIRED",
      });
    }

    const plansToday = await prisma.training_plans.count({
      where: { user_id: userId, created_at: { gte: new Date(Date.now() - DAY_MS) } },
    });
    if (plansToday >= USER_DAILY_PLAN_LIMIT) {
      return res.status(429).json({
        error: `You've reached today's limit of ${USER_DAILY_PLAN_LIMIT} plans. Try again tomorrow, or view a sample plan.`,
        code: "DAILY_LIMIT",
      });
    }

    const latestPlan = await prisma.training_plans.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      select: { version: true },
    });
    const nextVersion = latestPlan ? latestPlan.version + 1 : 1;

    let planJson;
    try {
      planJson = await generateTrainingPlan(profile);
    } catch (error) {
      if (error instanceof AiUnavailableError) {
        console.error("AI generation failed:", error.message);
        return res.status(503).json(
          error.reason === "quota"
            ? {
                error: "Today's free AI quota has been used up. Try again tomorrow, or view a sample plan.",
                code: "AI_QUOTA",
              }
            : {
                error: "The AI is busy, try again in a few minutes.",
                code: "AI_BUSY",
              },
        );
      }
      throw error;
    }

    const newPlan = await prisma.training_plans.create({
      data: {
        user_id: userId,
        plan_json: planJson as unknown as Prisma.InputJsonValue,
        plan_text: JSON.stringify(planJson, null, 2),
        version: nextVersion,
      },
    });

    res.json({
      id: newPlan.id,
      version: newPlan.version,
      createdAt: newPlan.created_at,
    });
  } catch (error) {
    console.error("Error generating plan:", error);
    res.status(500).json({ error: "Failed to generate plan", code: "INTERNAL" });
  } finally {
    generating.delete(userId);
  }
});

planRouter.get("/current", async (_req: Request, res: Response) => {
  try {
    const plan = await prisma.training_plans.findFirst({
      where: { user_id: getUserId(res) },
      orderBy: { created_at: "desc" },
    });

    if (!plan) {
      return res.json(null);
    }

    res.json({
      id: plan.id,
      userId: plan.user_id,
      planJson: plan.plan_json,
      planText: plan.plan_text,
      version: plan.version,
      createdAt: plan.created_at,
    });
  } catch (error) {
    console.error("Error fetching plan:", error);
    res.status(500).json({ error: "Failed to fetch plan", code: "INTERNAL" });
  }
});
