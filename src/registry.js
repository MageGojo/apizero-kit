/**
 * 加载接口清单 registry.json，并提供查询辅助。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(__dirname, "..", "registry.json");

let _registry = null;

export function loadRegistry() {
  if (_registry) return _registry;
  _registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  return _registry;
}

export function getBaseUrl() {
  return loadRegistry().baseUrl;
}

/** 按命令名（或 path 末段）查找接口 */
export function findEndpoint(name) {
  const reg = loadRegistry();
  const target = String(name).toLowerCase();
  return (
    reg.endpoints.find((e) => e.name === target) ||
    reg.endpoints.find((e) => e.path.split("/").pop() === target) ||
    null
  );
}

export function allEndpoints() {
  return loadRegistry().endpoints;
}

export function endpointsByTag() {
  const reg = loadRegistry();
  const groups = {};
  for (const e of reg.endpoints) {
    (groups[e.tag] = groups[e.tag] || []).push(e);
  }
  return groups;
}

export function getTagLabels() {
  return loadRegistry().tags || {};
}
