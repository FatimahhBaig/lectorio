const topicTitle = document.getElementById("topicTitle");
const topicMeta = document.getElementById("topicMeta");
const explanationCard = document.getElementById("easyExplanation");
const topicSections = document.getElementById("topicSections");
const keyPointsContainer = document.getElementById("keyPointsContainer");
const examplesContainer = document.getElementById("examplesContainer");
const quizContainer = document.getElementById("quizContainer");
const submitQuizBtn = document.getElementById("submitQuizBtn");
const nextTopicBtn = document.getElementById("nextTopicBtn");
const topicFocusTimerBtn = document.getElementById("topicFocusTimerBtn");

let nextTopicTarget = null;
let topicFocusMinutes = 25;

function escapeTopicHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function prepareTopicNavigation(planId, currentTopic, currentDay) {
  const response = await fetch(
    "http://localhost:5001/plans/" + planId,
    {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("lectorioToken")
      }
    }
  );

  const plan = await response.json();

  if (!response.ok) {
    throw new Error(plan.message || "Could not load topic navigation");
  }

  const orderedTopics = (plan.generatedPlan || []).flatMap(studyDay =>
    (studyDay.topics || []).map(topic => ({
      topic,
      day: Number(studyDay.day)
    }))
  );

  const currentStudyDay = (plan.generatedPlan || []).find(
    studyDay => Number(studyDay.day) === Number(currentDay)
  );

  if (currentStudyDay) {
    const topicCount = Math.max(1, (currentStudyDay.topics || []).length);
    const dayMinutes =
      Number(currentStudyDay.estimatedMinutes) || Number(plan.studyTime) || 25;

    topicFocusMinutes = Math.max(10, Math.round(dayMinutes / topicCount));
  }

  const currentIndex = orderedTopics.findIndex(item =>
    item.day === Number(currentDay) &&
    item.topic.toLowerCase() === currentTopic.toLowerCase()
  );

  nextTopicTarget =
    currentIndex >= 0 ? orderedTopics[currentIndex + 1] || null : null;

  if (nextTopicBtn && !nextTopicTarget) {
    nextTopicBtn.textContent = "Final Topic";
    nextTopicBtn.disabled = true;
    nextTopicBtn.classList.add("opacity-50", "cursor-not-allowed");
  }
}

async function loadTopicAI() {
  const planId = localStorage.getItem("selectedPlanId");
  const topic = localStorage.getItem("selectedTopic");
  const currentDay = localStorage.getItem("currentStudyDay") || "1";

  if (!planId || !topic) {
    explanationCard.textContent =
      "Open a topic from the Plan Detail or Study Session page first.";
    return;
  }

  topicTitle.textContent = topic;
  topicMeta.textContent = "Day " + currentDay + " - Grounded in your lecture notes";
  explanationCard.textContent = "AI is preparing your grounded explanation...";

  try {
    const response = await fetch(
      "http://localhost:5001/plans/" + planId + "/topic-explanation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("lectorioToken")
        },
        body: JSON.stringify({ topic })
      }
    );

    const responseText = await response.text();
    let lesson;

    try {
      lesson = JSON.parse(responseText);
    } catch {
      throw new Error(
        response.status === 404
          ? "The topic AI route is not active. Restart the backend server."
          : "The backend returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(lesson.message || "Could not load topic lesson");
    }

    explanationCard.textContent = lesson.easyExplanation;

    topicSections.innerHTML = (lesson.sections || []).map(section => `
      <div class="border-l-4 border-indigo-500 pl-4">
        <h3 class="font-semibold text-slate-900">
          ${escapeTopicHtml(section.heading)}
        </h3>
        <p class="mt-2 text-slate-600 leading-7">
          ${escapeTopicHtml(section.content)}
        </p>
      </div>
    `).join("");

    keyPointsContainer.innerHTML = (lesson.keyPoints || []).map(point => `
      <div class="flex gap-3">
        <span class="text-indigo-600">+</span>
        <p class="text-slate-600">${escapeTopicHtml(point)}</p>
      </div>
    `).join("");

    examplesContainer.innerHTML = (lesson.examples || []).length
      ? lesson.examples.map(example => `
          <p class="bg-white/50 rounded-xl p-3">
            ${escapeTopicHtml(example)}
          </p>
        `).join("")
      : "<p>No lecture-supported example was available for this topic.</p>";

    quizContainer.innerHTML = (lesson.quiz || []).map((question, index) => `
      <div class="topicQuizQuestion border border-slate-200 rounded-xl p-4"
           data-answer="${escapeTopicHtml(question.answer)}">
        <p class="font-semibold mb-3">
          ${index + 1}. ${escapeTopicHtml(question.question)}
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${(question.options || []).map(option => `
            <label class="border border-slate-200 rounded-xl px-4 py-3 cursor-pointer hover:border-indigo-500">
              <input type="radio" name="q${index}" value="${escapeTopicHtml(option)}" class="mr-2">
              ${escapeTopicHtml(option)}
            </label>
          `).join("")}
        </div>
      </div>
    `).join("");

    await prepareTopicNavigation(planId, topic, currentDay);
  } catch (error) {
    console.log(error);
    explanationCard.textContent = error.message || "AI failed to load.";
  }
}

if (nextTopicBtn) {
  nextTopicBtn.addEventListener("click", function () {
    if (!nextTopicTarget) return;

    localStorage.setItem("selectedTopic", nextTopicTarget.topic);
    localStorage.setItem("currentStudyDay", nextTopicTarget.day);
    window.location.reload();
  });
}

if (topicFocusTimerBtn) {
  topicFocusTimerBtn.addEventListener("click", function () {
    const totalSeconds = topicFocusMinutes * 60;
    const endTime = Date.now() + totalSeconds * 1000;

    localStorage.setItem("lectorioTotalSeconds", totalSeconds);
    localStorage.setItem("lectorioRemainingSeconds", totalSeconds);
    localStorage.setItem("lectorioEndTime", endTime);
    localStorage.setItem("lectorioIsRunning", "true");

    window.location.href = "timer.html";
  });
}

if (submitQuizBtn) {
  submitQuizBtn.addEventListener("click", function () {
    const questions = document.querySelectorAll(".topicQuizQuestion");
    let correct = 0;
    let answered = 0;

    questions.forEach((question, index) => {
      const selected = document.querySelector(`input[name="q${index}"]:checked`);
      if (!selected) return;

      answered++;
      if (selected.value === question.dataset.answer) correct++;
    });

    if (answered < questions.length) {
      alert("Please answer every question first.");
      return;
    }

    alert("You scored " + correct + " out of " + questions.length + ".");
  });
}

loadTopicAI();
