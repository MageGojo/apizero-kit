/**
 * 轻量命令行参数解析（零依赖）。
 *
 * 支持：
 *   --name value     选项带值
 *   --name=value     选项带值（等号形式）
 *   --flag           布尔开关
 *   -k value         短选项（部分内置别名）
 *   其余非 -- 开头的视为位置参数
 *
 * 全局选项（任意命令可用）：
 *   --key <key>      指定本次调用的 API Key
 *   --json           原样输出完整 JSON
 *   --raw            等同 --json
 *   --timeout <ms>   请求超时
 *   --dry-run        只打印将要发起的请求，不真正调用
 *   -h, --help       显示帮助
 */

const SHORT_ALIASES = {
  "-h": "--help",
  "-k": "--key",
  "-j": "--json",
};

// 已知的布尔型全局开关（不消耗后一个参数）
const BOOLEAN_FLAGS = new Set(["help", "json", "raw", "dry-run", "version", "no-color"]);

export function parseArgs(argv) {
  const positionals = [];
  const options = {};

  for (let i = 0; i < argv.length; i++) {
    let token = argv[i];

    if (SHORT_ALIASES[token]) token = SHORT_ALIASES[token];

    if (token.startsWith("--")) {
      let key = token.slice(2);
      let value;

      const eq = key.indexOf("=");
      if (eq !== -1) {
        value = key.slice(eq + 1);
        key = key.slice(0, eq);
        options[key] = value;
        continue;
      }

      if (BOOLEAN_FLAGS.has(key)) {
        options[key] = true;
        continue;
      }

      // 取下一个 token 作为值；若下一个是选项或不存在，则当作布尔
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        options[key] = true;
      } else {
        options[key] = next;
        i++;
      }
    } else if (token.startsWith("-") && token.length > 1 && !/^-\d/.test(token)) {
      // 未识别的短选项，按布尔处理
      options[token.slice(1)] = true;
    } else {
      positionals.push(token);
    }
  }

  return { positionals, options };
}

/** 从 options 中抽取全局选项，返回 { global, rest } */
export function extractGlobals(options) {
  const global = {
    key: typeof options.key === "string" ? options.key : undefined,
    json: !!(options.json || options.raw),
    timeout: options.timeout ? Number(options.timeout) : undefined,
    dryRun: !!options["dry-run"],
    help: !!options.help,
  };
  const rest = { ...options };
  for (const k of ["key", "json", "raw", "timeout", "dry-run", "help"]) {
    delete rest[k];
  }
  return { global, rest };
}
