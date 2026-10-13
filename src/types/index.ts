export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  goal: "cut" | "bulk" | "recomp" | "strength" | "endurance";
  experience: "beginner" | "intermediate" | "advanced";
  daysPerWeek: number;
  sessionLength: number;
  equipment: "full_gym" | "home" | "dumbbells";
  injuries?: string;
  preferredSplit: "full_body" | "upper_lower" | "ppl" | "custom";
  updatedAt: string;
}

export interface PlanOverview {
  goal: string;
  frequency: string;
  split: string;
  notes: string;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  rpe: number;
  notes?: string;
  alternatives?: string[];
}

export interface DaySchedule {
  day: string;
  focus: string;
  exercises: Exercise[];
}

export interface TrainingPlan {
  id: string;
  userId: string;
  overview: PlanOverview;
  weeklySchedule: DaySchedule[];
  progression: string;
  version: number;
  createdAt: string;
}
export type Diet = "any" | "vegetarian" | "vegan" | "pescatarian";

export interface MealRequest {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goal: "bulk" | "cut" | "recomp" | "strength" | "endurance";
  diet: Diet;
  meals: 3 | 4 | 5;
  avoid: string;
}

export interface Meal {
  name: string;
  title: string;
  items: { food: string; amount: string }[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlan {
  meals: Meal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  tips: string[];
  /** Meal plans the user can still create today (absent on the example day). */
  remainingToday?: number;
}
