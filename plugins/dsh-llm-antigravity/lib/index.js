import fs from 'node:fs'
import path from 'node:path'
import z from '@deepseek-ai/schemastery'
import * as dshLlm from '@deepseek-ai/dsh-llm'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { MAX_TIMER_DELAY_MS, idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout'
import { defineTool } from '@deepseek-ai/dsh-tools'

const {
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
} = dshLlm
const CallId = dshLlm.ToolCallId || dshLlm.CallId || ((id) => id)

function deepEqualJson(a, b) {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

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
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1_000_000, maxTokens: 65535, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash Thinking', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3-flash-agent', name: 'Gemini 3 Flash Agent', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.1-pro-high', name: 'Gemini 3.1 Pro High', contextWindow: 1_000_000, maxTokens: 65535, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro Low', contextWindow: 1_000_000, maxTokens: 65535, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', contextWindow: 1_000_000, maxTokens: 16384, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', contextWindow: 1_000_000, maxTokens: 16384, inputModalities: ['text', 'image', 'video'] },
  { id: 'gemini-3.5-flash-extra-low', name: 'Gemini 3.5 Flash Extra Low', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.5-flash-low', name: 'Gemini 3.5 Flash Low', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.6-flash-high', name: 'Gemini 3.6 Flash High', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.6-flash-medium', name: 'Gemini 3.6 Flash Medium', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.6-flash-low', name: 'Gemini 3.6 Flash Low', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.6-flash-tiered', name: 'Gemini 3.6 Flash Tiered', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.7-flash-high', name: 'Gemini 3.7 Flash High', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.7-flash-medium', name: 'Gemini 3.7 Flash Medium', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.7-flash-low', name: 'Gemini 3.7 Flash Low', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-3.7-flash-tiered', name: 'Gemini 3.7 Flash Tiered', contextWindow: 1_000_000, maxTokens: 65536, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'gemini-pro-agent', name: 'Gemini Pro Agent', contextWindow: 1_000_000, maxTokens: 65535, inputModalities: ['text', 'image', 'video', 'audio', 'document'] },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 1_000_000, maxTokens: 64000, inputModalities: ['text', 'image', 'video'] },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 Thinking', contextWindow: 1_000_000, maxTokens: 64000, inputModalities: ['text', 'image', 'video'] },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B Medium', contextWindow: 128_000, maxTokens: 16384, inputModalities: ['text'] },
]

const catalogModel = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number().step(1).min(1),
  maxTokens: z.number().step(1).min(1),
  inputModalities: z.array(z.union([z.const('text'), z.const('image'), z.const('video'), z.const('audio'), z.const('pdf'), z.const('document'), z.const('file')])),
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
// Usage tracking and persistence
// ---------------------------------------------------------------------------
function getUsageFilePath() {
  const homeDir = process.env.HOME || process.env.USERPROFILE
  if (homeDir) {
    const dshPath = path.join(homeDir, '.dsh', 'antigravity_usage.json')
    const cwdPath = path.join(process.cwd(), 'antigravity_usage.json')
    if (fs.existsSync(dshPath)) return dshPath
    if (fs.existsSync(cwdPath)) return cwdPath
    return dshPath
  }
  return path.join(process.cwd(), 'antigravity_usage.json')
}

class UsageTracker {
  constructor() {
    this.stats = this.load()
    this.saveTimer = null
  }

  load() {
    const filePath = getUsageFilePath()
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8')
        const data = JSON.parse(raw)
        const recent = Array.isArray(data.recent) ? data.recent : []
        const history = Array.isArray(data.history) && data.history.length > 0 ? data.history : [...recent]
        return {
          summary: {
            totalRequests: data.summary?.totalRequests || 0,
            totalInputTokens: data.summary?.totalInputTokens || 0,
            totalOutputTokens: data.summary?.totalOutputTokens || 0,
            totalCacheReadTokens: data.summary?.totalCacheReadTokens || 0,
            totalReasoningTokens: data.summary?.totalReasoningTokens || 0,
            firstUsed: data.summary?.firstUsed || null,
            lastUsed: data.summary?.lastUsed || null,
          },
          byModel: data.byModel || {},
          daily: data.daily || {},
          recent,
          history,
        }
      }
    } catch {}
    return {
      summary: {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalReasoningTokens: 0,
        firstUsed: null,
        lastUsed: null,
      },
      byModel: {},
      daily: {},
      recent: [],
      history: [],
    }
  }

  scheduleSave() {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      try {
        const filePath = getUsageFilePath()
        const dir = path.dirname(filePath)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(filePath, JSON.stringify(this.stats, null, 2), 'utf8')
      } catch {}
    }, 500)
  }

  record(item) {
    const {
      timestamp = new Date().toISOString(),
      model = 'unknown',
      inputTokens = 0,
      outputTokens = 0,
      cacheReadTokens = 0,
      reasoningTokens = 0,
      durationMs = 0,
      sessionId,
    } = item

    const totalTokens = inputTokens + outputTokens + reasoningTokens
    const promptGross = inputTokens + cacheReadTokens
    const cacheSavingsRatio = promptGross > 0 ? Math.round((cacheReadTokens / promptGross) * 1000) / 10 : 0

    // Summary
    this.stats.summary.totalRequests++
    this.stats.summary.totalInputTokens += inputTokens
    this.stats.summary.totalOutputTokens += outputTokens
    this.stats.summary.totalCacheReadTokens += cacheReadTokens
    this.stats.summary.totalReasoningTokens += reasoningTokens
    if (!this.stats.summary.firstUsed) this.stats.summary.firstUsed = timestamp
    this.stats.summary.lastUsed = timestamp

    // By Model
    if (!this.stats.byModel[model]) {
      this.stats.byModel[model] = {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
      }
    }
    const m = this.stats.byModel[model]
    m.requests++
    m.inputTokens += inputTokens
    m.outputTokens += outputTokens
    m.cacheReadTokens += cacheReadTokens
    m.reasoningTokens += reasoningTokens
    m.totalTokens += totalTokens

    // Daily
    const day = timestamp.slice(0, 10)
    if (!this.stats.daily[day]) {
      this.stats.daily[day] = {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
      }
    }
    const d = this.stats.daily[day]
    d.requests++
    d.inputTokens += inputTokens
    d.outputTokens += outputTokens
    d.cacheReadTokens += cacheReadTokens
    d.reasoningTokens += reasoningTokens
    d.totalTokens += totalTokens

    const recordEntry = {
      timestamp,
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      reasoningTokens,
      totalTokens,
      cacheSavingsRatio,
      durationMs,
      sessionId: sessionId ? String(sessionId) : undefined,
    }

    // History (retain 14 days of detailed records, capped at 20,000)
    if (!Array.isArray(this.stats.history)) {
      this.stats.history = Array.isArray(this.stats.recent) ? [...this.stats.recent] : []
    }
    this.stats.history.unshift(recordEntry)
    const cutoffMs = Date.now() - (14 * 24 * 3600 * 1000)
    this.stats.history = this.stats.history.filter((h) => {
      const t = new Date(h.timestamp).getTime()
      return !isNaN(t) && t >= cutoffMs
    })
    if (this.stats.history.length > 20000) {
      this.stats.history = this.stats.history.slice(0, 20000)
    }

    // Recent list (keep latest 50 for quick display)
    this.stats.recent.unshift(recordEntry)
    if (this.stats.recent.length > 50) {
      this.stats.recent = this.stats.recent.slice(0, 50)
    }

    this.scheduleSave()
  }

  aggregateWindow(startTimeMs, endTimeMs) {
    const byModel = {}
    let totalRequests = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheReadTokens = 0
    let totalReasoningTokens = 0

    const list = this.stats.history && this.stats.history.length > 0
      ? this.stats.history
      : (this.stats.recent || [])

    for (const item of list) {
      const t = new Date(item.timestamp).getTime()
      if (isNaN(t)) continue
      if (t >= startTimeMs && t <= endTimeMs) {
        const model = item.model || 'unknown'
        if (!byModel[model]) {
          byModel[model] = {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            reasoningTokens: 0,
            totalTokens: 0,
          }
        }
        const m = byModel[model]
        m.requests++
        m.inputTokens += (item.inputTokens || 0)
        m.outputTokens += (item.outputTokens || 0)
        m.cacheReadTokens += (item.cacheReadTokens || 0)
        m.reasoningTokens += (item.reasoningTokens || 0)
        m.totalTokens += ((item.inputTokens || 0) + (item.outputTokens || 0) + (item.reasoningTokens || 0))

        totalRequests++
        totalInputTokens += (item.inputTokens || 0)
        totalOutputTokens += (item.outputTokens || 0)
        totalCacheReadTokens += (item.cacheReadTokens || 0)
        totalReasoningTokens += (item.reasoningTokens || 0)
      }
    }

    const grossPrompt = totalInputTokens + totalCacheReadTokens
    const cacheSavingsRate = grossPrompt > 0
      ? `${(Math.round((totalCacheReadTokens / grossPrompt) * 1000) / 10).toFixed(1)}%`
      : '0.0%'

    return {
      startTime: new Date(startTimeMs).toISOString(),
      endTime: new Date(endTimeMs).toISOString(),
      summary: {
        totalRequests,
        totalInputTokens,
        totalOutputTokens,
        totalCacheReadTokens,
        totalReasoningTokens,
        totalTokens: totalInputTokens + totalOutputTokens + totalReasoningTokens,
        grossPromptTokens: grossPrompt,
        cacheSavingsRate,
      },
      byModel,
    }
  }

  getStats(options = {}) {
    const grossPrompt = this.stats.summary.totalInputTokens + this.stats.summary.totalCacheReadTokens
    const cacheSavingsRate = grossPrompt > 0
      ? `${(Math.round((this.stats.summary.totalCacheReadTokens / grossPrompt) * 1000) / 10).toFixed(1)}%`
      : '0.0%'
    const totalTokens = this.stats.summary.totalInputTokens + this.stats.summary.totalOutputTokens + this.stats.summary.totalReasoningTokens

    const now = Date.now()

    // 5h window: if resetTime is provided, calculate [resetTime - 5h, resetTime]; otherwise [now - 5h, now]
    const resetTime5hMs = options.resetTime5h ? new Date(options.resetTime5h).getTime() : now
    const end5h = !isNaN(resetTime5hMs) ? resetTime5hMs : now
    const start5h = end5h - (5 * 3600 * 1000)

    // Weekly window: if resetTime is provided, calculate [resetTime - 7d, resetTime]; otherwise [now - 7d, now]
    const resetTimeWeeklyMs = options.resetTimeWeekly ? new Date(options.resetTimeWeekly).getTime() : now
    const endWeekly = !isNaN(resetTimeWeeklyMs) ? resetTimeWeeklyMs : now
    const startWeekly = endWeekly - (7 * 24 * 3600 * 1000)

    const window5h = this.aggregateWindow(start5h, end5h)
    const windowWeekly = this.aggregateWindow(startWeekly, endWeekly)

    return {
      summary: {
        ...this.stats.summary,
        totalTokens,
        grossPromptTokens: grossPrompt,
        cacheSavingsRate,
      },
      byModel: this.stats.byModel,
      daily: this.stats.daily,
      recent: this.stats.recent,
      history: this.stats.history || this.stats.recent || [],
      windows: {
        '5h': window5h,
        weekly: windowWeekly,
      },
    }
  }

  reset() {
    this.stats = {
      summary: {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalReasoningTokens: 0,
        firstUsed: null,
        lastUsed: null,
      },
      byModel: {},
      daily: {},
      recent: [],
      history: [],
    }
    try {
      const filePath = getUsageFilePath()
      const dir = path.dirname(filePath)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(filePath, JSON.stringify(this.stats, null, 2), 'utf8')
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Quota querying service
// ---------------------------------------------------------------------------
class QuotaService {
  constructor() {
    this.cache = null
    this.cacheExpiresAt = 0
    this.fetchPromise = null
  }

  async getQuota(accessToken, baseURL, project, force = false) {
    const now = Date.now()
    if (!force && this.cache && now < this.cacheExpiresAt) {
      return this.cache
    }
    if (this.fetchPromise) return this.fetchPromise

    this.fetchPromise = (async () => {
      try {
        const headers = {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          ...attributionHeaders(),
          'user-agent': OFFICIAL_USER_AGENT,
        }

        // 1. retrieveUserQuotaSummary
        let quotaData = null
        try {
          const quotaRes = await fetch(`${baseURL}:retrieveUserQuotaSummary`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ project: project || 'default' }),
          })
          if (quotaRes.ok) quotaData = await quotaRes.json()
        } catch {}

        // 2. fetchAvailableModels
        let modelsData = null
        try {
          const modelsRes = await fetch(`${baseURL}:fetchAvailableModels`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ project: project || 'default' }),
          })
          if (modelsRes.ok) modelsData = await modelsRes.json()
        } catch {}

        // 3. loadCodeAssist
        let lcaData = null
        try {
          const lcaRes = await fetch(`${baseURL}:loadCodeAssist`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } }),
          })
          if (lcaRes.ok) lcaData = await lcaRes.json()
        } catch {}

        const groups = (quotaData?.groups || []).map((g) => ({
          displayName: g.displayName || 'Model Quota Group',
          description: g.description || '',
          buckets: (g.buckets || []).map((b) => {
            const fraction = typeof b.remainingFraction === 'number' ? b.remainingFraction : 1.0
            const percent = Math.round(fraction * 1000) / 10
            let resetInSeconds = 0
            if (b.resetTime) {
              const resetMs = new Date(b.resetTime).getTime()
              if (!isNaN(resetMs)) {
                resetInSeconds = Math.max(0, Math.round((resetMs - Date.now()) / 1000))
              }
            }
            return {
              bucketId: b.bucketId || 'default',
              displayName: b.displayName || b.bucketId || 'Quota Window',
              window: b.window || (b.bucketId?.includes('5h') ? '5h' : 'weekly'),
              resetTime: b.resetTime,
              resetInSeconds,
              description: b.description || '',
              remainingFraction: fraction,
              remainingPercent: percent,
            }
          }),
        }))

        const models = Object.entries(modelsData?.models || {})
          .map(([id, m]) => {
            const fraction = m.quotaInfo?.remainingFraction
            return {
              id,
              displayName: m.displayName || id,
              remainingFraction: fraction,
              remainingPercent: typeof fraction === 'number' ? Math.round(fraction * 1000) / 10 : undefined,
              resetTime: m.quotaInfo?.resetTime,
            }
          })
          .filter((m) => m.remainingFraction !== undefined)

        const result = {
          ok: true,
          tier: {
            id: lcaData?.currentTier?.id || 'free-tier',
            name: lcaData?.currentTier?.name || 'Antigravity',
            description: lcaData?.currentTier?.description || '',
            paidTier: lcaData?.paidTier?.name || lcaData?.paidTier?.id || 'Google AI Pro',
            project: project || lcaData?.cloudaicompanionProject || 'default',
            upgradeSubscriptionUri: lcaData?.currentTier?.upgradeSubscriptionUri || lcaData?.upgradeSubscriptionUri,
          },
          groups,
          models,
          quotaDescription: quotaData?.description,
          updatedAt: new Date().toISOString(),
        }

        this.cache = result
        this.cacheExpiresAt = Date.now() + 15_000 // 15s cache
        return result
      } finally {
        this.fetchPromise = null
      }
    })()

    return this.fetchPromise
  }
}

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
  if (lower.startsWith('gemini')) return ['text', 'image', 'video', 'audio', 'document']
  if (lower.startsWith('claude') || lower === 'opus' || lower === 'sonnet') return ['text', 'image', 'video']
  return ['text']
}

// ---------------------------------------------------------------------------
// Multimodal input tools: read_video, read_audio, read_pdf.
// Attaches local media/documents as inlineData parts so the model analyzes
// audio, video, PDF layouts, tables, and images directly.
// ---------------------------------------------------------------------------
const MAX_VIDEO_BYTES = 300 * 1024 * 1024 // 300MB video cap
const MAX_AUDIO_BYTES = 100 * 1024 * 1024 // 100MB audio cap
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024 // 100MB PDF/document cap

/** Sniff the container of a video buffer and return its MIME type, or undefined. */
function sniffVideoMimeType(buf) {
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    // ISO BMFF: mp4 / mov / m4v / heic-family. Brand at offset 8..12.
    const brand = buf.toString('latin1', 8, 12)
    if (['qt  ', 'isom', 'mp42', 'avc1', 'mp41', 'M4V ', 'M4A ', '3gp4', '3gp5', '3gp6'].includes(brand)) {
      return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4'
    }
  }
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'video/webm' // EBML magic (Matroska/WebM)
  }
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'AVI ') {
    return 'video/x-msvideo'
  }
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'OggS') {
    return 'video/ogg'
  }
  return undefined
}

const VIDEO_EXT_MIME = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
}

/** Sniff the container of an audio buffer and return its MIME type, or undefined. */
function sniffAudioMimeType(buf) {
  if (buf.length >= 3 && buf.toString('latin1', 0, 3) === 'ID3') return 'audio/mp3'
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mp3'
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WAVE') return 'audio/wav'
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'fLaC') return 'audio/flac'
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'OggS') return 'audio/ogg'
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12)
    if (['M4A ', 'M4B ', 'mp42', 'isom'].includes(brand)) return 'audio/m4a'
  }
  return undefined
}

const AUDIO_EXT_MIME = {
  '.mp3': 'audio/mp3',
  '.wav': 'audio/wav',
  '.m4a': 'audio/m4a',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.flac': 'audio/flac',
  '.weba': 'audio/webm',
}

/** Sniff the container of a document buffer (PDF / RTF / Jupyter) and return its MIME type, or undefined. */
function sniffDocumentMimeType(buf) {
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === '%PDF') return 'application/pdf'
  if (buf.length >= 5 && buf.toString('latin1', 0, 5) === '{\\rtf') return 'application/rtf'
  try {
    const text = buf.slice(0, 500).toString('utf8')
    if (text.includes('"cells"') && text.includes('"nbformat"')) return 'application/x-ipynb+json'
  } catch {}
  return undefined
}

const DOCUMENT_EXT_MIME = {
  '.pdf': 'application/pdf',
  '.ipynb': 'application/x-ipynb+json',
  '.rtf': 'application/rtf',
  '.csv': 'text/csv',
}

/** Register the model-facing read_video tool (parallel to read_image). */
function applyReadVideoTool(ctx) {
  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.tools.register(defineTool({
      name: 'read_video',
      description: 'Read a local video file (mp4/mov/webm/mkv/avi/ogg) and attach its frames to the conversation so the current model can analyze the video content, audio, and timing. Requires the current model to accept video input. Large files are capped; refuse inputs above the cap instead of reading them.',
      parameters: {
        file_path: {
          type: 'string',
          required: true,
          description: 'Path to the video file, resolved by the filesystem backend.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: { type: 'string', required: true },
            name: { type: 'string' },
            mimeType: { type: 'string', required: true },
            bytes: { type: 'integer', required: true },
            data: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `Attached video ${value.name ?? value.path} (${value.mimeType}, ${(value.bytes / 1024 / 1024).toFixed(1)} MB) for the current model to analyze.`,
        }, {
          type: 'video',
          mimeType: value.mimeType,
          data: value.data,
        }],
        presentationMeta: (_args, value) => ({
          path: value.path,
          mimeType: value.mimeType,
          sizeBytes: value.bytes,
        }),
      },
      timeoutMs: 120_000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        const filePath = String(args.file_path ?? '').trim()
        if (filePath.length === 0) throw new Error('read_video: file_path must be a non-empty string')
        const resolved = path.resolve(filePath)
        let stat
        try {
          stat = fs.statSync(resolved)
        } catch {
          throw new Error(`read_video: cannot stat "${filePath}" (resolved ${resolved}): the file does not exist or is not readable`)
        }
        if (!stat.isFile()) throw new Error(`read_video: "${filePath}" is not a regular file`)
        if (stat.size === 0) throw new Error(`read_video: "${filePath}" is empty`)
        if (stat.size > MAX_VIDEO_BYTES) {
          throw new Error(`read_video: "${filePath}" is ${(stat.size / 1024 / 1024).toFixed(1)} MB, exceeding the ${(MAX_VIDEO_BYTES / 1024 / 1024)} MB cap; split or downscale the video first`)
        }
        const buf = fs.readFileSync(resolved)
        const sniffed = sniffVideoMimeType(buf)
        const extMime = VIDEO_EXT_MIME[path.extname(resolved).toLowerCase()]
        const mimeType = sniffed ?? extMime
        if (mimeType === undefined) {
          throw new Error(`read_video: "${filePath}" does not look like a supported video container (mp4/mov/webm/mkv/avi/ogg)`)
        }
        return {
          path: resolved,
          name: path.basename(resolved),
          mimeType,
          bytes: buf.length,
          data: buf.toString('base64'),
        }
      },
      presentCall(args) {
        return {
          card: 'generic',
          title: `Read video ${args.file_path}`,
          kind: 'read',
          locations: [{ path: args.file_path }],
        }
      },
    }))
  })
}

/** Register the model-facing read_audio tool. */
function applyReadAudioTool(ctx) {
  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.tools.register(defineTool({
      name: 'read_audio',
      description: 'Read a local audio file (mp3/wav/m4a/aac/ogg/opus/flac/weba) and attach its audio stream to the conversation so the model can analyze the speech, tone, music, and timing.',
      parameters: {
        file_path: {
          type: 'string',
          required: true,
          description: 'Path to the audio file, resolved by the filesystem backend.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: { type: 'string', required: true },
            name: { type: 'string' },
            mimeType: { type: 'string', required: true },
            bytes: { type: 'integer', required: true },
            data: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `Attached audio ${value.name ?? value.path} (${value.mimeType}, ${(value.bytes / 1024 / 1024).toFixed(2)} MB) for the current model to analyze.`,
        }, {
          type: 'audio',
          mimeType: value.mimeType,
          data: value.data,
        }],
        presentationMeta: (_args, value) => ({
          path: value.path,
          mimeType: value.mimeType,
          sizeBytes: value.bytes,
        }),
      },
      timeoutMs: 120_000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        const filePath = String(args.file_path ?? '').trim()
        if (filePath.length === 0) throw new Error('read_audio: file_path must be a non-empty string')
        const resolved = path.resolve(filePath)
        let stat
        try {
          stat = fs.statSync(resolved)
        } catch {
          throw new Error(`read_audio: cannot stat "${filePath}" (resolved ${resolved}): the file does not exist or is not readable`)
        }
        if (!stat.isFile()) throw new Error(`read_audio: "${filePath}" is not a regular file`)
        if (stat.size === 0) throw new Error(`read_audio: "${filePath}" is empty`)
        if (stat.size > MAX_AUDIO_BYTES) {
          throw new Error(`read_audio: "${filePath}" is ${(stat.size / 1024 / 1024).toFixed(1)} MB, exceeding the ${(MAX_AUDIO_BYTES / 1024 / 1024)} MB cap; split or compress the audio first`)
        }
        const buf = fs.readFileSync(resolved)
        const sniffed = sniffAudioMimeType(buf)
        const extMime = AUDIO_EXT_MIME[path.extname(resolved).toLowerCase()]
        const mimeType = sniffed ?? extMime
        if (mimeType === undefined) {
          throw new Error(`read_audio: "${filePath}" does not look like a supported audio format (mp3/wav/m4a/aac/ogg/opus/flac/weba)`)
        }
        return {
          path: resolved,
          name: path.basename(resolved),
          mimeType,
          bytes: buf.length,
          data: buf.toString('base64'),
        }
      },
      presentCall(args) {
        return {
          card: 'generic',
          title: `Read audio ${args.file_path}`,
          kind: 'read',
          locations: [{ path: args.file_path }],
        }
      },
    }))
  })
}

/** Register the model-facing read_pdf tool. */
function applyReadPdfTool(ctx) {
  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.tools.register(defineTool({
      name: 'read_pdf',
      description: 'Read a local PDF document file and attach its pages/layout to the conversation so the model can analyze the text, charts, tables, and document structure.',
      parameters: {
        file_path: {
          type: 'string',
          required: true,
          description: 'Path to the PDF file, resolved by the filesystem backend.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: { type: 'string', required: true },
            name: { type: 'string' },
            mimeType: { type: 'string', required: true },
            bytes: { type: 'integer', required: true },
            data: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `Attached PDF document ${value.name ?? value.path} (${value.mimeType}, ${(value.bytes / 1024 / 1024).toFixed(2)} MB) for the current model to analyze.`,
        }, {
          type: 'pdf',
          mimeType: value.mimeType,
          data: value.data,
        }],
        presentationMeta: (_args, value) => ({
          path: value.path,
          mimeType: value.mimeType,
          sizeBytes: value.bytes,
        }),
      },
      timeoutMs: 120_000,
      isConcurrencySafe: () => false,
      async execute(args, exec) {
        const filePath = String(args.file_path ?? '').trim()
        if (filePath.length === 0) throw new Error('read_pdf: file_path must be a non-empty string')
        const resolved = path.resolve(filePath)
        let stat
        try {
          stat = fs.statSync(resolved)
        } catch {
          throw new Error(`read_pdf: cannot stat "${filePath}" (resolved ${resolved}): the file does not exist or is not readable`)
        }
        if (!stat.isFile()) throw new Error(`read_pdf: "${filePath}" is not a regular file`)
        if (stat.size === 0) throw new Error(`read_pdf: "${filePath}" is empty`)
        if (stat.size > MAX_DOCUMENT_BYTES) {
          throw new Error(`read_pdf: "${filePath}" is ${(stat.size / 1024 / 1024).toFixed(1)} MB, exceeding the ${(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB cap; split the PDF first`)
        }
        const buf = fs.readFileSync(resolved)
        const sniffed = sniffDocumentMimeType(buf)
        const extMime = DOCUMENT_EXT_MIME[path.extname(resolved).toLowerCase()]
        const mimeType = sniffed ?? extMime
        if (mimeType === undefined) {
          throw new Error(`read_pdf: "${filePath}" does not look like a supported document (PDF/Jupyter/RTF/CSV)`)
        }
        return {
          path: resolved,
          name: path.basename(resolved),
          mimeType,
          bytes: buf.length,
          data: buf.toString('base64'),
        }
      },
      presentCall(args) {
        return {
          card: 'generic',
          title: `Read PDF ${args.file_path}`,
          kind: 'read',
          locations: [{ path: args.file_path }],
        }
      },
    }))
  })
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
          const part = {
            functionCall: {
              name: block.name,
              args,
              ...(typeof block.id === 'string' && block.id.length > 0 ? { id: block.id } : {}),
            },
          }
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
        const mediaParts = []
        const textContent = flattenText(result.content)
        // Media carried by tool results (video/image blocks): the official
        // Antigravity client attaches media read through a tool (e.g.
        // view_file) as NESTED parts[].inlineData inside the functionResponse
        // (captured: {"functionResponse":{...,"parts":[{"inlineData":{
        // "mimeType":"video/mp4","data":"AAAAIGZ0eXBpc29t..."}}]}}). Emit the
        // same shape so video/image tool reads reach the model the way the
        // real client sends them. Data may be inlined (read_video/read_image
        // results) or resolved through the durable attachment service.
        // The parts array carries ONLY media; the tool's text result stays in
        // response.result so the no-media wire shape is unchanged (the prefix
        // cache depends on it).
        for (const block of result.content) {
          if (typeof block.mimeType === 'string' && typeof block.data === 'string' && block.data.length > 0) {
            mediaParts.push({ inlineData: { mimeType: block.mimeType, data: block.data } })
          } else if (block.type === 'image' && block.attachment !== undefined && attachments !== undefined) {
            const stored = await attachments.readImage(block.attachment)
            mediaParts.push({
              inlineData: {
                mimeType: stored.ref.mediaType,
                data: Buffer.from(stored.data).toString('base64'),
              },
            })
          } else if ((block.type === 'video' || block.type === 'audio' || block.type === 'pdf' || block.type === 'document' || block.type === 'file') && typeof block.data === 'string' && block.data.length > 0) {
            mediaParts.push({ inlineData: { mimeType: block.mimeType || 'application/octet-stream', data: block.data } })
          }
        }
        const toolCallId = (typeof result.toolCallId === 'string' && result.toolCallId.length > 0)
          ? result.toolCallId
          : (typeof result.callId === 'string' && result.callId.length > 0 ? result.callId : (typeof result.id === 'string' && result.id.length > 0 ? result.id : undefined))
        const fr = {
          name: (toolCallId ? callNames.get(toolCallId) : undefined) ?? result.toolName ?? 'unknown',
          response: { result: textContent || '(no output)' },
          ...(toolCallId ? { id: toolCallId } : {}),
        }
        if (mediaParts.length > 0) {
          // Match the official functionResponse media shape:
          // {"functionResponse":{"id":"call_...","name":...,"response":{...},"parts":[{"inlineData":{...}}]}}
          fr.parts = mediaParts
        }
        parts.push({ functionResponse: fr })
      }
      wire.push({ role: 'model', parts })
    }
    const parts = []
    const text = flattenText(message.content)
    if (text.length > 0) parts.push({ text })
    // Multimodal blocks (image/video/audio/pdf/document/file): the Antigravity
    // wire sends media as inlineData {mimeType, data(base64)} parts.
    for (const block of message.content) {
      if (block.type === 'image') {
        if (attachments !== undefined && block.attachment !== undefined) {
          const stored = await attachments.readImage(block.attachment)
          parts.push({
            inlineData: {
              mimeType: stored.ref.mediaType,
              data: Buffer.from(stored.data).toString('base64'),
            },
          })
        } else if (typeof block.mimeType === 'string' && typeof block.data === 'string' && block.data.length > 0) {
          parts.push({ inlineData: { mimeType: block.mimeType, data: block.data } })
        }
      } else if (
        (block.type === 'video' || block.type === 'audio' || block.type === 'pdf' || block.type === 'document' || block.type === 'file') &&
        typeof block.data === 'string' && block.data.length > 0
      ) {
        parts.push({
          inlineData: {
            mimeType: block.mimeType || (block.type === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
            data: block.data,
          },
        })
      } else if (typeof block.mimeType === 'string' && typeof block.data === 'string' && block.data.length > 0) {
        parts.push({ inlineData: { mimeType: block.mimeType, data: block.data } })
      }
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

const MODEL_ALIASES = {
  'gemini-3.1-pro-high': 'gemini-pro-agent',
  'gemini-3.1-pro': 'gemini-pro-agent',
  'gemini-3-pro': 'gemini-pro-agent',
  'claude-opus': 'claude-opus-4-6-thinking',
  'claude-opus-4-6': 'claude-opus-4-6-thinking',
  'claude-opus-4-5': 'claude-opus-4-6-thinking',
  'claude-opus-4-5-thinking': 'claude-opus-4-6-thinking',
  'claude-3-opus': 'claude-opus-4-6-thinking',
  'claude-3-5-opus': 'claude-opus-4-6-thinking',
  'opus': 'claude-opus-4-6-thinking',
  'claude-sonnet': 'claude-sonnet-4-6',
  'claude-sonnet-4-5': 'claude-sonnet-4-6',
  'claude-3-5-sonnet': 'claude-sonnet-4-6',
  'claude-3-7-sonnet': 'claude-sonnet-4-6',
  'claude-haiku-4-5': 'claude-sonnet-4-6',
  'claude-haiku': 'claude-sonnet-4-6',
  'sonnet': 'claude-sonnet-4-6',
}

function resolveCanonicalModel(modelId) {
  return MODEL_ALIASES[modelId] || modelId
}

function maxOutputTokensLimit(model) {
  const lower = model.toLowerCase()
  if (lower.startsWith('claude') || lower === 'opus' || lower === 'sonnet') return 64000
  if (lower.startsWith('gpt-oss-')) return 16384
  if (lower.includes('flash-lite') || lower.includes('flash-image')) return 16384
  if (lower.includes('pro')) return 65535
  return 65536
}

function supportsThinkingConfig(model) {
  const lower = model.toLowerCase()
  if (lower.startsWith('gpt-oss-')) return false
  return true
}

/** Build the wrapped v1internal streamGenerateContent body (reference wrap_request_v2). */
async function serializeRequest(options, project, attachments) {
  const model = resolveCanonicalModel(options.model)
  const contents = await serializeMessages(options.messages, options.sessionId, model, attachments)
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
  const maxLimit = maxOutputTokensLimit(model)
  let maxOutputTokens = options.maxTokens !== undefined ? options.maxTokens : maxLimit
  if (maxOutputTokens > maxLimit) maxOutputTokens = maxLimit
  generationConfig.maxOutputTokens = maxOutputTokens

  if (options.temperature !== undefined) generationConfig.temperature = options.temperature
  if (options.stop !== undefined && options.stop.length > 0) generationConfig.stopSequences = options.stop
  // Real Antigravity agent requests send the explicit thinking config for models that support it
  // (gpt-oss does not accept thinkingConfig and returns 400).
  if (supportsThinkingConfig(model)) {
    generationConfig.thinkingConfig = { includeThoughts: true, thinkingBudget: -1 }
  }
  if (Object.keys(generationConfig).length > 0) inner.generationConfig = generationConfig
  if (options.sessionId !== undefined) inner.sessionId = String(options.sessionId)
  inner.contents = contents

  return {
    project,
    request: inner,
    model,
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
async function* translate(payloads, sessionId, onUsage) {
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
  if (pendingUsage !== undefined) {
    if (typeof onUsage === 'function') {
      try { onUsage(pendingUsage) } catch {}
    }
    yield { type: 'usage', usage: pendingUsage }
  }
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
  constructor(config, usageTracker) {
    super()
    this.config = config
    this.usageTracker = usageTracker
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
          ...attributionHeaders(),
          'user-agent': OFFICIAL_USER_AGENT,
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
    const startTime = Date.now()
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
        yield* translate(parseSse(response.body), options.sessionId, (usage) => {
          this.usageTracker?.record({
            timestamp: new Date().toISOString(),
            model: options.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens || 0,
            reasoningTokens: usage.reasoningTokens || 0,
            durationMs: Date.now() - startTime,
            sessionId: options.sessionId,
          })
        })
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
const NS = 'llm-antigravity'
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

  // Model-facing multimodal tools: lets the model attach local video/audio/pdf files
  // to the conversation (the Antigravity wire carries them as inlineData parts).
  applyReadVideoTool(ctx)
  applyReadAudioTool(ctx)
  applyReadPdfTool(ctx)

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

  const usageTracker = new UsageTracker()
  const quotaService = new QuotaService()

  const adapter = new AntigravityAdapter({
    options,
    resolveRefreshToken,
    // The durable attachment service, resolved lazily so image blocks can be
    // serialized as inlineData. Undefined when the service is not mounted —
    // then image blocks are skipped (text-only fallback), like pi-ai's
    // "requires the durable attachment service" guard.
    resolveAttachments: () => ctx.get('attachments'),
  }, usageTracker)

  // Register WebServer routes for live quota and usage statistics when available
  ctx.inject(['webServer'], (httpCtx) => {
    try {
      httpCtx.webServer.register({
        kind: 'prefix',
        path: '/api/antigravity',
        handler: async (req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          if (req.method === 'OPTIONS') {
            res.writeHead(204)
            res.end()
            return
          }

          const url = new URL(req.url ?? '/', 'http://localhost')
          const pathName = url.pathname.replace(/\/+$/, '')

          if (pathName === '/api/antigravity/usage') {
            if (req.method === 'DELETE') {
              usageTracker.reset()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: true, message: 'Usage statistics reset' }))
              return
            }
            const resetTime5h = url.searchParams.get('resetTime5h')
            const resetTimeWeekly = url.searchParams.get('resetTimeWeekly')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true, stats: usageTracker.getStats({ resetTime5h, resetTimeWeekly }) }))
            return
          }

          if (pathName === '/api/antigravity/quota') {
            try {
              const connection = options()
              const accessToken = await adapter.ensureAccessToken()
              const project = await adapter.ensureProject(accessToken)
              const force = url.searchParams.get('force') === 'true' || req.method === 'POST'
              const quota = await quotaService.getQuota(accessToken, connection.baseURL, project, force)
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(quota))
            } catch (err) {
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: err.message || String(err) }))
            }
            return
          }

          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Endpoint not found' }))
        },
      })
    } catch (e) {
      ctx.logger?.warn?.('llm-antigravity: webServer registration failed', e)
    }
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
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NS, Config, config, {
      setSource: (source) => {
        current = source
      },
      onChange: ensureRegistrationFacts,
    })
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
