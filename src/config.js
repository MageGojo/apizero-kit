/**
 * 配置管理：API Key 与默认设置。
 *
 * 存储位置：~/.apizero/config.json
 * Key 解析优先级（从高到低）：
 *   1. 命令行 --key 选项
 *   2. 环境变量 APIZERO_KEY / APIZERO_API_KEY
 *   3. 配置文件 ~/.apizero/config.json
 */
import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";

const CONFIG_DIR = join(homedir(), ".apizero");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function getConfigPath() {
  return CONFIG_FILE;
}

export function readConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

export function writeConfig(config) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  // 配置含密钥，限制为仅本人可读写
  try {
    chmodSync(CONFIG_FILE, 0o600);
  } catch {
    /* Windows 等平台可能不支持，忽略 */
  }
}

export function setKey(key) {
  const config = readConfig();
  config.key = key;
  writeConfig(config);
  return CONFIG_FILE;
}

export function clearKey() {
  const config = readConfig();
  delete config.key;
  writeConfig(config);
  return CONFIG_FILE;
}

/**
 * 解析最终生效的 API Key。
 * @param {string} [cliKey] 命令行显式传入的 key
 */
export function resolveKey(cliKey) {
  if (cliKey && cliKey.trim()) return cliKey.trim();
  const envKey = process.env.APIZERO_KEY || process.env.APIZERO_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  const config = readConfig();
  if (config.key && String(config.key).trim()) return String(config.key).trim();
  return "";
}

/** 返回 key 的脱敏展示形式，如 sk_live_ab****wxyz */
export function maskKey(key) {
  if (!key) return "(未设置)";
  if (key.length <= 10) return key.slice(0, 2) + "****";
  return key.slice(0, 8) + "****" + key.slice(-4);
}
