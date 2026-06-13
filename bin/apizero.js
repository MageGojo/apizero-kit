#!/usr/bin/env node
/**
 * apizero —— 极数本源 ApiZero 平台命令行工具入口。
 *
 * 路由优先级：
 *   1. 内置命令：setkey / delkey / config / list / search / help / call / version
 *   2. 友好命令：ip / weather / ocr / video / ai
 *   3. 直接接口名：apizero weather --city 北京（等价 apizero call weather ...）
 */
import { parseArgs, extractGlobals } from "../src/args.js";
import { setKey, clearKey, getConfigPath } from "../src/config.js";
import { findEndpoint } from "../src/registry.js";
import { runEndpoint } from "../src/runner.js";
import {
  isFriendlyCommand,
  runFriendly,
} from "../src/friendly.js";
import {
  printMainHelp,
  printList,
  printEndpointHelp,
  printConfigStatus,
  printSearch,
  printVersion,
} from "../src/help.js";
import { c, printError, printSuccess, printInfo } from "../src/output.js";

async function main() {
  const argv = process.argv.slice(2);
  const { positionals, options } = parseArgs(argv);
  const { global, rest } = extractGlobals(options);

  const command = positionals[0];
  const args = positionals.slice(1);

  // 无命令 或 顶层 --help / --version
  if (!command) {
    if (options.version) return printVersion(), 0;
    printMainHelp();
    return 0;
  }
  if (command === "--version" || command === "version") {
    printVersion();
    return 0;
  }

  switch (command) {
    case "help": {
      if (args[0]) printEndpointHelp(args[0]);
      else printMainHelp();
      return 0;
    }

    case "setkey": {
      const key = args[0] || (typeof rest.key === "string" ? rest.key : "");
      if (!key) {
        printError("请提供 API Key，例：apizero setkey sk_live_xxxxxxxx");
        return 1;
      }
      const path = setKey(key);
      printSuccess(`API Key 已保存到 ${c.gray(path)}`);
      printInfo(c.gray("现在可以直接调用任意接口了，例：apizero weather 北京"));
      return 0;
    }

    case "delkey": {
      clearKey();
      printSuccess(`已删除保存的 API Key（${c.gray(getConfigPath())}）`);
      return 0;
    }

    case "config": {
      printConfigStatus();
      return 0;
    }

    case "list":
    case "ls": {
      printList(args[0]);
      return 0;
    }

    case "search":
    case "find": {
      printSearch(args[0]);
      return 0;
    }

    case "call":
    case "api": {
      const epName = args[0];
      if (!epName) {
        printError("请指定接口名，例：apizero call weather --city 北京");
        printInfo(c.gray("用 `apizero list` 查看全部接口。"));
        return 1;
      }
      const endpoint = findEndpoint(epName);
      if (!endpoint) {
        printError(`未找到接口：${epName}`);
        printInfo(`用 ${c.cyan("apizero search " + epName)} 搜索，或 ${c.cyan("apizero list")} 查看全部。`);
        return 1;
      }
      if (global.help) {
        printEndpointHelp(endpoint.name);
        return 0;
      }
      // rest 即为接口字段（已剔除全局选项）
      return runEndpoint(endpoint, rest, global);
    }

    default: {
      // 友好命令
      if (isFriendlyCommand(command)) {
        if (global.help) {
          printEndpointHelp(command);
          return 0;
        }
        return runFriendly(command, args, rest, global);
      }

      // 直接接口名（等价 call）
      const endpoint = findEndpoint(command);
      if (endpoint) {
        if (global.help) {
          printEndpointHelp(endpoint.name);
          return 0;
        }
        return runEndpoint(endpoint, rest, global);
      }

      printError(`未知命令或接口：${command}`);
      printInfo(`用 ${c.cyan("apizero --help")} 查看用法，或 ${c.cyan("apizero search " + command)} 搜索接口。`);
      return 1;
    }
  }
}

main()
  .then((code) => process.exit(typeof code === "number" ? code : 0))
  .catch((err) => {
    printError(err && err.message ? err.message : String(err));
    process.exit(1);
  });
