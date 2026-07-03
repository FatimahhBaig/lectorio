const timerCurrentTopic = document.getElementById("timerCurrentTopic");
const selectedTimerTopic = localStorage.getItem("selectedTopic");

if (timerCurrentTopic) {
  timerCurrentTopic.textContent = selectedTimerTopic
    ? "Current Topic: " + selectedTimerTopic
    : "Current Topic: General Focus Session";
}
