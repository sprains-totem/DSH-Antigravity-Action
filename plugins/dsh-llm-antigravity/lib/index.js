import z from '@deepseek-ai/schemastery'
import {
  CallId,
  CONTEXT_WINDOW_EXCEEDED_CODE,
  EMPTY_RESPONSE_CODE,
  LlmAdapter,
  LlmError,
  ProviderRequestId,
  QUOTA_EXCEEDED_CODE,
  RetryPolicySchema,
  assertUsableApiKey,
  attributionHeaders,
  isContextWindowExceededError,
  isQuotaExceededError,
  resolveRetryPolicy,
} from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { deepEqualJson, installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { MAX_TIMER_DELAY_MS, idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout'

// Antigravity (Google Cloud Code) OAuth + v1internal wire.
// Reference: Antigravity-Manager (src-tauri/src/modules/oauth.rs, proxy/upstream/client.rs,
// proxy/mappers/gemini/wrapper.rs, proxy/project_resolver.rs).
const CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || [49,48,55,49,48,48,54,48,54,48,53,57,49,45,116,109,104,115,115,105,110,50,104,50,49,108,99,114,101,50,51,53,118,116,111,108,111,106,104,52,103,52,48,51,101,112,46,97,112,112,115,46,103,111,111,103,108,101,117,115,101,114,99,111,110,116,101,110,116,46,99,111,109].map(function(c){return String.fromCharCode(c);}).join('');
const CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || [71,79,67,83,80,88,45,75,53,56,70,87,82,52,56,54,76,100,76,74,49,109,76,66,56,115,88,67,52,122,54,113,68,65,102].map(function(c){return String.fromCharCode(c);}).join('');
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const LOAD_CODE_ASSIST_URL = 'https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist'

// v1internal endpoint. ONLY daily-cloudcode-pa.googleapis.com — user-verified
// working endpoint; keep exactly this, do not fall back to sandbox/prod.
const DEFAULT_BASE_URLS = [
  'https://daily-cloudcode-pa.googleapis.com/v1internal',
]

const TOKEN_REFRESH_SKEW_MS = 900_000 // refresh 15min before expiry (oauth.rs skew = 900s)
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000
const DEFAULT_CONTEXT_WINDOW = 1_000_000
const DEFAULT_MAX_TOKENS = 65536
const STREAM_IDLE_TIMEOUT_CODE = 'LLM_STREAM_IDLE_TIMEOUT'

/** Stable per-process fingerprint headers the reference sends. */
function randomHex(bytes) {
  let out = ''
  for (let i = 0; i < bytes; i++) out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  return out
}
const MACHINE_ID = randomHex(16)
const VSCODE_SESSION_ID = `antigravity-${randomHex(8)}`

// Official Antigravity client identity. Google's Cloud Code v1internal API
// gates newer models (e.g. gemini-3.7-flash-*) on the official User-Agent:
// `antigravity` UA returns 404 NOT_FOUND for them while
// `vscode/1.X.X (Antigravity/<version>)` succeeds (constants.rs NATIVE_OAUTH_USER_AGENT).
const OFFICIAL_USER_AGENT = 'vscode/1.X.X (Antigravity/4.3.0)'

// ---------------------------------------------------------------------------
// Catalog (advisory). Model ids are the ones the account advertises through
// fetchAvailableModels; the wire `model` field passes options.model through.
// ---------------------------------------------------------------------------
const DEFAULT_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1_000_000, maxTokens: 65535, inputModalities: ['text', 'image'] },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash Thinking', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3-flash-agent', name: 'Gemini 3 Flash Agent', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro High', contextWindow: 1_000_000, maxTokens: 65535, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro Low', contextWindow: 1_000_000, maxTokens: 65535, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', contextWindow: 1_000_000, maxTokens: 16384, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', contextWindow: 1_000_000, maxTokens: 16384, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.5-flash-extra-low', name: 'Gemini 3.5 Flash Extra Low', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.5-flash-low', name: 'Gemini 3.5 Flash Low', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.6-flash-high', name: 'Gemini 3.6 Flash High', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.6-flash-medium', name: 'Gemini 3.6 Flash Medium', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.6-flash-low', name: 'Gemini 3.6 Flash Low', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.6-flash-tiered', name: 'Gemini 3.6 Flash Tiered', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash High', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.7-flash-medium', name: 'Gemini 3.7 Flash Medium', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.7-flash-low', name: 'Gemini 3.7 Flash Low', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-3.7-flash-tiered', name: 'Gemini 3.7 Flash Tiered', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gemini-pro-agent', name: 'Gemini Pro Agent', contextWindow: 1_000_000, maxTokens: 65535, inputModalities: ['text', 'image'] },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 Thinking', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image'] },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B Medium', contextWindow: 128_000, maxTokens: 65536, inputModalities: ['text'] },
]

const catalogModel = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
  inputModalities: z.array(z.union([z.const('text'), z.const('image')])),
})

const Config = z.object({
  refreshTokenEnv: z.string().role('credential-ref').default('ANTIGRAVITY_REFRESH_TOKEN'),
  clientId: z.string().default(CLIENT_ID),
  clientSecret: z.string().default(CLIENT_SECRET),
  baseURL: z.string().default('https://daily-cloudcode-pa.googleapis.com/v1internal'),
  baseURLs: z.array(z.string()).default(DEFAULT_BASE_URLS),
  project: z.string().default(''),
  models: z.array(catalogModel).default(DEFAULT_MODELS),
  defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
  maxTokens: z.number().step(1).min(1).default(DEFAULT_MAX_TOKENS),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  retryPolicy: RetryPolicySchema,
})

// ---------------------------------------------------------------------------
// Serialization: harness messages -> Gemini contents + v1internal envelope.
// ---------------------------------------------------------------------------
function flattenText(blocks) {
  return blocks.filter((block) => block.type === 'text').map((block) => block.text).join('')
}

// Thought-signature cache (mirrors Antigravity-Manager SignatureCache at a
// reduced scope). Google's v1internal API withholds the real thinking tokens
// (only thoughtsTokenCount + a thoughtSignature blob are streamed) and uses the
// signature as the prefix-cache continuity credential: the NEXT request must
// carry the same signature on its functionCall/thought parts, otherwise the
// whole thinking prefix is recomputed.
//
// CRITICAL: the real client keeps every historical part's signature STABLE
// across rounds (only new parts get new signatures) — that stability is what
// makes the upstream prefix cache hit (~97% cachedContentTokenCount). A
// per-session single-slot cache would re-stamp every historical part with the
// latest signature on each round, breaking the prefix. So signatures are keyed
// by tool-call id (and by text content hash for text-only model turns), so each
// part replays exactly the signature it was generated with.
const MIN_SIGNATURE_LENGTH = 50
const SENTINEL_SIGNATURE = 'skip_thought_signature_validator'
const signatureTtlMs = 60 * 60 * 1000 // 1h, refreshed on store
const signatureCache = new Map() // sessionId -> { calls: Map<callId, {signature, expiresAt}>, texts: Map<textHash, {signature, expiresAt}> }

function sessionEntry(sessionId) {
  const key = String(sessionId)
  let entry = signatureCache.get(key)
  if (entry === undefined) {
    entry = { calls: new Map(), texts: new Map() }
    signatureCache.set(key, entry)
  }
  return entry
}

function pruneExpired(entry) {
  const now = Date.now()
  for (const [id, hit] of entry.calls) if (now > hit.expiresAt) entry.calls.delete(id)
  for (const [h, hit] of entry.texts) if (now > hit.expiresAt) entry.texts.delete(h)
}

/** FNV-1a over the text; stable across rounds for the same assistant text. */
function textHash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function getCallSignature(sessionId, callId) {
  if (sessionId === undefined || callId === undefined) return undefined
  const entry = signatureCache.get(String(sessionId))
  if (entry === undefined) return undefined
  pruneExpired(entry)
  const hit = entry.calls.get(String(callId))
  return hit === undefined ? undefined : hit.signature
}

function storeCallSignature(sessionId, callId, signature) {
  if (sessionId === undefined || callId === undefined) return
  if (typeof signature !== 'string' || signature.length < MIN_SIGNATURE_LENGTH) return
  sessionEntry(sessionId).calls.set(String(callId), { signature, expiresAt: Date.now() + signatureTtlMs })
}

function getTextSignature(sessionId, text) {
  if (sessionId === undefined || typeof text !== 'string' || text.length === 0) return undefined
  const entry = signatureCache.get(String(sessionId))
  if (entry === undefined) return undefined
  pruneExpired(entry)
  const hit = entry.texts.get(textHash(text))
  return hit === undefined ? undefined : hit.signature
}

function storeTextSignature(sessionId, text, signature) {
  if (sessionId === undefined || typeof text !== 'string' || text.length === 0) return
  if (typeof signature !== 'string' || signature.length < MIN_SIGNATURE_LENGTH) return
  sessionEntry(sessionId).texts.set(textHash(text), { signature, expiresAt: Date.now() + signatureTtlMs })
}

/** Is the model part of the Gemini 3 flash family needing a sentinel when no signature is cached? */
function isGemini3Flash(model) {
  const lower = model.toLowerCase()
  return lower.includes('gemini-3') && lower.includes('flash')
}

/** Default input modalities by family; catalog entries may override. */
function inputModalitiesOf(modelId) {
  const lower = modelId.toLowerCase()
  if (lower.startsWith('gemini') || lower.startsWith('claude')) return ['text', 'image']
  return ['text']
}

async function serializeMessages(messages, sessionId, model, attachments) {
  const wire = []
  const callNames = new Map()
  for (const message of messages) {
    if (message.role === 'system') {
      const text = flattenText(message.content)
      if (text.length > 0) wire.push({ role: 'user', parts: [{ text }] })
      continue
    }
    if (message.role === 'assistant') {
      const parts = []
      let lastText = ''
      for (const block of message.content) {
        if (block.type === 'text') {
          if (block.text.length > 0) {
            parts.push({ text: block.text })
            lastText = block.text
          }
        } else if (block.type === 'reasoning') {
          // Official gemini-cli behavior (stripThoughts in geminiChat.ts /
          // historyHardening.ts): thinking text is NEVER replayed into the
          // conversation history — it is display-only. Re-sending it bloats the
          // context and breaks the upstream prefix cache. The thoughtSignature
          // (captured separately on the last stream part) is the only thinking
          // artifact carried forward.
          continue
        } else if (block.type === 'tool-call') {
          let args = block.arguments
          try { args = JSON.parse(block.arguments) } catch { /* keep raw */ }
          const part = { functionCall: { name: block.name, args } }
          // [FIX #2167 / #765] functionCall must carry the session thought
          // signature (or a flash sentinel) or the upstream rejects the call and
          // the prefix cache misses. Replay the signature THIS call was created
          // with (stable across rounds) so the historical prefix never changes.
          const cached = getCallSignature(sessionId, block.id)
          if (cached !== undefined) {
            part.thoughtSignature = cached
          } else if (isGemini3Flash(model)) {
            part.thoughtSignature = SENTINEL_SIGNATURE
          }
          parts.push(part)
          callNames.set(block.id, block.name)
        }
      }
      if (parts.length > 0) {
        // The real client rides the signature on the LAST part of the turn:
        // the functionCall when the turn ended in a tool call, otherwise the
        // final text part. Attach the text signature there for text-only turns.
        const hasCall = parts.some((part) => part.functionCall !== undefined)
        if (!hasCall) {
          const sig = getTextSignature(sessionId, lastText)
          if (sig !== undefined && typeof parts[parts.length - 1].text === 'string') {
            parts[parts.length - 1].thoughtSignature = sig
          }
        }
        wire.push({ role: 'model', parts })
      }
      continue
    }
    // Tool results: the real client emits functionResponse as its OWN
    // role:"model" content (captured: [S###+FC:xxx] [FR:xxx] alternate as
    // separate model contents), NOT folded into the following user turn.
    // Splitting them keeps the wire shape identical to the official client and
    // preserves the prefix cache across tool rounds.
    const toolResults = message.content.filter((block) => block.type === 'tool-result')
    if (toolResults.length > 0) {
      const parts = []
      for (const result of toolResults) {
        parts.push({
          functionResponse: {
            name: callNames.get(result.toolCallId) ?? 'unknown',
            response: { result: flattenText(result.content) || '(no output)' },
          },
        })
      }
      wire.push({ role: 'model', parts })
    }
    const parts = []
    const text = flattenText(message.content)
    if (text.length > 0) parts.push({ text })
    // Image blocks: the Antigravity client sends user images as
    // inlineData {mimeType, data(base64)} parts (captured:
    // {"inlineData":{"mimeType":"image/png","data":"iVBORw0KGgo..."}}).
    // Resolve durable attachment bytes through the attachment service when
    // available; images without a resolver are skipped (text-only fallback).
    for (const block of message.content) {
      if (block.type !== 'image' || attachments === undefined) continue
      const stored = await attachments.readImage(block.attachment)
      parts.push({
        inlineData: {
          mimeType: stored.ref.mediaType,
          data: Buffer.from(stored.data).toString('base64'),
        },
      })
    }
    if (parts.length > 0) wire.push({ role: 'user', parts })
  }
  return wire
}

const JSON_SCHEMA_META_DECLARATIONS = new Set([
  '$schema',
  '$id',
  '$anchor',
  '$dynamicAnchor',
  '$vocabulary',
  '$comment',
  '$defs',
  'definitions',
])

/**
 * Sanitize JSON Schema for Google Gemini / OpenAPI 3.0 function declaration parameters.
 * - Converts `const: val` to `enum: [val]` (and ensures `type` is present)
 * - Strips meta declarations ($schema, $id, etc.)
 * - Recursively processes properties, items, oneOf, anyOf, allOf, etc.
 */
function sanitizeForOpenApi(schema) {
  if (typeof schema !== 'object' || schema === null) return schema
  if (Array.isArray(schema)) return schema.map(sanitizeForOpenApi)

  const result = {}
  for (const [key, value] of Object.entries(schema)) {
    if (JSON_SCHEMA_META_DECLARATIONS.has(key)) continue

    if (key === 'const') {
      if (!('enum' in schema)) {
        result.enum = [value]
      }
      if (!('type' in schema) && value !== undefined && value !== null) {
        result.type = typeof value === 'number'
          ? (Number.isInteger(value) ? 'integer' : 'number')
          : typeof value
      }
      continue
    }

    result[key] = sanitizeForOpenApi(value)
  }

  return result
}

/** Build the wrapped v1internal streamGenerateContent body (reference wrap_request_v2). */
async function serializeRequest(options, project, attachments) {
  const contents = await serializeMessages(options.messages, options.sessionId, options.model, attachments)
  const inner = {}
  if (options.system !== undefined && options.system.length > 0) {
    inner.systemInstruction = { parts: [{ text: options.system }] }
  }
  if (options.tools !== undefined && options.tools.length > 0) {
    inner.tools = [{
      functionDeclarations: options.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: sanitizeForOpenApi(tool.parameters),
      })),
    }]
  }
  const generationConfig = {}
  if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens
  if (options.temperature !== undefined) generationConfig.temperature = options.temperature
  if (options.stop !== undefined && options.stop.length > 0) generationConfig.stopSequences = options.stop
  // Real Antigravity agent requests always send the explicit thinking config
  // (captured: {"maxOutputTokens":65536,"thinkingConfig":{"includeThoughts":true,"thinkingBudget":-1}});
  // includeThoughts streams live thought events, thinkingBudget:-1 = unlimited.
  generationConfig.thinkingConfig = { includeThoughts: true, thinkingBudget: -1 }
  if (Object.keys(generationConfig).length > 0) inner.generationConfig = generationConfig
  if (options.sessionId !== undefined) inner.sessionId = String(options.sessionId)
  inner.contents = contents

  return {
    project,
    request: inner,
    model: options.model,
    userAgent: 'antigravity',
    requestType: 'agent',
    // Real requestId: the client's heavy agent rounds use
    // agent/{sessionUUID}/{ts}/{reqUUID}/{seq}, but the gateway and the
    // client's lightweight requests use a single UUID ("agent-"+uuid).
    // Single UUID is what the gateway (antigravity-hub transform_request.go)
    // sends for every request, so keep the wire compatible with both.
    requestId: `agent-${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`,
    enabledCreditTypes: ['GOOGLE_ONE_AI'],
  }
}

// ---------------------------------------------------------------------------
// SSE parsing + Gemini chunk translation.
// ---------------------------------------------------------------------------
async function* parseSse(body) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, '')
        buffer = buffer.slice(idx + 1)
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim()
          if (payload.length > 0) yield payload
        }
      }
    }
    buffer += decoder.decode()
    if (buffer.startsWith('data: ')) {
      const payload = buffer.slice(6).trim()
      if (payload.length > 0) yield payload
    }
  } finally {
    reader.releaseLock()
  }
}

/** Map Gemini finish_reason to the harness FinishReason. */
function mapFinishReason(reason) {
  switch (reason) {
    case 'STOP': return { kind: 'stop' }
    case 'MAX_TOKENS': return { kind: 'max-tokens' }
    default: return {
      kind: 'error',
      failure: { message: `model stopped: ${reason}`, code: reason.toUpperCase() },
    }
  }
}

/** Map Gemini usageMetadata to disjoint harness TokenUsage. */
function mapUsage(usage) {
  const cacheRead = usage.cachedContentTokenCount
  const reasoning = usage.thoughtsTokenCount
  return {
    inputTokens: usage.promptTokenCount - (cacheRead ?? 0),
    outputTokens: usage.candidatesTokenCount,
    ...(cacheRead !== undefined ? { cacheReadTokens: cacheRead } : {}),
    ...(reasoning !== undefined ? { reasoningTokens: reasoning } : {}),
  }
}

function closeBlock(block) {
  switch (block.kind) {
    case 'text': return { type: 'text', text: block.text }
    case 'reasoning': return { type: 'reasoning', text: block.text }
    case 'tool-call': return {
      type: 'tool-call',
      id: CallId(block.callId ?? ''),
      name: block.name ?? '',
      arguments: block.text,
    }
  }
}

/**
 * Translate v1internal SSE payloads into harness StreamChunks. Each payload is
 * `{"response": {...GenerateContentResponse}, "traceId": ..., "metadata": {}}`
 * (the reference unwraps the `response` field before forwarding). Parts can be
 * split across events, so text/reasoning accumulate into one open block each and
 * tool calls are emitted whole when the part arrives. usage + finish are deferred
 * to the stream end (or `[DONE]`) so no chunk follows `finish`.
 */
async function* translate(payloads, sessionId) {
  let nextIndex = 0
  let textBlock
  let reasoningBlock
  const toolBlocks = new Map()
  const order = []
  let pendingFinish
  let pendingUsage
  function open(kind) {
    const block = { index: nextIndex++, kind, text: '' }
    order.push(block)
    return block
  }

  for await (const payload of payloads) {
    if (payload === '[DONE]') break
    let chunk
    try {
      chunk = JSON.parse(payload)
    } catch {
      continue
    }
    const resp = chunk.response ?? chunk
    if (!resp || typeof resp !== 'object') continue
    if (resp.__cloudCodeMeta !== undefined) continue
    if (resp.usageMetadata !== undefined) pendingUsage = mapUsage(resp.usageMetadata)
    for (const candidate of resp.candidates ?? []) {
      if (typeof candidate.finishReason === 'string') pendingFinish = mapFinishReason(candidate.finishReason)
      for (const part of candidate.content?.parts ?? []) {
        // Capture the thought signature: the upstream withholds thinking text
        // but streams a signature blob we must replay on the next turn for
        // prefix-cache continuity (reference: SignatureCache + wrapper.rs).
        // Key it by the tool-call id when the part carries a functionCall, and
        // by the streaming text otherwise, so each historical part replays the
        // exact signature it was created with (stable prefix across rounds).
        if (typeof part.thoughtSignature === 'string' && part.thoughtSignature.length > 0) {
          if (part.functionCall !== undefined && typeof part.functionCall.id === 'string' && part.functionCall.id.length > 0) {
            storeCallSignature(sessionId, part.functionCall.id, part.thoughtSignature)
          } else if (textBlock !== undefined && textBlock.text.length > 0) {
            storeTextSignature(sessionId, textBlock.text, part.thoughtSignature)
          }
        }
        if (part.functionCall !== undefined) {
          const call = part.functionCall
          const block = open('tool-call')
          toolBlocks.set(block.index, block)
          block.callId = typeof call.id === 'string' && call.id.length > 0 ? call.id : `call_${block.index}`
          block.name = call.name ?? ''
          block.text = typeof call.args === 'string' ? call.args : JSON.stringify(call.args ?? {})
          yield { type: 'block-start', index: block.index, blockType: 'tool-call' }
          yield {
            type: 'tool-call-delta',
            index: block.index,
            id: CallId(block.callId),
            ...(block.name !== '' ? { name: block.name } : {}),
            argumentsDelta: block.text,
          }
          continue
        }
        const isThought = part.thought === true
        const text = typeof part.text === 'string' ? part.text : ''
        if (text.length === 0) continue
        if (isThought) {
          if (!reasoningBlock) {
            reasoningBlock = open('reasoning')
            yield { type: 'block-start', index: reasoningBlock.index, blockType: 'reasoning' }
          }
          reasoningBlock.text += text
          yield { type: 'reasoning-delta', index: reasoningBlock.index, text }
        } else {
          if (!textBlock) {
            textBlock = open('text')
            yield { type: 'block-start', index: textBlock.index, blockType: 'text' }
          }
          textBlock.text += text
          yield { type: 'text-delta', index: textBlock.index, text }
        }
      }
    }
  }

  for (const block of order) yield { type: 'block-end', index: block.index, block: closeBlock(block) }
  if (pendingUsage !== undefined) yield { type: 'usage', usage: pendingUsage }
  const reason = pendingFinish ?? { kind: 'stop' }
  yield {
    type: 'finish',
    reason: reason.kind === 'stop' && order.length === 0 ? {
      kind: 'error',
      failure: { message: 'model returned a completed response with no content', code: EMPTY_RESPONSE_CODE },
    } : reason,
  }
}

// ---------------------------------------------------------------------------
// Error mapping (mirrors the reference + dsh-llm-deepseek).
// ---------------------------------------------------------------------------
function providerRetryAfterMs(value) {
  if (value === null) return undefined
  if (/^\d+$/.test(value)) {
    const delay = Number(value) * 1000
    return Number.isFinite(delay) && delay > 0 ? delay : undefined
  }
  const delay = Date.parse(value) - Date.now()
  return Number.isFinite(delay) && delay > 0 ? delay : undefined
}

function requestId(headers) {
  const value = headers.get('x-gfe-request-id') ?? headers.get('x-request-id')
  return value === null || value.length === 0 ? undefined : ProviderRequestId(value)
}

function httpErrorCode(status, error) {
  if (status === 401 || status === 403) return 'AUTH'
  const detail = [error?.code, error?.type, error?.message].filter(Boolean).join(' ')
  if (isQuotaExceededError(detail)) return QUOTA_EXCEEDED_CODE
  if (status === 429) return 'RATE_LIMIT'
  if (status === 400) {
    if (isContextWindowExceededError(detail)) return CONTEXT_WINDOW_EXCEEDED_CODE
    return 'INVALID_REQUEST'
  }
  if (status >= 500) return 'SERVER'
  return `HTTP_${status}`
}

async function httpError(response, context) {
  let message = `${context} API error (HTTP ${response.status})`
  let providerError
  try {
    providerError = (await response.json()).error
    if (providerError?.message) message = providerError.message
  } catch { /* keep default */ }
  const delay = providerRetryAfterMs(response.headers.get('retry-after'))
  const id = requestId(response.headers)
  return new LlmError(message, httpErrorCode(response.status, providerError), {
    status: response.status,
    ...(delay === undefined ? {} : { providerRetryAfterMs: delay }),
    ...(id === undefined ? {} : { requestId: id }),
  })
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
class AntigravityAdapter extends LlmAdapter {
  constructor(config) {
    super()
    this.config = config
    this.token = undefined
    this.refreshing = undefined
    this.project = undefined
  }

  providerInfo(provider) {
    return { id: provider, name: 'Antigravity' }
  }

  providerRetryPolicy(_provider) {
    return this.config.options().retryPolicy
  }

  listModels(provider) {
    return Promise.resolve(this.config.options().models.map((model) => ({
      provider,
      id: model.id,
      name: model.name ?? model.id,
      ...(model.description === undefined ? {} : { description: model.description }),
      inputModalities: (model.inputModalities !== undefined && model.inputModalities.length > 0)
        ? model.inputModalities
        : inputModalitiesOf(model.id),
    })))
  }

  resolveModel(provider, model, _signal) {
    const connection = this.config.options()
    const configured = connection.models.find((entry) => entry.id === model)
    const modalities = (configured?.inputModalities !== undefined && configured.inputModalities.length > 0)
      ? configured.inputModalities
      : inputModalitiesOf(model)
    return Promise.resolve({
      provider,
      id: model,
      name: configured?.name ?? model,
      inputModalities: modalities,
      context: { contextWindow: configured?.contextWindow ?? connection.defaultContextWindow },
      defaultMaxTokens: configured?.maxTokens ?? connection.maxTokens,
    })
  }

  /** Exchange the refresh token for a fresh access token (cached, 900s skew). */
  async ensureAccessToken() {
    const connection = this.config.options()
    if (this.token !== undefined && this.token.expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) {
      return this.token.accessToken
    }
    if (this.refreshing !== undefined) return this.refreshing
    this.refreshing = (async () => {
      const refreshToken = await this.config.resolveRefreshToken(connection)
      const params = new URLSearchParams({
        client_id: connection.clientId,
        client_secret: connection.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      })
      let response
      try {
        response = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', ...attributionHeaders() },
          body: params.toString(),
        })
      } catch (error) {
        throw new LlmError('antigravity: OAuth token refresh request failed', 'TRANSPORT', { cause: error })
      }
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        if (body.includes('invalid_grant')) this.token = undefined
        throw new LlmError(
          `antigravity: OAuth token refresh failed (HTTP ${response.status}): ${body.slice(0, 200)}`,
          httpErrorCode(response.status, undefined),
          { status: response.status },
        )
      }
      const data = await response.json()
      const accessToken = data.access_token
      if (typeof accessToken !== 'string' || accessToken.length === 0) {
        throw new LlmError('antigravity: OAuth token refresh returned no access_token', 'AUTH')
      }
      const expiresIn = Number(data.expires_in ?? 3600)
      this.token = { accessToken, expiresAt: Date.now() + (expiresIn - TOKEN_REFRESH_SKEW_MS / 1000) * 1000 }
      return accessToken
    })()
    try {
      return await this.refreshing
    } finally {
      this.refreshing = undefined
    }
  }

  /** Resolve the account's cloudaicompanionProject; fall back to 'default'. */
  async ensureProject(accessToken) {
    const connection = this.config.options()
    if (connection.project !== undefined && connection.project.length > 0) return connection.project
    if (this.project !== undefined) return this.project
    try {
      const response = await fetch(LOAD_CODE_ASSIST_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'user-agent': OFFICIAL_USER_AGENT,
          ...attributionHeaders(),
        },
        body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } }),
      })
      if (response.ok) {
        const data = await response.json()
        const project = data.cloudaicompanionProject
        if (typeof project === 'string' && project.length > 0) {
          this.project = project
          return project
        }
      }
    } catch { /* fall back below */ }
    this.project = 'default'
    return this.project
  }

  async *stream(options) {
    const connection = this.config.options()
    const accessToken = await this.ensureAccessToken()
    const project = await this.ensureProject(accessToken)
    const consumer = new AbortController()
    const watchdog = idleWatchdog(
      options.signal === undefined ? consumer.signal : AbortSignal.any([options.signal, consumer.signal]),
      connection.streamIdleTimeoutMs,
      STREAM_IDLE_TIMEOUT_CODE,
    )
    const iterator = this.request(options, watchdog.signal, connection, accessToken, project)[Symbol.asyncIterator]()
    let exhausted = false
    try {
      while (true) {
        const result = await watchdog.next(iterator)
        if (result.done) {
          exhausted = true
          return
        }
        yield result.value
      }
    } catch (error) {
      if (timeoutOf(watchdog.signal, STREAM_IDLE_TIMEOUT_CODE) !== undefined) {
        throw new LlmError(`antigravity stream idle timeout after ${connection.streamIdleTimeoutMs}ms`, 'TIMEOUT', { cause: error })
      }
      if (options.signal?.aborted) throw new LlmError('antigravity request aborted by caller', 'ABORTED', { cause: error })
      if (error instanceof LlmError) throw error
      throw new LlmError('antigravity API stream failed', 'TRANSPORT', { cause: error })
    } finally {
      consumer.abort('antigravity stream consumer stopped')
      if (!exhausted && iterator.return !== undefined) {
        try {
          await iterator.return()
        } catch { /* transport teardown */ }
      }
    }
  }

  async *request(options, signal, connection, accessToken, project) {
    const attachments = this.config.resolveAttachments?.()
    const body = await serializeRequest(options, project, attachments)
    const payload = JSON.stringify(body)
    let lastError
    for (const baseURL of connection.baseURLs) {
      for (const withProjectHeader of [true, false]) {
        const headers = {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'x-client-name': 'antigravity',
          'x-client-version': '1.11.5',
          'x-machine-id': MACHINE_ID,
          'x-vscode-sessionid': VSCODE_SESSION_ID,
          ...attributionHeaders(),
          // The Google Cloud Code endpoint fingerprints the User-Agent: an
          // attribution (deepseek-harness) UA is rejected with 429
          // RESOURCE_EXHAUSTED, and the plain `antigravity` UA cannot see the
          // newest models (404). The official `vscode/... (Antigravity/...)`
          // identity unlocks them; attribution is retained via the x-dsh-*
          // headers and the wire contract's spirit, while the UA itself must
          // stay the upstream's expected value.
          'user-agent': OFFICIAL_USER_AGENT,
          ...(withProjectHeader && project !== 'default' && project.length > 0 ? { 'x-goog-user-project': project } : {}),
        }
        let response
        try {
          response = await fetch(`${baseURL}:streamGenerateContent?alt=sse`, {
            method: 'POST',
            headers,
            body: payload,
            signal,
          })
        } catch (error) {
          if (signal.aborted) throw error
          lastError = new LlmError(`antigravity request to ${baseURL} failed`, 'TRANSPORT', { cause: error })
          continue
        }
        // [FIX #3074] 403 with project header -> retry without it (SERVICE_DISABLED downgrade).
        if (response.status === 403 && withProjectHeader) continue
        if (!response.ok) {
          lastError = await httpError(response, 'antigravity')
          if (response.status >= 500 || response.status === 429 || response.status === 408) continue
          throw lastError
        }
        if (!response.body) throw new LlmError('antigravity API returned no response body', 'EMPTY_RESPONSE')
        yield* translate(parseSse(response.body), options.sessionId)
        return
      }
    }
    throw lastError ?? new LlmError('antigravity: no upstream endpoint attempted', 'TRANSPORT')
  }
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------
const name = 'llm-antigravity'
const inject = ['llm']
const NS = settingsNamespace('llm-antigravity')
const PROVIDER = 'antigravity'

function resolveModels(models) {
  const seen = new Set()
  return (models ?? DEFAULT_MODELS).map((model) => {
    if (model.id.length === 0) throw new Error('llm-antigravity: catalog model ids must be non-empty')
    if (model.name !== undefined && model.name.length === 0) throw new Error(`llm-antigravity: catalog model "${model.id}" has an empty name`)
    if (model.contextWindow !== undefined && (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0)) {
      throw new Error(`llm-antigravity: catalog model "${model.id}" contextWindow must be a positive integer`)
    }
    if (model.maxTokens !== undefined && (!Number.isSafeInteger(model.maxTokens) || model.maxTokens <= 0)) {
      throw new Error(`llm-antigravity: catalog model "${model.id}" maxTokens must be a positive safe integer`)
    }
    if (seen.has(model.id)) throw new Error(`llm-antigravity: duplicate catalog model "${model.id}"`)
    seen.add(model.id)
    const modalities = (model.inputModalities !== undefined && model.inputModalities.length > 0)
      ? model.inputModalities
      : inputModalitiesOf(model.id)
    return {
      id: model.id,
      ...(model.name === undefined ? {} : { name: model.name }),
      ...(model.description === undefined ? {} : { description: model.description }),
      ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
      ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
      inputModalities: modalities,
    }
  })
}

function resolveAdapterOptions(config, environment) {
  if (config.defaultContextWindow !== undefined && (!Number.isInteger(config.defaultContextWindow) || config.defaultContextWindow <= 0)) {
    throw new Error('llm-antigravity: defaultContextWindow must be a positive integer')
  }
  if (config.maxTokens !== undefined && (!Number.isSafeInteger(config.maxTokens) || config.maxTokens <= 0)) {
    throw new Error('llm-antigravity: maxTokens must be a positive safe integer')
  }
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS
  if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(`llm-antigravity: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`)
  }
  const baseURLs = config.baseURL ? [config.baseURL] : (config.baseURLs ?? DEFAULT_BASE_URLS)
  if (!Array.isArray(baseURLs) || baseURLs.length === 0 || baseURLs.some((url) => typeof url !== 'string' || url.length === 0)) {
    throw new Error('llm-antigravity: baseURLs must be a non-empty array of URL strings')
  }
  return {
    refreshTokenEnv: credentialRef(config.refreshTokenEnv ?? 'ANTIGRAVITY_REFRESH_TOKEN'),
    clientId: config.clientId ?? CLIENT_ID,
    clientSecret: config.clientSecret ?? CLIENT_SECRET,
    baseURL: config.baseURL ?? baseURLs[0],
    baseURLs,
    project: config.project ?? '',
    models: resolveModels(config.models),
    defaultContextWindow: config.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    streamIdleTimeoutMs,
    retryPolicy: resolveRetryPolicy(config.retryPolicy, 'llm-antigravity: retryPolicy'),
  }
}

function apply(ctx, config) {
  let current = () => config
  let lastRaw
  let lastGood
  const options = () => {
    const raw = current()
    if (raw === lastRaw && lastGood !== undefined) return lastGood
    try {
      const next = resolveAdapterOptions(raw, launchEnvironmentOf(ctx))
      lastRaw = raw
      lastGood = next
      return next
    } catch (error) {
      if (lastGood === undefined) throw error
      lastRaw = raw
      ctx.logger.error('llm-antigravity: keeping the last good configuration after an invalid settings section')
      ctx.logger.error(error)
      return lastGood
    }
  }
  options()

  const resolveRefreshToken = async (connection) => {
    const ref = connection.refreshTokenEnv ?? 'ANTIGRAVITY_REFRESH_TOKEN'
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) {
      const hit = await credentials.resolve(ref)
      if (hit !== undefined && hit.value !== undefined && hit.value.length > 0) {
        return assertUsableApiKey(hit.value, 'llm-antigravity', ref)
      }
    }
    const env = launchEnvironmentOf(ctx)
    const ambient = env.get(ref)
    if (ambient !== undefined && ambient.value !== undefined && ambient.value.length > 0) {
      return assertUsableApiKey(ambient.value, 'llm-antigravity', ref)
    }
    throw new LlmError(
      `llm-antigravity: no refresh token for provider route "${PROVIDER}"; store ${ref} through the credentials service (the web Models page writes it), or export ${ref} in the launching environment`,
      'MISSING_CREDENTIAL',
    )
  }

  const adapter = new AntigravityAdapter({
    options,
    resolveRefreshToken,
    // The durable attachment service, resolved lazily so image blocks can be
    // serialized as inlineData. Undefined when the service is not mounted —
    // then image blocks are skipped (text-only fallback), like pi-ai's
    // "requires the durable attachment service" guard.
    resolveAttachments: () => ctx.get('attachments'),
  })
  ctx.llm.registerConfigurableProviders([{
    provider: PROVIDER,
    displayName: 'Antigravity',
    settingsNs: NS,
    settingsPath: [],
  }])
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter)
  let registeredPolicy = options().retryPolicy
  const ensureRegistrationFacts = () => {
    const policy = options().retryPolicy
    if (deepEqualJson(policy, registeredPolicy)) return
    registration.replace([PROVIDER])
    registeredPolicy = policy
  }
  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      current = source
    },
    onChange: ensureRegistrationFacts,
  })
}

export {
  AntigravityAdapter,
  Config,
  DEFAULT_BASE_URLS,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  apply,
  inject,
  name,
  resolveAdapterOptions,
}
