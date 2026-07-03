async function loadSessionTopicButtons() {
  const container = document.getElementById("todayObjectives");
  const planId = localStorage.getItem("selectedPlanId");
  const dayNumber = Number(localStorage.getItem("currentStudyDay") || "1");

  if (!container || !planId) return;

  try {
    const plan = await apiRequest("/plans/" + planId);
    const studyDay = (plan.generatedPlan || []).find(
      day => Number(day.day) === dayNumber
    );

    if (!studyDay) return;

    const explanation = document.getElementById("sessionExplanation");
    const keyPoints = document.getElementById("sessionKeyPoints");

    if (explanation) {
      explanation.textContent =
        studyDay.explanation ||
        studyDay.summary ||
        "No explanation is available for this older plan.";
    }

    if (keyPoints) {
      const points = Array.isArray(studyDay.keyPoints)
        ? studyDay.keyPoints
        : [];

      keyPoints.innerHTML = points.length
        ? points.map(point => `<li>- ${escapeHtml(point)}</li>`).join("")
        : "<li>No key points are available for this older plan.</li>";
    }

    container.innerHTML = (studyDay.topics || []).map(topic => `
      <button
        type="button"
        data-topic="${escapeHtml(topic)}"
        class="sessionTopicButton text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-500">
        <div class="text-indigo-500 mb-3">+</div>
        <h4 class="text-sm font-semibold">${escapeHtml(topic)}</h4>
      </button>
    `).join("");
  } catch (error) {
    console.log(error);
  }
}

function showCompletionModal(result) {
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4";

  modal.innerHTML = `
    <div class="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-7 shadow-xl">
      <h2 class="text-2xl font-bold text-slate-900">Session Complete</h2>
      <p class="mt-2 text-slate-500">Your quick AI revision is ready.</p>

      <div class="mt-6 bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <h3 class="font-bold text-indigo-900">Revision Summary</h3>
        <p class="mt-2 text-sm leading-7 text-indigo-900">
          ${escapeHtml(result.revisionSummary)}
        </p>
      </div>

      <h3 class="font-bold text-slate-900 mt-6">Quick Check</h3>
      <div class="mt-3 space-y-4">
        ${(result.quiz || []).map((question, index) => `
          <div class="border border-slate-200 rounded-xl p-4">
            <p class="font-semibold">${index + 1}. ${escapeHtml(question.question)}</p>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${(question.options || []).map(option => `
                <label class="border border-slate-200 rounded-lg p-3 text-sm">
                  <input type="radio" name="completion-q${index}" class="mr-2">
                  ${escapeHtml(option)}
                </label>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>

      <button id="finishCompletedSession"
        class="mt-6 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold">
        Finish and Return to Plan
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  document
    .getElementById("finishCompletedSession")
    .addEventListener("click", function () {
      window.location.href = "plan-detail.html";
    });
}

document.addEventListener("click", function (event) {
  const topicButton = event.target.closest(".sessionTopicButton");
  if (!topicButton) return;

  localStorage.setItem("selectedTopic", topicButton.dataset.topic);
  window.location.href = "topic.html";
});

document.addEventListener("click", async function (event) {
  const completeButton = event.target.closest("#markCompleteBtn");
  if (!completeButton) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const planId = localStorage.getItem("selectedPlanId");
  const day = Number(localStorage.getItem("currentStudyDay") || "1");

  completeButton.disabled = true;
  completeButton.textContent = "Preparing Revision...";

  try {
    const result = await apiRequest(
      "/plans/" + planId + "/complete-session",
      {
        method: "POST",
        body: JSON.stringify({ day })
      }
    );

    showCompletionModal(result);
  } catch (error) {
    alert(error.message || "Could not complete this session.");
    completeButton.disabled = false;
    completeButton.textContent = "Mark Day Complete";
  }
}, true);

loadSessionTopicButtons();
