/**
 * 终端输出工具：ANSI 着色、JSON 美化、键值摘要渲染。
 * 零依赖。当输出非 TTY（管道/重定向）或设置 NO_COLOR 时自动关闭颜色。
 */
const useColor =
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";

function wrap(code) {
  return (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
}

export const c = {
  bold: wrap("1"),
  dim: wrap("2"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  blue: wrap("34"),
  magenta: wrap("35"),
  cyan: wrap("36"),
  gray: wrap("90"),
};

export function printError(msg) {
  process.stderr.write(c.red("✖ ") + msg + "\n");
}

export function printWarn(msg) {
  process.stderr.write(c.yellow("! ") + msg + "\n");
}

export function printSuccess(msg) {
  process.stdout.write(c.green("✓ ") + msg + "\n");
}

export function printInfo(msg) {
  process.stdout.write(msg + "\n");
}

/** 彩色 JSON 输出（基础 token 着色） */
export function printJson(obj) {
  const json = JSON.stringify(obj, null, 2);
  if (!useColor) {
    process.stdout.write(json + "\n");
    return;
  }
  const colored = json
    // 键名
    .replace(/"([^"]+)":/g, (_, k) => `${c.cyan('"' + k + '"')}:`)
    // 字符串值
    .replace(/: "([^"]*)"/g, (_, v) => `: ${c.green('"' + v + '"')}`)
    // 数字/布尔/null
    .replace(/: (-?\d+\.?\d*)(,?)$/gm, (_, n, comma) => `: ${c.yellow(n)}${comma}`)
    .replace(/: (true|false|null)(,?)$/gm, (_, b, comma) => `: ${c.magenta(b)}${comma}`);
  process.stdout.write(colored + "\n");
}

/** 把一个扁平对象渲染成对齐的「键: 值」列表 */
export function printKeyValues(obj, { indent = 0 } = {}) {
  const pad = " ".repeat(indent);
  const keys = Object.keys(obj);
  const width = Math.max(0, ...keys.map((k) => k.length));
  for (const k of keys) {
    let v = obj[k];
    if (v === null || v === undefined || v === "") v = c.gray("—");
    else if (typeof v === "object") v = JSON.stringify(v);
    process.stdout.write(`${pad}${c.gray(k.padEnd(width))}  ${v}\n`);
  }
}

export function isColorEnabled() {
  return useColor;
}
