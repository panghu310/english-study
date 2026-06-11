# 英语小词典学习网页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个本地可开发、以后可部署到 GitHub Pages 的英语小词典网页，支持音节拆分展示、极简释义、浏览器朗读、三个学习分区和本机进度保存。

**Architecture:** 使用纯静态网页实现，不引入前端框架。`words.js` 只保存样本词表，`app.js` 负责状态、渲染和朗读，`styles.css` 负责手机和平板优先的界面样式。

**Tech Stack:** HTML、CSS、原生 JavaScript、`localStorage`、`SpeechSynthesis`、Node.js 内置测试模块。

---

## 文件结构

- Create: `/Users/user/study/index.html`，页面骨架和应用挂载点。
- Create: `/Users/user/study/src/words.js`，约 50 个样本词，包含原词、音节拆分、中文释义和分类。
- Create: `/Users/user/study/src/app.js`，分区状态、统计、渲染、移动状态、朗读、保存和错误提示。
- Create: `/Users/user/study/src/styles.css`，移动端优先样式。
- Create: `/Users/user/study/test/words.test.mjs`，检查词表结构、唯一性和样本规模。
- Create: `/Users/user/study/test/state.test.mjs`，检查纯状态函数，避免把状态逻辑全绑死在 DOM 上。
- Create: `/Users/user/study/package.json`，提供测试和本地预览命令。

当前目录不是 git 仓库，所以不执行 commit。每个任务完成后用测试或本地预览验证。

### Task 1: 项目骨架和词表数据

**Files:**
- Create: `/Users/user/study/package.json`
- Create: `/Users/user/study/index.html`
- Create: `/Users/user/study/src/words.js`
- Create: `/Users/user/study/test/words.test.mjs`

- [ ] **Step 1: 写词表结构测试**

创建 `/Users/user/study/test/words.test.mjs`：

```js
import assert from "node:assert/strict";
import test from "node:test";
import { WORDS } from "../src/words.js";

test("样本词表至少包含 50 个词", () => {
  assert.ok(WORDS.length >= 50);
});

test("每个词都有原词、音节、中文释义和分类", () => {
  for (const item of WORDS) {
    assert.equal(typeof item.word, "string");
    assert.equal(typeof item.syllables, "string");
    assert.equal(typeof item.meaning, "string");
    assert.equal(typeof item.category, "string");
    assert.ok(item.word.length > 0);
    assert.ok(item.syllables.length > 0);
    assert.ok(item.meaning.length > 0);
    assert.ok(["daily", "it"].includes(item.category));
  }
});

test("原始单词唯一，且音节显示不能包含空格", () => {
  const words = WORDS.map((item) => item.word);
  assert.equal(new Set(words).size, words.length);

  for (const item of WORDS) {
    assert.equal(item.word, item.word.toLowerCase());
    assert.equal(/\s/.test(item.syllables), false);
  }
});
```

- [ ] **Step 2: 创建测试脚本**

创建 `/Users/user/study/package.json`：

```json
{
  "name": "english-pocket-dictionary",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "dev": "python3 -m http.server 4173"
  }
}
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test`

Expected: 测试失败，原因是 `/Users/user/study/src/words.js` 尚不存在。

- [ ] **Step 4: 创建样本词表**

创建 `/Users/user/study/src/words.js`，导出 `WORDS` 数组。每个对象包含 `word`、`syllables`、`meaning`、`category`。词表至少 50 个，日常词和 IT 词混合。

- [ ] **Step 5: 创建页面骨架**

创建 `/Users/user/study/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>英语小词典</title>
    <link rel="stylesheet" href="./src/styles.css" />
  </head>
  <body>
    <main class="app-shell">
      <header class="app-header">
        <p class="eyebrow">Oxford 5000 + IT 高频词样本</p>
        <h1>英语小词典</h1>
        <p class="subtitle">音节拆分、极简释义、点一下就读。</p>
        <section class="stats" id="stats" aria-label="学习统计"></section>
      </header>

      <nav class="tabs" id="tabs" aria-label="学习分区"></nav>

      <section class="toolbar" aria-label="当前分区信息">
        <p id="sectionHint"></p>
      </section>

      <section class="word-list" id="wordList" aria-live="polite"></section>
      <p class="toast" id="toast" role="status" aria-live="polite"></p>
    </main>

    <script type="module" src="./src/app.js"></script>
  </body>
</html>
```

- [ ] **Step 6: 运行词表测试确认通过**

Run: `npm test`

Expected: `words.test.mjs` 全部通过。

### Task 2: 状态模型和保存逻辑

**Files:**
- Create: `/Users/user/study/test/state.test.mjs`
- Create: `/Users/user/study/src/app.js`

- [ ] **Step 1: 写状态函数测试**

创建 `/Users/user/study/test/state.test.mjs`：

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STATUS,
  STATUS_CONFIG,
  getWordStatus,
  moveWord,
  countByStatus
} from "../src/app.js";

const sampleWords = [
  { word: "computer" },
  { word: "database" },
  { word: "important" }
];

test("未知单词默认属于未掌握", () => {
  assert.equal(getWordStatus({}, "computer"), DEFAULT_STATUS);
});

test("移动单词时只更新目标单词", () => {
  const next = moveWord({ computer: "new" }, "computer", "known");
  assert.deepEqual(next, { computer: "known" });
});

test("拒绝不存在的状态", () => {
  assert.throws(() => moveWord({}, "computer", "bad"), /未知分区/);
});

test("按状态统计词数", () => {
  const counts = countByStatus(sampleWords, {
    computer: "known",
    database: "review"
  });

  assert.deepEqual(counts, {
    new: 1,
    review: 1,
    known: 1
  });
});

test("三个状态都有中文名称", () => {
  assert.equal(STATUS_CONFIG.new.label, "未掌握");
  assert.equal(STATUS_CONFIG.review.label, "需复习");
  assert.equal(STATUS_CONFIG.known.label, "已掌握");
});
```

- [ ] **Step 2: 运行状态测试确认失败**

Run: `npm test`

Expected: 测试失败，原因是 `/Users/user/study/src/app.js` 尚未导出状态函数。

- [ ] **Step 3: 实现状态函数和浏览器入口保护**

创建 `/Users/user/study/src/app.js`，先实现可测试的纯函数：

```js
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

function initApp() {
  window.__englishStudyApp = {
    words: WORDS,
    statusMap: loadStatusMap(),
    activeStatus: DEFAULT_STATUS
  };
}

if (isBrowser()) {
  initApp();
}
```

- [ ] **Step 4: 运行状态测试确认通过**

Run: `npm test`

Expected: `words.test.mjs` 和 `state.test.mjs` 全部通过。

### Task 3: 页面渲染、分区移动和朗读

**Files:**
- Modify: `/Users/user/study/src/app.js`

- [ ] **Step 1: 在 `app.js` 中补齐渲染和交互函数**

在现有纯函数下面补充 DOM 渲染函数：

```js
function render() {
  const app = window.__englishStudyApp;
  renderStats(app);
  renderTabs(app);
  renderSectionHint(app);
  renderWords(app);
}

function renderStats(app) {
  const stats = document.querySelector("#stats");
  const counts = countByStatus(app.words, app.statusMap);
  stats.innerHTML = Object.entries(STATUS_CONFIG)
    .map(([status, config]) => {
      return `<span>${config.label} <strong>${counts[status]}</strong></span>`;
    })
    .join("");
}

function renderTabs(app) {
  const tabs = document.querySelector("#tabs");
  tabs.innerHTML = Object.entries(STATUS_CONFIG)
    .map(([status, config]) => {
      const selected = status === app.activeStatus;
      return `
        <button class="tab ${selected ? "is-active" : ""}" type="button" data-tab="${status}" aria-pressed="${selected}">
          ${config.label}
        </button>
      `;
    })
    .join("");
}

function renderSectionHint(app) {
  const hint = document.querySelector("#sectionHint");
  hint.textContent = STATUS_CONFIG[app.activeStatus].hint;
}

function renderWords(app) {
  const list = document.querySelector("#wordList");
  const visibleWords = app.words.filter((item) => {
    return getWordStatus(app.statusMap, item.word) === app.activeStatus;
  });

  if (visibleWords.length === 0) {
    list.innerHTML = `<p class="empty-state">这个分区暂时没有单词。</p>`;
    return;
  }

  list.innerHTML = visibleWords.map(renderWordCard).join("");
}

function renderWordCard(item) {
  const actions = STATUS_CONFIG[getWordStatus(window.__englishStudyApp.statusMap, item.word)].actions;
  const actionButtons = actions
    .map((action) => {
      return `
        <button class="move-button" type="button" data-word="${item.word}" data-move="${action.status}">
          ${action.label}
        </button>
      `;
    })
    .join("");

  return `
    <article class="word-card">
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

function speakWord(word) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    showToast("这个浏览器暂时不能朗读。");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    const move = event.target.closest("[data-move]");
    const speak = event.target.closest("[data-speak]");
    const app = window.__englishStudyApp;

    if (tab) {
      app.activeStatus = tab.dataset.tab;
      render();
      return;
    }

    if (move) {
      app.statusMap = moveWord(app.statusMap, move.dataset.word, move.dataset.move);
      saveStatusMap(app.statusMap);
      render();
      return;
    }

    if (speak) {
      speakWord(speak.dataset.speak);
    }
  });
}
```

- [ ] **Step 2: 更新浏览器启动流程**

把 `initApp()` 改成初始化状态后绑定事件并渲染：

```js
function initApp() {
  window.__englishStudyApp = {
    words: WORDS,
    statusMap: loadStatusMap(),
    activeStatus: DEFAULT_STATUS
  };

  bindEvents();
  render();
}
```

- [ ] **Step 3: 运行测试确认没有破坏纯函数**

Run: `npm test`

Expected: 全部测试通过。

### Task 4: 移动端优先样式

**Files:**
- Create: `/Users/user/study/src/styles.css`

- [ ] **Step 1: 创建样式文件**

创建 `/Users/user/study/src/styles.css`，要求：

```css
:root {
  color-scheme: light;
  --bg: #f6f5f1;
  --panel: #ffffff;
  --ink: #181714;
  --muted: #69665d;
  --line: #dedbd2;
  --accent: #2364aa;
  --accent-strong: #174a7c;
  --review: #8a5a00;
  --known: #28724f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
}

button {
  font: inherit;
}

.app-shell {
  width: min(100%, 860px);
  margin: 0 auto;
  padding: 20px 16px 40px;
}

.app-header {
  padding: 16px 0 12px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--accent-strong);
  font-size: 0.85rem;
  font-weight: 700;
}

h1 {
  margin: 0;
  font-size: 2rem;
  letter-spacing: 0;
}

.subtitle {
  margin: 8px 0 16px;
  color: var(--muted);
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stats span {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  padding: 8px 10px;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 14px 0;
}

.tab,
.move-button,
.speak-button {
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--ink);
  cursor: pointer;
}

.tab.is-active {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
  font-weight: 700;
}

.toolbar {
  color: var(--muted);
  min-height: 34px;
}

.word-list {
  display: grid;
  gap: 10px;
}

.word-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px;
}

.word-main {
  display: grid;
  grid-template-columns: 1.25fr 0.8fr auto;
  align-items: center;
  gap: 12px;
}

.syllables {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1.35rem;
  line-height: 1.2;
}

.plain-word {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.86rem;
}

.meaning {
  margin: 0;
  font-size: 1.15rem;
}

.speak-button {
  min-width: 64px;
  padding: 0 12px;
  color: var(--accent-strong);
  font-weight: 700;
}

.word-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.move-button {
  flex: 1;
  padding: 0 12px;
  color: var(--muted);
}

.empty-state {
  margin: 24px 0;
  color: var(--muted);
  text-align: center;
}

.toast {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 18px;
  margin: 0 auto;
  width: min(calc(100% - 32px), 520px);
  min-height: 0;
  border-radius: 8px;
  background: #181714;
  color: #ffffff;
  text-align: center;
  padding: 0;
}

.toast:not(:empty) {
  padding: 12px 14px;
}

@media (max-width: 620px) {
  .app-shell {
    padding: 16px 12px 34px;
  }

  h1 {
    font-size: 1.7rem;
  }

  .word-main {
    grid-template-columns: 1fr auto;
  }

  .meaning {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .speak-button {
    grid-column: 2;
    grid-row: 1;
  }
}
```

- [ ] **Step 2: 运行测试确认样式加入没有破坏模块加载**

Run: `npm test`

Expected: 全部测试通过。

### Task 5: 本地预览和浏览器验证

**Files:**
- Modify: `/Users/user/study/src/app.js`，仅在发现实际问题时修改。
- Modify: `/Users/user/study/src/styles.css`，仅在发现实际问题时修改。

- [ ] **Step 1: 启动本地服务**

Run: `npm run dev`

Expected: 本地服务监听 `http://localhost:4173`。

- [ ] **Step 2: 用浏览器打开页面**

Open: `http://localhost:4173`

Expected: 能看到标题、统计、三个分区和单词列表。

- [ ] **Step 3: 验证核心流程**

在浏览器中执行：

- 点击一个词的“需复习”，该词从“未掌握”消失。
- 切到“需复习”，该词出现。
- 点击该词的“已掌握”，该词进入“已掌握”。
- 刷新页面，状态仍然保留。
- 点击“朗读”，浏览器读原始英文单词。

- [ ] **Step 4: 验证移动端布局**

把浏览器宽度调整到 390px。

Expected:

- 三个分区按钮不重叠。
- 单词、释义、朗读按钮不重叠。
- 移动状态按钮触摸区域足够大。

- [ ] **Step 5: 最终检查**

Run: `npm test`

Expected: 全部测试通过。

Run: `find /Users/user/study -maxdepth 3 -type f | sort`

Expected: 只包含计划内文件、设计文档和实现文件。

## 自查

- 设计文档里的第一版目标由 Task 1 到 Task 5 覆盖。
- 词表、分区、朗读、保存和移动端样式都有对应任务。
- 未包含账号、同步、导入导出、自动复习算法和本地音频包。
- 状态函数先测试再实现，页面交互通过本地浏览器验证。
