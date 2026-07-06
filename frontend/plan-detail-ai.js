async function loadAIPlanDetail() {
  const container = document.getElementById("generatedPlanContainer");
  const planId = localStorage.getItem("selectedPlanId");

  if (!container || !planId) return;

  try {
    const plan = await apiRequest("/plans/" + planId);
    const completedDays = Array.isArray(plan.completedDays)
      ? plan.completedDays
      : [];
    const days = Array.isArray(plan.generatedPlan)
      ? plan.generatedPlan
      : [];

    renderPlanDays(container, plan, days, completedDays);

    const hasMissingRecommendations = days.some(studyDay => {
      return !Array.isArray(studyDay.videoRecommendations) ||
        studyDay.videoRecommendations.length === 0;
    });

    if (hasMissingRecommendations) {
      generateAndRenderVideoRecommendations(container, planId, plan, completedDays);
    }
  } catch (error) {
    console.log(error);
  }
}

function renderVideoRecommendations(studyDay, isLoading) {
  const recommendations = Array.isArray(studyDay.videoRecommendations)
    ? studyDay.videoRecommendations
    : [];

  if (isLoading) {
    return `
      <section class="mt-6 border-t border-slate-100 pt-5">
        <div class="flex items-center justify-between gap-3">
          <h4 class="font-bold text-slate-900">📺 Recommended Videos</h4>
          <span class="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
            Finding videos
          </span>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          ${[1, 2].map(() => `
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="h-4 w-3/4 animate-pulse rounded bg-slate-200"></div>
              <div class="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-200"></div>
              <div class="mt-5 h-10 w-full animate-pulse rounded-xl bg-slate-200"></div>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  if (recommendations.length === 0) {
    return `
      <section class="mt-6 border-t border-slate-100 pt-5">
        <h4 class="font-bold text-slate-900">📺 Recommended Videos</h4>
        <div class="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No video recommendations are available for this study day yet.
        </div>
      </section>
    `;
  }

  return `
    <section class="mt-6 border-t border-slate-100 pt-5">
      <h4 class="font-bold text-slate-900">📺 Recommended Videos</h4>

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        ${recommendations.map(recommendation => `
          <article class="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-200 hover:shadow-md">
            <div class="flex items-start gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                ▶
              </div>
              <div class="min-w-0">
                <h5 class="break-words text-sm font-bold text-slate-900">
                  ${escapeHtml(recommendation.title)}
                </h5>
                <p class="mt-1 text-xs font-semibold text-slate-500">
                  ${escapeHtml(recommendation.channel || "YouTube")}
                </p>
              </div>
            </div>

            <p class="mt-3 flex-1 text-sm leading-6 text-slate-600">
              ${escapeHtml(recommendation.reason || "Helpful for this study day's topics.")}
            </p>

            <a
              href="${escapeHtml(recommendation.url)}"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600">
              Watch on YouTube
            </a>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPlanDays(container, plan, days, completedDays, options) {
  const loadingVideos = Boolean(options && options.loadingVideos);

  container.innerHTML = days.map(studyDay => {
      const dayNumber = Number(studyDay.day);
      const completed = completedDays.includes(dayNumber);
      const keyPoints = Array.isArray(studyDay.keyPoints)
        ? studyDay.keyPoints
        : [];
      const topics = Array.isArray(studyDay.topics)
        ? studyDay.topics
        : [];
      const tasks = Array.isArray(studyDay.tasks)
        ? studyDay.tasks
        : [];
      const quiz = Array.isArray(studyDay.quiz)
        ? studyDay.quiz
        : [];

      const status = completed
        ? `<span class="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full">Completed</span>`
        : studyDay.isRevisionDay
          ? `<span class="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">Revision Day</span>`
          : `<span class="bg-slate-100 text-slate-500 text-xs font-semibold px-3 py-1 rounded-full">Not Started</span>`;

      return `
        <article class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-5 min-w-0">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <h3 class="text-lg font-bold text-slate-900 break-words">
              Day ${dayNumber}: ${escapeHtml(studyDay.title || "Study Session")}
            </h3>
            ${status}
          </div>

          <p class="mt-2 text-slate-500">
            ${escapeHtml(studyDay.summary || "No summary available.")}
          </p>

          <div class="mt-4 flex flex-wrap gap-2">
            <span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
              ${Number(studyDay.estimatedMinutes) || plan.studyTime} minutes
            </span>
            <span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold">
              ${plan.breakTime} minute break
            </span>
          </div>

          ${studyDay.explanation ? `
            <div class="mt-5 bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <h4 class="font-semibold text-slate-900">Simple Explanation</h4>
              <p class="mt-2 text-sm text-slate-600 leading-relaxed">
                ${escapeHtml(studyDay.explanation)}
              </p>
            </div>
          ` : ""}

          ${keyPoints.length ? `
            <h4 class="mt-5 font-semibold text-slate-900">Key Points</h4>
            <ul class="mt-2 space-y-2 text-sm text-slate-600">
              ${keyPoints.map(point => `<li>- ${escapeHtml(point)}</li>`).join("")}
            </ul>
          ` : ""}

          ${topics.length ? `
            <h4 class="mt-5 font-semibold text-slate-900">Topics</h4>
            <div class="mt-2 flex flex-wrap gap-2">
              ${topics.map(topic => `
                <button
                  type="button"
                  data-topic="${escapeHtml(topic)}"
                  data-day="${dayNumber}"
                  class="openTopicBtn bg-violet-50 text-violet-700 border border-violet-200 px-3 py-2 rounded-full text-xs hover:bg-violet-100">
                  ${escapeHtml(topic)}
                </button>
              `).join("")}
            </div>
          ` : ""}

          <h4 class="mt-5 font-semibold text-slate-900">Tasks</h4>
          <ul class="mt-2 space-y-2 text-sm text-slate-600">
            ${tasks.map(task => `<li>- ${escapeHtml(task)}</li>`).join("")}
          </ul>

          <h4 class="mt-5 font-semibold text-slate-900">Quick Quiz</h4>
          <ol class="mt-2 space-y-2 text-sm text-slate-600 list-decimal list-inside">
            ${quiz.map(question => `<li>${escapeHtml(question)}</li>`).join("")}
          </ol>

          ${renderVideoRecommendations(
            studyDay,
            loadingVideos &&
              (!Array.isArray(studyDay.videoRecommendations) ||
                studyDay.videoRecommendations.length === 0)
          )}

          <button
            data-day="${dayNumber}"
            class="startSessionBtn mt-5 bg-indigo-500 text-white px-5 py-3 rounded-xl text-sm font-semibold">
            ${completed ? "Review Session" : "Start Session"}
          </button>
        </article>
      `;
    }).join("");
}

async function generateAndRenderVideoRecommendations(
  container,
  planId,
  plan,
  completedDays
) {
  const days = Array.isArray(plan.generatedPlan) ? plan.generatedPlan : [];

  renderPlanDays(container, plan, days, completedDays, {
    loadingVideos: true
  });

  try {
    const result = await apiRequest(`/plans/${planId}/video-recommendations`, {
      method: "POST"
    });

    const updatedDays = Array.isArray(result.generatedPlan)
      ? result.generatedPlan
      : days;

    renderPlanDays(container, plan, updatedDays, completedDays);
  } catch (error) {
    console.log(error);
    renderPlanDays(container, plan, days, completedDays);
  }
}

document.addEventListener("click", function (event) {
  const topicButton = event.target.closest(".openTopicBtn");
  if (!topicButton) return;

  localStorage.setItem("selectedTopic", topicButton.dataset.topic);
  localStorage.setItem("currentStudyDay", topicButton.dataset.day);
  window.location.href = "topic.html";
});

loadAIPlanDetail();
