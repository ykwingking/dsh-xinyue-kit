/**
 * 势力图生成器（xinyue-kit）：把用户给的势力徽记 / 体力晶石加工成 FreeKill 需要的五种文件。
 *
 * 为什么需要它：自定义势力的图不是一张就够，官方尺寸实测为
 *   <代号>.png            75x75   势力徽记（LunarLtk/Components/GeneralCardItem.qml:55 画在武将卡左上角，宽 34px）
 *   <代号>-magatama.png   22x27   体力晶石
 *   <代号>-magatama-l/-r  13x20   双将模式左右两半（QML 把 -r 左移 4.4px 拼合）
 *   <代号>-back.png       175x233 卡背/底图（PhotoBase 的 back，缩放 0.75；局内只有左侧约 30px 窄条露出来）
 * 手工做这些需要图像处理，这里交给 Pillow（探测方式与 match-assets 一致）。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findImageConverter } from './match-assets.js'
import { safeFolderPath } from './write.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'knowledge', 'tools', 'kingdom_assets.py')
const CODE_RE = /^[A-Za-z][\w-]*$/

/**
 * 生成势力图。
 * @param {string} gameDir 游戏根目录
 * @param {object} input
 * @param {string} input.folder 拓展目录名
 * @param {Array<{code:string, char?:string, accent?:number[], icon?:string, crystal?:string}>} input.kingdoms
 * @param {string} [input.font] 楷体字体路径（缺省 Windows 的 simkai.ttf）
 */
export function generateKingdomAssets(gameDir, { folder, kingdoms, font } = {}) {
  if (!Array.isArray(kingdoms) || kingdoms.length === 0) {
    return { ok: false, error: 'kingdoms 不能为空（每项形如 {code:"xinglinggan", char:"星", accent:[116,158,191], icon:"…", crystal:"…"}）' }
  }
  let root
  try { ({ full: root } = safeFolderPath(gameDir, folder)) } catch (e) {
    return { ok: false, error: e.message }
  }
  const dst = join(root, 'image', 'kingdom')

  const cleaned = []
  for (const k of kingdoms) {
    const code = String(k.code || '').trim()
    if (!CODE_RE.test(code)) {
      return { ok: false, error: `势力代号「${code}」不合法：只允许字母开头的字母/数字/下划线/连字符（会变成文件名）` }
    }
    const accent = Array.isArray(k.accent) && k.accent.length === 3
      ? k.accent.map((v) => Math.max(0, Math.min(255, Number(v) || 0)))
      : null
    for (const key of ['icon', 'crystal']) {
      if (k[key] && !existsSync(String(k[key]))) {
        return { ok: false, error: `${code} 的 ${key} 文件不存在：${k[key]}` }
      }
    }
    cleaned.push({ code, char: k.char ? String(k.char).slice(0, 1) : '', accent, icon: k.icon, crystal: k.crystal })
  }

  const conv = findImageConverter()
  if (!conv || conv.kind !== 'pillow') {
    return { ok: false, error: '没找到带 Pillow 的 Python（本机会用 dsh 自带运行时），无法生成势力图' }
  }
  if (!existsSync(SCRIPT)) return { ok: false, error: `内置脚本缺失：${SCRIPT}` }

  const tmp = mkdtempSync(join(tmpdir(), 'fx-kingdom-'))
  const specPath = join(tmp, 'spec.json')
  const resultPath = join(tmp, 'result.json')
  writeFileSync(specPath, JSON.stringify({ dst, font: font || '', result: resultPath, kingdoms: cleaned }), 'utf8')
  try {
    mkdirSync(dst, { recursive: true })
    /* 注意：沙箱下用管道接子进程输出会 EPERM（AGENTS.md 记载的边界），
     * 所以 stdio 一律 ignore，结果由 python 写到 result.json，再从文件读。 */
    execFileSync(conv.cmd, [SCRIPT, specPath], { timeout: 120000, stdio: 'ignore' })
    if (!existsSync(resultPath)) return { ok: false, error: '生成脚本没有产出结果文件（可能缺少 Pillow 或素材路径不对）' }
    const parsed = JSON.parse(readFileSync(resultPath, 'utf8'))
    if (!parsed.ok) return { ok: false, error: parsed.error || '生成失败' }
    return { ok: true, dir: dst, files: parsed.files, warnings: parsed.warnings || [] }
  } catch (e) {
    let detail = ''
    try {
      if (existsSync(resultPath)) detail = JSON.parse(readFileSync(resultPath, 'utf8')).error || ''
    } catch { /* 结果文件读不出来就用下面的信息 */ }
    return { ok: false, error: `生成失败：${detail || e.message}` }
  }
}
