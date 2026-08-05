#!/usr/bin/env node
/**
 * gen-jwt-secret.mjs — 生成密码学安全的 JWT_SECRET。
 *
 * 使用 node:crypto.randomBytes 生成 256 位熵,以 base64url 编码输出(43 字符,URL 安全)。
 *
 * 用法:
 *   node scripts/gen-jwt-secret.mjs            # 打印到 stdout
 *   node scripts/gen-jwt-secret.mjs --write     # 写入 .env 的 JWT_SECRET 行
 *   node scripts/gen-jwt-secret.mjs --write --force   # 跳过覆盖确认
 *
 * --write 行为:
 *   - .env 存在:原地替换第一个 JWT_SECRET= 行(保留其余内容)
 *   - .env 不存在:创建文件并写入 JWT_SECRET=
 *   - 若当前值已是强密钥(非测试占位符且长度>=32),会要求确认,可用 --force 跳过
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(apiRoot, '.env')

const args = new Set(process.argv.slice(2))
const wantWrite = args.has('--write')
const force = args.has('--force')

// 已知的测试/占位符密钥,覆盖时不需确认
const TEST_PLACEHOLDERS = new Set([
  'ci-test-secret-not-for-prod-32+chars',
  'change-me',
  'your-secret-key',
  'secret',
  'jwt_secret_here',
])

function generateSecret() {
  // 256-bit entropy => base64url (无 padding) => 43 字符
  return randomBytes(32).toString('base64url')
}

function isWeakSecret(value) {
  if (TEST_PLACEHOLDERS.has(value)) return true
  if (value.length < 32) return true
  return false
}

async function confirm(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout })
  try {
    const answer = (await rl.question(question)).trim().toLowerCase()
    return answer === 'y' || answer === 'yes'
  } finally {
    rl.close()
  }
}

function updateEnv(content, secret) {
  const lines = content.split('\n')
  let replaced = false
  const next = lines.map((line) => {
    if (!replaced && /^JWT_SECRET\s*=/.test(line)) {
      replaced = true
      return `JWT_SECRET=${secret}`
    }
    return line
  })
  if (!replaced) {
    // 没有 JWT_SECRET 行,追加
    if (next.length && next[next.length - 1] !== '') next.push('')
    next.push(`JWT_SECRET=${secret}`)
  }
  return next.join('\n')
}

async function main() {
  const secret = generateSecret()

  if (!wantWrite) {
    console.log(secret)
    console.log('\n# 写入 .env: node scripts/gen-jwt-secret.mjs --write')
    return
  }

  let content = ''
  if (existsSync(envPath)) {
    content = readFileSync(envPath, 'utf8')
    const match = /^JWT_SECRET\s*=\s*(.+)$/m.exec(content)
    if (match && !isWeakSecret(match[1].trim()) && !force) {
      const ok = await confirm('当前 JWT_SECRET 已是强密钥,是否覆盖? [y/N] ')
      if (!ok) {
        console.log('已取消。')
        return
      }
    }
  }

  const newContent = updateEnv(content, secret)
  writeFileSync(envPath, newContent, 'utf8')
  console.log(`已写入 ${envPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
