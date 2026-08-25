# Antigravity (Google Cloud Code) API 深度调用规范文档

> 本文档基于 2026-08-23 22:00:00 后的最新捕获流量（共 149+ 条独立网络交互记录）以及底层插件实现逆向分析整理。

---

## 1. 架构与认证规范

### 1.1 基础服务地址
- **生产网关 (API Base URL)**：`https://daily-cloudcode-pa.googleapis.com/v1internal`
- **OAuth2 Token 交换服务**：`https://oauth2.googleapis.com/token`

### 1.2 认证与 Token 刷新机制
客户端持久化存储 `refresh_token`，并在内存中维持 `access_token`。每次请求前校验有效期，并在距过期前 15 分钟（`TOKEN_REFRESH_SKEW_MS = 900,000ms`）提前刷新。

#### Token 刷新请求
- **Method**: `POST`
- **URL**: `https://oauth2.googleapis.com/token`
- **Headers**: `Content-Type: application/x-www-form-urlencoded`
- **Body**:
  ```ini
  client_id=<ANTIGRAVITY_CLIENT_ID>
  client_secret=<ANTIGRAVITY_CLIENT_SECRET>
  refresh_token=<REFRESH_TOKEN>
  grant_type=refresh_token
  ```
- **Response**:
  ```json
  {
    "access_token": "ya29.a0AdMD6E...",
    "expires_in": 3599,
    "scope": "https://www.googleapis.com/auth/cloud-platform ...",
    "token_type": "Bearer"
  }
  ```

### 1.3 客户端伪装与请求头要求
```http
Authorization: Bearer ya29.a0AdMD6E...
Content-Type: application/json
User-Agent: antigravity/hub/2.9.1 (aidev_client; os_type=windows; arch=amd64; cl=967871920)
Accept-Encoding: gzip
```

---

## 2. 接口清单与详细规范

### 2.1 会话推理流：`POST /v1internal:streamGenerateContent?alt=sse`
核心 LLM 交互接口，支持流式 SSE、思考链（Reasoning/Thinking）、函数调用（Function Calling）与全模态输入。

#### Request Payload
```json
{
  "project": "atlantean-moon-qjgl4",
  "requestId": "agent/e1bcf4f9-e68e-4f03-8f88-b80b537cc759/1787495198387/399c6c43-91d5-4336-b2d5-eb4264dea2dd/23",
  "model": "gemini-3.7-flash-high",
  "userAgent": "antigravity",
  "requestType": "agent",
  "request": {
    "sessionId": "agent-399c6c43-91d5-4336-b2d5-eb4264dea2dd",
    "systemInstruction": {
      "role": "user",
      "parts": [{ "text": "You are Antigravity AI assistant..." }]
    },
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": "请分析项目代码" }]
      },
      {
        "role": "model",
        "parts": [
          {
            "functionCall": {
              "id": "call_101",
              "name": "list_dir",
              "args": { "DirectoryPath": "D:/project" }
            },
            "thoughtSignature": "Et4ICtsIARFNMg/hnzKotNcp4IW5dsHx..."
          }
        ]
      },
      {
        "role": "model",
        "parts": [
          {
            "functionResponse": {
              "name": "list_dir",
              "response": { "result": "[\"src\", \"README.md\"]" }
            }
          }
        ]
      }
    ],
    "tools": [
      {
        "functionDeclarations": [
          {
            "name": "list_dir",
            "description": "List directory contents",
            "parameters": {
              "type": "object",
              "properties": {
                "DirectoryPath": { "type": "string" }
              },
              "required": ["DirectoryPath"]
            }
          }
        ]
      }
    ],
    "generationConfig": {
      "candidateCount": 1,
      "temperature": 0.2,
      "maxOutputTokens": 65536,
      "thinkingConfig": { "thinkingBudget": 8192 }
    }
  }
}
```

#### SSE 响应流数据结构
1. **思考过程事件**：
   ```json
   data: {"response":{"candidates":[{"content":{"role":"model","parts":[{"thought":true,"text":"Thinking..."}]}}],"modelVersion":"gemini-3.7-flash"}}
   ```
2. **前缀缓存签名事件**：
   ```json
   data: {"response":{"candidates":[{"content":{"role":"model","parts":[{"thoughtSignature":"Et4ICtsI..."}]}}],"modelVersion":"gemini-3.7-flash"}}
   ```
3. **正文输出事件**：
   ```json
   data: {"response":{"candidates":[{"content":{"role":"model","parts":[{"text":"分析结果如下："}]}}],"modelVersion":"gemini-3.7-flash"}}
   ```
4. **结束与 Token 结算事件**：
   ```json
   data: {"response":{"candidates":[{"content":{"role":"model","parts":[{"text":""}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":1520,"candidatesTokenCount":142,"totalTokenCount":1662,"thoughtsTokenCount":245,"cachedContentTokenCount":1400},"modelVersion":"gemini-3.7-flash"}}
   ```

---

### 2.2 同步生成/联网检索与生图：`POST /v1internal:generateContent`

#### 联网搜索 (Google Search Grounding)
- **Model**: `gemini-3.1-flash-lite`
- **Request Tools**: `tools: [{ googleSearch: { enhancedContent: { imageSearch: { maxResultCount: 5 } } } }]`
- **Response**: 返回 `groundingMetadata.groundingChunks` (包含 Web URL、标题与摘要支持段落索引)。

#### 图像生成 (Image Generation)
- **Model**: `gemini-3.1-flash-image`
- **Response**: 返回 `parts[0].inlineData`，其中包含 `mimeType: "image/png"` 和 base64 图片字符串。

---

### 2.3 握手与 Project 解析：`POST /v1internal:loadCodeAssist`
- **Request**: `{ "metadata": { "ideType": "ANTIGRAVITY", "ideVersion": "2.9.1" } }`
- **Response**:
  ```json
  {
    "cloudaicompanionProject": "atlantean-moon-qjgl4",
    "currentTier": {
      "id": "free-tier",
      "name": "Antigravity",
      "upgradeSubscriptionUri": "https://accounts.google.com/..."
    },
    "paidTier": {
      "id": "g1-pro-tier",
      "name": "Google AI Pro"
    }
  }
  ```

---

### 2.4 模型元数据目录：`POST /v1internal:fetchAvailableModels`
- **Request**: `{ "project": "atlantean-moon-qjgl4" }`
- **返回模型清单 (28 款)**：
  - **Gemini 3.7 系列**：`gemini-3.7-flash-high` / `medium` / `low` / `tiered` (1M 上下文，64K 输出，带 Thinking)
  - **Gemini 3.6 / 3.5 系列**：`gemini-3.6-flash-high` / `medium` / `low`, `gemini-3.5-flash-low`
  - **Gemini 3.1 系列**：`gemini-3.1-pro-high` / `low`, `gemini-3.1-flash-lite`, `gemini-3.1-flash-image`
  - **Gemini 2.5 系列**：`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-thinking`
  - **Anthropic Vertex**：`claude-sonnet-4-6` (250K 上下文，64K 输出，Thinking), `claude-opus-4-6-thinking`
  - **OpenAI Vertex**：`gpt-oss-120b-medium` (128K 上下文，32K 输出，Thinking)

---

### 2.5 用户配额与窗口：`POST /v1internal:retrieveUserQuotaSummary`
- **Request**: `{ "project": "atlantean-moon-qjgl4" }`
- **Response**: 返回 5 小时滑动窗口（`5h window`）与周窗口（`weekly window`）的剩余配额比例（`remainingFraction`）及 `resetTime`。

---

### 2.6 遥测指标上报：`POST /v1internal:recordCodeAssistMetrics`
- **Request**: 上报 `conversationOffered`, `streamingLatency` (首字延迟 TTFT 及总耗时), `isAgentic`, `trajectoryId`, `traceId`。
- **Response**: `{}` (HTTP 200)

---

## 3. 多模态能力与全文件格式支持规范

Antigravity 依托 Google Gemini 底层原生多模态架构，具备原生处理 **视频、音频、图像、PDF 文档、交互式 Jupyter Notebook、结构化数据及源代码** 的能力。

### 3.1 多模态线协议封装格式 (`inlineData`)

所有非纯文本的多模态媒体文件在传输时，均封装在 `parts` 数组中的 `inlineData` 对象内：
```json
{
  "inlineData": {
    "mimeType": "<MIME_TYPE>",
    "data": "<BASE64_ENCODED_STRING>"
  }
}
```

#### (1) 用户端直接输入多模态资产 (User Input)
多模态块与普通文本块平铺并列：
```json
{
  "role": "user",
  "parts": [
    { "text": "请分析这段操作录屏中的 Bug 原因：" },
    {
      "inlineData": {
        "mimeType": "video/mp4",
        "data": "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQ..."
      }
    }
  ]
}
```

#### (2) 工具/函数调用回传多模态数据 (Tool / Function Response)
当 Agent 通过工具（如 `read_video`、`read_image`、`view_file`）读取媒体并返回给模型时，媒体数据挂载在 `functionResponse.parts` 内部，与文本输出严格隔离以维持前缀缓存一致性：
```json
{
  "role": "model",
  "parts": [
    {
      "functionResponse": {
        "name": "read_video",
        "response": {
          "result": "Attached video demo.mp4 (video/mp4, 12.4 MB) for analysis."
        },
        "parts": [
          {
            "inlineData": {
              "mimeType": "video/mp4",
              "data": "AAAAIGZ0eXBpc29t..."
            }
          }
        ]
      }
    }
  ]
}
```

---

### 3.2 完整支持的 MIME 类型清单 (Supported MIME Types)

从 `fetchAvailableModels` 实时解析提取出的服务端合法 MIME 字典如下：

| 模态类别 | 支持的 MIME 类型 (MIME Types) | 典型扩展名 | 说明与特性 |
| :--- | :--- | :--- | :--- |
| **视频 (Video)** | `video/mp4`<br>`video/webm`<br>`video/quicktime`<br>`video/jpeg2000`<br>`video/videoframe/jpeg2000`<br>`video/audio/wav`<br>`video/audio/s16le`<br>`video/text/timestamp` | `.mp4`, `.webm`, `.mov`, `.mkv`, `.avi` | 原生音视频同步理解，支持画面动作、转场、字幕与时间戳定位 |
| **音频 (Audio)** | `audio/mp3`<br>`audio/mpeg`<br>`audio/wav`<br>`audio/x-wav`<br>`audio/vnd.wave`<br>`audio/wave`<br>`audio/aac`<br>`audio/ogg`<br>`audio/opus`<br>`audio/flac`<br>`audio/webm`<br>`audio/webm;codecs=opus`<br>`audio/m4a`<br>`audio/mp4`<br>`audio/l16` | `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.flac` | 原生语音识别、语气理解、多说话人分离与背景音分析 |
| **图像 (Image)** | `image/png`<br>`image/jpeg`<br>`image/webp`<br>`image/heic`<br>`image/heif` | `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, `.heif` | 高精度 OCR、UI/原型稿还原、图表数据逆向提取、空间几何理解 |
| **富文档 (Documents)** | `application/pdf`<br>`application/rtf`<br>`text/rtf` | `.pdf`, `.rtf` | **原生视觉与排版解析**：识别双栏排版、数学公式、图表矢量路径与嵌入图片 |
| **交互式代码 (Notebook)** | `application/x-ipynb+json` | `.ipynb` | 原生解析 Jupyter 单元格代码、执行历史、富文本输出与嵌入图表 |
| **结构化数据与文本** | `application/json`<br>`text/csv`<br>`text/html`<br>`text/css`<br>`text/xml`<br>`text/markdown`<br>`text/plain` | `.json`, `.csv`, `.html`, `.css`, `.xml`, `.md`, `.txt` | 结构化语法与数据表格语义化直读 |
| **编程源码 (Code)** | `text/x-python`<br>`application/x-python-code`<br>`text/x-python-script`<br>`text/x-typescript`<br>`application/x-typescript`<br>`application/x-javascript`<br>`text/javascript` | `.py`, `.ts`, `.js` | 编程语言 AST 级别语义感知 |

---

### 3.3 模型支持差异矩阵 (Model Support Matrix)

| 模型类别 | 代表模型 ID | 视频/音频 | 图像 (Image) | PDF 文档 | Jupyter Notebook | 文本与代码 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Gemini 3.7 / 3.6 / 3.5 / 3.1** | `gemini-3.7-flash-*`<br>`gemini-3.1-pro-*` | **完全支持** | **完全支持** | **完全支持** | **完全支持** | **完全支持** |
| **Gemini 2.5 系列** | `gemini-2.5-pro`<br>`gemini-2.5-flash` | **完全支持** | **完全支持** | **完全支持** | **完全支持** | **完全支持** |
| **Gemini 生图专用** | `gemini-3.1-flash-image` | 不支持 | 仅输出生成 | 不支持 | 不支持 | 纯文本 Prompt |
| **Anthropic Vertex** | `claude-sonnet-4-6`<br>`claude-opus-4-6-thinking` | 仅部分帧序列 (`video/jpeg2000`) | **完全支持** | 不支持原生 PDF (需转图) | 不支持 | **完全支持** |
| **OpenAI Vertex** | `gpt-oss-120b-medium` | 不支持 | 不支持 | 不支持 | 不支持 | **完全支持** |

---

### 3.4 Token 计算与配额转换标准 (Tokenization Rules)

不同模态输入在输入模型时，会按照各自的规则转换为上下文 Token：

| 模态类型 | Token 转换基准 | 1M 上下文极限容量参考 |
| :--- | :--- | :--- |
| **纯文本 / 源码** | 约 $1 \text{ Token} \approx 4 \text{ 字符} \approx 0.75 \text{ 单词}$ | 约 **4MB 纯文本 / 70 万字代码** |
| **视频文件** | 画面按 1 FPS 抽帧（约 258 tokens/秒）+ 伴音约 32 tokens/秒 $\approx$ **290 ~ 300 Tokens / 秒** | 约 **55 ~ 60 分钟完整连续视频** |
| **音频文件** | 约 **32 Tokens / 秒**（1 分钟约 1,920 Tokens） | 约 **8.4 小时连续高保真音频** |
| **PDF 文档** | 每页按高精度图块（Tile）编码，每页约 **258 ~ 1,000 Tokens** | 约 **1,000 ~ 3,500 页大型 PDF 文档** |
| **静态图像** | 低分辨率 258 Tokens；高分辨率自动按 $768 \times 768$ 网格切片（每片 258 Tokens） | 约 **1,000+ 张独立高精度图片** |

---

### 3.5 多轮对话下的多模态数据与前缀缓存机制 (Multi-Turn & Prefix Cache)

1. **多轮对话为什么必须保留媒体数据**：
   - Google `v1internal` 是**无状态（Stateless REST）** 接口，服务端不在会话间维持持久的媒体特征状态。
   - 在后续第 $2, 3 \dots N$ 轮对话中，客户端发送的 `contents` 历史记录中**必须完整保留之前上传的 Base64 `inlineData`**。若客户端在后续轮次中剔除了该数据，模型将瞬间失去对该媒体细节的视觉/听觉感知能力。
2. **前缀缓存（Prefix Cache）对大文件的优化**：
   - 只要历史 `contents` 前缀的 Base64 字节流与 `thoughtSignature` 保持原样不变，Google 网关会自动命中云端前缀缓存（`usageMetadata.cachedContentTokenCount` 达 **95% ~ 98%**）。
   - **效果**：大视频/音频文件在多轮对话中**无需重复进行特征计算**，首字延迟（TTFT）从数秒降至数百毫秒，且不会重复扣减全额视频 Token 配额。

---

### 3.6 客户端容器类型嗅探 (Magic Bytes Container Sniffing)

为确保二进制流对应的 `mimeType` 准确无误，客户端实现了基于 Magic Bytes 的容器嗅探器（参考 `dsh-llm-antigravity/lib/index.js`）：

```javascript
function sniffVideoMimeType(buf) {
  // 1. ISO Base Media File Format (MP4 / QuickTime / MOV / M4V)
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12);
    if (['qt  ', 'isom', 'mp42', 'avc1', 'mp41', 'M4V ', 'M4A ', '3gp4'].includes(brand)) {
      return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
    }
  }
  // 2. EBML / Matroska / WebM
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'video/webm';
  }
  // 3. RIFF AVI
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'AVI ') {
    return 'video/x-msvideo';
  }
  // 4. Ogg Container
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'OggS') {
    return 'video/ogg';
  }
  return undefined;
}
```

---

### 3.7 文件上传与大小限制规范 (Size Limits & Guardrails)

系统中的大小限制分为三个不同维度的控制层：

1. **客户端层保护（Client Heap Guard）**：
   - 针对视频文件定义了本地硬上限 `MAX_VIDEO_BYTES = 300 * 1024 * 1024`（**300MB**），防止超大视频读取导致 Node.js V8 堆内存溢出崩溃。
   - 普通图片/PDF 建议单文件在 50MB 以内。
2. **网关传输层限制（Gateway Payload Guard）**：
   - Base64 编码会带来约 **33%** 的体积膨胀。
   - `POST JSON` 单次请求 Payload 建议保持在 **20MB ~ 32MB** 以内。超大视频应在本地进行抽帧转码或压缩后上传。
3. **模型上下文限制（Context Window Guard）**：
   - 整个会话（所有历史文字 + 视频 + 音频 + 代码）总 Token 数不得超过模型上限（Gemini 3.7 为 `1,048,576 Tokens`，Claude 为 `250,000 Tokens`）。

---

## 4. 多模态调用代码示例 (Code Examples)

### 4.1 视频与文本混合多模态请求 (Node.js)

```javascript
import fs from 'node:fs';
import fetch from 'node:node-fetch';

async function analyzeVideo() {
  const videoBuffer = fs.readFileSync('D:/test_recording.mp4');
  const base64Data = videoBuffer.toString('base64');
  const accessToken = 'ya29.a0AdMD...';

  const res = await fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'antigravity/hub/2.9.1 (aidev_client; os_type=windows; arch=amd64; cl=967871920)'
    },
    body: JSON.stringify({
      project: 'atlantean-moon-qjgl4',
      model: 'gemini-3.7-flash-high',
      requestType: 'agent',
      userAgent: 'antigravity',
      request: {
        contents: [
          {
            role: 'user',
            parts: [
              { text: '请按时间轴详细列出视频中的所有操作步骤，并指出出错的时间点：' },
              {
                inlineData: {
                  mimeType: 'video/mp4',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192
        }
      }
    })
  });

  for await (const chunk of res.body) {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = JSON.parse(line.slice(6));
        const text = json.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) process.stdout.write(text);
      }
    }
  }
}

analyzeVideo().catch(console.error);
```

### 4.2 PDF 文档与图表深度解析请求 (Node.js)

```javascript
import fs from 'node:fs';
import fetch from 'node:node-fetch';

async function analyzePDF() {
  const pdfBuffer = fs.readFileSync('D:/deepseek_v3_report.pdf');
  const base64Pdf = pdfBuffer.toString('base64');
  const accessToken = 'ya29.a0AdMD...';

  const res = await fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'antigravity/hub/2.9.1 (aidev_client; os_type=windows; arch=amd64; cl=967871920)'
    },
    body: JSON.stringify({
      project: 'atlantean-moon-qjgl4',
      model: 'gemini-3.7-flash-high',
      requestType: 'agent',
      userAgent: 'antigravity',
      request: {
        contents: [
          {
            role: 'user',
            parts: [
              { text: '请提取这篇论文中第 4 节架构图中的所有关键模块参数，并用 Markdown 表格呈现：' },
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Pdf
                }
              }
            ]
          }
        ]
      }
    })
  });

  // 处理 SSE 输出...
}
```
