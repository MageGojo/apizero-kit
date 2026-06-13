/**
 * 友好命令：为最常用的接口提供自然的命令行用法与美化输出。
 *
 *   apizero ip 8.8.8.8
 *   apizero weather 北京
 *   apizero ocr ./idcard.png        （本地文件自动转 base64；URL 直接用）
 *   apizero video "抖音/小红书链接"
 *   apizero ai "一只赛博朋克猫"        （豆包 Seedream 文生图）
 *
 * 每个友好命令把位置参数映射到接口主参数，并对返回结果做人性化摘要。
 * 仍支持 --json 输出原始数据，以及全局 --key / --dry-run 等。
 */
import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";
import { findEndpoint } from "./registry.js";
import { runEndpoint, buildRequest, findMissingRequired } from "./runner.js";
import { callApi, ApiError } from "./http.js";
import { getBaseUrl } from "./registry.js";
import { c, printJson, printError, printInfo, printKeyValues } from "./output.js";

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
};

function looksLikeUrl(s) {
  return /^https?:\/\//i.test(s);
}

/** 把本地图片读成 data URI；若已是 URL 原样返回 */
function imageToInput(pathOrUrl) {
  if (looksLikeUrl(pathOrUrl)) {
    return { input_type: "url", input_data: pathOrUrl };
  }
  if (!existsSync(pathOrUrl)) {
    throw new Error(`找不到文件：${pathOrUrl}（也不是 http/https URL）`);
  }
  const buf = readFileSync(pathOrUrl);
  const sizeMB = buf.length / 1024 / 1024;
  if (sizeMB > 6) {
    throw new Error(
      `图片过大（${sizeMB.toFixed(1)}MB），平台上限 6MB，请压缩后重试。`
    );
  }
  const mime = MIME_BY_EXT[extname(pathOrUrl).toLowerCase()] || "image/jpeg";
  const b64 = buf.toString("base64");
  return { input_type: "base64", input_data: `data:${mime};base64,${b64}` };
}

/**
 * 友好命令表。每项定义：
 *   endpoint: registry 接口名
 *   usage / desc: 帮助文案
 *   map(positionals, options): 返回字段值对象
 *   summarize(data): 可选，自定义人性化输出（返回 true 表示已自行输出）
 */
export const FRIENDLY = {
  ip: {
    endpoint: "ip-pro",
    usage: "apizero ip [IP地址]",
    desc: "查询 IP 归属地（街道级 + 运营商 + 风险）。不传则查询本机出口 IP。",
    examples: ["apizero ip 8.8.8.8", "apizero ip"],
    map(positionals) {
      const ip = positionals[0];
      return ip ? { ip } : {};
    },
    summarize(data) {
      if (!data || typeof data !== "object") return false;
      const risk = data.risk && typeof data.risk === "object" ? data.risk : null;
      let riskText;
      if (risk) {
        riskText = [risk.level, risk.tag].filter(Boolean).join(" ");
        if (risk.is_proxy) riskText += `（疑似代理${risk.proxy_type ? "：" + risk.proxy_type : ""}）`;
      } else {
        riskText = data.risk_label || data.usage_type;
      }
      printKeyValues({
        IP: data.ip,
        归属: [data.country, data.province, data.city, data.district]
          .filter(Boolean)
          .join(" "),
        街道: data.street || undefined,
        运营商: data.isp || data.asn_org || data.owner,
        经纬度:
          data.latitude != null && data.longitude != null
            ? `${data.latitude}, ${data.longitude}`
            : undefined,
        时区: data.time_zone || data.timezone,
        风险: riskText || undefined,
        数据档位: data.source,
      });
      return true;
    },
  },

  weather: {
    endpoint: "weather",
    usage: "apizero weather <城市> [--type realtime|daily|hourly|weather] [--days N]",
    desc: "查询天气（彩云天气）。默认返回实时天气摘要。",
    examples: [
      "apizero weather 北京",
      "apizero weather 上海 --type daily --days 7",
    ],
    map(positionals, options) {
      const city = positionals[0];
      const values = {};
      if (city) values.city = city;
      // 友好默认：不指定 type 时取实时，输出更聚焦
      values.type = options.type || "realtime";
      if (options.days) values.days = options.days;
      if (options.hours) values.hours = options.hours;
      if (options.location) {
        values.location = options.location;
        delete values.city;
      }
      if (options.alert !== undefined) values.alert = options.alert;
      return values;
    },
    validate(values) {
      if (!values.city && !values.location) {
        return "请提供城市名（或用 --location 经度,纬度）。";
      }
      return null;
    },
    summarize(data) {
      if (!data || typeof data !== "object") return false;
      const s = data.summary || {};
      const loc = data.location || {};
      if (data.type === "realtime" || s.temperature !== undefined) {
        const wind = s.wind || {};
        const air = s.air_quality || {};
        printKeyValues({
          城市: s.city || loc.city,
          天气: [s.skycon_emoji, s.skycon].filter(Boolean).join(" "),
          温度: s.temperature != null ? `${s.temperature}°C` : undefined,
          体感: s.apparent_temperature != null ? `${s.apparent_temperature}°C` : undefined,
          湿度:
            s.humidity_percent != null
              ? `${s.humidity_percent}%`
              : s.humidity != null
              ? `${Math.round(s.humidity * 100)}%`
              : undefined,
          风: [wind.direction_text, wind.level_text].filter(Boolean).join(" ") || undefined,
          能见度: s.visibility_km != null ? `${s.visibility_km} km` : undefined,
          空气质量:
            air.aqi != null
              ? `${air.level || ""} (AQI ${air.aqi}${air.pm25 != null ? ", PM2.5 " + air.pm25 : ""})`.trim()
              : undefined,
          预警: s.alert_count ? `${s.alert_count} 条` : undefined,
          提示: data.forecast_keypoint || s.tip,
        });
        return true;
      }
      return false; // 复杂类型（daily/hourly）走默认 JSON
    },
  },

  ocr: {
    endpoint: "ocr-text",
    usage: "apizero ocr <图片路径或URL>",
    desc: "通用 OCR 文字识别。支持本地图片（自动转 base64，≤6MB）或公网图片 URL。",
    examples: ["apizero ocr ./idcard.png", "apizero ocr https://x.com/a.png"],
    map(positionals) {
      const src = positionals[0];
      if (!src) return {};
      return imageToInput(src);
    },
    summarize(data) {
      if (!data || typeof data !== "object") return false;
      if (data.full_text !== undefined || Array.isArray(data.text_list)) {
        printInfo(c.gray(`识别到 ${data.text_count ?? (data.text_list || []).length} 行文本：`));
        printInfo(data.full_text || (data.text_list || []).join("\n"));
        return true;
      }
      return false;
    },
  },

  video: {
    endpoint: "video-parse",
    usage: 'apizero video "<视频/图文分享链接>"',
    desc: "解析全平台视频/图文元数据（标题、作者、封面、直链等）。",
    examples: ['apizero video "https://v.douyin.com/xxxx/"'],
    map(positionals) {
      const url = positionals[0];
      return url ? { url } : {};
    },
    summarize(data, raw) {
      if (!data || typeof data !== "object") return false;
      const stats = (raw && raw.stats) || data.stats || {};
      printKeyValues({
        平台: (raw && raw.platform) || data.platform,
        类型: (raw && raw.type) || data.type,
        标题: data.title,
        作者: stats.author_name,
        视频直链: data.video_url,
        封面: data.cover_url,
        音频: data.audio_url,
        图集数: Array.isArray(data.imagelist) ? data.imagelist.length : undefined,
        点赞: stats.like_count,
        评论: stats.comment_count,
        收藏: stats.collect_count,
      });
      if (Array.isArray(data.imagelist) && data.imagelist.length) {
        printInfo(c.gray("图集："));
        data.imagelist.forEach((u, i) => printInfo(`  ${i + 1}. ${u}`));
      }
      return true;
    },
  },

  ai: {
    endpoint: "doubao-image",
    usage: 'apizero ai "<图片描述提示词>" [--size 1024x1024]',
    desc: "AI 文生图（豆包 Seedream 3.0）。输入提示词，返回生成图片的 URL。",
    examples: [
      'apizero ai "一只赛博朋克猫在雨夜的霓虹街头，电影感"',
      'apizero ai "极简风格的猫咪 logo" --size 1024x1024',
    ],
    map(positionals, options) {
      const prompt = positionals.join(" ").trim();
      const values = {};
      if (prompt) values.prompt = prompt;
      if (options.size) values.size = options.size;
      return values;
    },
    summarize(data) {
      if (!data || typeof data !== "object") return false;
      const url = data.image_url || data.url || (data.images && data.images[0]);
      printKeyValues({
        提示词: data.prompt,
        尺寸: data.size,
        图片URL: url,
        有效期: data.expires_in || "24 小时（请尽快下载保存）",
      });
      if (url) printInfo(c.green("\n图片直链（24h 内有效）：\n") + url);
      return true;
    },
  },
};

export function isFriendlyCommand(name) {
  return Object.prototype.hasOwnProperty.call(FRIENDLY, name);
}

export function friendlyNames() {
  return Object.keys(FRIENDLY);
}

export function getFriendly(name) {
  return FRIENDLY[name];
}

/**
 * 执行一个友好命令。
 */
export async function runFriendly(name, positionals, options, global) {
  const def = FRIENDLY[name];
  const endpoint = findEndpoint(def.endpoint);
  if (!endpoint) {
    printError(`内部错误：未找到接口 ${def.endpoint}`);
    return 1;
  }

  let values;
  try {
    values = def.map(positionals, options) || {};
  } catch (err) {
    printError(err.message);
    return 1;
  }

  // 友好命令自定义校验（如 weather 需要 city/location 二选一）
  const customError = def.validate ? def.validate(values, positionals, options) : null;
  // 缺参时给友好命令专属的用法提示
  const missing = findMissingRequired(endpoint, values);
  if (customError || missing.length) {
    printError(customError || `参数不足。用法：${c.cyan(def.usage)}`);
    printInfo(c.gray("用法：") + def.usage);
    if (def.examples) {
      printInfo(c.gray("示例："));
      def.examples.forEach((e) => printInfo("  " + e));
    }
    return 1;
  }

  // 自定义摘要：若用户要 --json 或 dry-run，则交回通用执行器
  if (global.json || global.dryRun || !def.summarize) {
    return runEndpoint(endpoint, values, global);
  }

  const { query, body } = buildRequest(endpoint, values);
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
    const handled = def.summarize(result.data, result.raw);
    if (!handled) {
      if (result.data && typeof result.data === "object") printJson(result.data);
      else printInfo(String(result.data));
    }
    return 0;
  } catch (err) {
    if (err instanceof ApiError) {
      printError(err.message);
      return 1;
    }
    printError(err.message || String(err));
    return 1;
  }
}
