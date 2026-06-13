# apizero-kit

> 极数本源 [ApiZero](https://apizero.cn) 平台全部接口的命令行工具 —— 一个 Key，一行命令，连接所有可能。

把 ApiZero 平台 **93 个接口**全部封装成 CLI：既有 `ip` / `weather` / `ocr` / `video` / `ai` 这种顺手的友好命令，也能用 `apizero call <任意接口>` 调用平台上的每一个 API。零运行时依赖，纯 Node.js 实现。

```bash
apizero ip 8.8.8.8
apizero weather 北京
apizero ocr ./idcard.png
apizero video "抖音/小红书链接"
apizero ai "帮我画一只赛博朋克猫"
```

## 安装

需要 Node.js >= 18。

```bash
# 在项目目录里全局安装（开发/本地使用）
npm install -g .

# 之后任意位置即可使用 apizero 命令
apizero --help
```

如果不想全局安装，也可以直接运行：

```bash
node bin/apizero.js --help
```

## 设置 API Key

大部分接口都有匿名免费额度，开箱即用；但额度有限、且部分接口（如身份证识别等）必须登录。建议先到 <https://apizero.cn/account/keys> 申请一个 Key 并设置：

```bash
apizero setkey sk_live_xxxxxxxxxxxxxxxx
```

Key 会保存在 `~/.apizero/config.json`（权限 600，仅本人可读写）。

查看 / 删除：

```bash
apizero config     # 查看当前 Key 状态（脱敏显示）
apizero delkey     # 删除已保存的 Key
```

**Key 解析优先级**（从高到低）：

1. 命令行 `--key <key>`
2. 环境变量 `APIZERO_KEY`（或 `APIZERO_API_KEY`）
3. 配置文件 `~/.apizero/config.json`

## 友好命令

为最常用的 5 个能力提供了自然的用法和人性化输出：

| 命令 | 说明 | 示例 |
| --- | --- | --- |
| `ip` | IP 归属地（街道级 + 运营商 + 风险），不传则查本机出口 IP | `apizero ip 8.8.8.8` |
| `weather` | 天气（彩云天气），默认实时天气摘要 | `apizero weather 北京` |
| `ocr` | 通用 OCR，**支持本地图片**（自动转 base64，≤6MB）或图片 URL | `apizero ocr ./idcard.png` |
| `video` | 全平台视频/图文元数据解析 | `apizero video "https://v.douyin.com/xxxx/"` |
| `ai` | AI 文生图（豆包 Seedream 3.0），返回图片直链 | `apizero ai "一只赛博朋克猫，电影感"` |

更多用法：

```bash
# 天气：指定类型与天数
apizero weather 上海 --type daily --days 7

# OCR：识别公网图片
apizero ocr https://example.com/photo.png

# 文生图：指定尺寸
apizero ai "极简风格的猫咪 logo" --size 1024x1024
```

> 说明：ApiZero 平台目前未提供「AI 文本对话/总结」接口，因此 `ai` 命令对接的是平台的**文生图**能力（豆包 Seedream）。等平台上线文本对话接口后可再扩展。

## 调用任意接口

平台 93 个接口都能用 `call`（或直接用接口名）调用，参数与官方文档一致：

```bash
# 通用调用
apizero call exchange-rate --from USD --to CNY      # 实时汇率
apizero call whois --domain apizero.cn              # 域名 whois
apizero call translate --q "你好世界" --to en        # 文本翻译

# 直接用接口名（等价于 call）
apizero hitokoto                                    # 一言
apizero qrcode --text "https://apizero.cn"          # 二维码
```

## 探索接口

```bash
apizero list              # 按分类列出全部 93 个接口
apizero list ai           # 只看某分类（life/ocrdata/finance/ai/geo/kyc/content/dev）
apizero search 翻译        # 关键词搜索接口
apizero help weather      # 查看某接口/友好命令的参数说明、配额与文档链接
```

## 全局选项

可用于任意命令：

| 选项 | 说明 |
| --- | --- |
| `--key <key>` | 指定本次调用使用的 API Key |
| `--json` / `--raw` | 输出完整原始 JSON（默认只输出 `data` 摘要） |
| `--dry-run` | 只显示将要发起的请求，不真正调用（调试用） |
| `--timeout <ms>` | 请求超时毫秒数（默认 30000） |
| `-h, --help` | 显示帮助 |

```bash
apizero ip 1.1.1.1 --json           # 看完整响应信封
apizero ai "测试" --dry-run          # 只看请求不发起
apizero weather 北京 --key sk_xxx    # 临时用指定 Key
```

## 输出与管道

- 默认输出 `data` 部分并带颜色，适合人看。
- 输出到管道/文件或设置 `NO_COLOR` 时自动关闭颜色。
- 配合 `--json` 和 [`jq`](https://jqlang.github.io/jq/) 可做脚本处理：

```bash
apizero ip 8.8.8.8 --json | jq '.data.country'
apizero call exchange-rate --from USD --to CNY --json | jq '.data.rate'
```

## 错误码

平台统一错误码会被翻译成中文提示，常见的有：

| code | 含义 |
| --- | --- |
| `4000` | 参数错误 |
| `4011` / `4013` / `4014` | API Key 无效 / 已暂停 / IP 不在白名单 |
| `4015` | 匿名额度用完，需要设置 Key |
| `4022` | 账户余额不足 |
| `4029` / `4030` | QPS 超限 / 今日额度用完 |
| `5020` / `5021` | 上游数据源异常 |

## 项目结构

```
apizero-kit/
├── bin/apizero.js          # CLI 入口与命令路由
├── src/
│   ├── config.js           # Key / 配置读写（~/.apizero/config.json）
│   ├── http.js             # 请求层：鉴权注入、超时、错误码语义化
│   ├── runner.js           # 通用接口执行器
│   ├── friendly.js         # ip/weather/ocr/video/ai 友好命令 + 摘要渲染
│   ├── help.js             # 帮助 / list / search / config 展示
│   ├── registry.js         # 接口清单加载
│   ├── args.js             # 零依赖参数解析
│   └── output.js           # ANSI 着色 / JSON 美化
├── scripts/build-registry.js  # 从 openapi.json 生成 registry.json
├── registry.json           # 93 个接口的精简清单（CLI 运行时数据源）
├── openapi.json            # 平台 OpenAPI 规范（构建用）
└── llms-full.txt           # 平台完整文档（参考）
```

## 更新接口清单

当平台新增/调整接口后，重新拉取规范并重建清单即可：

```bash
curl -s https://apizero.cn/openapi.json -o openapi.json
npm run build:registry
```

## 许可

MIT
