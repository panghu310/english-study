import assert from "node:assert/strict";
import test from "node:test";
import {
  countByStatus,
  getAvailableActions,
  getAudioPath,
  getContinuousReadQueue,
  getStatusTabs,
  getVisibleWords
} from "../src/app.js";

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
