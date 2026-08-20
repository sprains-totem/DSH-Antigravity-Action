// Web-search provider selector (host): one settings namespace that switches the
// ctx.web searchProvider between deepseek-official and antigravity.
//
// Flow: the user edits `web-search.provider` in settings (Models page or a
// settings UI). The settings service hot-publishes the change; this plugin's
// onChange rewrites the `web` row's searchProvider in the profile
// cordis.patch.yml; the patch HMR watcher reloads the `web` service with the
// new provider id — so web_search switches backends live, no restart.
//
// Host-plane plugin (registered in cordis.patch.yml) so it has Node fs access;
// dynamic Cordis plugins cannot touch the filesystem.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

const name = 'web-search-selector'
const inject = ['web']
const NS = settingsNamespace('web-search-selector')
const PROVIDERS = ['deepseek-official', 'antigravity']

function resolvePatchPath(ctx) {
  if (ctx.baseUrl) {
    try {
      return fileURLToPath(new URL('cordis.patch.yml', ctx.baseUrl))
    } catch {}
  }
  return path.resolve(import.meta.dirname, '../../../cordis.patch.yml')
}

function currentProviderFromPatch(patchPath) {
  try {
    const text = fs.readFileSync(patchPath, 'utf8')
    const m = text.match(/searchProvider:\s*(\S+)/)
    return m ? m[1] : undefined
  } catch {
    return undefined
  }
}

function applyProviderToPatch(patchPath, provider) {
  const text = fs.readFileSync(patchPath, 'utf8')
  const next = text.replace(/searchProvider:\s*\S+/, `searchProvider: ${provider}`)
  if (next === text) {
    throw new Error(`web-search-selector: no "searchProvider:" line found in ${patchPath}`)
  }
  fs.writeFileSync(patchPath, next)
}

const Config = z.object({
  provider: z.union(PROVIDERS).default('deepseek-official'),
})

function apply(ctx, config) {
  const patchPath = resolvePatchPath(ctx)
  let readSection = () => ({ provider: 'deepseek-official' })
  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      readSection = source
    },
    onChange: () => {
      const section = readSection() ?? {}
      const provider = section.provider
      if (provider !== undefined && PROVIDERS.includes(provider)) {
        const current = currentProviderFromPatch(patchPath)
        if (current !== provider) {
          try {
            applyProviderToPatch(patchPath, provider)
            ctx.logger.info(`web-search-selector: searchProvider -> ${provider} (patch reloaded via HMR)`)
          } catch (error) {
            ctx.logger.error('web-search-selector: failed to write patch', error)
          }
        }
      }
    },
  })
}

export { Config, PROVIDERS, apply, inject, name }
