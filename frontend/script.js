document.addEventListener("DOMContentLoaded", () => {
  // ⚙️ Connect to same-origin backend (backend serves frontend)
  const BACKEND_URL = "https://recipe-finder-agent-backend.vercel.app";

  // === Elements ===
  const ingredientsInput = document.getElementById("ingredientsInput");
  const searchButton = document.getElementById("searchButton");
  const resultsContainer = document.getElementById("resultsContainer");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const agenticBox = document.getElementById("agenticBox");
  const agenticGoal = document.getElementById("agenticGoal");
  const agenticReason = document.getElementById("agenticReason");
  const agenticSubs = document.getElementById("agenticSubs");
  const agenticSteps = document.getElementById("agenticSteps");
  const darkToggle = document.getElementById("darkToggle");
  const icon = darkToggle.querySelector("i");
  const recipeModal = document.getElementById("recipeModal");
  const recipeContent = document.getElementById("recipeContent");
  const closeModalButton = document.getElementById("closeModalButton");
  const downloadPdf = document.getElementById("downloadPdf");
  const youtubeBtn = document.getElementById("youtubeBtn");

  // === Dark Mode ===
  if (
    localStorage.theme === "dark" ||
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    document.documentElement.classList.add("dark");
    icon.classList.replace("bx-moon", "bx-sun");
  }

  darkToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const d = document.documentElement.classList.contains("dark");
    icon.classList.replace(d ? "bx-moon" : "bx-sun", d ? "bx-sun" : "bx-moon");
    localStorage.theme = d ? "dark" : "light";
  });

  // === Search Recipes ===
  searchButton.addEventListener("click", fetchRecipes);
  ingredientsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fetchRecipes();
  });

  async function fetchRecipes() {
    const ingredients = ingredientsInput.value.trim();
    if (!ingredients) return alert("Please enter some ingredients!");

    resultsContainer.innerHTML = "";
    agenticBox.classList.add("hidden");
    loadingIndicator.classList.remove("hidden");

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/recipes?ingredients=${encodeURIComponent(ingredients)}`
      );
      const { recipes = [], agentic = null } = await res.json();

      renderRecipes(recipes);
      renderAgentic(agentic);
    } catch (err) {
      console.error("❌ Fetch Error:", err);
      alert("Failed to load recipes. Check backend or API keys.");
    } finally {
      loadingIndicator.classList.add("hidden");
    }
  }

  // === Render Agentic AI Box ===
  function renderAgentic(a) {
    if (!a) {
      agenticBox.classList.add("hidden");
      return;
    }

    agenticBox.classList.remove("hidden");
    agenticGoal.textContent = a.goal
      ? `🎯 Goal: ${a.goal.charAt(0).toUpperCase() + a.goal.slice(1)}`
      : "🎯 Goal: Auto-detected";
    agenticReason.textContent = a.reasoning || "No reasoning provided by AI.";

    agenticSubs.innerHTML = (a.substitutions || [])
      .map((s) => `<li>${s.from} → ${s.to} (${s.benefit || ""})</li>`)
      .join("");

    agenticSteps.innerHTML = (a.improved_instructions || [])
      .map((step, i) => `<li>${step}</li>`)
      .join("");
  }

  // === Render Recipe Cards ===
  function renderRecipes(list) {
    resultsContainer.innerHTML = "";
    if (!list.length) {
      resultsContainer.innerHTML =
        "<p class='col-span-full text-center text-lg text-gray-600 dark:text-gray-300'>No recipes found.</p>";
      return;
    }

    list.forEach((r) => {
      const card = document.createElement("div");
      card.className = `glass-card rounded-xl shadow-lg p-4 hover:scale-105 transition bg-white/20 ${
        r.isBest ? "best-recipe-card" : ""
      }`;
      card.innerHTML = `
        <img src="${r.image}" alt="${r.title}" class="rounded-lg mb-3 w-full h-48 object-cover">
        <h3 class="text-lg font-bold mb-1 text-gray-900 dark:text-white">${r.title}</h3>
        <p class="text-sm text-gray-700 dark:text-gray-400 mb-3">
          ${r.usedIngredients?.length || 0} used, ${
        r.missedIngredients?.length || 0
      } missing
        </p>
        <button class="view-btn w-full py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">
          View Recipe
        </button>
      `;
      card
        .querySelector(".view-btn")
        .addEventListener("click", () => openModal(r));
      resultsContainer.appendChild(card);
    });
  }

  // === Recipe Modal ===
  function openModal(recipe) {
    recipeModal.classList.remove("hidden");
    youtubeBtn.classList.remove("hidden");
    downloadPdf.classList.remove("hidden");

    const usedList = (recipe.usedIngredients || [])
      .map((u) => `<li>✅ ${u.name}</li>`)
      .join("");
    const missedList = (recipe.missedIngredients || [])
      .map((m) => `<li>❌ ${m.name}</li>`)
      .join("");

    recipeContent.innerHTML = `
      <h2 class="text-2xl font-bold mb-3">${recipe.title}</h2>
      <img src="${recipe.image}" class="w-full rounded-lg mb-4">

      <h3 class="text-lg font-semibold text-indigo-600">Used Ingredients</h3>
      <ul class="mb-3 text-gray-700 dark:text-gray-300">${usedList}</ul>

      <h3 class="text-lg font-semibold text-red-600">Missing Ingredients</h3>
      <ul class="mb-3 text-gray-700 dark:text-gray-300">${missedList}</ul>

      <h3 class="text-lg font-semibold text-green-600 mt-3">Cooking Instructions</h3>
      <p class="text-gray-800 dark:text-gray-200 mb-2">${
        recipe.instructions || "No instructions available."
      }</p>
    `;

    // === PDF Download ===
    downloadPdf.onclick = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Missing Ingredients for ${recipe.title}`, 10, 10);
      const missing =
        recipe.missedIngredients
          ?.map((m) => `• ${m.name}`)
          .join("\n") || "None";
      doc.setFontSize(12);
      doc.text(missing, 10, 25);
      doc.save(`${recipe.title.replace(/\s+/g, "_")}_MissingIngredients.pdf`);
    };

    // === YouTube Search ===
    youtubeBtn.onclick = () =>
      window.open(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(
          recipe.title
        )}+recipe`,
        "_blank"
      );
  }

  // === Modal Close ===
  closeModalButton.addEventListener("click", () =>
    recipeModal.classList.add("hidden")
  );
  recipeModal.addEventListener("click", (e) => {
    if (e.target === recipeModal) recipeModal.classList.add("hidden");
  });
});
