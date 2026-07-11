import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { validateManifest } from './manifest'
import { LoadedPluginManifest, PluginManifest } from './types'

const MANIFEST_FILE_CANDIDATES = ['manifest.ts', 'manifest.js', 'manifest.mts', 'manifest.cts']
export const DEFAULT_DISABLED_PLUGIN_MODULES = ['hello', 'portal', 'shop', 'kf'] as const

export interface PluginModuleInfo {
  moduleName: string
  moduleRoot: string
}

export function listPluginModules(modulesDir: string, disabledModules: Iterable<string> = []): PluginModuleInfo[] {
  if (!existsSync(modulesDir)) {
    return []
  }

  const disabled = new Set(disabledModules)
  return readdirSync(modulesDir)
    .filter((name) => statSync(join(modulesDir, name)).isDirectory())
    .filter((moduleName) => !disabled.has(moduleName))
    .map((moduleName) => ({
      moduleName,
      moduleRoot: join(modulesDir, moduleName),
    }))
}

function resolveManifestPath(moduleRoot: string): string | undefined {
  for (const fileName of MANIFEST_FILE_CANDIDATES) {
    const candidate = join(moduleRoot, fileName)
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

export function loadPluginManifests(modulesDir: string): LoadedPluginManifest[] {
  const loaded: LoadedPluginManifest[] = []

  for (const { moduleName, moduleRoot } of listPluginModules(modulesDir)) {
    const manifestPath = resolveManifestPath(moduleRoot)
    if (!manifestPath) {
      continue
    }

    const mod = require(manifestPath) as { default?: unknown }
    const manifest = (mod.default ?? mod) as PluginManifest
    const validation = validateManifest(manifest)
    if (!validation.valid) {
      continue
    }

    loaded.push({
      moduleName,
      manifestPath,
      manifest
    })
  }

  return loaded
}
