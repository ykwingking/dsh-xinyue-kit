/**
 * xinyue-kit 图片复制:把用户选好的本地图片复制进新月杀(FreeKill)扩展包的专用图片文件夹。
 *
 * 与无名杀的目录约定不同(重要):
 *   无名杀:<扩展文件夹>/image/<文件名>            ← 平铺
 *   新月杀:<包目录>/image/generals/<武将id>.jpg    ← 立绘(官方包实测用 .jpg)
 *          <包目录>/image/card/<卡牌id>.png        ← 卡图(官方包实测用 .png,93x130)
 * 实测 FreeKill 官方包用的是 image/generals、image/card、image/mark、image/mvp 等
 * 二十多种子目录,这里只覆盖最常用的 generals 与 card。
 *
 * 安全校验:源必须存在;目标名只允许安全字符 + 图片扩展名;目录不得逃逸。
 */
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { safeFolderPath } from './write.js'

const TARGET_NAME_RE = /^[\w\u4e00-\u9fff-]+\.(jpg|jpeg|png|gif|webp)$/i

/** 允许的图片用途子目录(对应 FreeKill 的 image/<kind>/)。 */
const IMAGE_KINDS = new Set(['generals', 'card', 'anim', 'kingdom', 'mark'])

/**
 * 复制一批图片到扩展包的 image/<kind>/ 子目录。
 * @param {string} gameDir - 新月杀(FreeKill)游戏本体目录。
 * @param {object} input
 * @param {string} input.folder - 扩展包目录名(即 packages/ 下的一层)。
 * @param {'generals'|'card'|'anim'|'kingdom'|'mark'} [input.kind='generals'] - 图片用途。
 *   generals=武将立绘(250x290 jpg)、card=卡图(93x130 png)、anim=技能特效图(可全屏,如限定技
 *   `image/anim/xxx.jpg` 配 room:doSuperLightBox)、kingdom=势力图(需 <代号>.png 75x75 /
 *   -magatama 22x27 / -magatama-l,-r 13x20 / -back 175x233,用 xinyue_kingdom_assets 生成更省事)、
 *   mark=标记角标(20~25px png,配 `@!` 前缀标记)。
 * @param {Array<{source:string, target:string}>} input.images - source=本地图片绝对路径;target=存入目标目录的文件名(含扩展名)。
 * @returns {{ok:boolean, copied?:Array, errors?:Array}}
 */
export async function copyImages(gameDir, { folder, kind = 'generals', images }) {
  if (!Array.isArray(images) || images.length === 0) {
    return { ok: false, errors: [{ source: '', error: 'images 不能为空' }] }
  }
  if (!IMAGE_KINDS.has(kind)) {
    return { ok: false, errors: [{ source: '', error: `kind「${kind}」不合法:只允许 ${[...IMAGE_KINDS].join(' / ')}` }] }
  }
  let root
  try { ({ full: root } = safeFolderPath(gameDir, folder)) } catch (error) {
    return { ok: false, errors: [{ source: '', error: error.message }] }
  }
  const imageDir = join(root, 'image', kind)
  const copied = []
  const errors = []
  for (const item of images) {
    try {
      const source = String(item.source || '')
      const target = String(item.target || basename(source))
      if (!TARGET_NAME_RE.test(target)) {
        throw new Error(`目标名「${target}」不合法:只允许中文/字母/数字/下划线/连字符 + 图片扩展名(jpg/png/gif/webp),请先重命名`)
      }
      if (target !== basename(target) || /[/\\]/.test(target)) throw new Error('目标名只能是一个文件名')
      await stat(source)
      await mkdir(imageDir, { recursive: true })
      await copyFile(source, join(imageDir, target))
      copied.push(`${kind}/${target}`)
    } catch (error) {
      errors.push({ source: item.source, error: error.message })
    }
  }
  return { ok: errors.length === 0, copied, errors }
}
