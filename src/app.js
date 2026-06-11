import { WORDS } from "./words.js";

export const DEFAULT_STATUS = "new";

export const STATUS_CONFIG = {
  new: {
    label: "未掌握",
    hint: "还没记住的词都先放在这里。",
    actions: [
      { status: "review", label: "需复习" },
      { status: "known", label: "已掌握" }
    ]
  },
  review: {
    label: "需复习",
    hint: "现在记住了，但还想时不时看一眼。",
    actions: [
      { status: "new", label: "未掌握" },
      { status: "known", label: "已掌握" }
    ]
  },
  known: {
    label: "已掌握",
    hint: "已经比较熟的词，误点也可以移回去。",
    actions: [
      { status: "review", label: "需复习" },
      { status: "new", label: "未掌握" }
    ]
  }
};

const STORAGE_KEY = "english-pocket-dictionary-status-v1";

export function getWordStatus(statusMap, word) {
  return statusMap[word] || DEFAULT_STATUS;
}

export function moveWord(statusMap, word, nextStatus) {
  if (!STATUS_CONFIG[nextStatus]) {
    throw new Error(`未知分区：${nextStatus}`);
  }

  return {
    ...statusMap,
    [word]: nextStatus
  };
}

export function countByStatus(words, statusMap) {
  const counts = { new: 0, review: 0, known: 0 };

  for (const item of words) {
    const status = getWordStatus(statusMap, item.word);
    counts[status] += 1;
  }

  return counts;
}

export function getVisibleWords(words, statusMap, activeStatus) {
  return words.filter((item) => getWordStatus(statusMap, item.word) === activeStatus);
}

export function getAvailableActions(status) {
  if (!STATUS_CONFIG[status]) {
    throw new Error(`未知分区：${status}`);
  }

  return STATUS_CONFIG[status].actions;
}

export function getStatusTabs(counts, activeStatus) {
  return Object.entries(STATUS_CONFIG).map(([status, config]) => ({
    status,
    label: config.label,
    count: counts[status],
    active: status === activeStatus
  }));
}

export function getContinuousReadQueue(words, statusMap, activeStatus) {
  return getVisibleWords(words, statusMap, activeStatus);
}

export function getAudioPath(word) {
  const safeName = word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `./audio/${safeName}.m4a`;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function loadStatusMap() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    showToast("进度读取失败，本次先临时使用。");
    return {};
  }
}

function saveStatusMap(statusMap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statusMap));
  } catch {
    showToast("进度保存失败，刷新后可能丢失。");
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  window.setTimeout(() => {
    toast.textContent = "";
  }, 2200);
}

function render() {
  const app = window.__englishStudyApp;
  renderTabs(app);
  renderSectionHint(app);
  renderReaderControls(app);
  renderWords(app);
}

function renderTabs(app) {
  const tabs = document.querySelector("#tabs");
  const counts = countByStatus(app.words, app.statusMap);
  const statusTabs = getStatusTabs(counts, app.activeStatus);

  tabs.innerHTML = statusTabs
    .map((item) => {
      return `
        <button class="tab ${item.active ? "is-active" : ""}" type="button" data-tab="${item.status}" aria-pressed="${item.active}">
          <span>${item.label}</span>
          <strong>${item.count}</strong>
        </button>
      `;
    })
    .join("");
}

function renderSectionHint(app) {
  const hint = document.querySelector("#sectionHint");
  hint.textContent = STATUS_CONFIG[app.activeStatus].hint;
}

function renderReaderControls(app) {
  const controls = document.querySelector("#readerControls");
  const currentCount = getContinuousReadQueue(app.words, app.statusMap, app.activeStatus).length;
  const isReading = app.reader.isReading;

  controls.innerHTML = `
    <button class="reader-button reader-primary" type="button" data-read-all ${isReading || currentCount === 0 ? "disabled" : ""}>
      连续读
    </button>
    <button class="reader-button" type="button" data-stop-reading ${isReading ? "" : "disabled"}>
      暂停
    </button>
    <span class="reader-status">${isReading ? `正在读 ${app.reader.index + 1}/${app.reader.queue.length}` : `当前分区 ${currentCount} 个词`}</span>
  `;
}

function renderWords(app) {
  const list = document.querySelector("#wordList");
  const visibleWords = getVisibleWords(app.words, app.statusMap, app.activeStatus);

  if (visibleWords.length === 0) {
    list.innerHTML = `<p class="empty-state">这个分区暂时没有单词。</p>`;
    return;
  }

  list.innerHTML = visibleWords.map(renderWordCard).join("");
}

function renderWordCard(item) {
  const currentStatus = getWordStatus(window.__englishStudyApp.statusMap, item.word);
  const readingWord = window.__englishStudyApp.reader.currentWord;
  const actionButtons = getAvailableActions(currentStatus)
    .map((action) => {
      return `
        <button class="move-button" type="button" data-word="${item.word}" data-move="${action.status}">
          ${action.label}
        </button>
      `;
    })
    .join("");

  return `
    <article class="word-card ${readingWord === item.word ? "is-reading" : ""}" data-card-word="${item.word}">
      <div class="word-main">
        <div>
          <p class="syllables">${item.syllables}</p>
          <p class="plain-word">${item.word}</p>
        </div>
        <p class="meaning">${item.meaning}</p>
        <button class="speak-button" type="button" data-speak="${item.word}" aria-label="朗读 ${item.word}">
          朗读
        </button>
      </div>
      <div class="word-actions">${actionButtons}</div>
    </article>
  `;
}

async function speakWord(word) {
  const playedLocalAudio = await playLocalAudio(word);
  if (playedLocalAudio) {
    return true;
  }

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    showToast("这个浏览器暂时不能朗读。");
    return false;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
  return true;
}

async function speakWordUntilEnd(word) {
  const playedLocalAudio = await playLocalAudio(word, true);
  if (playedLocalAudio) {
    return true;
  }

  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      showToast("这个浏览器暂时不能朗读。");
      resolve(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    utterance.onend = () => resolve(true);
    utterance.onerror = () => {
      if (window.__englishStudyApp.reader.isReading) {
        showToast("朗读被中断了。");
      }
      resolve(false);
    };
    window.speechSynthesis.speak(utterance);
  });
}

function playLocalAudio(word, waitUntilEnd = false) {
  return new Promise((resolve) => {
    const audio = new Audio(getAudioPath(word));
    audio.preload = "auto";

    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);

    const playPromise = audio.play();
    if (!playPromise) {
      resolve(true);
      return;
    }

    playPromise
      .then(() => {
        if (!waitUntilEnd) {
          resolve(true);
        }
      })
      .catch(() => resolve(false));
  });
}

function stopContinuousRead() {
  const app = window.__englishStudyApp;
  if (!app?.reader) return;

  app.reader.isReading = false;
  app.reader.queue = [];
  app.reader.index = 0;
  app.reader.currentWord = "";

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function scrollReadingCardIntoView(word) {
  const card = document.querySelector(`[data-card-word="${word}"]`);
  if (!card) return;

  card.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

async function startContinuousRead() {
  const app = window.__englishStudyApp;
  const queue = getContinuousReadQueue(app.words, app.statusMap, app.activeStatus);

  if (queue.length === 0) {
    showToast("当前分区没有可以朗读的单词。");
    return;
  }

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    showToast("这个浏览器暂时不能连续朗读。");
    return;
  }

  app.reader.isReading = true;
  app.reader.queue = queue;

  for (let index = 0; index < queue.length; index += 1) {
    if (!app.reader.isReading) break;

    const item = queue[index];
    app.reader.index = index;
    app.reader.currentWord = item.word;
    render();
    scrollReadingCardIntoView(item.word);

    const finished = await speakWordUntilEnd(item.word);
    if (!finished || !app.reader.isReading) break;

    await wait(450);
  }

  stopContinuousRead();
  render();
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    const move = event.target.closest("[data-move]");
    const speak = event.target.closest("[data-speak]");
    const readAll = event.target.closest("[data-read-all]");
    const stopReading = event.target.closest("[data-stop-reading]");
    const app = window.__englishStudyApp;

    if (tab) {
      stopContinuousRead();
      app.activeStatus = tab.dataset.tab;
      render();
      return;
    }

    if (move) {
      stopContinuousRead();
      app.statusMap = moveWord(app.statusMap, move.dataset.word, move.dataset.move);
      saveStatusMap(app.statusMap);
      render();
      return;
    }

    if (speak) {
      speakWord(speak.dataset.speak);
      return;
    }

    if (readAll) {
      startContinuousRead();
      return;
    }

    if (stopReading) {
      stopContinuousRead();
      render();
    }
  });
}

function initApp() {
  window.__englishStudyApp = {
    words: WORDS,
    statusMap: loadStatusMap(),
    activeStatus: DEFAULT_STATUS,
    reader: {
      isReading: false,
      queue: [],
      index: 0,
      currentWord: ""
    }
  };

  bindEvents();
  render();
}

if (isBrowser()) {
  initApp();
}
