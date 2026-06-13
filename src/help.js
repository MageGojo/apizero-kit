/**
 * 帮助与列表展示。
 */
import { allEndpoints, endpointsByTag, getTagLabels, findEndpoint } from "./registry.js";
import { FRIENDLY, friendlyNames, getFriendly } from "./friendly.js";
import { c, printInfo } from "./output.js";
import { getConfigPath, resolveKey, maskKey } from "./config.js";

const VERSION = "1.0.0";

export function printVersion() {
  printInfo(`apizero v${VERSION}`);
}

export function printMainHelp() {
  const total = allEndpoints().length;
  printInfo(`${c.bold("apizero")} — 极数本源 ApiZero 命令行工具  ${c.gray("v" + VERSION)}`);
  printInfo(c.gray("一个 Key，一行命令，连接所有可能。"));
  printInfo("");
  printInfo(c.bold("用法"));
  printInfo(`  apizero <命令> [参数] [选项]`);
  printInfo("");
  printInfo(c.bold("常用命令（友好别名）"));
  for (const name of friendlyNames()) {
    const f = getFriendly(name);
    printInfo(`  ${c.cyan(name.padEnd(10))} ${f.desc}`);
  }
  printInfo("");
  printInfo(c.bold("Key 管理"));
  printInfo(`  ${c.cyan("setkey".padEnd(10))} 设置 API Key，例：apizero setkey sk_live_xxx`);
  printInfo(`  ${c.cyan("config".padEnd(10))} 查看当前配置与 Key 状态`);
  printInfo(`  ${c.cyan("delkey".padEnd(10))} 删除已保存的 API Key`);
  printInfo("");
  printInfo(c.bold("通用 / 探索"));
  printInfo(`  ${c.cyan("list".padEnd(10))} 列出全部 ${total} 个接口（按分类）`);
  printInfo(`  ${c.cyan("list <分类>".padEnd(10))} 列出某分类接口，如 apizero list ai`);
  printInfo(`  ${c.cyan("call <接口>".padEnd(10))} 调用任意接口，如 apizero call weather --city 北京`);
  printInfo(`  ${c.cyan("help <接口>".padEnd(10))} 查看某接口的参数说明`);
  printInfo(`  ${c.cyan("search <词>".padEnd(10))} 按关键词搜索接口`);
  printInfo("");
  printInfo(c.bold("全局选项"));
  printInfo(`  ${c.gray("--key <key>")}    指定本次调用使用的 API Key`);
  printInfo(`  ${c.gray("--json")}         输出完整原始 JSON（默认输出 data 摘要）`);
  printInfo(`  ${c.gray("--dry-run")}      只显示将要发起的请求，不真正调用`);
  printInfo(`  ${c.gray("--timeout <ms>")} 请求超时毫秒数（默认 30000）`);
  printInfo(`  ${c.gray("-h, --help")}     显示帮助`);
  printInfo("");
  printInfo(c.bold("示例"));
  printInfo("  apizero setkey sk_live_xxxxxxxx");
  printInfo("  apizero ip 8.8.8.8");
  printInfo("  apizero weather 北京");
  printInfo("  apizero ocr ./idcard.png");
  printInfo('  apizero video "https://v.douyin.com/xxxx/"');
  printInfo('  apizero ai "一只赛博朋克猫，电影感"');
  printInfo("  apizero call exchange-rate --from USD --to CNY");
  printInfo("");
  printInfo(c.gray(`Key 申请：https://apizero.cn/account/keys`));
}

/** apizero list [tag] */
export function printList(tag) {
  const labels = getTagLabels();
  const groups = endpointsByTag();

  if (tag) {
    const key = resolveTag(tag, labels);
    if (!key || !groups[key]) {
      printInfo(c.yellow(`未知分类：${tag}`));
      printInfo("可用分类：" + Object.keys(labels).map((t) => `${t}(${labels[t]})`).join("、"));
      return;
    }
    printTagGroup(key, labels[key], groups[key]);
    return;
  }

  printInfo(c.bold(`极数本源 全部接口（共 ${allEndpoints().length} 个）`));
  printInfo(c.gray("用 `apizero help <接口名>` 查看参数；`apizero call <接口名>` 调用。"));
  for (const t of Object.keys(labels)) {
    if (!groups[t]) continue;
    printInfo("");
    printTagGroup(t, labels[t], groups[t]);
  }
}

function printTagGroup(tag, label, list) {
  printInfo(`${c.bold(label)} ${c.gray("(" + tag + " · " + list.length + ")")}`);
  const width = Math.max(...list.map((e) => e.name.length));
  for (const e of list) {
    const method = e.method === "GET" ? c.green(e.method.padEnd(4)) : c.yellow(e.method.padEnd(4));
    printInfo(`  ${method} ${c.cyan(e.name.padEnd(width))}  ${c.gray(e.summary)}`);
  }
}

function resolveTag(input, labels) {
  const lower = String(input).toLowerCase();
  if (labels[lower]) return lower;
  // 支持用中文名匹配
  for (const [k, v] of Object.entries(labels)) {
    if (v === input) return k;
  }
  return null;
}

/** apizero help <接口名> 或 友好命令 */
export function printEndpointHelp(name) {
  // 友好命令优先
  if (FRIENDLY[name]) {
    const f = FRIENDLY[name];
    const ep = findEndpoint(f.endpoint);
    printInfo(`${c.bold(name)} ${c.gray("(友好命令 → " + f.endpoint + ")")}`);
    printInfo(f.desc);
    printInfo("");
    printInfo(c.bold("用法"));
    printInfo("  " + f.usage);
    if (f.examples) {
      printInfo("");
      printInfo(c.bold("示例"));
      f.examples.forEach((e) => printInfo("  " + e));
    }
    if (ep) {
      printInfo("");
      printInfo(c.gray(`底层接口：${ep.method} ${ep.path}`));
      printParamTable(ep);
    }
    return;
  }

  const ep = findEndpoint(name);
  if (!ep) {
    printInfo(c.yellow(`未找到接口：${name}`));
    printInfo(`用 ${c.cyan("apizero list")} 查看全部接口，或 ${c.cyan("apizero search " + name)} 搜索。`);
    return;
  }

  printInfo(`${c.bold(ep.name)}  ${c.gray("[" + ep.method + " " + ep.path + "]")}`);
  printInfo(ep.summary);
  if (ep.description && ep.description !== ep.summary) {
    printInfo(c.gray(ep.description));
  }
  printInfo("");
  printInfo(c.bold("调用"));
  const sample = buildSampleCommand(ep);
  printInfo("  " + sample);
  printParamTable(ep);

  const pr = ep.pricing || {};
  printInfo("");
  printInfo(c.bold("配额 / 计费"));
  printInfo(
    c.gray(
      `  单次积分 ${pr.pointCost ?? "—"} · QPS ${pr.qpsLimit ?? "—"} · ` +
        `登录每日 ${pr.dailyFreeLimit ?? "—"} 次免费 · 匿名每日 ${pr.noKeyDaily ?? "—"} 次`
    )
  );
  if (ep.docUrl) printInfo(c.gray(`  文档：${ep.docUrl}`));
}

function printParamTable(ep) {
  printInfo("");
  printInfo(c.bold("参数"));
  if (!ep.params.length) {
    printInfo(c.gray("  （无参数）"));
    return;
  }
  const nameW = Math.max(...ep.params.map((p) => p.name.length));
  for (const p of ep.params) {
    const req = p.required ? c.red("必填") : c.gray("可选");
    let line = `  --${c.cyan(p.name.padEnd(nameW))}  ${req}  ${c.gray(p.type)}`;
    printInfo(line);
    if (p.description) printInfo(`      ${c.gray(p.description)}`);
    if (p.enum) printInfo(`      ${c.gray("可选值: " + p.enum.join(" / "))}`);
    if (p.example !== undefined && p.example !== null && p.example !== "")
      printInfo(`      ${c.gray("示例: " + p.example)}`);
  }
}

function buildSampleCommand(ep) {
  const parts = [`apizero call ${ep.name}`];
  for (const p of ep.params) {
    if (!p.required) continue;
    let val = p.example;
    if (val === undefined || val === null || val === "") val = `<${p.name}>`;
    if (typeof val === "string" && val.includes(" ")) val = `"${val}"`;
    parts.push(`--${p.name} ${val}`);
  }
  return parts.join(" ");
}

/** apizero config */
export function printConfigStatus() {
  const key = resolveKey();
  printInfo(c.bold("apizero 配置"));
  printInfo(`  配置文件：${c.gray(getConfigPath())}`);
  printInfo(`  当前 Key：${key ? c.green(maskKey(key)) : c.yellow("未设置（仅可用匿名免费额度）")}`);
  const src = keySource();
  if (key) printInfo(`  Key 来源：${c.gray(src)}`);
  printInfo("");
  printInfo(c.gray("设置 Key：apizero setkey <你的Key>"));
  printInfo(c.gray("Key 申请：https://apizero.cn/account/keys"));
}

function keySource() {
  if (process.env.APIZERO_KEY || process.env.APIZERO_API_KEY) return "环境变量 APIZERO_KEY";
  return "配置文件";
}

/** apizero search <词> */
export function printSearch(keyword) {
  const kw = String(keyword || "").toLowerCase();
  if (!kw) {
    printInfo(c.yellow("请提供搜索关键词，例：apizero search 翻译"));
    return;
  }
  const hits = allEndpoints().filter(
    (e) =>
      e.name.toLowerCase().includes(kw) ||
      (e.summary || "").toLowerCase().includes(kw) ||
      (e.description || "").toLowerCase().includes(kw)
  );
  if (!hits.length) {
    printInfo(c.yellow(`没有匹配「${keyword}」的接口。`));
    return;
  }
  printInfo(c.bold(`匹配「${keyword}」的接口（${hits.length} 个）`));
  const width = Math.max(...hits.map((e) => e.name.length));
  for (const e of hits) {
    const method = e.method === "GET" ? c.green(e.method.padEnd(4)) : c.yellow(e.method.padEnd(4));
    printInfo(`  ${method} ${c.cyan(e.name.padEnd(width))}  ${c.gray(e.summary)}`);
  }
}

export { VERSION };
