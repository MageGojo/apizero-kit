#!/usr/bin/env node
/**
 * 从 openapi.json 生成精简的接口清单 registry.json。
 * CLI 运行时只依赖 registry.json，不依赖庞大的 openapi.json。
 *
 * 用法: node scripts/build-registry.js
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const OPENAPI_PATH = join(root, "openapi.json");
const OUT_PATH = join(root, "registry.json");

// 这些「参数」其实是鉴权头，由 CLI 统一注入，不应暴露为命令行选项
const AUTH_PARAM_NAMES = new Set([
  "authorization",
  "x-api-key",
  "apikey",
  "api-key",
  "key",
]);

const TAG_LABELS = {
  life: "生活服务",
  ocrdata: "文档识别",
  finance: "金融数据",
  ai: "AI 能力",
  geo: "地理位置",
  kyc: "身份核验",
  content: "内容娱乐",
  dev: "开发工具",
};

function isAuthParam(name) {
  return AUTH_PARAM_NAMES.has(String(name).toLowerCase());
}

/** 把 operationId / slug 规整成简短命令名，例如 ocr_text -> ocr-text */
function toCommandName(operationId, path) {
  let base = operationId;
  if (!base) {
    // 退化：从 path 末段取
    base = path.split("/").filter(Boolean).pop();
  }
  return String(base).replace(/_/g, "-").toLowerCase();
}

function collectGetParams(op) {
  const params = [];
  for (const p of op.parameters || []) {
    if (p.in !== "query") continue;
    if (isAuthParam(p.name)) continue;
    const schema = p.schema || {};
    params.push({
      name: p.name,
      required: !!p.required,
      type: schema.type || "string",
      description: (p.description || "").trim(),
      enum: schema.enum || undefined,
      default: schema.default,
      example: p.example ?? schema.example,
    });
  }
  return params;
}

function collectPostParams(op) {
  const params = [];
  const content = op.requestBody?.content || {};
  // 优先 json，其次 form
  const ct =
    content["application/json"] ||
    content["application/x-www-form-urlencoded"] ||
    content["multipart/form-data"] ||
    Object.values(content)[0];
  if (!ct) return { params, contentType: "application/json" };

  const contentType = content["application/json"]
    ? "application/json"
    : content["application/x-www-form-urlencoded"]
    ? "application/x-www-form-urlencoded"
    : content["multipart/form-data"]
    ? "multipart/form-data"
    : "application/json";

  const schema = ct.schema || {};
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  for (const name of Object.keys(props)) {
    if (isAuthParam(name)) continue;
    const ps = props[name] || {};
    params.push({
      name,
      required: required.has(name),
      type: ps.type || "string",
      description: (ps.description || "").trim(),
      enum: ps.enum || undefined,
      default: ps.default,
      example: ps.example,
    });
  }
  return { params, contentType };
}

function main() {
  const spec = JSON.parse(readFileSync(OPENAPI_PATH, "utf8"));
  const paths = spec.paths || {};
  const endpoints = [];

  for (const path of Object.keys(paths)) {
    const item = paths[path];
    for (const method of Object.keys(item)) {
      if (!["get", "post", "put", "delete"].includes(method)) continue;
      const op = item[method];
      const name = toCommandName(op.operationId, path);
      const tag = (op.tags && op.tags[0]) || "other";
      const pricing = op["x-pricing"] || {};

      let params = [];
      let contentType;
      if (method === "post") {
        const r = collectPostParams(op);
        params = r.params;
        contentType = r.contentType;
      } else {
        params = collectGetParams(op);
      }

      endpoints.push({
        name,
        method: method.toUpperCase(),
        path,
        tag,
        tagLabel: TAG_LABELS[tag] || tag,
        summary: (op.summary || "").trim(),
        description: (op.description || "").trim().slice(0, 500),
        docUrl: op["x-doc-url"] || "",
        pricing: {
          pointCost: pricing.point_cost,
          qpsLimit: pricing.qps_limit,
          dailyFreeLimit: pricing.daily_free_limit,
          noKeyDaily: pricing.no_key_daily,
        },
        contentType,
        params,
      });
    }
  }

  endpoints.sort((a, b) => a.name.localeCompare(b.name));

  const registry = {
    generatedAt: new Date().toISOString(),
    baseUrl: (spec.servers && spec.servers[0] && spec.servers[0].url) || "https://v1.apizero.cn",
    platform: spec.info?.title || "极数本源 ApiZero",
    total: endpoints.length,
    tags: TAG_LABELS,
    endpoints,
  };

  writeFileSync(OUT_PATH, JSON.stringify(registry, null, 2), "utf8");
  console.log(`已生成 ${OUT_PATH}`);
  console.log(`接口总数: ${endpoints.length}`);
  const byTag = {};
  for (const e of endpoints) byTag[e.tag] = (byTag[e.tag] || 0) + 1;
  console.log("分类分布:", JSON.stringify(byTag));
}

main();
