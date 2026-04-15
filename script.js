const DEFAULT_DURATION = 15;
const INITIAL_WORD_COUNT = 50;
const APPEND_WORD_COUNT = 18;
const MAX_RENDERED_WORDS = 220;
const RECENT_WORD_WINDOW = 3;
const MAX_TYPED_LINES = 3;

const APPEND_WHEN_LINES_LEFT = 1;
const TARGET_LINES_AHEAD = 3;
const MAX_APPEND_BATCHES = 12;

const INITIAL_PI_CHUNK_LENGTH = 120;
const APPEND_PI_CHUNK_LENGTH = 60;

const textDisplay = document.getElementById("text-display");
const textTrack = document.getElementById("text-track");

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

const focusToggle = document.getElementById("focus-toggle");
const focusToggleWrap = document.querySelector(".focus-toggle .toggle");

const MODES = ["dark", "light"];
const ACCENTS = ["green", "pink", "blue", "purple", "peach"];

let isLineShifting = false;
let pendingPrune = null;

let currentMode = "dark";
let currentAccent = "green";
let currentSkin = "snail";
let currentContentMode = "words";

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

let piGen = null;
let piStarted = false;

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

    setDropdownValue(dropdownId, initialValue);

    selected.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllDropdowns(dropdownId);
        dropdown.classList.toggle("open");
    });

    items.forEach((item) => {
        item.addEventListener("click", () => {
            const value = item.dataset.value;
            setDropdownValue(dropdownId, value);
            dropdown.classList.remove("open");
            onSelect(value, item.textContent);
        });
    });
}

function setDropdownValue(dropdownId, value) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const selected = dropdown.querySelector(".dropdown-selected");
    const items = dropdown.querySelectorAll(".dropdown-item");
    const item = dropdown.querySelector(`.dropdown-item[data-value="${value}"]`);

    items.forEach((i) => i.classList.remove("active"));

    if (selected && item) {
        selected.textContent = item.textContent;
        item.classList.add("active");
    }
}

function closeAllDropdowns(exceptId = null) {
    document.querySelectorAll(".dropdown.open").forEach((dropdown) => {
        if (dropdown.id !== exceptId) {
            dropdown.classList.remove("open");
        }
    });
}

document.addEventListener("click", () => closeAllDropdowns());

function getImagePath(skin, mode, accent) {
    return `./images/${skin}/${skin}-${mode}-${accent}.png`;
}

function updateAnimalImage() {
    snailIcon.src = getImagePath(currentSkin, currentMode, currentAccent);

    if (["bunny", "turtle", "fish"].includes(currentSkin)) {
        snailIcon.style.transform = "translateY(-50%) scale(1.15)";
    } else {
        snailIcon.style.transform = "translateY(-50%) scale(1)";
    }
}

function applyAppearance(mode, accent) {
    currentMode = mode;
    currentAccent = accent;

    document.body.classList.remove(...MODES.map((m) => `mode-${m}`));
    document.body.classList.remove(...ACCENTS.map((a) => `accent-${a}`));
    document.body.classList.add(`mode-${mode}`, `accent-${accent}`);

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
    currentMode = localStorage.getItem("snailtype-mode") || "dark";
    currentAccent = localStorage.getItem("snailtype-accent") || "green";
    currentSkin = localStorage.getItem("snailtype-skin") || "snail";
    currentContentMode = localStorage.getItem("snailtype-content-mode") || "words";
    focusMode = localStorage.getItem("snailtype-focus") === "true";

    if (focusToggle) {
        focusToggle.checked = focusMode;
    }

    setDropdownValue("mode-dropdown", currentMode);
    setDropdownValue("accent-dropdown", currentAccent);
    setDropdownValue("skin-dropdown", currentSkin);
    setDropdownValue("content-dropdown", currentContentMode);

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
    const transition = "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), width 0.34s cubic-bezier(0.22, 1, 0.36, 1), height 0.34s cubic-bezier(0.22, 1, 0.36, 1)";

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
            timeHighlight.style.transition = transition;
        });
        return;
    }

    timeHighlight.style.transition = transition;
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
    customTimeInput.value = "";
    requestAnimationFrame(() => customTimeInput.focus());
    document.body.style.overflow = "hidden";
}

function closeCustomTimeModal() {
    customTimeModal.classList.add("hidden");
    document.body.style.overflow = "";
}

function bumpCustomTime(direction) {
    if (customTimeInput.value === "") {
        if (direction > 0) {
            customTimeInput.value = 1;
        }
        return;
    }

    const current = Number(customTimeInput.value);
    customTimeInput.value = direction > 0
        ? current + 1
        : Math.max(1, current - 1);
}

function triggerCustomTimeShake() {
    customTimeInput.classList.add("shake");
    setTimeout(() => {
        customTimeInput.classList.remove("shake");
    }, 300);
}

function submitCustomTime() {
    const num = Number(customTimeInput.value);

    if (!Number.isFinite(num) || num <= 0) {
        customTimeInput.value = "";
        customTimeInput.focus();
        triggerCustomTimeShake();
        return;
    }

    selectedDuration = Math.round(num);

    const presetBtn = document.querySelector(`.time-btn[data-time="${selectedDuration}"]`);
    const customBtn = document.querySelector('.time-btn[data-time="custom"]');

    if (presetBtn) {
        customBtn.textContent = "custom";
        setActive(presetBtn);
    } else {
        customBtn.textContent = `${selectedDuration}`;
        setActive(customBtn);
    }

    closeCustomTimeModal();
    restartTest();
}

customTimeCancel.addEventListener("click", closeCustomTimeModal);
customTimeConfirm.addEventListener("click", submitCustomTime);

stepUp.addEventListener("mousedown", (e) => e.preventDefault());
stepDown.addEventListener("mousedown", (e) => e.preventDefault());

stepUp.addEventListener("click", () => {
    bumpCustomTime(1);
    customTimeInput.focus();
});

stepDown.addEventListener("click", () => {
    bumpCustomTime(-1);
    customTimeInput.focus();
});

customTimeInput.addEventListener("input", () => {
    customTimeInput.value = customTimeInput.value.replace(/[^0-9]/g, "");
});

customTimeInput.addEventListener("wheel", (e) => {
    e.preventDefault();
    bumpCustomTime(e.deltaY < 0 ? 1 : -1);
});

customTimeInput.addEventListener("keydown", (e) => {
    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];

    if (e.key === "Enter") {
        e.preventDefault();
        submitCustomTime();
        return;
    }

    if (e.key === "Escape") {
        e.preventDefault();
        closeCustomTimeModal();
        return;
    }

    if (e.key === "ArrowUp") {
        e.preventDefault();
        bumpCustomTime(1);
        return;
    }

    if (e.key === "ArrowDown") {
        e.preventDefault();
        bumpCustomTime(-1);
        return;
    }

    if (allowedKeys.includes(e.key)) return;
    if (!/^[0-9]$/.test(e.key)) {
        e.preventDefault();
    }
});

customTimeModal.addEventListener("click", (e) => {
    if (e.target === customTimeModal) {
        closeCustomTimeModal();
    }
});

function* piGenerator() {
    let q = 1n, r = 0n, t = 1n, k = 1n, n = 3n, l = 3n;

    while (true) {
        if (4n * q + r - t < n * t) {
            yield Number(n);

            const nr = 10n * (r - n * t);
            n = ((10n * (3n * q + r)) / t) - 10n * n;
            q *= 10n;
            r = nr;
        } else {
            const nr = (2n * q + r) * l;
            const nn = (q * (7n * k) + 2n + r * l) / (t * l);
            q *= k;
            t *= l;
            l += 2n;
            k += 1n;
            n = nn;
            r = nr;
        }
    }
}

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

    return availableWords.length > 0
        ? availableWords[Math.floor(Math.random() * availableWords.length)]
        : getRandomWord();
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

function getPiChunk(length) {
    if (!piGen || length <= 0) return "";

    let result = "";

    while (result.length < length) {
        const digit = String(piGen.next().value);

        if (!piStarted) {
            result += digit;
            piStarted = true;

            if (result.length < length) {
                result += ".";
            }
        } else {
            result += digit;
        }
    }

    return result.slice(0, length);
}

function generateContent(initial = false) {
    if (currentContentMode === "pi") {
        return getPiChunk(initial ? INITIAL_PI_CHUNK_LENGTH : APPEND_PI_CHUNK_LENGTH);
    }

    const recentWords = getRecentWordsFromText(currentText, RECENT_WORD_WINDOW);
    return generateWords(
        initial ? INITIAL_WORD_COUNT : APPEND_WORD_COUNT,
        initial ? [] : recentWords
    );
}

function getWordBounds(index) {
    if (!currentText.length || index < 0 || index >= currentText.length) {
        return null;
    }

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
    return chars[index] ? Math.round(chars[index].offsetTop) : null;
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

    return getUniqueLineTopsInRange(currentIndex, chars.length)
        .filter((top) => top > currentTop).length;
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
        const prune = pendingPrune;
        pendingPrune = null;

        if (!prune?.removeCount) {
            isLineShifting = false;
            return;
        }

        chars.slice(0, prune.removeCount).forEach((el) => el.remove());
        chars = chars.slice(prune.removeCount);
        currentText = currentText.slice(prune.removeCount);
        currentIndex -= prune.removeCount;

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

    if (!focusMode || currentContentMode === "pi") return;

    const safeIndex = Math.min(currentIndex, currentText.length - 1);
    if (safeIndex < 0) return;

    const currentWord = getWordBounds(safeIndex);
    if (!currentWord) return;

    const nextStart = currentWord.end + 1;
    const nextWord = nextStart < currentText.length ? getWordBounds(nextStart) : null;

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
    if (!focusMode || !currentText.length || currentContentMode === "pi") return true;

    const safeIndex = Math.min(currentIndex, currentText.length - 1);
    if (safeIndex < 0) return true;

    const currentWord = getWordBounds(safeIndex);
    if (!currentWord) return true;

    const nextStart = currentWord.end + 1;
    const nextWord = nextStart < currentText.length ? getWordBounds(nextStart) : null;

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
    currentText = generateContent(true);
    renderText(currentText);
}

function appendMoreWords() {
    if (currentContentMode === "pi") {
        const extra = getPiChunk(APPEND_PI_CHUNK_LENGTH);
        if (!extra) return false;

        currentText += extra;
        renderText(extra, true);
        return true;
    }

    const currentWordCount = currentText.trim()
        ? currentText.trim().split(/\s+/).length
        : 0;

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
        progress = Math.min((performance.now() - startTime) / 1000 / selectedDuration, 1);
    }

    if (finished) {
        progress = 1;
    }

    const animalLeft = progress * maxLeft;
    snailIcon.style.left = `${animalLeft}px`;

    const scale = ["bunny", "turtle", "fish"].includes(currentSkin) ? 1.15 : 1;
    snailIcon.style.transform = `translateY(-50%) scale(${scale})`;

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
        const progress = Math.min((now - wiggleStart) / wiggleDuration, 1);
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
            const scale = ["bunny", "turtle", "fish"].includes(currentSkin) ? 1.15 : 1;
            snailIcon.style.transform = `translateY(-50%) rotate(0deg) scale(${scale})`;
            wiggleFrameId = null;
        }
    }

    wiggleFrameId = requestAnimationFrame(wiggle);
}

function moveCaret() {
    if (!chars.length || finished || currentIndex >= chars.length) {
        caret.style.display = "none";
        return;
    }

    const el = chars[currentIndex];
    caret.style.display = "block";
    caret.style.height = `${el.offsetHeight}px`;
    caret.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
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
    const total = correctCount + incorrectCount;

    finalWpmEl.textContent = results.wpm;
    finalAccuracyEl.textContent = results.accuracy;
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

    piGen = piGenerator();
    piStarted = false;

    snailIcon.style.transition = "left 0.35s cubic-bezier(0.22, 1, 0.36, 1), transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)";
    snailLine.style.transition = "left 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1)";
    snailTrail.style.transition = "width 0.35s cubic-bezier(0.22, 1, 0.36, 1)";

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

    const scale = ["bunny", "turtle", "fish"].includes(currentSkin) ? 1.15 : 1;
    snailIcon.style.transform = `translateY(-50%) rotate(0deg) scale(${scale})`;

    hintEl.style.display = "block";
    hintEl.textContent =
        currentContentMode === "pi"
            ? "start typing digits of pi. press [enter] to restart."
            : "start typing to begin the test. press [enter] to restart.";

    restartBox.classList.add("hidden");
    timeEl.textContent = timeLeft;
    textDisplay.style.display = "block";
    resultScreen.classList.add("hidden");
    caret.style.display = "block";

    loadInitialWords();
    updateSnailProgress();

    setTimeout(() => {
        snailIcon.style.transition = "";
        snailLine.style.transition = "";
        snailTrail.style.transition = "";
    }, 350);

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
    loadPreferences();

    setupDropdown("mode-dropdown", currentMode, (value) => {
        applyAppearance(value, currentAccent);
        setDropdownValue("mode-dropdown", value);
    });

    setupDropdown("accent-dropdown", currentAccent, (value) => {
        applyAppearance(currentMode, value);
        setDropdownValue("accent-dropdown", value);
    });

    setupDropdown("content-dropdown", currentContentMode, (value) => {
        currentContentMode = value;
        localStorage.setItem("snailtype-content-mode", value);
        setDropdownValue("content-dropdown", value);
        restartTest();
    });

    setupDropdown("skin-dropdown", currentSkin, (value) => {
        applySkin(value);
        setDropdownValue("skin-dropdown", value);
    });

    updateAnimalImage();

    const activeBtn = document.querySelector(".time-btn.active");
    if (activeBtn) {
        updateTimeHighlight(activeBtn, false);
    }

    restartTest();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
        e.preventDefault();

        if (focusToggle) {
            focusToggle.checked = !focusToggle.checked;
            focusToggle.dispatchEvent(new Event("change", { bubbles: true }));
        }

        return;
    }

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

    if (finished || isLineShifting) return;

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

    if (e.key.length !== 1 || !chars.length) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

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