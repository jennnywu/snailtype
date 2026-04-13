const DEFAULT_DURATION = 15;

const textDisplay = document.getElementById("text-display");
const caret = document.getElementById("caret");
const timeEl = document.getElementById("time");
const hintEl = document.querySelector(".hint");

const snailIcon = document.getElementById("snail-icon");
const snailLine = document.getElementById("snail-line");
const snailTrail = document.getElementById("snail-trail");

const restartBox = document.getElementById("restart-box");
const resultScreen = document.getElementById("result-screen");

const finalWpmEl = document.getElementById("final-wpm");
const finalAccuracyEl = document.getElementById("final-accuracy");
const finalTimeEl = document.getElementById("final-time");
const finalCharsEl = document.getElementById("final-chars");

const timeButtons = document.querySelectorAll(".time-btn");

const modeSelect = document.getElementById("mode-select");
const accentSelect = document.getElementById("accent-select");
const skinSelect = document.getElementById("skin-select");

const MODES = ["dark", "light"];
const ACCENTS = ["green", "pink", "blue", "purple", "peach"];

let selectedDuration = DEFAULT_DURATION;
let chars = [];
let currentIndex = 0;
let correctCount = 0;
let incorrectCount = 0;
let timeLeft = selectedDuration;
let started = false;
let finished = false;
let currentText = "";

let startTime = null;
let animationFrameId = null;
let wiggleFrameId = null;

restartBox.addEventListener("click", restartTest);

restartBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        restartTest();
    }
});

function getSnailImagePath(mode, accent) {
    return `snail-${mode}-${accent}.png`;
}

function getCurrentMode() {
    return modeSelect.value || "dark";
}

function getCurrentAccent() {
    return accentSelect.value || "green";
}

function updateSnailImage() {
    const mode = getCurrentMode();
    const accent = getCurrentAccent();
    snailIcon.src = getSnailImagePath(mode, accent);
}

function applyAppearance(mode, accent) {
    document.body.classList.remove(...MODES.map(m => `mode-${m}`));
    document.body.classList.remove(...ACCENTS.map(a => `accent-${a}`));

    document.body.classList.add(`mode-${mode}`);
    document.body.classList.add(`accent-${accent}`);

    localStorage.setItem("snailtype-mode", mode);
    localStorage.setItem("snailtype-accent", accent);

    updateSnailImage();
}

function loadPreferences() {
    const savedMode = localStorage.getItem("snailtype-mode") || "dark";
    const savedAccent = localStorage.getItem("snailtype-accent") || "green";

    modeSelect.value = savedMode;
    accentSelect.value = savedAccent;

    if (skinSelect) {
        skinSelect.value = savedAccent;
    }

    applyAppearance(savedMode, savedAccent);
}

function getRandomWord() {
    return wordBank[Math.floor(Math.random() * wordBank.length)];
}

function generateWords(count = 30) {
    const words = [];
    for (let i = 0; i < count; i++) {
        words.push(getRandomWord());
    }
    return words.join(" ");
}

function renderText(text, append = false) {
    if (!append) {
        textDisplay.innerHTML = "";
        textDisplay.appendChild(caret);
        chars = [];
    }

    for (const ch of text) {
        const span = document.createElement("span");
        span.textContent = ch;
        span.className = "char";
        textDisplay.appendChild(span);
        chars.push(span);
    }

    updateCursor();
    updateSnailProgress();
}

function loadInitialWords() {
    currentText = generateWords(40);
    renderText(currentText);
}

function appendMoreWords() {
    const extra = " " + generateWords(20);
    currentText += extra;
    renderText(extra, true);
}

function startTimer() {
    if (started) return;

    started = true;
    startTime = performance.now();

    function tick(now) {
        if (finished) return;

        const elapsed = (now - startTime) / 1000;
        timeLeft = Math.max(selectedDuration - elapsed, 0);

        timeEl.textContent = Math.ceil(timeLeft);
        updateSnailProgress();

        if (timeLeft <= 0) {
            endTest();
            return;
        }

        animationFrameId = requestAnimationFrame(tick);
    }

    animationFrameId = requestAnimationFrame(tick);
}

function updateSnailProgress() {
    if (!snailIcon || !snailLine || !snailTrail) return;

    const container = document.querySelector(".snail-progress");
    const timerEl = document.querySelector(".progress-timer");
    if (!container) return;

    const snailWidth = snailIcon.offsetWidth || 32;
    const timerWidth = timerEl ? timerEl.offsetWidth : 40;

    const usableWidth = container.clientWidth - timerWidth - 16;
    const maxLeft = Math.max(usableWidth - snailWidth, 0);

    let progress = 0;

    if (started && startTime !== null) {
        const elapsed = (performance.now() - startTime) / 1000;
        progress = Math.min(elapsed / selectedDuration, 1);
    }

    if (finished) {
        progress = 1;
    }

    const snailLeft = progress * maxLeft;
    snailIcon.style.left = `${snailLeft}px`;
    snailIcon.style.transform = "translateY(-50%)";

    const lineGap = 10;
    const lineStart = snailLeft + snailWidth + lineGap;
    const lineWidth = Math.max(usableWidth - lineStart, 0);

    snailLine.style.left = `${lineStart}px`;
    snailLine.style.width = `${lineWidth}px`;

    const trailStart = 8;
    const trailEndGap = 24;
    const dotSpacing = 26;

    const trailWidth = Math.max(snailLeft - trailStart - trailEndGap, 0);
    const dotCount = Math.floor(trailWidth / dotSpacing);

    snailTrail.style.left = `${trailStart}px`;
    snailTrail.style.width = `${trailWidth}px`;
    snailTrail.textContent = dotCount > 0
        ? ". ".repeat(dotCount).trim()
        : "";
}

function playHappyWiggle() {
    if (!snailIcon) return;

    if (wiggleFrameId) {
        cancelAnimationFrame(wiggleFrameId);
        wiggleFrameId = null;
    }

    const wiggleStart = performance.now();
    const wiggleDuration = 1200;

    function wiggle(now) {
        const elapsed = now - wiggleStart;
        const progress = Math.min(elapsed / wiggleDuration, 1);

        const damping = 1 - progress;
        const angle = Math.sin(progress * Math.PI * 8) * 10 * damping;
        const bounceY = Math.abs(Math.sin(progress * Math.PI * 6)) * -6 * damping;
        const scaleX = 1 + 0.05 * damping;
        const scaleY = 1 - 0.04 * damping;

        snailIcon.style.transform =
            `translateY(calc(-50% + ${bounceY}px)) rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;

        if (progress < 1) {
            wiggleFrameId = requestAnimationFrame(wiggle);
        } else {
            snailIcon.style.transform = "translateY(-50%) rotate(0deg) scale(1, 1)";
            wiggleFrameId = null;
        }
    }

    wiggleFrameId = requestAnimationFrame(wiggle);
}

function moveCaret() {
    if (finished || currentIndex >= chars.length) {
        caret.style.display = "none";
        return;
    }

    const rect = chars[currentIndex].getBoundingClientRect();
    const container = textDisplay.getBoundingClientRect();

    const x = rect.left - container.left;
    const y = rect.top - container.top;

    caret.style.display = "block";
    caret.style.height = `${rect.height}px`;
    caret.style.transform = `translate(${x}px, ${y}px)`;
}

function updateCursor() {
    requestAnimationFrame(moveCaret);
}

function calculateResults() {
    const total = correctCount + incorrectCount;
    const minutes = selectedDuration / 60;

    const grossWpm = (total / 5) / minutes;
    const penalty = (incorrectCount / 5) / minutes;
    const wpm = Math.max(0, Math.round(grossWpm - penalty));
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 100;

    return { wpm, accuracy };
}

function endTest() {
    finished = true;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    hintEl.style.display = "none";
    restartBox.classList.remove("hidden");

    caret.style.display = "none";
    textDisplay.style.display = "none";

    const results = calculateResults();

    finalWpmEl.textContent = results.wpm;
    finalAccuracyEl.textContent = results.accuracy;

    const total = correctCount + incorrectCount;
    finalCharsEl.textContent = `${correctCount}/${total}`;
    finalTimeEl.textContent = selectedDuration;

    resultScreen.classList.remove("hidden");
    updateSnailProgress();
    playHappyWiggle();
}

function restartTest() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (wiggleFrameId) {
        cancelAnimationFrame(wiggleFrameId);
        wiggleFrameId = null;
    }

    chars = [];
    currentIndex = 0;
    correctCount = 0;
    incorrectCount = 0;
    timeLeft = selectedDuration;
    started = false;
    finished = false;
    currentText = "";
    startTime = null;

    snailTrail.textContent = "";
    snailIcon.style.transform = "translateY(-50%) rotate(0deg) scale(1, 1)";

    hintEl.style.display = "block";
    restartBox.classList.add("hidden");

    timeEl.textContent = timeLeft;
    textDisplay.style.display = "block";
    resultScreen.classList.add("hidden");
    caret.style.display = "block";

    loadInitialWords();
    updateSnailProgress();
}

function setActive(btn) {
    timeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
}

function handleTimeSelection(button) {
    const value = button.dataset.time;

    if (value === "custom") {
        const input = prompt("Enter test duration in seconds:", selectedDuration);
        if (!input) return;

        const num = Number(input);
        if (!Number.isFinite(num) || num <= 0) return;

        selectedDuration = Math.round(num);
        button.textContent = `${selectedDuration}s`;
    } else {
        selectedDuration = Number(value);
        document.querySelector('[data-time="custom"]').textContent = "custom";
    }

    setActive(button);
    restartTest();
    button.blur();
}

timeButtons.forEach(btn =>
    btn.addEventListener("click", () => handleTimeSelection(btn))
);

modeSelect.addEventListener("change", () => {
    applyAppearance(modeSelect.value, accentSelect.value);
});

accentSelect.addEventListener("change", () => {
    applyAppearance(modeSelect.value, accentSelect.value);
});

if (skinSelect) {
    skinSelect.addEventListener("change", () => {
        skinSelect.value = accentSelect.value;
    });
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        restartTest();
        return;
    }

    if (finished) return;

    if (e.key === "Backspace") {
        e.preventDefault();

        if (currentIndex > 0) {
            currentIndex--;
            const el = chars[currentIndex];

            if (el.classList.contains("correct")) correctCount--;
            else if (el.classList.contains("incorrect")) incorrectCount--;

            el.classList.remove("correct", "incorrect");
            updateCursor();
        }
        return;
    }

    if (e.key.length !== 1) return;

    startTimer();

    if (currentIndex >= chars.length - 20) appendMoreWords();
    if (currentIndex >= chars.length) return;

    const expected = currentText[currentIndex];
    const el = chars[currentIndex];

    if (e.key === expected) {
        el.classList.add("correct");
        correctCount++;
    } else {
        el.classList.add("incorrect");
        incorrectCount++;
    }

    currentIndex++;
    updateCursor();
});

window.addEventListener("resize", () => {
    updateCursor();
    updateSnailProgress();
});

window.addEventListener("load", () => {
    loadPreferences();
    updateSnailImage();
    updateCursor();
    updateSnailProgress();
});

restartTest();