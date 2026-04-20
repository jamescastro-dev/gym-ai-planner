import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { profileRouter } from "./routes/profile.js";
import { planRouter } from "./routes/plan.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: [
    "https://gym-ai-planner.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

//API Routes
app.use("/api/profile", profileRouter);
app.use("/api/plan", planRouter);

app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});
