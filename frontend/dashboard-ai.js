async function loadAIDashboardRecommendation() {
  const sessionsContainer = document.getElementById("todaySessionsList");
  const goalTitle = document.getElementById("dashboardGoalTitle");
  const goalSuggestion = document.getElementById("dashboardGoalSuggestion");
  const continueLink = document.getElementById("dashboardContinueLink");

  if (!sessionsContainer) return;

  try {
    const plans = await apiRequest("/plans");
    let recommendation = null;

    for (const plan of plans) {
      const completedDays = Array.isArray(plan.completedDays)
        ? plan.completedDays
        : [];
      const nextDay = (plan.generatedPlan || []).find(
        day => !completedDays.includes(Number(day.day))
      );

      if (nextDay) {
        recommendation = { plan, nextDay };
        break;
      }
    }

    if (!recommendation) {
      sessionsContainer.innerHTML = `
        <p class="text-sm text-slate-500">
          You have completed every available study day.
        </p>
      `;
      if (goalTitle) goalTitle.textContent = "Plan Complete";
      if (goalSuggestion) {
        goalSuggestion.textContent =
          "Review your completed quizzes or create a new study plan.";
      }
      return;
    }

    const { plan, nextDay } = recommendation;
    const primaryTopic = (nextDay.topics || [nextDay.title])[0];

    sessionsContainer.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div class="border-l-4 border-indigo-500 pl-4">
          <p class="text-xs font-semibold text-indigo-600">Recommended Next</p>
          <h4 class="font-semibold text-slate-900 mt-1">
            Day ${nextDay.day}: ${escapeHtml(primaryTopic)}
          </h4>
          <p class="text-sm text-slate-500 mt-1">
            ${Number(nextDay.estimatedMinutes) || plan.studyTime} minute focus block
          </p>
        </div>
        <button
          id="startRecommendedSession"
          class="bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          Start
        </button>
      </div>
    `;

    if (goalTitle) goalTitle.textContent = nextDay.title;
    if (goalSuggestion) {
      goalSuggestion.textContent =
        plan.dashboardSuggestion ||
        "Focus on the next incomplete topic and finish one task at a time.";
    }
    if (continueLink) continueLink.href = "session.html";

    function selectRecommendation() {
      localStorage.setItem("selectedPlanId", plan._id);
      localStorage.setItem("currentStudyDay", nextDay.day);
    }

    document
      .getElementById("startRecommendedSession")
      ?.addEventListener("click", function () {
        selectRecommendation();
        window.location.href = "session.html";
      });

    continueLink?.addEventListener("click", selectRecommendation);
  } catch (error) {
    console.log(error);
  }
}

loadAIDashboardRecommendation();
