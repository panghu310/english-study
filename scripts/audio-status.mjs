import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { WORDS } from "../src/words.js";

const ROOT = process.cwd();
const AUDIO_DIR = path.join(ROOT, "audio");
const LOG_FILE = path.join(ROOT, "data", "generated", "audio-all.log");

async function main() {
  const files = await listAudioFiles();
  const screen = spawnSync("screen", ["-ls"], { encoding: "utf8" });
  const screenOutput = `${screen.stdout || ""}${screen.stderr || ""}`;
  const isRunning = screenOutput.includes("english-audio");
  const recentLog = await readRecentLog();

  console.log(`音频：${files.length}/${WORDS.length}`);
  console.log(`后台生成：${isRunning ? "运行中" : "未运行"}`);
  if (recentLog) {
    console.log("最近日志：");
    console.log(recentLog);
  }
}

async function listAudioFiles() {
  try {
    const files = await fs.readdir(AUDIO_DIR);
    return files.filter((file) => file.endsWith(".m4a"));
  } catch {
    return [];
  }
}

async function readRecentLog() {
  try {
    const text = await fs.readFile(LOG_FILE, "utf8");
    return text.trim().split("\n").slice(-8).join("\n");
  } catch {
    return "";
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
