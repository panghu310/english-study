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
