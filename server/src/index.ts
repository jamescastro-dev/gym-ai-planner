import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { profileRouter } from "./routes/profile.js";
import { planRouter } from "./routes/plan.js";
import { nutritionRouter } from "./routes/nutrition.js";
import { getModels } from "./lib/ai.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Comma-separated list; add your custom domain here when you have one.
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ??
  "https://gym-ai-planner.vercel.app,http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Number of reverse proxies in front of this server (needed for the per-IP rate limit to see visitor IPs).
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

//API Routes
app.use("/api/profile", profileRouter);
app.use("/api/plan", planRouter);
app.use("/api/nutrition", nutritionRouter);

app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
  console.log(`[config] allowed origins: ${allowedOrigins.join(", ")}`);
  console.log(`[config] AI models (in order): ${getModels().join(", ")}`);
  if (!process.env.NEON_AUTH_URL) {
    console.error("[config] NEON_AUTH_URL is not set — all /api requests will be rejected");
  }
});
