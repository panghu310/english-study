import fs from "node:fs/promises";
import path from "node:path";
import Hypher from "hypher";
import english from "hyphenation.en-us";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "data", "source");
const CACHE_DIR = path.join(ROOT, "data", "cache");
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const WORDS_OUTPUT = path.join(ROOT, "src", "words.js");
const TRANSLATION_CACHE = path.join(CACHE_DIR, "translations.json");

const OXFORD_URL = "https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000";
const CSAVL_URL = "https://www.eapfoundation.com/vocab/academic/other/csavl/";
const CSAVLS_URL = "https://www.eapfoundation.com/vocab/academic/other/csavl/?list=csavls#csavlmain";

const h = new Hypher(english);

const SYLLABLE_OVERRIDES = {
  computer: "com.put.er",
  database: "da.ta.base",
  important: "im.por.tant",
  information: "in.for.ma.tion",
  remember: "re.mem.ber",
  understand: "un.der.stand",
  performance: "per.for.mance",
  algorithm: "al.go.rithm",
  deploy: "de.ploy",
  message: "mes.sage"
};

const MEANING_OVERRIDES = {
  a: "一个",
  about: "关于",
  computer: "计算机",
  database: "数据库",
  deploy: "部署",
  network: "网络",
  performance: "性能",
  algorithm: "算法",
  message: "消息",
  important: "重要的",
  information: "信息",
  remember: "记住",
  understand: "理解"
};

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function ensureDirs() {
  await fs.mkdir(SOURCE_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function fetchCached(url, fileName) {
  const file = path.join(SOURCE_DIR, fileName);
  if (!hasFlag("refresh")) {
    try {
      return await fs.readFile(file, "utf8");
    } catch {
      // 没有缓存时继续下载。
    }
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "english-pocket-dictionary-local-builder/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`下载失败 ${response.status}: ${url}`);
  }

  const text = await response.text();
  await fs.writeFile(file, text);
  return text;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function normalizeWord(word) {
  return decodeHtml(word).toLowerCase().replace(/\s+/g, " ").trim();
}

function isUsefulWord(word) {
  return /^[a-z][a-z-]*$/.test(word);
}

function parseOxford(html) {
  const items = [];
  const liRegex = /<li\b[^>]*data-hw="([^"]+)"[^>]*>.*?<\/li>/gs;
  let match;
  let rank = 0;

  while ((match = liRegex.exec(html))) {
    const block = match[0];
    const word = normalizeWord(match[1]);
    if (!isUsefulWord(word)) continue;

    rank += 1;
    const level = block.match(/data-ox5000="([^"]+)"/)?.[1] || block.match(/data-ox3000="([^"]+)"/)?.[1] || "";
    const pos = decodeHtml(block.match(/<span class="pos">([^<]+)<\/span>/)?.[1] || "");

    items.push({
      word,
      category: "daily",
      source: "oxford5000",
      level,
      pos,
      rank
    });
  }

  return uniqueByWord(items);
}

function parseCsavl(html, sourceName) {
  const items = [];
  const rowRegex = /<tr><td>(\d+)<\/td><td>([^<]+)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g;
  let match;

  while ((match = rowRegex.exec(html))) {
    const word = normalizeWord(match[2]);
    if (!isUsefulWord(word)) continue;

    items.push({
      word,
      category: "it",
      source: sourceName,
      level: "",
      pos: decodeHtml(match[4]),
      rank: Number(match[1])
    });
  }

  return uniqueByWord(items);
}

function uniqueByWord(items) {
  const seen = new Map();

  for (const item of items) {
    if (!seen.has(item.word)) {
      seen.set(item.word, item);
      continue;
    }

    const existing = seen.get(item.word);
    if (item.category === "it") existing.category = "it";
    if (!existing.pos && item.pos) existing.pos = item.pos;
    if (existing.source !== item.source && !existing.source.includes(item.source)) {
      existing.source = `${existing.source},${item.source}`;
    }
  }

  return [...seen.values()];
}

async function translateWords(words) {
  const cache = await readJson(TRANSLATION_CACHE, {});
  const missing = words.filter((word) => !cache[word]);
  const batchSize = Number(getArg("batch", "60"));

  for (let index = 0; index < missing.length; index += batchSize) {
    const batch = missing.slice(index, index + batchSize);
    const translations = await translateBatch(batch);

    for (let i = 0; i < batch.length; i += 1) {
      cache[batch[i]] = cleanMeaning(translations[i] || batch[i]);
    }

    await fs.writeFile(TRANSLATION_CACHE, `${JSON.stringify(cache, null, 2)}\n`);
    console.log(`释义缓存：${Math.min(index + batch.length, missing.length)}/${missing.length}`);
    await sleep(220);
  }

  return cache;
}

async function translateBatch(words) {
  const query = words.join("\n");
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`翻译失败 ${response.status}`);
  }

  const data = await response.json();
  const joined = data[0].map((item) => item[0]).join("");
  const lines = joined.split("\n").map((line) => line.trim()).filter(Boolean);

  if (lines.length === words.length) {
    return lines;
  }

  const fallback = [];
  for (const word of words) {
    fallback.push(await translateOne(word));
    await sleep(80);
  }
  return fallback;
}

async function translateOne(word) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
  const response = await fetch(url);
  if (!response.ok) return word;
  const data = await response.json();
  return data[0].map((item) => item[0]).join("").trim();
}

function cleanMeaning(value) {
  const raw = String(value || "").trim();
  return raw
    .replace(/\s+/g, "")
    .split(/[;；,，、]/)[0]
    .slice(0, 10) || raw;
}

function syllabify(word) {
  if (Object.hasOwn(SYLLABLE_OVERRIDES, word)) return SYLLABLE_OVERRIDES[word];
  const parts = h.hyphenate(word);
  return parts.length > 0 ? parts.join(".") : word;
}

function toWordEntry(item, translations) {
  return {
    word: item.word,
    syllables: syllabify(item.word),
    meaning: getMeaningOverride(item.word) || cleanMeaning(translations[item.word]) || item.word,
    category: item.category,
    source: item.source,
    level: item.level,
    pos: item.pos,
    audio: `audio/${safeAudioName(item.word)}.m4a`
  };
}

function getMeaningOverride(word) {
  return Object.hasOwn(MEANING_OVERRIDES, word) ? MEANING_OVERRIDES[word] : "";
}

function safeAudioName(word) {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mergeWordSources(oxfordWords, itWords) {
  const map = new Map();

  for (const item of oxfordWords) {
    map.set(item.word, { ...item });
  }

  for (const item of itWords) {
    const existing = map.get(item.word);
    if (!existing) {
      map.set(item.word, { ...item });
      continue;
    }

    existing.category = "it";
    existing.source = existing.source.includes(item.source) ? existing.source : `${existing.source},${item.source}`;
    if (!existing.pos && item.pos) existing.pos = item.pos;
  }

  return [...map.values()];
}

async function main() {
  await ensureDirs();

  const limit = Number(getArg("limit", "0"));
  const itLimit = Number(getArg("it-limit", "1000"));

  const oxfordHtml = await fetchCached(OXFORD_URL, "oxford3000-5000.html");
  const csavlHtml = await fetchCached(CSAVL_URL, "csavl.html");
  const csavlsHtml = await fetchCached(CSAVLS_URL, "csavls.html");

  const oxfordWords = parseOxford(oxfordHtml);
  const itWords = uniqueByWord([
    ...parseCsavl(csavlHtml, "csavl"),
    ...parseCsavl(csavlsHtml, "csavls")
  ]).slice(0, itLimit);

  const merged = mergeWordSources(oxfordWords, itWords);
  const selected = limit > 0 ? merged.slice(0, limit) : merged;
  const translations = await translateWords(selected.map((item) => item.word));
  const entries = selected.map((item) => normalizeEntry(toWordEntry(item, translations)));

  await fs.writeFile(WORDS_OUTPUT, `export const WORDS = ${JSON.stringify(entries, null, 2)};\n`);
  await fs.writeFile(path.join(GENERATED_DIR, "words-meta.json"), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    oxfordUnique: oxfordWords.length,
    itUnique: itWords.length,
    totalUnique: merged.length,
    outputCount: entries.length
  }, null, 2)}\n`);

  console.log(`Oxford 唯一词：${oxfordWords.length}`);
  console.log(`IT 唯一词：${itWords.length}`);
  console.log(`输出词数：${entries.length}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEntry(entry) {
  return {
    word: entry.word,
    syllables: entry.syllables || entry.word,
    meaning: entry.meaning || entry.word,
    category: entry.category || "daily",
    source: entry.source || "generated",
    level: entry.level || "",
    pos: entry.pos || "",
    audio: entry.audio || `audio/${safeAudioName(entry.word)}.m4a`
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
