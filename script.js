const DEFAULT_DURATION = 15;
const INITIAL_WORD_COUNT = 36;
const APPEND_WORD_COUNT = 18;
const MAX_RENDERED_WORDS = 220;
const RECENT_WORD_WINDOW = 3;
const MAX_TYPED_LINES = 3;

const APPEND_WHEN_LINES_LEFT = 1;
const TARGET_LINES_AHEAD = 5;
const MAX_APPEND_BATCHES = 12;

const textDisplay = document.getElementById("text-display");
const textTrack = document.getElementById("text-track");

let isLineShifting = false;
let pendingPrune = null;

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

const timeSelector = document.getElementById("time-selector");
const timeHighlight = document.getElementById("time-highlight");
const timeButtons = document.querySelectorAll(".time-btn");

const customTimeModal = document.getElementById("custom-time-modal");
const customTimeInput = document.getElementById("custom-time-input");
const customTimeCancel = document.getElementById("custom-time-cancel");
const customTimeConfirm = document.getElementById("custom-time-confirm");
const stepUp = document.getElementById("step-up");
const stepDown = document.getElementById("step-down");

const MODES = ["dark", "light"];
const ACCENTS = ["green", "pink", "blue", "purple", "peach"];
const SKINS = ["snail", "frog", "bunny", "turtle", "fish", "duck"];

let currentMode = "dark";
let currentAccent = "green";
let currentSkin = "snail";

let selectedDuration = DEFAULT_DURATION;
let chars = [];
let currentIndex = 0;
let correctCount = 0;
let incorrectCount = 0;
let timeLeft = selectedDuration;
let started = false;
let finished = false;
let currentText = "";
let focusMode = false;

let startTime = null;
let animationFrameId = null;
let wiggleFrameId = null;
let timeHighlightFrame = null;

restartBox.addEventListener("click", restartTest);
restartBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        restartTest();
    }
});

function setupDropdown(dropdownId, initialValue, onSelect) {
    const dropdown = document.getElementById(dropdownId);
    const selected = dropdown.querySelector(".dropdown-selected");
    const items = dropdown.querySelectorAll(".dropdown-item");

    selected.textContent = initialValue;

    selected.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllDropdowns(dropdownId);
        dropdown.classList.toggle("open");
    });

    items.forEach((item) => {
        item.addEventListener("click", () => {
            const value = item.dataset.value;
            selected.textContent = item.textContent;
            dropdown.classList.remove("open");
            onSelect(value, item.textContent);
        });
    });
}

function setDropdownValue(dropdownId, value) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const selected = dropdown.querySelector(".dropdown-selected");
    const item = dropdown.querySelector(`.dropdown-item[data-value="${value}"]`);

    if (selected && item) {
        selected.textContent = item.textContent;
    }
}

function closeAllDropdowns(exceptId = null) {
    document.querySelectorAll(".dropdown.open").forEach((dropdown) => {
        if (dropdown.id !== exceptId) {
            dropdown.classList.remove("open");
        }
    });
}

document.addEventListener("click", () => {
    closeAllDropdowns();
});

function getImagePath(skin, mode, accent) {
    return `./images/${skin}/${skin}-${mode}-${accent}.png`;
}

function updateAnimalImage() {
    snailIcon.src = getImagePath(currentSkin, currentMode, currentAccent);
}

function applyAppearance(mode, accent) {
    currentMode = mode;
    currentAccent = accent;

    document.body.classList.remove(...MODES.map((m) => `mode-${m}`));
    document.body.classList.remove(...ACCENTS.map((a) => `accent-${a}`));

    document.body.classList.add(`mode-${mode}`);
    document.body.classList.add(`accent-${accent}`);

    localStorage.setItem("snailtype-mode", mode);
    localStorage.setItem("snailtype-accent", accent);

    updateAnimalImage();
}

function applySkin(skin) {
    currentSkin = skin;
    localStorage.setItem("snailtype-skin", skin);
    updateAnimalImage();
}

function loadPreferences() {
    const savedMode = localStorage.getItem("snailtype-mode") || "dark";
    const savedAccent = localStorage.getItem("snailtype-accent") || "green";
    const savedSkin = localStorage.getItem("snailtype-skin") || "snail";
    const savedFocusMode = localStorage.getItem("snailtype-focus") === "true";

    currentMode = savedMode;
    currentAccent = savedAccent;
    currentSkin = savedSkin;
    focusMode = savedFocusMode;

    if (focusToggle) {
        focusToggle.checked = focusMode;
    }

    setDropdownValue("mode-dropdown", currentMode);
    setDropdownValue("accent-dropdown", currentAccent);
    setDropdownValue("skin-dropdown", currentSkin);

    applyAppearance(currentMode, currentAccent);
    applySkin(currentSkin);
}

function updateTimeHighlight(activeBtn, animate = true) {
    if (!timeSelector || !timeHighlight || !activeBtn) return;

    const selectorRect = timeSelector.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    const left = btnRect.left - selectorRect.left;
    const top = btnRect.top - selectorRect.top;
    const width = btnRect.width;
    const height = btnRect.height;

    if (timeHighlightFrame) {
        cancelAnimationFrame(timeHighlightFrame);
        timeHighlightFrame = null;
    }

    if (!animate) {
        timeHighlight.style.transition = "none";
        timeHighlight.style.width = `${width}px`;
        timeHighlight.style.height = `${height}px`;
        timeHighlight.style.transform = `translate(${left}px, ${top}px) scaleX(1)`;

        requestAnimationFrame(() => {
            timeHighlight.style.transition =
                "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), width 0.34s cubic-bezier(0.22, 1, 0.36, 1), height 0.34s cubic-bezier(0.22, 1, 0.36, 1)";
        });
        return;
    }

    timeHighlight.style.transition =
        "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), width 0.34s cubic-bezier(0.22, 1, 0.36, 1), height 0.34s cubic-bezier(0.22, 1, 0.36, 1)";
    timeHighlight.style.width = `${width}px`;
    timeHighlight.style.height = `${height}px`;
    timeHighlight.style.transform = `translate(${left}px, ${top}px) scaleX(1.08)`;

    timeHighlightFrame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            timeHighlight.style.transform = `translate(${left}px, ${top}px) scaleX(1)`;
            timeHighlightFrame = null;
        });
    });
}

function openCustomTimeModal() {
    customTimeModal.classList.remove("hidden");
    customTimeInput.value = selectedDuration;
    requestAnimationFrame(() => customTimeInput.focus());
    document.body.style.overflow = "hidden";
}

function closeCustomTimeModal() {
    customTimeModal.classList.add("hidden");
    document.body.style.overflow = "";
}

function submitCustomTime() {
    const num = Number(customTimeInput.value);

    if (!Number.isFinite(num) || num <= 0) {
        customTimeInput.focus();
        customTimeInput.select();
        return;
    }

    selectedDuration = Math.round(num);
    const customBtn = document.querySelector('[data-time="custom"]');
    customBtn.textContent = `${selectedDuration}s`;
    setActive(customBtn);

    closeCustomTimeModal();
    restartTest();
}

customTimeCancel.addEventListener("click", closeCustomTimeModal);
customTimeConfirm.addEventListener("click", submitCustomTime);

stepUp.addEventListener("mousedown", (e) => e.preventDefault());
stepDown.addEventListener("mousedown", (e) => e.preventDefault());

stepUp.addEventListener("click", () => {
    const current = Number(customTimeInput.value) || 1;
    customTimeInput.value = current + 1;
    customTimeInput.focus();
});

stepDown.addEventListener("click", () => {
    const current = Number(customTimeInput.value) || 1;
    customTimeInput.value = Math.max(1, current - 1);
    customTimeInput.focus();
});

customTimeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        submitCustomTime();
    }

    if (e.key === "Escape") {
        e.preventDefault();
        closeCustomTimeModal();
    }

    if (e.key === "ArrowUp") {
        e.preventDefault();
        const current = Number(customTimeInput.value) || 1;
        customTimeInput.value = current + 1;
    }

    if (e.key === "ArrowDown") {
        e.preventDefault();
        const current = Number(customTimeInput.value) || 1;
        customTimeInput.value = Math.max(1, current - 1);
    }
});

customTimeModal.addEventListener("click", (e) => {
    if (e.target === customTimeModal) {
        closeCustomTimeModal();
    }
});

function getRandomWord() {
    return wordBank[Math.floor(Math.random() * wordBank.length)];
}

function getRandomWordAvoiding(recentWords = []) {
    if (!Array.isArray(wordBank) || wordBank.length === 0) {
        return "";
    }

    if (wordBank.length === 1) {
        return wordBank[0];
    }

    const blocked = new Set(recentWords.filter(Boolean));
    const availableWords = wordBank.filter((word) => !blocked.has(word));

    if (availableWords.length > 0) {
        return availableWords[Math.floor(Math.random() * availableWords.length)];
    }

    return getRandomWord();
}

function getRecentWordsFromText(text, count = RECENT_WORD_WINDOW) {
    if (!text.trim()) return [];
    return text.trim().split(/\s+/).slice(-count);
}

function generateWords(count = 30, seedRecentWords = []) {
    const words = [];
    const recentWords = [...seedRecentWords].filter(Boolean).slice(-RECENT_WORD_WINDOW);

    for (let i = 0; i < count; i++) {
        const word = getRandomWordAvoiding(recentWords);
        words.push(word);
        recentWords.push(word);

        if (recentWords.length > RECENT_WORD_WINDOW) {
            recentWords.shift();
        }
    }

    return words.join(" ");
}

function getWordBounds(index) {
    if (!currentText.length) return null;
    if (index < 0 || index >= currentText.length) return null;

    let start = index;
    let end = index;

    while (start > 0 && currentText[start - 1] !== " ") {
        start--;
    }

    while (end < currentText.length && currentText[end] !== " ") {
        end++;
    }

    return { start, end };
}

function getLineTopForIndex(index) {
    if (!chars[index]) return null;
    return Math.round(chars[index].offsetTop);
}

function getUniqueLineTopsInRange(startIndex, endIndexExclusive) {
    const tops = [];

    for (let i = startIndex; i < endIndexExclusive; i++) {
        const top = getLineTopForIndex(i);
        if (top === null) continue;

        if (tops.length === 0 || tops[tops.length - 1] !== top) {
            tops.push(top);
        }
    }

    return tops;
}

function getRemainingLinesAhead() {
    if (!chars.length || currentIndex >= chars.length) return 0;

    const currentTop = getLineTopForIndex(currentIndex);
    if (currentTop === null) return 0;

    const aheadTops = getUniqueLineTopsInRange(currentIndex, chars.length);
    return aheadTops.filter((top) => top > currentTop).length;
}

function pruneTypedLines() {
    if (!chars.length || currentIndex <= 0 || isLineShifting) return;

    const typedLineTops = [];

    for (let i = 0; i < currentIndex; i++) {
        const top = getLineTopForIndex(i);
        if (top === null) continue;

        if (typedLineTops.length === 0 || typedLineTops[typedLineTops.length - 1] !== top) {
            typedLineTops.push(top);
        }
    }

    if (typedLineTops.length <= MAX_TYPED_LINES) return;

    const firstKeptLineTop = typedLineTops[typedLineTops.length - MAX_TYPED_LINES];
    let removeCount = 0;

    while (removeCount < currentIndex) {
        const top = getLineTopForIndex(removeCount);
        if (top === null || top >= firstKeptLineTop) break;
        removeCount++;
    }

    if (removeCount <= 0 || !chars[removeCount]) return;

    const shiftAmount = chars[removeCount].offsetTop;
    if (!Number.isFinite(shiftAmount) || shiftAmount <= 0) return;

    isLineShifting = true;
    pendingPrune = { removeCount };

    textTrack.classList.remove("no-transition");
    textTrack.style.transform = `translateY(-${shiftAmount}px)`;

    const onDone = () => {
        textTrack.removeEventListener("transitionend", onDone);

        const { removeCount } = pendingPrune || {};
        pendingPrune = null;

        if (!removeCount) {
            isLineShifting = false;
            return;
        }

        chars.slice(0, removeCount).forEach((el) => el.remove());
        chars = chars.slice(removeCount);
        currentText = currentText.slice(removeCount);
        currentIndex -= removeCount;

        textTrack.classList.add("no-transition");
        textTrack.style.transform = "translateY(0)";

        requestAnimationFrame(() => {
            isLineShifting = false;
            updateCursor();
            updateFocusModeView();
        });
    };

    textTrack.addEventListener("transitionend", onDone, { once: true });
}

function updateFocusModeView() {
    if (!chars.length) return;

    chars.forEach((charEl) => {
        charEl.classList.remove("dimmed", "focus-visible");
    });

    if (!focusMode) return;

    const safeIndex = Math.min(currentIndex, currentText.length - 1);
    if (safeIndex < 0) return;

    const currentWord = getWordBounds(safeIndex);
    if (!currentWord) return;

    let nextWord = null;
    const nextStart = currentWord.end + 1;

    if (nextStart < currentText.length) {
        nextWord = getWordBounds(nextStart);
    }

    chars.forEach((charEl, i) => {
        const isTyped = i < currentIndex;
        const inCurrentWord = i >= currentWord.start && i < currentWord.end;
        const inNextWord = nextWord && i >= nextWord.start && i < nextWord.end;

        if (isTyped || inCurrentWord || inNextWord) {
            charEl.classList.add("focus-visible");
        } else {
            charEl.classList.add("dimmed");
        }
    });
}

function isCharVisibleInFocus(index) {
    if (!focusMode) return true;
    if (!currentText.length) return true;

    const safeIndex = Math.min(currentIndex, currentText.length - 1);
    if (safeIndex < 0) return true;

    const currentWord = getWordBounds(safeIndex);
    if (!currentWord) return true;

    let nextWord = null;
    const nextStart = currentWord.end + 1;

    if (nextStart < currentText.length) {
        nextWord = getWordBounds(nextStart);
    }

    const inCurrentWord = index >= currentWord.start && index < currentWord.end;
    const inNextWord = nextWord && index >= nextWord.start && index < nextWord.end;

    return inCurrentWord || inNextWord;
}

function renderText(text, append = false) {
    if (!append) {
        textTrack.innerHTML = "";
        textTrack.appendChild(caret);
        chars = [];
    }

    const startIndex = chars.length;

    for (const ch of text) {
        const span = document.createElement("span");
        span.textContent = ch;
        span.className = "char";

        span.style.opacity = "0";
        span.style.transform = "translateY(4px)";

        textTrack.appendChild(span);
        chars.push(span);
    }

    updateFocusModeView();

    chars.slice(startIndex).forEach((span, offset) => {
        const charIndex = startIndex + offset;
        const shouldBeVisible = isCharVisibleInFocus(charIndex);

        requestAnimationFrame(() => {
            span.style.transition = "opacity 0.18s ease, transform 0.18s ease";
            span.style.transform = "translateY(0)";
            span.style.opacity = shouldBeVisible ? "1" : "0.08";

            setTimeout(() => {
                span.style.opacity = "";
                span.style.transform = "";
            }, 200);
        });
    });

    updateCursor();
    updateFocusModeView();
    updateSnailProgress();
}

function loadInitialWords() {
    currentText = generateWords(INITIAL_WORD_COUNT);
    renderText(currentText);
}

function appendMoreWords() {
    const currentWordCount = currentText.trim() ? currentText.trim().split(/\s+/).length : 0;

    if (currentWordCount >= MAX_RENDERED_WORDS) {
        return false;
    }

    const remaining = MAX_RENDERED_WORDS - currentWordCount;
    const amountToAdd = Math.min(APPEND_WORD_COUNT, remaining);
    const recentWords = getRecentWordsFromText(currentText, RECENT_WORD_WINDOW);
    const extraWords = generateWords(amountToAdd, recentWords);

    if (!extraWords) {
        return false;
    }

    const extra = currentText ? ` ${extraWords}` : extraWords;
    currentText += extra;
    renderText(extra, true);
    return true;
}

function ensureLineBuffer() {
    if (!chars.length || currentIndex >= chars.length) return;

    let remainingLines = getRemainingLinesAhead();
    if (remainingLines > APPEND_WHEN_LINES_LEFT) return;

    let batches = 0;
    while (
        remainingLines < TARGET_LINES_AHEAD &&
        batches < MAX_APPEND_BATCHES &&
        appendMoreWords()
    ) {
        batches++;
        remainingLines = getRemainingLinesAhead();
    }
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

    const animalWidth = snailIcon.offsetWidth || 32;
    const timerWidth = timerEl ? timerEl.offsetWidth : 40;

    const usableWidth = container.clientWidth - timerWidth - 16;
    const maxLeft = Math.max(usableWidth - animalWidth, 0);

    let progress = 0;

    if (started && startTime !== null) {
        const elapsed = (performance.now() - startTime) / 1000;
        progress = Math.min(elapsed / selectedDuration, 1);
    }

    if (finished) {
        progress = 1;
    }

    const animalLeft = progress * maxLeft;
    snailIcon.style.left = `${animalLeft}px`;
    snailIcon.style.transform = "translateY(-50%)";

    const lineGap = 10;
    const lineStart = animalLeft + animalWidth + lineGap;
    const lineWidth = Math.max(usableWidth - lineStart, 0);

    snailLine.style.left = `${lineStart}px`;
    snailLine.style.width = `${lineWidth}px`;

    const trailStart = 8;
    const trailEndGap = 24;
    const dotSpacing = 26;

    const trailWidth = Math.max(animalLeft - trailStart - trailEndGap, 0);
    const dotCount = Math.floor(trailWidth / dotSpacing);

    snailTrail.style.left = `${trailStart}px`;
    snailTrail.style.width = `${trailWidth}px`;
    snailTrail.textContent = dotCount > 0 ? ". ".repeat(dotCount).trim() : "";
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
    if (!chars.length) {
        caret.style.display = "none";
        return;
    }

    if (finished || currentIndex >= chars.length) {
        caret.style.display = "none";
        return;
    }

    const el = chars[currentIndex];

    const x = el.offsetLeft;
    const y = el.offsetTop;

    caret.style.display = "block";
    caret.style.height = `${el.offsetHeight}px`;
    caret.style.transform = `translate(${x}px, ${y}px)`;
}

function updateCursor() {
    requestAnimationFrame(() => {
        requestAnimationFrame(moveCaret);
    });
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

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            ensureLineBuffer();
            updateFocusModeView();
            updateCursor();
            updateSnailProgress();
        });
    });
}

function setActive(btn, animate = true) {
    timeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updateTimeHighlight(btn, animate);
}

function handleTimeSelection(button) {
    const value = button.dataset.time;

    if (value === "custom") {
        openCustomTimeModal();
        button.blur();
        return;
    }

    selectedDuration = Number(value);
    document.querySelector('[data-time="custom"]').textContent = "custom";
    setActive(button);
    restartTest();
    button.blur();
}

timeButtons.forEach((btn) => {
    btn.addEventListener("click", () => handleTimeSelection(btn));
});

const focusToggle = document.getElementById("focus-toggle");
const focusToggleWrap = document.querySelector(".focus-toggle .toggle");

if (focusToggleWrap && focusToggle) {
    focusToggleWrap.addEventListener("click", (e) => {
        if (e.target === focusToggle) return;
        focusToggle.checked = !focusToggle.checked;
        focusToggle.dispatchEvent(new Event("change", { bubbles: true }));
    });
}

if (focusToggle) {
    focusToggle.addEventListener("change", () => {
        focusMode = focusToggle.checked;
        localStorage.setItem("snailtype-focus", String(focusMode));
        updateFocusModeView();
        updateCursor();
    });
}

window.addEventListener("resize", () => {
    updateCursor();
    updateSnailProgress();

    const activeBtn = document.querySelector(".time-btn.active");
    if (activeBtn) {
        updateTimeHighlight(activeBtn, false);
    }

    requestAnimationFrame(() => {
        ensureLineBuffer();
        updateCursor();
    });
});

window.addEventListener("load", () => {
    setupDropdown("mode-dropdown", currentMode, (value) => {
        applyAppearance(value, currentAccent);
    });

    setupDropdown("accent-dropdown", currentAccent, (value) => {
        applyAppearance(currentMode, value);
    });

    setupDropdown("skin-dropdown", currentSkin, (value) => {
        applySkin(value);
    });

    loadPreferences();
    updateAnimalImage();

    const activeBtn = document.querySelector(".time-btn.active");
    if (activeBtn) {
        updateTimeHighlight(activeBtn, false);
    }

    restartTest();
});

document.addEventListener("keydown", (e) => {
    if (!customTimeModal.classList.contains("hidden")) {
        if (e.key === "Escape") {
            e.preventDefault();
            closeCustomTimeModal();
        }
        return;
    }

    if (e.key === "Enter") {
        e.preventDefault();
        restartTest();
        return;
    }

    if (finished) return;
    if (isLineShifting) return;

    if (e.key === "Backspace") {
        e.preventDefault();

        if (currentIndex > 0) {
            currentIndex--;
            const el = chars[currentIndex];

            if (el.classList.contains("correct")) {
                correctCount--;
            } else if (el.classList.contains("incorrect")) {
                incorrectCount--;
            }

            el.classList.remove("correct", "incorrect");
            updateCursor();
            updateFocusModeView();
        }
        return;
    }

    if (e.key.length !== 1) return;
    if (!chars.length) return;

    e.preventDefault();
    startTimer();

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
    pruneTypedLines();
    ensureLineBuffer();
    updateCursor();
    updateFocusModeView();
});