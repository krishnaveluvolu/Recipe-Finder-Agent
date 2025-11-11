import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SPOON_KEY = process.env.SPOON_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

function scoreRecipe(r) {
  const used = Number(r.usedIngredientCount || 0);
  const missed = Number(r.missedIngredientCount || 0);
  const likes = Number(r.likes || 0);
  return used * 3 - missed * 2 + Math.min(likes / 50, 10);
}

app.get("/api/recipes", async (req, res) => {
  let { ingredients } = req.query;
  if (!ingredients) return res.status(400).json({ error: "Missing ingredients" });
  ingredients = String(ingredients).replace(/[^a-zA-Z0-9,\s]/g, "");

  try {
    console.log("🔍 Fetching recipes for:", ingredients);

    // 1️⃣ Basic recipe search
    const base = await axios.get("https://api.spoonacular.com/recipes/findByIngredients", {
      params: { ingredients, number: 5, apiKey: SPOON_KEY },
    });

    const recipes = Array.isArray(base.data) ? base.data : [];
    if (!recipes.length) return res.json({ recipes: [], agentic: null });

    // 2️⃣ Fetch details for each recipe
    const detailed = await Promise.all(
      recipes.map(async (r) => {
        try {
          const info = await axios.get(
            `https://api.spoonacular.com/recipes/${r.id}/information`,
            { params: { apiKey: SPOON_KEY } }
          );

          let instructions = info.data.instructions || "";
          let missedIngredients = r.missedIngredients || [];
          let usedIngredients = r.usedIngredients || [];

          // 3️⃣ If no instructions, use Gemini to generate them
          if (!instructions.trim()) {
            try {
              const prompt = `Generate step-by-step cooking instructions for a recipe called "${r.title}" using the following ingredients: ${ingredients}.`;
              const ai = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent?key=${GEMINI_KEY}`,
                { contents: [{ parts: [{ text: prompt }] }] }
              );
              instructions =
                ai.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                "Instructions unavailable.";
            } catch (e) {
              instructions = "Instructions unavailable.";
            }
          }

          return {
            ...r,
            instructions,
            missedIngredients,
            usedIngredients,
          };
        } catch (e) {
          console.warn("⚠️ Failed to fetch details:", e.message);
          return { ...r, instructions: "Instructions unavailable." };
        }
      })
    );

    // 4️⃣ Pick best recipe for AI reasoning
    const sorted = detailed.slice().sort((a, b) => scoreRecipe(b) - scoreRecipe(a));
    const best = sorted[0];

    // 5️⃣ Ask Gemini for smart suggestions on the best recipe
    let agentic = {
      bestRecipeId: best.id,
      bestRecipeTitle: best.title,
      chosenGoal: null,
      reasoning: null,
      substitutions: [],
      improvedInstructions: [],
    };

    try {
      const prompt = `
You are an autonomous cooking assistant.
Pick ONE goal: healthier, cheaper, or faster.
Return JSON:
{
  "goal": "healthier",
  "reasoning": "why",
  "substitutions": [
    {"from": "cream", "to": "yogurt", "benefit": "less fat"}
  ],
  "improved_instructions": ["Step 1", "Step 2"]
}
Recipe: ${best.title}
Ingredients: ${ingredients}
Current instructions: ${best.instructions}
`;
      const ai = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:generateContent?key=${GEMINI_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );
      const text = ai.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        agentic = { ...agentic, ...parsed };
      } else {
        agentic.reasoning = text;
      }
    } catch (e) {
      console.warn("⚠️ Gemini reasoning failed:", e.message);
      agentic.reasoning = "AI suggestion unavailable.";
    }

    console.log(`✅ Returning ${detailed.length} recipes`);
    res.json({ recipes: detailed, agentic });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: "Failed to load recipes" });
  }
});

// Fallback to serve frontend
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
