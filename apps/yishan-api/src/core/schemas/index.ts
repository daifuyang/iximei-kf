import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { DEFAULT_DISABLED_PLUGIN_MODULES, listPluginModules } from '../plugin-runtime/loader.js'
import registerAttachment from './attachment.js'
import registerArticleSchemas from './article.js'
import registerAuth from './auth.js'
import registerCommon from './common.js'
import registerDepartment from './department.js'
import registerDict from './dict.js'
import registerLoginLog from './login-log.js'
import registerMenu from './menu.js'
import registerPageSchemas from './page.js'
import registerPost from './post.js'
import registerRole from './role.js'
import registerSystem from './system.js'
import registerTemplateSchemas from './template.js'
import registerUser from './user.js'

type SchemaRegister = (fastify: FastifyInstance) => void | Promise<void>

const SCHEMA_FILE_PATTERN = /\.(?:js|ts|mjs|cjs|mts|cts)$/

async function registerPluginSchemas(fastify: FastifyInstance) {
  const modulesDir = join(__dirname, '../../plugins/modules')

  for (const { moduleName, moduleRoot } of listPluginModules(modulesDir, DEFAULT_DISABLED_PLUGIN_MODULES)) {
    const schemasDir = join(moduleRoot, 'schemas')
    if (!existsSync(schemasDir)) {
      continue
    }

    const schemaFiles = readdirSync(schemasDir)
      .filter((fileName) => SCHEMA_FILE_PATTERN.test(fileName))
      .map((fileName) => join(schemasDir, fileName))
      .filter((filePath) => statSync(filePath).isFile())
      .sort()

    for (const schemaFile of schemaFiles) {
      try {
        const mod = require(schemaFile) as { default?: unknown }
        const register = mod.default
        if (typeof register === 'function') {
          await (register as SchemaRegister)(fastify)
        }
      } catch (error) {
        fastify.log.warn(
          {
            module: moduleName,
            schemaFile,
            error: error instanceof Error ? error.message : String(error),
          },
          'plugin schema registration skipped'
        )
      }
    }
  }
}

// Schema插件，定义共享的Schema引用
export default fp(async (fastify, opts) => {
  registerCommon(fastify);
  registerUser(fastify);
  registerAuth(fastify);
  registerSystem(fastify);
  registerRole(fastify);
  registerDepartment(fastify);
  registerPost(fastify);
  registerMenu(fastify);
  registerDict(fastify);
  registerArticleSchemas(fastify);
  registerPageSchemas(fastify);
  registerTemplateSchemas(fastify);
  registerAttachment(fastify);
  registerLoginLog(fastify);
  await registerPluginSchemas(fastify);
});
