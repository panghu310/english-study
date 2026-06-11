import assert from "node:assert/strict";
import test from "node:test";
import { WORDS } from "../../src/words.js";

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
