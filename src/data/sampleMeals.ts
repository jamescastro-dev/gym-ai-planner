import type { MealPlan } from "@/types";

/**
 * A real reply from the meal-plan endpoint (free model, first attempt) for the calculator's example targets:
 * 2,050 kcal, 120 g protein, 264 g carbs, 57 g fat, 4 meals, no diet restriction. Shown to signed-out visitors.
 */
export const SAMPLE_MEALS_FOR = { calories: 2050, meals: 4 } as const;

export const sampleMeals: MealPlan = {
  "meals": [
    {
      "name": "Breakfast",
      "title": "Power Oat Bowl",
      "items": [
        {
          "food": "rolled oats",
          "amount": "60g"
        },
        {
          "food": "whey protein",
          "amount": "30g"
        },
        {
          "food": "banana",
          "amount": "1 medium"
        },
        {
          "food": "almond butter",
          "amount": "15g"
        }
      ],
      "calories": 500,
      "protein": 30,
      "carbs": 55,
      "fat": 15
    },
    {
      "name": "Lunch",
      "title": "Chicken Rice Bowl",
      "items": [
        {
          "food": "grilled chicken breast",
          "amount": "150g"
        },
        {
          "food": "cooked rice",
          "amount": "150g"
        },
        {
          "food": "steamed broccoli",
          "amount": "100g"
        },
        {
          "food": "olive oil",
          "amount": "1 tbsp"
        }
      ],
      "calories": 600,
      "protein": 35,
      "carbs": 70,
      "fat": 15
    },
    {
      "name": "Snack",
      "title": "Greek Yogurt Parfait",
      "items": [
        {
          "food": "nonfat Greek yogurt",
          "amount": "200g"
        },
        {
          "food": "honey",
          "amount": "1 tbsp"
        },
        {
          "food": "almonds",
          "amount": "20g"
        }
      ],
      "calories": 300,
      "protein": 20,
      "carbs": 40,
      "fat": 10
    },
    {
      "name": "Dinner",
      "title": "Beef & Sweet Potato",
      "items": [
        {
          "food": "lean beef",
          "amount": "200g"
        },
        {
          "food": "sweet potato",
          "amount": "200g"
        },
        {
          "food": "green beans",
          "amount": "100g"
        },
        {
          "food": "olive oil",
          "amount": "1 tsp"
        }
      ],
      "calories": 650,
      "protein": 35,
      "carbs": 99,
      "fat": 17
    }
  ],
  "totals": {
    "calories": 2050,
    "protein": 120,
    "carbs": 264,
    "fat": 57
  },
  "tips": [
    "Drink water before meals to help control hunger.",
    "Prep ingredients ahead of time to save cooking time."
  ]
};
