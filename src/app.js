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
const ORDER_STORAGE_KEY = "english-pocket-dictionary-order-v1";
const DEFAULT_ORDER = "recommended";

export const ORDER_CONFIG = {
  recommended: {
    label: "推荐顺序",
    hint: "核心约2000词、扩展词、IT词分段推进，段内打散。"
  },
  level: {
    label: "等级顺序",
    hint: "按 A1 到 C1 推进，适合从浅到深扫词。"
  },
  itFirst: {
    label: "IT优先",
    hint: "先看开发和技术文档里更容易遇到的词。"
  },
  alphabetical: {
    label: "字母顺序",
    hint: "按 A 到 Z 排列，适合查找。"
  }
};

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

export function getOrderOptions() {
  return Object.entries(ORDER_CONFIG).map(([key, config]) => ({
    key,
    label: config.label
  }));
}

export function getOrderedWords(words, orderKey = DEFAULT_ORDER) {
  const selectedOrder = ORDER_CONFIG[orderKey] ? orderKey : DEFAULT_ORDER;
  const sorted = [...words];

  if (selectedOrder === "alphabetical") {
    return sorted.sort((a, b) => a.word.localeCompare(b.word));
  }

  if (selectedOrder === "itFirst") {
    return sorted.sort((a, b) => {
      const topicDiff = Number(getStudyBand(a) !== "it") - Number(getStudyBand(b) !== "it");
      return topicDiff || compareRecommended(a, b);
    });
  }

  if (selectedOrder === "level") {
    return sorted.sort(compareLevelOrder);
  }

  return sorted.sort(compareRecommended);
}

export function getReaderDockState(reader, currentCount) {
  const queueLength = reader.queue?.length || 0;
  const rawPosition = (reader.index || 0) + 1;
  const position = queueLength > 0 ? Math.min(rawPosition, queueLength) : 0;

  if (reader.isReading) {
    return {
      canContinue: false,
      canStop: true,
      canRestart: currentCount > 0,
      primaryLabel: `朗读中 ${position}/${queueLength}`
    };
  }

  if (reader.isPaused && queueLength > 0) {
    return {
      canContinue: true,
      canStop: false,
      canRestart: currentCount > 0,
      primaryLabel: `继续 ${position}/${queueLength}`
    };
  }

  return {
    canContinue: currentCount > 0,
    canStop: false,
    canRestart: currentCount > 0,
    primaryLabel: currentCount > 0 ? `连续读 ${currentCount}` : "当前分区 0"
  };
}

function compareRecommended(a, b) {
  return getBandOrder(a) - getBandOrder(b)
    || getLevelOrder(a) - getLevelOrder(b)
    || getStableShuffleKey(a.word) - getStableShuffleKey(b.word)
    || a.word.localeCompare(b.word);
}

function compareLevelOrder(a, b) {
  return getLevelOrder(a) - getLevelOrder(b)
    || getStableShuffleKey(a.word) - getStableShuffleKey(b.word)
    || a.word.localeCompare(b.word);
}

function getBandOrder(item) {
  const order = {
    core: 0,
    extension: 1,
    it: 2
  };
  return order[getStudyBand(item)] ?? 9;
}

function getStudyBand(item) {
  if (item.level && ["a1", "a2", "b1"].includes(item.level)) return "core";
  if (item.level && ["b2", "c1"].includes(item.level)) return "extension";
  if (item.category === "it" || String(item.source || "").includes("csavl")) return "it";
  return "extension";
}

function getLevelOrder(item) {
  const order = {
    a1: 0,
    a2: 1,
    b1: 2,
    b2: 3,
    c1: 4
  };
  return order[item.level] ?? 5;
}

function getStableShuffleKey(word) {
  let hash = 2166136261;
  const text = `study-${word}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getAudioPath(word) {
  const safeName = word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `./audio/${safeName}.m4a`;
}

export function replaceCurrentAudio(owner, nextAudio) {
  const previousAudio = owner?.currentAudio;
  if (previousAudio && previousAudio !== nextAudio) {
    previousAudio.pause();
    previousAudio.currentTime = 0;
  }

  if (owner) {
    owner.currentAudio = nextAudio;
  }
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

function loadOrderKey() {
  try {
    const saved = window.localStorage.getItem(ORDER_STORAGE_KEY);
    return ORDER_CONFIG[saved] ? saved : DEFAULT_ORDER;
  } catch {
    return DEFAULT_ORDER;
  }
}

function saveOrderKey(orderKey) {
  try {
    window.localStorage.setItem(ORDER_STORAGE_KEY, orderKey);
  } catch {
    showToast("顺序保存失败，刷新后可能恢复默认。");
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
  renderOrderSelect(app);
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
  hint.textContent = `${STATUS_CONFIG[app.activeStatus].hint} ${ORDER_CONFIG[app.orderKey].hint}`;
}

function renderOrderSelect(app) {
  const orderSelect = document.querySelector("#orderSelect");
  if (!orderSelect) return;

  orderSelect.innerHTML = getOrderOptions()
    .map((item) => {
      return `<option value="${item.key}" ${item.key === app.orderKey ? "selected" : ""}>${item.label}</option>`;
    })
    .join("");
}

function renderReaderControls(app) {
  const controls = document.querySelector("#readerControls");
  const orderedWords = getOrderedWords(app.words, app.orderKey);
  const currentCount = getContinuousReadQueue(orderedWords, app.statusMap, app.activeStatus).length;
  const state = getReaderDockState(app.reader, currentCount);

  controls.innerHTML = `
    <button class="reader-button reader-primary" type="button" data-continue-reading ${state.canContinue ? "" : "disabled"}>
      ${state.primaryLabel}
    </button>
    <button class="reader-button" type="button" data-stop-reading ${state.canStop ? "" : "disabled"}>
      停止
    </button>
    <button class="reader-button" type="button" data-restart-reading ${state.canRestart ? "" : "disabled"}>
      从头
    </button>
  `;
}

function renderWords(app) {
  const list = document.querySelector("#wordList");
  const orderedWords = getOrderedWords(app.words, app.orderKey);
  const visibleWords = getVisibleWords(orderedWords, app.statusMap, app.activeStatus);

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
    const app = window.__englishStudyApp;
    const audio = new Audio(getAudioPath(word));
    audio.preload = "auto";
    const audioOwner = waitUntilEnd ? app?.reader : app?.speaker;

    if (audioOwner) {
      replaceCurrentAudio(audioOwner, audio);
    }

    audio.onended = () => {
      if (audioOwner?.currentAudio === audio) audioOwner.currentAudio = null;
      resolve(true);
    };
    audio.onerror = () => {
      if (audioOwner?.currentAudio === audio) audioOwner.currentAudio = null;
      resolve(false);
    };

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
      .catch(() => {
        if (audioOwner?.currentAudio === audio) audioOwner.currentAudio = null;
        resolve(false);
      });
  });
}

function clearCurrentAudio(owner) {
  if (!owner) return;
  replaceCurrentAudio(owner, null);
}

function stopSpeechAndAudio(app) {
  clearCurrentAudio(app?.reader);
  clearCurrentAudio(app?.speaker);
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function resetContinuousRead() {
  const app = window.__englishStudyApp;
  if (!app?.reader) return;

  app.reader.runId += 1;
  app.reader.isReading = false;
  app.reader.isPaused = false;
  app.reader.queue = [];
  app.reader.index = 0;
  app.reader.currentWord = "";
  app.reader.activeStatus = "";
  app.reader.orderKey = "";

  stopSpeechAndAudio(app);
}

function pauseContinuousRead() {
  const app = window.__englishStudyApp;
  if (!app?.reader) return;

  app.reader.runId += 1;
  app.reader.isReading = false;
  app.reader.isPaused = app.reader.queue.length > 0;

  stopSpeechAndAudio(app);
}

function scrollReadingCardIntoView(word) {
  const card = document.querySelector(`[data-card-word="${word}"]`);
  if (!card) return;

  card.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

async function startContinuousRead(options = {}) {
  const app = window.__englishStudyApp;
  const orderedWords = getOrderedWords(app.words, app.orderKey);
  const currentQueue = getContinuousReadQueue(orderedWords, app.statusMap, app.activeStatus);

  if (currentQueue.length === 0) {
    showToast("当前分区没有可以朗读的单词。");
    return;
  }

  const shouldStartFresh = options.fromStart
    || !app.reader.isPaused
    || app.reader.activeStatus !== app.activeStatus
    || app.reader.orderKey !== app.orderKey
    || app.reader.queue.length === 0;

  app.reader.runId += 1;
  const runId = app.reader.runId;

  if (shouldStartFresh) {
    app.reader.queue = currentQueue;
    app.reader.index = 0;
  } else if (app.reader.index >= app.reader.queue.length) {
    app.reader.index = 0;
  }

  app.reader.isReading = true;
  app.reader.isPaused = false;
  app.reader.activeStatus = app.activeStatus;
  app.reader.orderKey = app.orderKey;

  while (app.reader.isReading && app.reader.runId === runId && app.reader.index < app.reader.queue.length) {
    const item = app.reader.queue[app.reader.index];

    app.reader.currentWord = item.word;
    render();
    scrollReadingCardIntoView(item.word);

    const finished = await speakWordUntilEnd(item.word);
    if (!finished || !app.reader.isReading || app.reader.runId !== runId) break;

    app.reader.index += 1;
    render();
    await wait(450);
  }

  if (app.reader.isReading && app.reader.runId === runId && app.reader.index >= app.reader.queue.length) {
    resetContinuousRead();
  }

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
    const continueReading = event.target.closest("[data-continue-reading]");
    const stopReading = event.target.closest("[data-stop-reading]");
    const restartReading = event.target.closest("[data-restart-reading]");
    const app = window.__englishStudyApp;

    if (tab) {
      resetContinuousRead();
      app.activeStatus = tab.dataset.tab;
      render();
      return;
    }

    if (move) {
      resetContinuousRead();
      app.statusMap = moveWord(app.statusMap, move.dataset.word, move.dataset.move);
      saveStatusMap(app.statusMap);
      render();
      return;
    }

    if (speak) {
      speakWord(speak.dataset.speak);
      return;
    }

    if (continueReading) {
      startContinuousRead();
      return;
    }

    if (stopReading) {
      pauseContinuousRead();
      render();
      return;
    }

    if (restartReading) {
      pauseContinuousRead();
      startContinuousRead({ fromStart: true });
    }
  });

  document.addEventListener("change", (event) => {
    const orderSelect = event.target.closest("#orderSelect");
    if (!orderSelect) return;

    const app = window.__englishStudyApp;
    resetContinuousRead();
    app.orderKey = ORDER_CONFIG[orderSelect.value] ? orderSelect.value : DEFAULT_ORDER;
    saveOrderKey(app.orderKey);
    render();
  });
}

function initApp() {
  window.__englishStudyApp = {
    words: WORDS,
    statusMap: loadStatusMap(),
    activeStatus: DEFAULT_STATUS,
    orderKey: loadOrderKey(),
    reader: {
      isReading: false,
      isPaused: false,
      queue: [],
      index: 0,
      currentWord: "",
      currentAudio: null,
      activeStatus: "",
      orderKey: "",
      runId: 0
    },
    speaker: {
      currentAudio: null
    }
  };

  bindEvents();
  render();
}

if (isBrowser()) {
  initApp();
}
