/**
 * 统一请求层：鉴权注入、GET/POST 构造、超时、错误码语义化。
 *
 * 极数本源响应信封：{ code, msg, data, request_id }
 *   - code === 0 表示成功
 *   - 其它 code 为平台统一错误码（见 ERROR_HINTS）
 */
import { resolveKey } from "./config.js";

const DEFAULT_TIMEOUT_MS = 30000;

/** 平台统一错误码 → 友好中文提示 */
const ERROR_HINTS = {
  4000: "参数错误，请检查输入的参数是否正确、完整。",
  4011: "API Key 无效，请用 `apizero setkey <你的Key>` 重新设置。",
  4013: "API Key 已被暂停，请到控制台 https://apizero.cn/account/keys 查看。",
  4014: "当前 IP 不在该 API Key 的白名单内，请到控制台调整白名单。",
  4015: "匿名调用的每日免费额度已用完，请用 `apizero setkey <你的Key>` 设置 Key。",
  4022: "账户余额不足，请到 https://apizero.cn 充值后再试。",
  4029: "调用过快（超过 QPS 限制），请稍后重试。",
  4030: "今日免费额度已用完，请设置/更换 API Key 或升级套餐。",
  5020: "上游数据源暂不可用（连接失败 / 超时 / 返回空），请稍后重试。",
  5021: "上游返回格式异常或业务解析失败。",
  5030: "上游服务未正确配置（平台侧问题），请联系平台。",
};

export class ApiError extends Error {
  constructor(message, { code, httpStatus, requestId, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.requestId = requestId;
    this.body = body;
  }
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(path.replace(/^\//, ""), baseUrl.replace(/\/?$/, "/"));
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/**
 * 发起一次接口调用。
 * @param {object} opts
 * @param {string} opts.baseUrl  网关基址
 * @param {string} opts.path     接口路径，如 /api/weather
 * @param {string} opts.method   GET / POST
 * @param {object} [opts.query]  GET 查询参数 / POST 也可附带
 * @param {object} [opts.body]   POST 请求体
 * @param {string} [opts.contentType] POST body 编码
 * @param {string} [opts.key]    显式 API Key（覆盖配置/环境变量）
 * @param {number} [opts.timeout]
 * @returns {Promise<{ok:boolean, code:number, msg:string, data:any, requestId:string, raw:any, httpStatus:number}>}
 */
export async function callApi({
  baseUrl,
  path,
  method = "GET",
  query,
  body,
  contentType = "application/json",
  key,
  timeout = DEFAULT_TIMEOUT_MS,
} = {}) {
  const apiKey = resolveKey(key);
  const url = buildUrl(baseUrl, path, query);

  const headers = {
    Accept: "application/json",
    "User-Agent": "apizero-cli",
  };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const init = { method, headers };

  if (method !== "GET" && body && Object.keys(body).length > 0) {
    if (contentType === "application/x-www-form-urlencoded") {
      headers["Content-Type"] = contentType;
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (v === undefined || v === null) continue;
        form.set(k, String(v));
      }
      init.body = form.toString();
    } else {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  init.signal = controller.signal;

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new ApiError(`请求超时（>${timeout}ms）：${url}`, {});
    }
    throw new ApiError(`网络请求失败：${err.message}`, {});
  }
  clearTimeout(timer);

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(
      `服务返回非 JSON（HTTP ${res.status}）：${text.slice(0, 200)}`,
      { httpStatus: res.status, body: text }
    );
  }

  const code = json.code;
  const msg = json.msg || json.message || "";
  const requestId = json.request_id || res.headers.get("x-request-id") || "";

  // 业务成功：code === 0
  if (code === 0) {
    return {
      ok: true,
      code,
      msg,
      data: json.data,
      requestId,
      raw: json,
      httpStatus: res.status,
    };
  }

  // 业务失败：拼装友好提示
  const hint = ERROR_HINTS[code];
  let message = msg || `请求失败（code: ${code}）`;
  if (hint) message = `${message}\n  ${hint}`;
  throw new ApiError(message, {
    code,
    httpStatus: res.status,
    requestId,
    body: json,
  });
}

export { ERROR_HINTS };
