import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { WORDS } from "../src/words.js";

const ROOT = process.cwd();
const AUDIO_DIR = path.join(ROOT, "audio");
const TEMP_DIR = path.join(ROOT, "data", "tmp-audio");

function getArg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function main() {
  const limit = Number(getArg("limit", "0"));
  const voice = getArg("voice", "Samantha");
  const rate = getArg("rate", "160");
  const selected = limit > 0 ? WORDS.slice(0, limit) : WORDS;

  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });

  let generated = 0;
  let skipped = 0;

  for (const item of selected) {
    const output = path.join(ROOT, item.audio);

    if (await exists(output)) {
      skipped += 1;
      continue;
    }

    await generateOne(item.word, output, voice, rate);
    generated += 1;

    if (generated % 25 === 0) {
      console.log(`音频已生成：${generated}，已跳过：${skipped}`);
    }
  }

  console.log(`完成。新生成 ${generated} 个，跳过 ${skipped} 个。`);
}

async function generateOne(word, output, voice, rate) {
  const safe = safeAudioName(word);
  const tempAiff = path.join(TEMP_DIR, `${safe}.aiff`);

  await run("say", ["-v", voice, "-r", rate, "-o", tempAiff, word]);
  await run("ffmpeg", ["-y", "-loglevel", "error", "-i", tempAiff, "-c:a", "aac", "-b:a", "48k", output]);
  await fs.rm(tempAiff, { force: true });
}

function safeAudioName(word) {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} 退出码 ${code}`));
      }
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
