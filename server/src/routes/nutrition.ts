import { Router, type Request, type Response } from "express";
import { AiUnavailableError } from "../lib/ai.js";
import { getUserId, requireAuth } from "../lib/auth.js";
import { DailyCounter, USER_DAILY_MEAL_LIMIT, logProxyOnce, mealIpLimiter } from "../lib/limits.js";
import { generateMealPlan, parseMealRequest } from "../lib/meals.js";

export const nutritionRouter = Router();

nutritionRouter.use(requireAuth);

/** Successful meal plans per user, rolling 24h. Only successes count, like plans. */
const mealPlansToday = new DailyCounter();
/** Users with a meal plan currently being generated (stops double-click quota burn). */
const generating = new Set<string>();

nutritionRouter.post("/meals", logProxyOnce, mealIpLimiter, async (req: Request, res: Response) => {
  const userId = getUserId(res);

  const parsed = parseMealRequest(req.body);
  if (typeof parsed === "string") {
    return res.status(400).json({ error: parsed, code: "INVALID_REQUEST" });
  }

  if (generating.has(userId)) {
    return res.status(429).json({ error: "Your meal ideas are already being written. Hang tight.", code: "IN_PROGRESS" });
  }
  if (mealPlansToday.count(userId) >= USER_DAILY_MEAL_LIMIT) {
    return res.status(429).json({
      error: `You've reached today's limit of ${USER_DAILY_MEAL_LIMIT} meal plans. Try again tomorrow.`,
      code: "DAILY_LIMIT",
    });
  }

  generating.add(userId);
  try {
    const plan = await generateMealPlan(parsed);
    mealPlansToday.add(userId);
    res.json({ ...plan, remainingToday: Math.max(0, USER_DAILY_MEAL_LIMIT - mealPlansToday.count(userId)) });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      console.error("AI meal plan failed:", error.message);
      return res.status(503).json(
        error.reason === "quota"
          ? { error: "Today's free AI quota has been used up. Try again tomorrow.", code: "AI_QUOTA" }
          : { error: "The AI is busy, try again in a few minutes.", code: "AI_BUSY" },
      );
    }
    console.error("Error generating meal plan:", error);
    res.status(500).json({ error: "Failed to generate meal ideas", code: "INTERNAL" });
  } finally {
    generating.delete(userId);
  }
});
