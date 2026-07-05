const API_BASE_URL = "https://lectorio.onrender.com";

function getAuthHeaders() {
  const token = localStorage.getItem("lectorioToken");

  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token
  };
}

function formatPlanDate(dateValue) {
  if (!dateValue) return new Date().toLocaleDateString();
  return new Date(dateValue).toLocaleDateString();
}

function getPlanId(plan) {
  return plan._id || plan.id;
}

function getCompletedDays(plan) {
  return Array.isArray(plan.completedDays) ? plan.completedDays : [];
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function apiRequest(path, options) {
  const response = await fetch(API_BASE_URL + path, {
    ...(options || {}),
    headers: {
      ...getAuthHeaders(),
      ...((options && options.headers) || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

// =====================
// TIMER PAGE
// =====================

document.addEventListener("DOMContentLoaded", function () {
  const customMinutes = document.getElementById("customMinutes");
  const setTimerBtn = document.getElementById("setTimerBtn");
  const mainTimerText = document.getElementById("mainTimerText");
  const mainTimerProgress = document.getElementById("mainTimerProgress");
  const focusPercent = document.getElementById("focusPercent");
  const focusProgressBar = document.getElementById("focusProgressBar");
  const startPauseBtn = document.getElementById("startPauseBtn");
  const skipBtn = document.getElementById("skipBtn");
  const resetBtn = document.getElementById("resetBtn");

  if (
    !customMinutes ||
    !setTimerBtn ||
    !mainTimerText ||
    !mainTimerProgress ||
    !focusPercent ||
    !focusProgressBar ||
    !startPauseBtn ||
    !skipBtn ||
    !resetBtn
  ) {
    return;
  }

  let totalSeconds = 15 * 60;
  let remainingSeconds = totalSeconds;
  let timerInterval = null;
  let isRunning = false;
  const circleLength = 785;

  mainTimerProgress.style.strokeDasharray = circleLength;
  mainTimerProgress.style.strokeDashoffset = 0;

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function updateDisplay() {
    mainTimerText.textContent = formatTime(remainingSeconds);

    const completedSeconds = totalSeconds - remainingSeconds;
    const progress = completedSeconds / totalSeconds;
    const percent = Math.floor(progress * 100);

    mainTimerProgress.style.strokeDashoffset = circleLength * progress;
    focusPercent.textContent = percent + "% Complete";
    focusProgressBar.style.width = percent + "%";
  }

  function clearTimerState() {
    localStorage.removeItem("lectorioEndTime");
    localStorage.removeItem("lectorioTotalSeconds");
    localStorage.removeItem("lectorioRemainingSeconds");
    localStorage.removeItem("lectorioIsRunning");
  }

  function loadTimerState() {
    const savedTotal = localStorage.getItem("lectorioTotalSeconds");
    const savedRemaining = localStorage.getItem("lectorioRemainingSeconds");
    const savedRunning = localStorage.getItem("lectorioIsRunning");
    const savedEndTime = localStorage.getItem("lectorioEndTime");

    if (savedTotal) totalSeconds = Number(savedTotal);
    if (savedRemaining) remainingSeconds = Number(savedRemaining);

    if (savedRunning === "true" && savedEndTime) {
      remainingSeconds = Math.ceil((Number(savedEndTime) - Date.now()) / 1000);

      if (remainingSeconds > 0) {
        isRunning = true;
        startPauseBtn.textContent = "Pause";
        startTimer();
      } else {
        remainingSeconds = 0;
        isRunning = false;
        startPauseBtn.textContent = "Play";
        clearTimerState();
      }
    }

    customMinutes.value = Math.ceil(totalSeconds / 60);
    updateDisplay();
  }

  function startTimer() {
    clearInterval(timerInterval);

    isRunning = true;
    startPauseBtn.textContent = "Pause";

    const endTime = Date.now() + remainingSeconds * 1000;

    localStorage.setItem("lectorioEndTime", endTime);
    localStorage.setItem("lectorioTotalSeconds", totalSeconds);
    localStorage.setItem("lectorioIsRunning", true);

    timerInterval = setInterval(function () {
      const savedEndTime = Number(localStorage.getItem("lectorioEndTime"));
      remainingSeconds = Math.ceil((savedEndTime - Date.now()) / 1000);

      if (remainingSeconds > 0) {
        localStorage.setItem("lectorioRemainingSeconds", remainingSeconds);
        updateDisplay();
      } else {
        remainingSeconds = 0;
        isRunning = false;
        clearInterval(timerInterval);
        clearTimerState();
        startPauseBtn.textContent = "Play";
        updateDisplay();
        mainTimerText.textContent = "Done!";
      }
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    startPauseBtn.textContent = "Play";

    localStorage.removeItem("lectorioEndTime");
    localStorage.setItem("lectorioRemainingSeconds", remainingSeconds);
    localStorage.setItem("lectorioTotalSeconds", totalSeconds);
    localStorage.setItem("lectorioIsRunning", false);
  }

  setTimerBtn.addEventListener("click", function () {
    const minutes = Number(customMinutes.value);

    if (minutes <= 0) {
      mainTimerText.textContent = "Invalid";
      return;
    }

    clearInterval(timerInterval);
    clearTimerState();

    totalSeconds = minutes * 60;
    remainingSeconds = totalSeconds;
    isRunning = false;

    startPauseBtn.textContent = "Play";
    updateDisplay();
  });

  startPauseBtn.addEventListener("click", function () {
    isRunning ? pauseTimer() : startTimer();
  });

  resetBtn.addEventListener("click", function () {
    clearInterval(timerInterval);
    clearTimerState();

    remainingSeconds = totalSeconds;
    isRunning = false;

    startPauseBtn.textContent = "Play";
    updateDisplay();
  });

  skipBtn.addEventListener("click", function () {
    clearInterval(timerInterval);
    clearTimerState();

    remainingSeconds = 0;
    isRunning = false;

    startPauseBtn.textContent = "Play";
    updateDisplay();
    mainTimerText.textContent = "Done!";
  });

  loadTimerState();
});

// =====================
// FILE UPLOAD
// =====================

const lectureFile = document.getElementById("lectureFile");
const browseFileBtn = document.getElementById("browseFileBtn");
const selectedFileName = document.getElementById("selectedFileName");
const changeFileBtn = document.getElementById("changeFileBtn");

if (lectureFile && browseFileBtn && selectedFileName && changeFileBtn) {
  browseFileBtn.addEventListener("click", function () {
    lectureFile.click();
  });

  changeFileBtn.addEventListener("click", function () {
    lectureFile.click();
  });

  lectureFile.addEventListener("change", function () {
    if (lectureFile.files.length > 0) {
      selectedFileName.textContent = "Selected: " + lectureFile.files[0].name;
      selectedFileName.classList.remove("text-slate-500");
      selectedFileName.classList.add("text-emerald-600", "font-medium");

      browseFileBtn.classList.add("hidden");
      changeFileBtn.classList.remove("hidden");
    }
  });
}

// =====================
// PLAN PARAMETER SLIDERS
// =====================

const daysRange = document.getElementById("daysRange");
const daysValue = document.getElementById("daysValue");
const studyRange = document.getElementById("studyRange");
const studyValue = document.getElementById("studyValue");
const breakRange = document.getElementById("breakRange");
const breakValue = document.getElementById("breakValue");

if (daysRange && daysValue) {
  daysValue.textContent = daysRange.value;
  daysRange.addEventListener("input", function () {
    daysValue.textContent = daysRange.value;
  });
}

if (studyRange && studyValue) {
  studyValue.textContent = studyRange.value;
  studyRange.addEventListener("input", function () {
    studyValue.textContent = studyRange.value;
  });
}

if (breakRange && breakValue) {
  breakValue.textContent = breakRange.value;
  breakRange.addEventListener("input", function () {
    breakValue.textContent = breakRange.value;
  });
}

// =====================
// GENERATE PLAN
// =====================

const lectureNotes = document.getElementById("lectureNotes");
const generatePlanBtn = document.getElementById("generatePlanBtn");

async function saveNewPlan() {
  let fileName = "No file uploaded";

  if (lectureFile && lectureFile.files.length > 0) {
    fileName = lectureFile.files[0].name;
  }

  const notes = lectureNotes ? lectureNotes.value : "";
  const formData = new FormData();

  formData.append(
    "title",
    fileName !== "No file uploaded" ? fileName : "Pasted Lecture Notes"
  );
  formData.append("fileName", fileName);
  formData.append("notes", notes);
  formData.append("days", daysRange.value);
  formData.append("studyTime", studyRange.value);
  formData.append("breakTime", breakRange.value);

  if (lectureFile && lectureFile.files.length > 0) {
    formData.append("lectureFile", lectureFile.files[0]);
  }

  try {
    generatePlanBtn.textContent = "Generating Plan...";
    generatePlanBtn.disabled = true;

    const response = await fetch(API_BASE_URL + "/plans", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("lectorioToken")
      },
      body: formData
    });

    const savedPlan = await response.json();

    if (!response.ok) {
      throw new Error(savedPlan.message || "Could not generate plan");
    }

    localStorage.setItem("selectedPlanId", savedPlan._id);
    window.location.href = "plan-detail.html";
  } catch (error) {
    console.log(error);
    alert(error.message || "Could not generate plan.");
    generatePlanBtn.textContent = "Generate My Plan";
    generatePlanBtn.disabled = false;
  }
}

if (generatePlanBtn) {
  generatePlanBtn.addEventListener("click", function () {
    let fileName = "No file uploaded";

    if (lectureFile && lectureFile.files.length > 0) {
      fileName = lectureFile.files[0].name;
    }

    const notes = lectureNotes ? lectureNotes.value : "";

    if (fileName === "No file uploaded" && notes.trim() === "") {
      alert("Please upload a file or paste lecture notes first.");
      return;
    }

    const wordCount = notes.trim().split(/\s+/).filter(Boolean).length;
    const estimatedStudyMinutes = Math.ceil(wordCount / 50);
    const selectedDays = Number(daysRange.value);
    const selectedStudyTime = Number(studyRange.value);
    const selectedStudyMinutes = selectedDays * selectedStudyTime;

    const studyWarningModal = document.getElementById("studyWarningModal");
    const warningMessage = document.getElementById("warningMessage");
    const cancelPlanBtn = document.getElementById("cancelPlanBtn");
    const continuePlanBtn = document.getElementById("continuePlanBtn");

    if (
      notes.trim() !== "" &&
      estimatedStudyMinutes > selectedStudyMinutes &&
      studyWarningModal &&
      warningMessage &&
      cancelPlanBtn &&
      continuePlanBtn
    ) {
      const recommendedDays = Math.ceil(estimatedStudyMinutes / selectedStudyTime);

      warningMessage.textContent =
        "Your notes contain approximately " +
        wordCount +
        " words. Estimated study time is around " +
        estimatedStudyMinutes +
        " minutes. With your current settings, we recommend approximately " +
        recommendedDays +
        " days.";

      studyWarningModal.classList.remove("hidden");

      cancelPlanBtn.onclick = function () {
        studyWarningModal.classList.add("hidden");
      };

      continuePlanBtn.onclick = function () {
        studyWarningModal.classList.add("hidden");
        saveNewPlan();
      };

      return;
    }

    saveNewPlan();
  });
}

// =====================
// MY PLANS PAGE
// =====================

const plansListContainer = document.getElementById("plansListContainer");

async function loadPlansPage() {
  if (!plansListContainer) return;

  try {
    plansListContainer.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
        <p class="text-slate-500">Loading your study plans...</p>
      </div>
    `;

    const allPlans = await apiRequest("/plans");

    plansListContainer.innerHTML = "";

    if (allPlans.length === 0) {
      plansListContainer.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <h3 class="text-2xl font-bold text-slate-900">No study plans yet</h3>
          <p class="mt-3 text-slate-500">
            Create your first AI study plan and start organizing your lectures.
          </p>
          <a href="new-plan.html" class="inline-block mt-6 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold">
            + Create New Plan
          </a>
        </div>
      `;
      return;
    }

    allPlans.forEach(function (plan) {
      const planId = getPlanId(plan);
      const completedDays = getCompletedDays(plan);

      plansListContainer.innerHTML += `
        <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-2xl mb-5">
            DOC
          </div>

          <h3 class="text-xl font-bold text-slate-900">${escapeHtml(plan.title)}</h3>

          <p class="mt-2 text-slate-500">
            Generated on ${formatPlanDate(plan.createdAt)} - ${plan.days} days - ${plan.studyTime} min study - ${plan.breakTime} min break
          </p>

          <p class="mt-3 text-sm font-semibold text-indigo-600">
            Progress: ${completedDays.length}/${plan.days}
          </p>

          <div class="mt-5 flex gap-3">
            <button
              data-plan-id="${planId}"
              class="openPlanBtn bg-indigo-500 text-white px-5 py-3 rounded-xl text-sm font-semibold">
              View Plan
            </button>

            <button
              data-plan-id="${planId}"
              class="deletePlanBtn bg-red-100 text-red-600 px-5 py-3 rounded-xl text-sm font-semibold">
              Delete
            </button>
          </div>
        </div>
      `;
    });
  } catch (error) {
    console.log(error);
    plansListContainer.innerHTML = `
      <div class="bg-white border border-red-200 rounded-2xl p-10 text-center shadow-sm">
        <h3 class="text-2xl font-bold text-red-600">Could not load plans</h3>
        <p class="mt-3 text-slate-500">Please check that your backend is running.</p>
      </div>
    `;
  }
}

loadPlansPage();

// =====================
// PLAN DETAIL PAGE
// =====================

const planTitle = document.getElementById("planTitle");
const planInfo = document.getElementById("planInfo");
const generatedPlanContainer = document.getElementById("generatedPlanContainer");

const courseCoverageText = document.getElementById("courseCoverageText");
const courseCoverageBar = document.getElementById("courseCoverageBar");
const sessionCount = document.getElementById("sessionCount");
const focusHours = document.getElementById("focusHours");
const planProgressText = document.getElementById("planProgressText");

async function loadPlanDetailPage() {
  if (!planTitle && !generatedPlanContainer) return;

  const selectedPlanId = localStorage.getItem("selectedPlanId");

  if (!selectedPlanId) {
    if (planTitle) planTitle.textContent = "No Plan Selected";
    if (planInfo) planInfo.textContent = "Please open a plan from My Plans.";
    return;
  }

  try {
    const selectedPlan = await apiRequest("/plans/" + selectedPlanId);

    const completedDays = getCompletedDays(selectedPlan);
    const completedCount = completedDays.length;
    const totalDays = Number(selectedPlan.days);
    const percentage = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

    if (planTitle) {
      planTitle.textContent = selectedPlan.title;
    }

    if (planInfo) {
      planInfo.textContent =
        "Generated on " +
        formatPlanDate(selectedPlan.createdAt) +
        " - " +
        selectedPlan.days +
        " days - " +
        selectedPlan.studyTime +
        " min study - " +
        selectedPlan.breakTime +
        " min break" +
        (selectedPlan.recommendedDays
          ? " - AI recommendation: " + selectedPlan.recommendedDays + " days"
          : "");
    }

    if (planProgressText) {
      planProgressText.textContent = completedCount + "/" + totalDays + " completed";
    }

    if (courseCoverageText) {
      courseCoverageText.textContent = percentage + "%";
    }

    if (courseCoverageBar) {
      courseCoverageBar.style.width = percentage + "%";
    }

    if (sessionCount) {
      sessionCount.textContent = completedCount + " / " + totalDays;
    }

    if (focusHours) {
      const totalMinutes = completedCount * Number(selectedPlan.studyTime);
      focusHours.textContent = (totalMinutes / 60).toFixed(1) + "h";
    }

    if (generatedPlanContainer) {
      generatedPlanContainer.innerHTML = "";

      const generatedDays = Array.isArray(selectedPlan.generatedPlan)
        ? selectedPlan.generatedPlan
        : [];

      if (generatedDays.length === 0) {
        generatedPlanContainer.innerHTML = `
          <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 class="text-lg font-bold text-slate-900">No generated schedule</h3>
            <p class="mt-2 text-slate-500">
              This older plan does not contain an AI-generated daily schedule.
            </p>
          </div>
        `;
      }

      generatedDays.forEach(function (studyDay) {
        const dayNumber = Number(studyDay.day);
        const isCompleted = completedDays.includes(dayNumber);
        const tasks = Array.isArray(studyDay.tasks) ? studyDay.tasks : [];
        const quiz = Array.isArray(studyDay.quiz) ? studyDay.quiz : [];

        generatedPlanContainer.innerHTML += `
          <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-5">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-slate-900">
                Day ${dayNumber}: ${escapeHtml(studyDay.title || "Study Session")}
              </h3>

              ${
                isCompleted
                  ? `<span class="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full">
                      Completed
                    </span>`
                  : `<span class="bg-slate-100 text-slate-500 text-xs font-semibold px-3 py-1 rounded-full">
                      Not Started
                    </span>`
              }
            </div>

            <p class="mt-2 text-slate-500">
  ${escapeHtml(studyDay.summary || "No summary available.")}
</p>

<div class="mt-4 flex flex-wrap gap-2">
  <span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
    ${Number(studyDay.estimatedMinutes) || selectedPlan.studyTime} minutes
  </span>

  <span class="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold">
    ${selectedPlan.breakTime} minute break
  </span>
</div>

${
  Array.isArray(studyDay.topics) && studyDay.topics.length > 0
    ? `
      <h4 class="mt-5 font-semibold text-slate-900">
        Topics
      </h4>

      <div class="mt-2 flex flex-wrap gap-2">
        ${studyDay.topics
          .map(function (topic) {
            return `
              <span class="bg-violet-50 text-violet-700 border border-violet-200 px-3 py-1 rounded-full text-xs">
                ${escapeHtml(topic)}
              </span>
            `;
          })
          .join("")}
      </div>
    `
    : ""
}

<h4 class="mt-5 font-semibold text-slate-900">Tasks</h4>
            <ul class="mt-2 space-y-2 text-sm text-slate-600">
              ${tasks.map(function (task) {
                return `<li>- ${escapeHtml(task)}</li>`;
              }).join("")}
            </ul>

            <h4 class="mt-5 font-semibold text-slate-900">Quick Quiz</h4>
            <ol class="mt-2 space-y-2 text-sm text-slate-600 list-decimal list-inside">
              ${quiz.map(function (question) {
                return `<li>${escapeHtml(question)}</li>`;
              }).join("")}
            </ol>

            <button
              data-day="${dayNumber}"
              class="startSessionBtn mt-5 bg-indigo-500 text-white px-5 py-3 rounded-xl text-sm font-semibold">
              ${isCompleted ? "Review Session" : "Start Session"}
            </button>
          </div>
        `;
      });
    }
  } catch (error) {
    console.log(error);
    if (planTitle) planTitle.textContent = "Plan Not Found";
    if (planInfo) planInfo.textContent = "Please open a plan from My Plans.";
  }
}

loadPlanDetailPage();

// =====================
// OPEN PLAN / DELETE PLAN / START SESSION
// =====================

document.addEventListener("click", async function (e) {
  if (e.target.classList.contains("openPlanBtn")) {
    localStorage.setItem("selectedPlanId", e.target.dataset.planId);
    window.location.href = "plan-detail.html";
  }

  if (e.target.classList.contains("deletePlanBtn")) {
    const planId = e.target.dataset.planId;
    const confirmDelete = confirm("Are you sure you want to delete this plan?");

    if (!confirmDelete) return;

    try {
      await apiRequest("/plans/" + planId, {
        method: "DELETE"
      });

      location.reload();
    } catch (error) {
      console.log(error);
      alert("Could not delete plan.");
    }
  }

  if (e.target.classList.contains("startSessionBtn")) {
    localStorage.setItem("currentStudyDay", e.target.dataset.day);
    window.location.href = "session.html";
  }
});

// =====================
// SESSION PAGE
// =====================

const sessionDay = document.getElementById("sessionDay");
const sessionLectureTitle = document.getElementById("sessionLectureTitle");
const sessionSummary = document.getElementById("sessionSummary");
const sessionQuizList = document.getElementById("sessionQuizList");

const overallProgressText = document.getElementById("overallProgressText");
const overallProgressBar = document.getElementById("overallProgressBar");

const lecturePages = document.getElementById("lecturePages");
const lectureTopics = document.getElementById("lectureTopics");
const estimatedTime = document.getElementById("estimatedTime");

const todayObjectives = document.getElementById("todayObjectives");
const taskList = document.getElementById("taskList");
const smartTimeline = document.getElementById("smartTimeline");
const weeklyRoadmap = document.getElementById("weeklyRoadmap");

async function loadSessionPage() {
  if (!sessionDay || !sessionLectureTitle) return;

  const selectedPlanId = localStorage.getItem("selectedPlanId");
  const currentDay = Number(
    localStorage.getItem("currentStudyDay") || "1"
  );

  if (!selectedPlanId) {
    sessionDay.textContent = "No study plan selected";
    return;
  }

  try {
    const plan = await apiRequest("/plans/" + selectedPlanId);

    const generatedDays = Array.isArray(plan.generatedPlan)
      ? plan.generatedPlan
      : [];

    const studyDay = generatedDays.find(function (day) {
      return Number(day.day) === currentDay;
    });

    if (!studyDay) {
      throw new Error("This study day was not found");
    }

    const topics = Array.isArray(studyDay.topics)
      ? studyDay.topics
      : [];

    const tasks = Array.isArray(studyDay.tasks)
      ? studyDay.tasks
      : [];

    const quiz = Array.isArray(studyDay.quiz)
      ? studyDay.quiz
      : [];

    const completedDays = Array.isArray(plan.completedDays)
      ? plan.completedDays
      : [];

    const estimatedMinutes =
      Number(studyDay.estimatedMinutes) ||
      Number(plan.studyTime);

    sessionLectureTitle.textContent = studyDay.title;

    sessionDay.textContent =
      "Day " +
      currentDay +
      " of " +
      plan.days +
      " - " +
      plan.title;

    if (sessionSummary) {
      sessionSummary.textContent =
        studyDay.summary || "No summary available.";
    }

    if (lecturePages) {
      lecturePages.textContent =
        Number(plan.wordCount || 0).toLocaleString() + " total words";
    }

    if (lectureTopics) {
      lectureTopics.textContent =
        topics.length + " topics";
    }

    if (estimatedTime) {
      estimatedTime.textContent =
        estimatedMinutes + " minutes";
    }

    const progress =
      plan.days > 0
        ? Math.round(
            (completedDays.length / Number(plan.days)) * 100
          )
        : 0;

    if (overallProgressText) {
      overallProgressText.textContent = progress + "%";
    }

    if (overallProgressBar) {
      overallProgressBar.style.width = progress + "%";
    }

    if (todayObjectives) {
      todayObjectives.innerHTML = topics
        .map(function (topic) {
          return `
            <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div class="text-indigo-500 mb-3">+</div>

              <h4 class="text-sm font-semibold">
                ${escapeHtml(topic)}
              </h4>
            </div>
          `;
        })
        .join("");
    }

    if (taskList) {
      taskList.innerHTML = tasks
        .map(function (task, index) {
          return `
            <label class="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
              <input
                type="checkbox"
                data-task-index="${index}"
                class="sessionTaskCheckbox accent-indigo-500">

              <span>${escapeHtml(task)}</span>
            </label>
          `;
        })
        .join("");
    }

    if (sessionQuizList) {
      sessionQuizList.innerHTML = quiz
        .map(function (question, index) {
          return `
            <div class="bg-white/10 rounded-xl p-3">
              <span class="font-bold">${index + 1}.</span>
              ${escapeHtml(question)}
            </div>
          `;
        })
        .join("");
    }

    if (smartTimeline) {
      smartTimeline.innerHTML = `
        <div class="flex gap-4">
          <div class="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs">
            1
          </div>

          <div>
            <h4 class="text-sm font-bold">Focused Study</h4>
            <p class="text-xs text-slate-500">
              ${estimatedMinutes} minutes
            </p>
          </div>
        </div>

        <div class="flex gap-4">
          <div class="w-8 h-8 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center text-xs">
            B
          </div>

          <div>
            <h4 class="text-sm font-bold">Break</h4>
            <p class="text-xs text-slate-500">
              ${plan.breakTime} minutes
            </p>
          </div>
        </div>
      `;
    }

    if (weeklyRoadmap) {
      weeklyRoadmap.innerHTML = "";

      for (let day = 1; day <= Number(plan.days); day++) {
        const isCurrent = day === currentDay;
        const isCompleted = completedDays.includes(day);

        let circleClasses =
          "bg-slate-200 text-slate-500";

        if (isCompleted) {
          circleClasses =
            "bg-emerald-500 text-white";
        } else if (isCurrent) {
          circleClasses =
            "bg-indigo-500 text-white";
        }

        weeklyRoadmap.innerHTML += `
          <div class="text-center">
            <div class="w-10 h-10 ${circleClasses} rounded-full flex items-center justify-center mx-auto font-bold">
              ${isCompleted ? "OK" : day}
            </div>

            <p class="text-xs mt-2">
              ${isCurrent ? "Today" : "Day " + day}
            </p>
          </div>
        `;
      }
    }

    studySeconds = estimatedMinutes * 60;
    breakSeconds = Number(plan.breakTime) * 60;
    sessionSeconds = studySeconds;

    updateMiniTimer();
  } catch (error) {
    console.log(error);
    sessionDay.textContent =
      error.message || "Could not load this session";
  }
}

loadSessionPage();

// =====================
// MARK DAY COMPLETE
// =====================

const markCompleteBtn = document.getElementById("markCompleteBtn");

if (markCompleteBtn) {
  markCompleteBtn.addEventListener("click", async function () {
    const selectedPlanId = localStorage.getItem("selectedPlanId");
    const currentDay = Number(localStorage.getItem("currentStudyDay") || "1");

    if (!selectedPlanId) {
      alert("No plan selected.");
      return;
    }

    try {
      await apiRequest("/plans/" + selectedPlanId + "/complete-day", {
        method: "PATCH",
        body: JSON.stringify({ day: currentDay })
      });

      alert("Day " + currentDay + " marked complete!");
      window.location.href = "plan-detail.html";
    } catch (error) {
      console.log(error);
      alert("Could not mark day complete.");
    }
  });
}

// =====================
// SESSION MINI TIMER
// =====================

const nextBlockTime = document.getElementById("nextBlockTime");
const smallStartBtn = document.getElementById("smallStartBtn");

let sessionTimer;
let timerRunning = false;
let timerMode = "study";
let studySeconds = 45 * 60;
let breakSeconds = 10 * 60;
let sessionSeconds = studySeconds;

if (nextBlockTime && smallStartBtn) {
  updateMiniTimer();

  smallStartBtn.addEventListener("click", function () {
    timerRunning ? pauseMiniTimer() : startMiniTimer();
  });
}

function startMiniTimer() {
  clearInterval(sessionTimer);

  sessionTimer = setInterval(function () {
    if (sessionSeconds > 0) {
      sessionSeconds--;
      updateMiniTimer();
    } else {
      clearInterval(sessionTimer);
      timerRunning = false;

      if (smallStartBtn) smallStartBtn.textContent = "Play";

      if (timerMode === "study") {
        startBreakMode();
      } else {
        finishBreakMode();
      }
    }
  }, 1000);

  timerRunning = true;

  if (smallStartBtn) smallStartBtn.textContent = "Pause";
}

function pauseMiniTimer() {
  clearInterval(sessionTimer);
  timerRunning = false;

  if (smallStartBtn) smallStartBtn.textContent = "Play";
}

function startBreakMode() {
  timerMode = "break";
  sessionSeconds = breakSeconds;
  updateMiniTimer();

  showSessionBanner(
    "Study block complete!",
    "Time for a break. Drink water, stretch, rest your eyes, and come back fresh.",
    "bg-emerald-50",
    "text-emerald-700",
    "border-emerald-200"
  );

  startMiniTimer();
}

function finishBreakMode() {
  timerMode = "study";
  sessionSeconds = studySeconds;
  updateMiniTimer();

  showSessionBanner(
    "Break complete!",
    "Welcome back. Your break is over. Start your next focus session when you're ready.",
    "bg-indigo-50",
    "text-indigo-700",
    "border-indigo-200"
  );
}

function updateMiniTimer() {
  if (!nextBlockTime) return;

  const minutes = Math.floor(sessionSeconds / 60);
  const seconds = sessionSeconds % 60;

  nextBlockTime.textContent =
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0");
}

function showSessionBanner(title, message, bgClass, textClass, borderClass) {
  let banner = document.getElementById("sessionBanner");

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "sessionBanner";
    document.body.appendChild(banner);
  }

  banner.className =
    "fixed top-6 right-6 z-50 max-w-sm rounded-2xl border p-5 shadow-lg " +
    bgClass +
    " " +
    textClass +
    " " +
    borderClass;

  banner.innerHTML = `
    <h3 class="font-bold text-lg">${escapeHtml(title)}</h3>
    <p class="mt-2 text-sm leading-relaxed">${escapeHtml(message)}</p>
  `;

  setTimeout(function () {
    banner.remove();
  }, 9000);
}

// =====================
// DASHBOARD
// =====================

const newUserDashboard = document.getElementById("newUserDashboard");
const returningUserDashboard = document.getElementById("returningUserDashboard");
const dashboardPlansList = document.getElementById("dashboardPlansList");
const todaySessionsList = document.getElementById("todaySessionsList");
const plansCreatedCount = document.getElementById("plansCreatedCount");
const totalFocusHours = document.getElementById("totalFocusHours");

async function loadDashboardPage() {
  if (!newUserDashboard || !returningUserDashboard) return;

  try {
    const allPlans = await apiRequest("/plans");

    if (allPlans.length === 0) {
      newUserDashboard.classList.remove("hidden");
      returningUserDashboard.classList.add("hidden");
      return;
    }

    newUserDashboard.classList.add("hidden");
    returningUserDashboard.classList.remove("hidden");

    if (plansCreatedCount) {
      plansCreatedCount.textContent = allPlans.length;
    }

    let completedMinutes = 0;

    allPlans.forEach(function (plan) {
      const completedDays = getCompletedDays(plan);
      completedMinutes += completedDays.length * Number(plan.studyTime);
    });

    if (totalFocusHours) {
      totalFocusHours.textContent = (completedMinutes / 60).toFixed(1) + " hrs";
    }

    if (dashboardPlansList) {
      dashboardPlansList.innerHTML = "";

      allPlans.forEach(function (plan) {
        const planId = getPlanId(plan);
        const completedDays = getCompletedDays(plan);

        dashboardPlansList.innerHTML += `
          <div class="border-b border-slate-100 pb-5">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-semibold text-slate-900">${escapeHtml(plan.title)}</h4>
                <p class="text-sm text-slate-500 mt-1">
                  ${completedDays.length}/${plan.days} sessions completed
                </p>
              </div>

              <button
                data-plan-id="${planId}"
                class="openPlanBtn bg-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full">
                Open
              </button>
            </div>
          </div>
        `;
      });
    }

    if (todaySessionsList && allPlans.length > 0) {
      const firstPlan = allPlans[0];

      todaySessionsList.innerHTML = `
        <div class="flex gap-4">
          <p class="text-sm font-semibold w-16">Today</p>

          <div class="border-l-4 border-indigo-500 pl-4">
            <h4 class="font-semibold text-slate-900">${escapeHtml(firstPlan.title)}</h4>
            <p class="text-sm text-slate-500">
              Focus Block - ${firstPlan.studyTime} mins
            </p>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.log(error);
    newUserDashboard.classList.remove("hidden");
    returningUserDashboard.classList.add("hidden");
  }
}

loadDashboardPage();
