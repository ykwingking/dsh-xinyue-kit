/**
 * xinyue-kit 自动探测:在本机常见位置扫描「新月杀 / FreeKill」游戏本体目录。
 *
 * 与无名杀的区别(重要):
 *   无名杀根目录特征 = extension/ 子目录 + noname.js(或 noname/、game/)
 *   新月杀根目录特征 = packages/ 子目录 + lua/ 子目录(FreeKill 引擎脚本)
 *                     其中 lua/core/package.lua 是最硬的标志
 *
 * 策略沿用原版:从盘符根/用户目录出发,前两层无条件深入(游戏可能套在任意名字的
 * 文件夹里),更深层只沿"名字像新月杀(freekill|新月)"的目录、以及它们下面的壳目录
 * (resources/app/www/src)往下走;名字匹配的链路放宽到 8 层,非匹配路径剪到 4 层
 * 防全盘乱扫。这样新机器上用户不用手找路径,工坊向导里点一下就行。
 */
import { readdir } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const NAME_RE = /freekill|新月/i
const SHELL_DIRS = new Set(['resources', 'app', 'www', 'game', 'src', 'release'])
const SKIP_DIRS = new Set([
  'node_modules', 'Windows', 'Program Files', 'Program Files (x86)',
  '$Recycle.Bin', 'System Volume Information', 'AppData', 'assets',
  'audio', 'font', 'image', 'qml', 'client', 'server', 'lua', 'packages',
])
const MAX_CANDIDATES = 8

/**
 * 目录是否像一个新月杀(FreeKill)游戏本体根。
 * 判定:同时有 lua/ 与 packages/,且满足下面任一硬标志。
 */
function looksLikeGameRoot(dir) {
  if (!existsSync(join(dir, 'lua'))) return false
  if (!existsSync(join(dir, 'packages'))) return false
  return (
    existsSync(join(dir, 'lua', 'core', 'package.lua')) ||
    existsSync(join(dir, 'FreeKill.exe')) ||
    existsSync(join(dir, 'fk_ver')) ||
    existsSync(join(dir, 'freekill.client.config.json'))
  )
}

async function scan(dir, depth, matched, out) {
  // 沿"名字像新月杀"的链路放宽到 8 层,非匹配路径 4 层
  // ——剪枝靠名字继承,不会全盘乱扫。
  if (depth > (matched ? 8 : 4) || out.length >= MAX_CANDIDATES) return
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const name = entry.name
    // SKIP 清单里的 lua/packages/client/server 本意是跳过游戏根下的引擎子目录,
    // 但会误伤安装路径中间出现同名文件夹的场景——壳目录与名字明确匹配的目录不跳过,
    // 交给 SHELL_DIRS 递归条件与 looksLikeGameRoot 正常判定。
    if (SKIP_DIRS.has(name) && !SHELL_DIRS.has(name.toLowerCase()) && !NAME_RE.test(name)) continue
    const full = join(dir, name)
    const nameMatched = matched || NAME_RE.test(name)
    if (looksLikeGameRoot(full)) {
      out.push(full)
      if (out.length >= MAX_CANDIDATES) return
      continue // 游戏根本身不再往下扫
    }
    // 前两层无条件深入(游戏可能套在任意名字的文件夹里);
    // 更深的层只沿"名字匹配/祖先匹配/壳目录"走,避免全盘乱扫。
    if (depth < 2 || nameMatched || SHELL_DIRS.has(name.toLowerCase())) {
      await scan(full, depth + 1, nameMatched, out)
    }
  }
}

/**
 * 列出游戏目录 packages/ 下已安装的扩展包名(子目录,排序,上限 100)。
 * 设置页用它向用户证明"目录填对了:你的扩展包都在这里"。
 * @param {string} gameDir - 新月杀(FreeKill)游戏本体目录。
 * @returns {string[]}
 */
export function listPackages(gameDir) {
  try {
    return readdirSync(join(gameDir, 'packages'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .slice(0, 100)
  } catch {
    return []
  }
}

/** @deprecated 旧名(无名杀语义),保留以免破坏既有调用点。 */
export const listExtensionFolders = listPackages

/**
 * 返回本机探测到的候选游戏根目录列表。
 * @param {string[]} [rootsOverride] - 测试注入:替换默认的盘符/用户目录扫描起点。
 * @returns {Promise<string[]>}
 */
export async function detectCandidates(rootsOverride) {
  const roots = [...(rootsOverride || [])]
  if (!rootsOverride) {
    if (process.platform === 'win32') {
      for (const letter of ['C', 'D', 'E', 'F', 'G']) roots.push(`${letter}:\\`)
    } else {
      roots.push('/')
    }
    roots.push(join(process.env.USERPROFILE || process.env.HOME || '', 'Desktop'))
    roots.push(join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads'))
  }
  const out = []
  for (const root of roots) {
    if (out.length >= MAX_CANDIDATES) break
    await scan(root, 1, false, out)
  }
  return [...new Set(out)]
}
