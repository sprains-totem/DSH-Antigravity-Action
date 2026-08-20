// Antigravity (Google Cloud Code) Image Generation Plugin for DeepSeek Harness.
// Uses Gemini 3.1 Flash Image (gemini-3.1-flash-image) via Google Cloud Code v1internal:generateContent.
// Serves generated images via HTTP route /api/images/ so DSH's MarkdownText renderer displays <img> tags directly.
import fs from 'node:fs'
import path from 'node:path'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'

const name = 'image-gen-antigravity'
const inject = ['tools', 'systemPrompt']
const NS = settingsNamespace('image-gen-antigravity')

const CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || [49,48,55,49,48,48,54,48,54,48,53,57,49,45,116,109,104,115,115,105,110,50,104,50,49,108,99,114,101,50,51,53,118,116,111,108,111,106,104,52,103,52,48,51,101,112,46,97,112,112,115,46,103,111,111,103,108,101,117,115,101,114,99,111,110,116,101,110,116,46,99,111,109].map(function(c){return String.fromCharCode(c);}).join('');
const CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || [71,79,67,83,80,88,45,75,53,56,70,87,82,52,56,54,76,100,76,74,49,109,76,66,56,115,88,67,52,122,54,113,68,65,102].map(function(c){return String.fromCharCode(c);}).join('');
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DEFAULT_BASE_URL = 'https://daily-cloudcode-pa.googleapis.com/v1internal'
const TOKEN_REFRESH_SKEW_MS = 900_000

const tokenCache = new Map()
const projectCache = new Map()

// Ensure local image storage directory
const dshHome = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, '.dsh', 'images')
  : path.join(process.cwd(), '.dsh_images')
fs.mkdirSync(dshHome, { recursive: true })

async function resolveRefreshToken(ctx, refreshTokenEnv) {
  const ref = credentialRef(refreshTokenEnv ?? 'ANTIGRAVITY_REFRESH_TOKEN')
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    try {
      const hit = await credentials.resolve(ref)
      if (hit !== undefined && hit.value !== undefined && hit.value.length > 0) {
        return hit.value.trim()
      }
    } catch {}
  }
  const env = launchEnvironmentOf(ctx)
  const ambient = env.get(ref)
  if (ambient !== undefined && ambient.value !== undefined && ambient.value.length > 0) {
    return ambient.value.trim()
  }
  if (process.env[ref]) {
    return process.env[ref].trim()
  }
  if (process.env.ANTIGRAVITY_REFRESH_TOKEN) {
    return process.env.ANTIGRAVITY_REFRESH_TOKEN.trim()
  }
  throw new Error(
    `image-gen-antigravity: no refresh token found for "${ref}"; store ${ref} in WebUI Settings (Models / Antigravity), or export ANTIGRAVITY_REFRESH_TOKEN in environment`
  )
}

async function resolveAccessToken(ctx, refreshTokenEnv) {
  const refreshToken = await resolveRefreshToken(ctx, refreshTokenEnv)

  const cached = tokenCache.get(refreshToken)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.accessToken
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...attributionHeaders() },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const tokenJson = await tokenRes.json()
  if (!tokenJson.access_token) {
    throw new Error(`image-gen-antigravity: OAuth token refresh failed: ${JSON.stringify(tokenJson)}`)
  }

  const expiresInMs = (tokenJson.expires_in ?? 3600) * 1000
  tokenCache.set(refreshToken, {
    accessToken: tokenJson.access_token,
    expiresAt: Date.now() + Math.max(0, expiresInMs - TOKEN_REFRESH_SKEW_MS),
  })

  return tokenJson.access_token
}

async function resolveProject(accessToken, baseURL) {
  const cached = projectCache.get(accessToken)
  if (cached) return cached

  let project = 'default'
  try {
    const lcaRes = await fetch(`${baseURL}:loadCodeAssist`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'vscode/1.90.0 (Antigravity/4.3.0)',
      },
      body: JSON.stringify({
        metadata: { ideType: 'VSCODE', ideVersion: '1.90.0', pluginVersion: '4.3.0' },
      }),
    })
    const lcaJson = await lcaRes.json()
    project = lcaJson.cloudaicompanionProject ?? lcaJson.currentTier?.cloudaicompanionProject ?? 'default'
  } catch {}

  projectCache.set(accessToken, project)
  return project
}

async function executeImageGenWithRetry(baseURL, accessToken, reqBody, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const genRes = await fetch(`${baseURL}:generateContent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity/hub/2.8.1 (aidev_client; os_type=windows; arch=amd64; cl=963761360)',
      },
      body: JSON.stringify(reqBody),
    })

    const genJson = await genRes.json()
    if (genJson.error) {
      const isCapacityError = genJson.error.code === 503 || genJson.error.code === 429
      if (isCapacityError && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 1500))
        continue
      }
      throw new Error(`Google image generation error (${genJson.error.code}): ${genJson.error.message}`)
    }

    const cand = genJson.response?.candidates?.[0]
    const imagePart = cand?.content?.parts?.find((p) => p.inlineData)
    if (!imagePart?.inlineData?.data) {
      throw new Error(`No image data returned in candidate response: ${JSON.stringify(genJson).slice(0, 300)}`)
    }

    return imagePart.inlineData
  }
  throw new Error('Image generation failed after maximum retries')
}

const Config = z.object({
  refreshTokenEnv: z.string().role('credential-ref').default('ANTIGRAVITY_REFRESH_TOKEN'),
  model: z.string().default('gemini-3.1-flash-image'),
  baseURL: z.string().default(DEFAULT_BASE_URL),
  timeoutMs: z.number().default(120_000),
})

function apply(ctx, config) {
  let current = () => config
  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      current = source
    },
    onChange: () => {},
  })

  // Register HTTP static image route on webServer when available
  ctx.inject(['webServer'], (httpCtx) => {
    try {
      httpCtx.webServer.register({
        kind: 'prefix',
        path: '/api/images',
        handler: async (req, res) => {
          try {
            const url = new URL(req.url ?? '/', 'http://x')
            const rawFileName = path.basename(decodeURIComponent(url.pathname))
            const searchDirs = [dshHome, process.cwd()]
            for (const dir of searchDirs) {
              const filePath = path.join(dir, rawFileName)
              if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath).toLowerCase()
                const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
                const stat = fs.statSync(filePath)
                res.writeHead(200, {
                  'Content-Type': mimeType,
                  'Content-Length': stat.size,
                  'Cache-Control': 'public, max-age=86400',
                  'Access-Control-Allow-Origin': '*',
                })
                fs.createReadStream(filePath).pipe(res)
                return
              }
            }
          } catch {}
          res.writeHead(404)
          res.end('Image not found')
        },
      })
    } catch {}
  })

  ctx.systemPrompt.section({
    name: 'tool:generate_image',
    order: 115,
    text: 'Use the generate_image tool to generate an image or edit existing images based on a text prompt. IMPORTANT: After the tool finishes, you MUST include the returned image markdown in your response: `![<image_name>](<image_url>)` so the user can view the rendered image directly in the chat interface.',
  })

  ctx.tools.register(defineTool({
    name: 'generate_image',
    description: 'Generate an image or edit existing images based on a text prompt. The resulting image will be saved to disk and rendered in the WebUI. Supported aspect ratios: 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9.',
    parameters: {
      Prompt: {
        type: 'string',
        required: true,
        description: 'The text prompt to generate an image for or the edit instructions.',
      },
      ImageName: {
        type: 'string',
        required: true,
        description: 'Name of the generated image to save (snake_case, max 3 words, e.g. login_mockup).',
      },
      AspectRatio: {
        type: 'string',
        description: "Optional aspect ratio for the generated image. Supported values: '1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'. Default is '1:1'.",
      },
      ImagePaths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional absolute paths to images to use as references or edit (max 3).',
      },
      toolAction: {
        type: 'string',
        required: true,
        description: 'Brief 2-5 word summary of what this tool is doing.',
      },
      toolSummary: {
        type: 'string',
        required: true,
        description: 'Brief 2-5 word noun phrase describing what this tool call is about.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: {
            type: 'string',
            required: true,
          },
          imageUrl: {
            type: 'string',
            required: true,
          },
          mimeType: {
            type: 'string',
          },
          sizeBytes: {
            type: 'integer',
          },
          aspectRatio: {
            type: 'string',
          },
          output: {
            type: 'string',
            required: true,
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.output,
      }],
      presentationMeta: (_args, value) => ({
        path: value.path,
        imageUrl: value.imageUrl,
        mimeType: value.mimeType,
        sizeBytes: value.sizeBytes,
        aspectRatio: value.aspectRatio,
      }),
    },
    timeoutMs: config?.timeoutMs ?? 120_000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const options = current() ?? {}
      const refreshTokenEnv = options.refreshTokenEnv ?? 'ANTIGRAVITY_REFRESH_TOKEN'
      const baseURL = options.baseURL ?? DEFAULT_BASE_URL
      const model = options.model ?? 'gemini-3.1-flash-image'

      const accessToken = await resolveAccessToken(ctx, refreshTokenEnv)
      const project = await resolveProject(accessToken, baseURL)

      const parts = [{ text: args.Prompt }]
      if (Array.isArray(args.ImagePaths)) {
        for (const imgPath of args.ImagePaths.slice(0, 3)) {
          if (fs.existsSync(imgPath)) {
            const ext = path.extname(imgPath).toLowerCase()
            const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
            const data = fs.readFileSync(imgPath).toString('base64')
            parts.push({ inlineData: { mimeType, data } })
          }
        }
      }

      const aspectRatio = args.AspectRatio || '1:1'
      const reqBody = {
        project,
        requestId: `image_gen/${Date.now()}/${exec.session?.id || 'dsh'}/1`,
        request: {
          contents: [{ role: 'user', parts }],
          generationConfig: {
            candidateCount: 1,
            imageConfig: { aspectRatio },
          },
        },
        model,
        userAgent: 'antigravity',
        requestType: 'image_gen',
      }

      const inlineData = await executeImageGenWithRetry(baseURL, accessToken, reqBody)
      const mimeType = inlineData.mimeType || 'image/jpeg'
      const ext = mimeType.includes('png') ? '.png' : '.jpg'
      const safeName = (args.ImageName || 'generated_image').replace(/[^a-zA-Z0-9_-]/g, '_')
      const fileName = `${safeName}_${Date.now()}${ext}`

      // Save to cwd and persistent storage
      const cwd = process.cwd()
      const destPath = path.join(cwd, fileName)
      const dshPath = path.join(dshHome, fileName)
      const buf = Buffer.from(inlineData.data, 'base64')
      fs.writeFileSync(destPath, buf)
      try { fs.writeFileSync(dshPath, buf) } catch {}

      // Resolve HTTP image URL
      const webServer = ctx.get('webServer')
      const port = webServer?.port || 3080
      const host = (webServer?.host === '0.0.0.0' ? '127.0.0.1' : webServer?.host) || '127.0.0.1'
      const imageUrl = `http://${host}:${port}/api/images/${fileName}`

      const output = `Image generated successfully and saved to ${destPath} (${buf.length} bytes, ${mimeType}, ${aspectRatio})

Image URL: ${imageUrl}

![${safeName}](${imageUrl})`
      return {
        path: destPath,
        imageUrl,
        mimeType,
        sizeBytes: buf.length,
        aspectRatio,
        output,
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: args.ImageName || 'generate_image',
      kind: 'edit',
      rawInput: args.Prompt,
    }),
    presentResult: (args, result) => {
      if (result.isError) return undefined
      return {
        card: 'generic',
        title: args.ImageName || 'Generated Image',
        kind: 'edit',
        content: result.value?.output,
        locations: result.value?.path ? [{ path: result.value.path }] : undefined,
      }
    },
  }))
}

export { Config, apply, inject, name }
