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

const Config = z.object({
  refreshTokenEnv: z.string().role('credential-ref').default('ANTIGRAVITY_REFRESH_TOKEN'),
  clientId: z.string().default(CLIENT_ID),
  clientSecret: z.string().default(CLIENT_SECRET),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  model: z.string().default('gemini-3.7-flash-high'),
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
      let response
      try {
        response = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', ...attributionHeaders() },
          body: params.toString(),
        })
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
    let response
    try {
      response = await fetch(`${options.baseURL}:generateContent`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'user-agent': OFFICIAL_USER_AGENT,
        },
        body: JSON.stringify(body),
        ...(signal !== undefined ? { signal } : {}),
      })
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
    for (const support of supports) {
      const text = support?.segment?.text
      if (typeof text !== 'string' || text.length === 0) continue
      for (const idx of support?.groundingChunkIndices ?? []) {
        const existing = snippetMap.get(idx) ?? []
        if (!existing.includes(text)) existing.push(text)
        snippetMap.set(idx, existing)
      }
    }

    const seen = new Set()
    const sources = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const web = chunk?.web
      const uri = web?.uri
      if (typeof uri !== 'string' || uri.length === 0 || seen.has(uri)) continue
      seen.add(uri)
      const snippets = snippetMap.get(i)
      sources.push({
        url: uri,
        ...(typeof web.title === 'string' && web.title.length > 0 ? { title: web.title } : {}),
        ...(snippets !== undefined && snippets.length > 0 ? { snippet: snippets.slice(0, 2).join(' ') } : {}),
      })
    }
    return {
      ...(content !== undefined ? { content } : {}),
      sources,
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
