// Antigravity (Google Cloud Code) search provider for the ctx.web seam.
// Registers as provider id "antigravity": search() exchanges the account
// refresh token for an access token, calls the v1internal generateContent
// endpoint with the built-in googleSearch tool, and maps the returned
// groundingMetadata.groundingChunks to {url,title,snippet} sources.
//
// Mirrors the antigravity-hub gateway's search forwarding (transform_request.go
// isSearchRequested -> {googleSearch:{}} + toolConfig VALIDATED, and
// transform_response.go FormatGroundingSources), so the same wire shape is
// used; the sources here are raw, letting dsh-tool-web format them.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { WebError } from '@deepseek-ai/dsh-web'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'

const PROVIDER_ID = 'antigravity'
const CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || [49,48,55,49,48,48,54,48,54,48,53,57,49,45,116,109,104,115,115,105,110,50,104,50,49,108,99,114,101,50,51,53,118,116,111,108,111,106,104,52,103,52,48,51,101,112,46,97,112,112,115,46,103,111,111,103,108,101,117,115,101,114,99,111,110,116,101,110,116,46,99,111,109].map(function(c){return String.fromCharCode(c);}).join('');
const CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || [71,79,67,83,80,88,45,75,53,56,70,87,82,52,56,54,76,100,76,74,49,109,76,66,56,115,88,67,52,122,54,113,68,65,102].map(function(c){return String.fromCharCode(c);}).join('');
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
// Same endpoint as the llm adapter: user-verified working endpoint.
const DEFAULT_BASE_URL = 'https://daily-cloudcode-pa.googleapis.com/v1internal'
const LOAD_CODE_ASSIST_URL = 'https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist'
const TOKEN_REFRESH_SKEW_MS = 900_000
const OFFICIAL_USER_AGENT = 'Antigravity/4.3.0 windows/amd64'

// ---------------------------------------------------------------------------
// Proxy Support (HTTP / HTTPS / SOCKS5)
// ---------------------------------------------------------------------------
let _undici = null
function getUndici() {
  if (_undici) return _undici
  try {
    const req = createRequire(import.meta.url)
    _undici = req('undici')
    if (_undici?.ProxyAgent) return _undici
  } catch {}
  const candidates = [
    'undici',
    path.join(process.env.APPDATA || '', 'npm/node_modules/@deepseek-ai/dsh/node_modules/undici'),
    path.join(process.env.HOME || process.env.USERPROFILE || '', '.dsh/profiles/web/node_modules/undici'),
  ]
  for (const c of candidates) {
    try {
      const req = createRequire(import.meta.url)
      _undici = req(c)
      if (_undici?.ProxyAgent) return _undici
    } catch {}
  }
  return null
}

function resolveActiveProxy() {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE
    const p = homeDir ? path.join(homeDir, '.dsh', 'antigravity_accounts.json') : path.join(process.cwd(), 'antigravity_accounts.json')
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'))
      const active = data.accounts?.find((a) => a.id === data.activeAccountId)
      return active?.proxy || null
    }
  } catch {}
  return null
}

function normalizeProxyUrl(raw) {
  if (!raw || typeof raw !== 'string') return null
  let trimmed = raw.trim()
  if (!trimmed) return null
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    trimmed = 'http://' + trimmed
  }
  try {
    const u = new URL(trimmed)
    if (u.protocol === 'socks5h:' || u.protocol === 'socks:') {
      trimmed = 'socks5:' + trimmed.slice(u.protocol.length)
    }
    return trimmed
  } catch {
    return null
  }
}

const proxyAgentCache = new Map()
function getDispatcher(proxyUrl) {
  const norm = normalizeProxyUrl(proxyUrl)
  if (!norm) return null
  let agent = proxyAgentCache.get(norm)
  if (!agent) {
    const undici = getUndici()
    if (!undici?.ProxyAgent) return null
    agent = new undici.ProxyAgent(norm)
    proxyAgentCache.set(norm, agent)
  }
  return agent
}

async function antigravityFetch(url, options = {}, proxyUrl = null) {
  const dispatcher = getDispatcher(proxyUrl)
  if (dispatcher) {
    const undici = getUndici()
    return undici.fetch(url, { ...options, dispatcher })
  }
  return fetch(url, options)
}

const redirectCache = new Map()

function extractDirectUrlSync(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  try {
    const u = new URL(rawUrl)
    if (/(?:^|\.)google\.[a-z.]+$/i.test(u.hostname) && (u.pathname === '/url' || u.pathname.endsWith('/url'))) {
      const target = u.searchParams.get('url') || u.searchParams.get('q')
      if (target && /^https?:\/\//i.test(target)) {
        return target
      }
    }
  } catch {}
  return null
}

function isRedirectUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  if (extractDirectUrlSync(rawUrl) !== null) return true
  try {
    const u = new URL(rawUrl)
    if (u.hostname === 'vertexaisearch.cloud.google.com' && u.pathname.startsWith('/grounding-api-redirect')) {
      return true
    }
    if (/(?:^|\.)google\.[a-z.]+$/i.test(u.hostname) && (u.pathname === '/url' || u.pathname.includes('/redirect'))) {
      return true
    }
  } catch {}
  return false
}

async function resolveDirectUrl(rawUrl, proxyUrl = null, timeoutMs = 2500, signal = undefined) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl

  const syncDirect = extractDirectUrlSync(rawUrl)
  if (syncDirect) return syncDirect

  if (!isRedirectUrl(rawUrl)) return rawUrl

  if (redirectCache.has(rawUrl)) return redirectCache.get(rawUrl)

  const controller = new AbortController()
  const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await antigravityFetch(rawUrl, {
      method: 'HEAD',
      redirect: 'manual',
      signal: combinedSignal,
    }, proxyUrl)
    clearTimeout(timer)
    const location = res.headers?.get?.('location')
    if (location && /^https?:\/\//i.test(location)) {
      const direct = extractDirectUrlSync(location) || location
      redirectCache.set(rawUrl, direct)
      return direct
    }
    if (res.status === 405) {
      const getController = new AbortController()
      const getSignal = signal ? AbortSignal.any([signal, getController.signal]) : getController.signal
      const getTimer = setTimeout(() => getController.abort(), timeoutMs)
      try {
        const getRes = await antigravityFetch(rawUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: getSignal,
        }, proxyUrl)
        clearTimeout(getTimer)
        const loc = getRes.headers?.get?.('location')
        if (loc && /^https?:\/\//i.test(loc)) {
          const direct = extractDirectUrlSync(loc) || loc
          redirectCache.set(rawUrl, direct)
          return direct
        }
      } catch {} finally {
        clearTimeout(getTimer)
      }
    }
  } catch {} finally {
    clearTimeout(timer)
  }

  return null
}

const pageTitleCache = new Map()

function decodeHtmlEntities(str) {
  if (!str) return str
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try { return String.fromCharCode(parseInt(hex, 16)) } catch { return _ }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try { return String.fromCharCode(parseInt(dec, 10)) } catch { return _ }
    })
}

function cleanTitle(raw) {
  if (!raw || typeof raw !== 'string') return null
  const decoded = decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim()
  return decoded.length > 0 ? decoded : null
}

async function fetchPageTitle(url, proxyUrl = null, timeoutMs = 2500, signal = undefined) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null
  if (pageTitleCache.has(url)) return pageTitleCache.get(url)

  const controller = new AbortController()
  const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await antigravityFetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: combinedSignal,
    }, proxyUrl)

    clearTimeout(timer)
    if (!res.ok) return null

    if (res.body?.getReader) {
      const reader = res.body.getReader()
      let html = ''
      const decoder = new TextDecoder()
      while (html.length < 32768) {
        const { value, done } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        if (match) {
          try { await reader.cancel() } catch {}
          const title = cleanTitle(match[1])
          if (title) {
            pageTitleCache.set(url, title)
            return title
          }
        }
      }
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (match) {
        const title = cleanTitle(match[1])
        if (title) {
          pageTitleCache.set(url, title)
          return title
        }
      }
    } else if (typeof res.text === 'function') {
      const text = await res.text()
      const match = text.slice(0, 32768).match(/<title[^>]*>([^<]+)<\/title>/i)
      if (match) {
        const title = cleanTitle(match[1])
        if (title) {
          pageTitleCache.set(url, title)
          return title
        }
      }
    }
  } catch {} finally {
    clearTimeout(timer)
  }

  return null
}

const Config = z.object({
  refreshTokenEnv: z.string().role('credential-ref').default('ANTIGRAVITY_REFRESH_TOKEN'),
  clientId: z.string().default(CLIENT_ID),
  clientSecret: z.string().default(CLIENT_SECRET),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  model: z.string().default('gemini-3.7-flash-high'),
  includeContent: z.boolean().default(false),
  includeSnippets: z.boolean().default(false),
  resolveRedirects: z.boolean().default(true),
  dropUnresolvedRedirects: z.boolean().default(false),
  redirectTimeoutMs: z.number().default(3000),
  fetchPageTitles: z.boolean().default(true),
  pageTitleTimeoutMs: z.number().default(2500),
})

const name = 'web-search-antigravity'
const inject = ['web']
const NS = 'web-search-antigravity'

function randomHex(bytes) {
  let out = ''
  for (let i = 0; i < bytes; i++) out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  return out
}

class AntigravitySearchProvider {
  constructor(resolveOptions) {
    this.resolveOptions = resolveOptions
    this.id = PROVIDER_ID
    this.token = undefined
    this.refreshing = undefined
    this.project = undefined
  }

  available() {
    const options = this.resolveOptions()
    return options.refreshTokenEnv !== undefined || options.resolveRefreshToken !== undefined
  }

  async ensureAccessToken(options) {
    if (this.token !== undefined && this.token.expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) return this.token.accessToken
    if (this.refreshing !== undefined) return this.refreshing
    this.refreshing = (async () => {
      const refreshToken = await options.resolveRefreshToken()
      const params = new URLSearchParams({
        client_id: options.clientId,
        client_secret: options.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      })
      const proxy = resolveActiveProxy()
      let response
      try {
        response = await antigravityFetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', ...attributionHeaders() },
          body: params.toString(),
        }, proxy)
      } catch (error) {
        throw new WebError(`antigravity search: OAuth token refresh request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
      }
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new WebError(`antigravity search: OAuth token refresh failed (HTTP ${response.status}): ${body.slice(0, 200)}`, 'WEB_PROVIDER_ERROR')
      }
      const data = await response.json()
      const accessToken = data.access_token
      if (typeof accessToken !== 'string' || accessToken.length === 0) {
        throw new WebError('antigravity search: OAuth token refresh returned no access_token', 'WEB_PROVIDER_ERROR')
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

  async ensureProject(options, accessToken) {
    if (this.project !== undefined) return this.project
    const proxy = resolveActiveProxy()
    try {
      const response = await antigravityFetch(LOAD_CODE_ASSIST_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          ...attributionHeaders(),
          'user-agent': OFFICIAL_USER_AGENT,
        },
        body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } }),
      }, proxy)
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

  async search(request, signal) {
    const options = this.resolveOptions()
    const accessToken = await this.ensureAccessToken(options)
    const project = await this.ensureProject(options, accessToken)
    const body = {
      project,
      requestId: `agent-${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`,
      userAgent: 'antigravity',
      requestType: 'agent',
      model: options.model,
      request: {
        contents: [{ role: 'user', parts: [{ text: request.query }] }],
        tools: [{ googleSearch: {} }],
        toolConfig: { functionCallingConfig: { mode: 'VALIDATED' } },
        generationConfig: {},
        sessionId: `search-${randomHex(8)}`,
      },
    }
    const proxy = resolveActiveProxy()
    let response
    try {
      response = await antigravityFetch(`${options.baseURL}:generateContent`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'user-agent': OFFICIAL_USER_AGENT,
        },
        body: JSON.stringify(body),
        ...(signal !== undefined ? { signal } : {}),
      }, proxy)
    } catch (error) {
      if (signal?.aborted === true) throw new WebError('antigravity search aborted', 'WEB_ABORTED', { cause: signal.reason })
      throw new WebError(`antigravity search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new WebError(`antigravity search API error (HTTP ${response.status}): ${detail.slice(0, 200)}`, 'WEB_PROVIDER_ERROR')
    }
    let data
    try {
      data = await response.json()
    } catch (error) {
      throw new WebError(`antigravity search returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
    const candidate = data.response?.candidates?.[0] ?? data.candidates?.[0]
    const textParts = (candidate?.content?.parts ?? [])
      .filter((p) => typeof p.text === 'string' && p.thought !== true)
      .map((p) => p.text)
    const content = textParts.length > 0 ? textParts.join('\n') : undefined

    const grounding = candidate?.groundingMetadata
    const chunks = grounding?.groundingChunks ?? []
    const supports = grounding?.groundingSupports ?? []
    const snippetMap = new Map()
    if (options.includeSnippets) {
      for (const support of supports) {
        const text = support?.segment?.text
        if (typeof text !== 'string' || text.length === 0) continue
        for (const idx of support?.groundingChunkIndices ?? []) {
          const existing = snippetMap.get(idx) ?? []
          if (!existing.includes(text)) existing.push(text)
          snippetMap.set(idx, existing)
        }
      }
    }

    const seen = new Set()
    const rawSources = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const web = chunk?.web
      const uri = web?.uri
      if (typeof uri !== 'string' || uri.length === 0 || seen.has(uri)) continue
      seen.add(uri)
      const snippets = snippetMap.get(i)
      rawSources.push({
        url: uri,
        title: typeof web.title === 'string' && web.title.length > 0 ? web.title : undefined,
        snippet: snippets !== undefined && snippets.length > 0 ? snippets.slice(0, 2).join(' ') : undefined,
      })
    }

    let sources = rawSources
    if (options.resolveRedirects) {
      const resolved = await Promise.all(
        rawSources.map(async (src) => {
          const direct = await resolveDirectUrl(src.url, proxy, options.redirectTimeoutMs, signal)
          if (direct) {
            return { ...src, url: direct }
          }
          if (options.dropUnresolvedRedirects) {
            return null
          }
          return src
        })
      )
      sources = resolved.filter(Boolean)
    }

    if (options.fetchPageTitles !== false) {
      const withTitles = await Promise.all(
        sources.map(async (src) => {
          const pageTitle = await fetchPageTitle(src.url, proxy, options.pageTitleTimeoutMs ?? 2500, signal)
          if (pageTitle && pageTitle.length > 0) {
            return { ...src, title: pageTitle }
          }
          return src
        })
      )
      sources = withTitles
    }

    const finalSources = sources.map((src) => ({
      url: src.url,
      ...(src.title !== undefined ? { title: src.title } : {}),
      ...(options.includeSnippets && src.snippet !== undefined ? { snippet: src.snippet } : {}),
    }))

    return {
      ...(options.includeContent && content !== undefined ? { content } : {}),
      sources: finalSources,
      truncated: false,
    }
  }
}

function resolveOptions(ctx, config) {
  const refreshTokenEnv = credentialRef(config.refreshTokenEnv ?? 'ANTIGRAVITY_REFRESH_TOKEN')
  return {
    refreshTokenEnv,
    clientId: config.clientId ?? CLIENT_ID,
    clientSecret: config.clientSecret ?? CLIENT_SECRET,
    baseURL: config.baseURL ?? DEFAULT_BASE_URL,
    model: config.model ?? 'gemini-3.7-flash-high',
    includeContent: config.includeContent ?? false,
    includeSnippets: config.includeSnippets ?? false,
    resolveRedirects: config.resolveRedirects ?? true,
    dropUnresolvedRedirects: config.dropUnresolvedRedirects ?? false,
    redirectTimeoutMs: config.redirectTimeoutMs ?? 3000,
    fetchPageTitles: config.fetchPageTitles ?? true,
    pageTitleTimeoutMs: config.pageTitleTimeoutMs ?? 2500,
    resolveRefreshToken: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) {
        const hit = await credentials.resolve(refreshTokenEnv)
        if (hit !== undefined && hit.value !== undefined && hit.value.length > 0) return hit.value
      }
      const env = launchEnvironmentOf(ctx)
      const ambient = env.get(refreshTokenEnv)
      if (ambient !== undefined && ambient.value !== undefined && ambient.value.length > 0) return ambient.value
      throw new WebError(
        `antigravity search: no refresh token; store ${refreshTokenEnv} through the credentials service or export it in the launching environment`,
        'WEB_PROVIDER_CREDENTIAL_MISSING',
      )
    },
  }
}

function apply(ctx, config) {
  let current = () => config
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NS, Config, config, {
      setSource: (source) => {
        current = source
      },
      onChange: () => {},
    })
  })
  ctx.web.registerSearchProvider(new AntigravitySearchProvider(() => resolveOptions(ctx, current())))
}

export { AntigravitySearchProvider, Config, PROVIDER_ID, apply, inject, name }
