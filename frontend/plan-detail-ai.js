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

          <button
            data-day="${dayNumber}"
            class="startSessionBtn mt-5 bg-indigo-500 text-white px-5 py-3 rounded-xl text-sm font-semibold">
            ${completed ? "Review Session" : "Start Session"}
          </button>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.log(error);
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
