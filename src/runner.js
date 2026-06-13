/**
 * 通用接口执行器：把一个 registry 接口定义 + 参数，变成一次实际调用并输出结果。
 * 被「通用子命令」与「友好命令」共同复用。
 */
import { callApi, ApiError } from "./http.js";
import { getBaseUrl } from "./registry.js";
import { resolveKey, maskKey } from "./config.js";
import { c, printJson, printError, printKeyValues, printInfo } from "./output.js";

/**
 * 根据接口定义和用户提供的字段值，拆分出 query 与 body。
 * @param {object} endpoint registry 中的接口
 * @param {object} values   字段名 -> 值（已从命令行解析）
 */
export function buildRequest(endpoint, values) {
  const query = {};
  const body = {};
  for (const p of endpoint.params) {
    const v = values[p.name];
    if (v === undefined) continue;
    if (endpoint.method === "GET") {
      query[p.name] = v;
    } else {
      body[p.name] = v;
    }
  }
  return { query, body };
}

/** 校验必填参数，返回缺失的参数名数组 */
export function findMissingRequired(endpoint, values) {
  return endpoint.params
    .filter((p) => p.required && (values[p.name] === undefined || values[p.name] === ""))
    .map((p) => p.name);
}

/**
 * 执行一个接口调用。
 * @returns {Promise<number>} 进程退出码
 */
export async function runEndpoint(endpoint, values, global = {}) {
  const missing = findMissingRequired(endpoint, values);
  if (missing.length) {
    printError(
      `缺少必填参数：${missing.map((m) => c.bold(m)).join(", ")}\n  用 ${c.cyan(
        "apizero help " + endpoint.name
      )} 查看该接口的参数说明。`
    );
    return 1;
  }

  const { query, body } = buildRequest(endpoint, values);

  if (global.dryRun) {
    const baseUrl = getBaseUrl();
    printInfo(c.bold("DRY-RUN（不会真正发起请求）"));
    printKeyValues({
      接口: `${endpoint.method} ${endpoint.path}`,
      名称: endpoint.summary,
      Key: maskKey(resolveKey(global.key)),
      query: Object.keys(query).length ? JSON.stringify(query) : "—",
      body: Object.keys(body).length ? JSON.stringify(body) : "—",
    });
    return 0;
  }

  try {
    const result = await callApi({
      baseUrl: getBaseUrl(),
      path: endpoint.path,
      method: endpoint.method,
      query,
      body,
      contentType: endpoint.contentType,
      key: global.key,
      timeout: global.timeout,
    });

    if (global.json) {
      printJson(result.raw);
    } else {
      // 默认输出 data 部分（更干净）；data 非对象时直接打印
      if (result.data && typeof result.data === "object") {
        printJson(result.data);
      } else {
        printInfo(String(result.data));
      }
      if (result.requestId) {
        process.stderr.write(c.gray(`request_id: ${result.requestId}\n`));
      }
    }
    return 0;
  } catch (err) {
    if (err instanceof ApiError) {
      printError(err.message);
      if (err.requestId) process.stderr.write(c.gray(`request_id: ${err.requestId}\n`));
      return 1;
    }
    printError(err.message || String(err));
    return 1;
  }
}
