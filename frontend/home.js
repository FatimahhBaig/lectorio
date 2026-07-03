const timerText = document.getElementById("timerText");
const timerProgress = document.getElementById("timerProgress");

// Timer duration
const totalTime = 15; // 15 seconds

// Circle length
const circleLength = 314;

// Set circle setup
timerProgress.style.strokeDasharray = circleLength;
timerProgress.style.strokeDashoffset = 0;

let startTime = null;

function formatTime(seconds) {
    let minutes = Math.floor(seconds / 60);
    let remainingSeconds = Math.ceil(seconds % 60);

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0")
    );
}

function runTimer(currentTime) {
    if (startTime === null) {
        startTime = currentTime;
    }

    // How much time has passed
    let elapsedTime = (currentTime - startTime) / 1000;

    // How much time is left
    let timeLeft = totalTime - elapsedTime;

    // If timer is finished, restart it
    if (timeLeft <= 0) {
        startTime = currentTime;
        timeLeft = totalTime;
    }

    // Update timer text
    timerText.textContent = formatTime(timeLeft);

    // Calculate progress from 0 to 1
    let progress = elapsedTime / totalTime;

    // If progress becomes more than 1, reset it
    if (progress > 1) {
        progress = 0;
    }

    // Move circle smoothly backwards
    timerProgress.style.strokeDashoffset = circleLength * progress;

    // Keep running animation
    requestAnimationFrame(runTimer);
}

// Start timer
requestAnimationFrame(runTimer);
