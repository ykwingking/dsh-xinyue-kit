/**
 * xinyue-kit 配音复制:把用户提供的本地 mp3 复制进新月杀(FreeKill)扩展包的
 * audio/ 子目录,音频只归扩展包,绝不写进游戏本体音频目录。
 *
 * 与无名杀的目录约定不同(重要):
 *   无名杀:<包>/audio/skill/<技能ID><序号>.mp3、<包>/audio/die/<武将ID><序号>.mp3
 *   新月杀:<包>/audio/skill/<技能ID>.mp3、<包>/audio/death/<武将ID>.mp3
 *          —— 注意是 death 而不是 die,且官方包不做"一句一文件"的序号拆分。
 * 实测 FreeKill 官方包的 audio/ 子目录为:skill、death、card、win。
 *
 * 安全校验:源必须存在;目标只允许白名单子目录 + 纯文件名(.mp3);目录不得逃逸。
 */
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { safeFolderPath } from './write.js'

/** 允许的音频子目录(对应 FreeKill 的 audio/<kind>/)。skill=技能音,death=阵亡音。 */
const AUDIO_KINDS = ['skill', 'death']
/** 历史别名:无名杀用 die,新月杀用 death,两个都收,统一落到 death。 */
const KIND_ALIAS = { die: 'death' }

const TARGET_RE = /^(skill|death|die)[/\\][\w\u4e00-\u9fff-]+\.mp3$/i

/**
 * 复制一批配音到扩展包的 audio/<kind>/ 子目录。
 * @param {string} gameDir - 新月杀(FreeKill)游戏本体目录。
 * @param {object} input
 * @param {string} input.folder - 扩展包目录名(即 packages/ 下的一层)。
 * @param {Array<{source:string, target:string}>} input.audios - source=本地 mp3 绝对路径;target=存入 audio/ 的相对路径,必须是 `skill/<名>.mp3` 或 `death/<名>.mp3`(兼容旧写法 `die/<名>.mp3`)。
 * @returns {{ok:boolean, copied?:Array, errors?:Array}}
 */
export async function copyAudios(gameDir, { folder, audios }) {
  if (!Array.isArray(audios) || audios.length === 0) {
    return { ok: false, errors: [{ source: '', error: 'audios 不能为空' }] }
  }
  let root
  try { ({ full: root } = safeFolderPath(gameDir, folder)) } catch (error) {
    return { ok: false, errors: [{ source: '', error: error.message }] }
  }
  const audioDir = join(root, 'audio')
  const copied = []
  const errors = []
  for (const item of audios) {
    try {
      const source = String(item.source || '')
      const target = String(item.target || '')
      if (!TARGET_RE.test(target)) {
        throw new Error(`目标路径「${target}」不合法:必须是 skill/ 或 death/ 开头 + 纯文件名(.mp3)。`
          + `文件名只能用 字母/数字/下划线/连字符/汉字,不能含 【】！？… 等标点;`
          + `而且必须用「技能ID+序号」命名(引擎按 audio/<类型>/<技能ID><序号>.mp3 找文件,不看台词文案),`
          + `例如 skill/cfwl_37benyuanyunsuan4.mp3、death/cfwl_37.mp3`)
      }
      if (target.includes('..')) throw new Error('目标路径不允许 ..')
      await stat(source)
      const parts = target.split(/[\\/]/)
      const kind = KIND_ALIAS[parts[0].toLowerCase()] || parts[0].toLowerCase()
      const dest = join(audioDir, kind, parts[1])
      await mkdir(join(audioDir, kind), { recursive: true })
      await copyFile(source, dest)
      copied.push(`${kind}/${parts[1]}`)
    } catch (error) {
      errors.push({ source: item.source, error: error.message })
    }
  }
  return { ok: errors.length === 0, copied, errors }
}

/** 目标路径的归属目录:'skill' | 'death' | null(非配音目标形态)。
 * 兼容旧写法 die → 归一为 death,与 copyAudios 的口径必须一致。 */
export function audioTargetKind(target) {
  const m = String(target || '').replace(/\\/g, '/').match(/^(skill|death|die)\//i)
  if (!m) return null
  const kind = m[1].toLowerCase()
  return KIND_ALIAS[kind] || kind
}

/** 允许的音频子目录列表(供 UI/工具 schema 复用)。 */
export const AUDIO_TARGET_KINDS = AUDIO_KINDS
