import assert from "node:assert/strict";
import test from "node:test";
import {
  countByStatus,
  extractDictionaryAudioUrl,
  getAvailableActions,
  getAudioPath,
  getContinuousReadQueue,
  getOrderedWords,
  getReaderDockState,
  getStatusTabs,
  getVisibleWords,
  renderWordCardForTest,
  replaceCurrentAudio
} from "../../src/app.js";

const sampleWords = [
  { word: "computer" },
  { word: "database" },
  { word: "important" }
];

test("当前分区只显示对应状态的单词", () => {
  const visible = getVisibleWords(sampleWords, {
    computer: "known",
    database: "review"
  }, "new");

  assert.deepEqual(visible, [{ word: "important" }]);
});

test("未掌握分区可以移动到需复习或已掌握", () => {
  assert.deepEqual(getAvailableActions("new"), [
    { status: "review", label: "需复习" },
    { status: "known", label: "已掌握" }
  ]);
});

test("已掌握分区可以移回其它分区", () => {
  assert.deepEqual(getAvailableActions("known"), [
    { status: "review", label: "需复习" },
    { status: "new", label: "未掌握" }
  ]);
});

test("分区标签包含对应数量", () => {
  const counts = countByStatus(sampleWords, {
    computer: "known",
    database: "review"
  });

  assert.deepEqual(getStatusTabs(counts, "review"), [
    { status: "new", label: "未掌握", count: 1, active: false },
    { status: "review", label: "需复习", count: 1, active: true },
    { status: "known", label: "已掌握", count: 1, active: false }
  ]);
});

test("连续读队列只包含当前分区的单词", () => {
  const queue = getContinuousReadQueue(sampleWords, {
    computer: "known",
    database: "review"
  }, "new");

  assert.deepEqual(queue, [{ word: "important" }]);
});

test("音频路径使用安全文件名", () => {
  assert.equal(getAudioPath("computer"), "./audio/computer.m4a");
  assert.equal(getAudioPath("log in"), "./audio/log-in.m4a");
});

test("从 dictionaryapi.dev 返回里提取第一个可用音频", () => {
  const audioUrl = extractDictionaryAudioUrl([
    {
      phonetics: [
        { text: "/bad/" },
        { audio: "" },
        { audio: "//api.dictionaryapi.dev/media/pronunciations/en/six-us.mp3" }
      ]
    }
  ]);

  assert.equal(audioUrl, "https://api.dictionaryapi.dev/media/pronunciations/en/six-us.mp3");
});

test("词卡提供在线核对读音按钮", () => {
  const html = renderWordCardForTest({
    word: "computer",
    syllables: "com.put.er",
    phonetic: "/kəmˈpjutər/",
    meaning: "计算机"
  }, "new", "");

  assert.match(html, /data-check-pronunciation="computer"/);
  assert.match(html, /核对/);
});

test("词卡显示音标时放在原词旁边", () => {
  const html = renderWordCardForTest({
    word: "computer",
    syllables: "com.put.er",
    phonetic: "/kəmˈpjutər/",
    meaning: "计算机"
  }, "new", "");

  assert.match(html, /plain-word/);
  assert.match(html, /computer/);
  assert.match(html, /phonetic/);
  assert.equal(html.includes("/kəmˈpjutər/"), true);
});

test("推荐顺序按学习频段推进，并打散同频段字母顺序", () => {
  const words = [
    { word: "zoo", level: "c1", category: "daily", source: "oxford5000" },
    { word: "able", level: "a1", category: "daily", source: "oxford5000" },
    { word: "about", level: "a1", category: "daily", source: "oxford5000" },
    { word: "computer", level: "", category: "it", source: "csavl" }
  ];

  const ordered = getOrderedWords(words, "recommended").map((item) => item.word);

  assert.equal(ordered.indexOf("zoo") > ordered.indexOf("able"), true);
  assert.equal(ordered.indexOf("computer") > ordered.indexOf("zoo"), true);
  assert.notDeepEqual(ordered.slice(0, 2), ["able", "about"]);
});

test("悬浮朗读控制支持继续、停止和从头开始", () => {
  assert.deepEqual(getReaderDockState({
    isReading: true,
    isPaused: false,
    index: 4,
    queue: [{}, {}, {}, {}, {}, {}]
  }, 12), {
    canContinue: false,
    canStop: true,
    canRestart: true,
    primaryLabel: "朗读中 5/6"
  });

  assert.deepEqual(getReaderDockState({
    isReading: false,
    isPaused: true,
    index: 4,
    queue: [{}, {}, {}, {}, {}, {}]
  }, 12), {
    canContinue: true,
    canStop: false,
    canRestart: true,
    primaryLabel: "继续 5/6"
  });
});

test("重新朗读会立即停止上一次本地音频", () => {
  const previousAudio = {
    paused: false,
    currentTime: 3,
    pauseCalls: 0,
    pause() {
      this.paused = true;
      this.pauseCalls += 1;
    }
  };
  const nextAudio = {
    currentTime: 0,
    pause() {}
  };
  const owner = { currentAudio: previousAudio };

  replaceCurrentAudio(owner, nextAudio);

  assert.equal(previousAudio.paused, true);
  assert.equal(previousAudio.currentTime, 0);
  assert.equal(previousAudio.pauseCalls, 1);
  assert.equal(owner.currentAudio, nextAudio);
});
