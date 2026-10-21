/**
 * 扩展包路径安全层:包名校验、路径逃逸防护、条目文件解析、包内 .lua 枚举。
 *
 * 从 write.js 抽出的第一段——这些是**纯路径逻辑**(不写文件),write.js 与
 * 未来的 backup 模块都依赖它们;抽出来避免两边互相 import 造成环。
 * write.js 仍 re-export 这些名字,外部 import 路径不变。
 */
import { join, resolve, sep } from 'node:path'
import { readdir } from 'node:fs/promises'
import { ENTRY_FILE } from '../blocks.js'

export const FOLDER_RE = /^[\w\u4e00-\u9fff-]{1,64}$/
export const SKIP_DIRS = new Set(['backup', 'image', 'audio', 'node_modules', '.git'])

/** 新月杀的扩展根:packages/(无名杀版是 extension/)。 */
export function extRootOf(gameDir) {
  return join(resolve(gameDir), 'packages')
}

/** 校验包目录名并解析出安全绝对路径;逃逸直接抛错。 */
export function safeFolderPath(gameDir, folder) {
  if (typeof folder !== 'string' || !FOLDER_RE.test(folder)) {
    throw new Error(`非法的扩展包名「${folder}」:只允许中文/字母/数字/下划线/连字符,长度 1-64。`)
  }
  const root = extRootOf(gameDir)
  const full = resolve(root, folder)
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error('路径越界:目标不在 packages 目录内。')
  }
  return { root, full }
}

/** 目录名是否含非 ASCII 字符(中文/全角)。 */
export function isNonAsciiFolder(folder) {
  return /[^\x20-\x7e]/.test(String(folder || ''))
}

/** 写入门禁:非 ASCII 目录名一律拒写。
 *  引擎按目录名 `require("packages."..目录名)` 加载包(lua/core/mod_manager.lua),
 *  中文目录会让游戏**启动即崩**(实测:`module 'packages.名将杀' not found`)。
 *  只拦写入;读取/回滚仍允许,方便抢修已有的事故包。
 *  @returns 拒写原因(字符串);目录名合法时返回 null */
export function asciiFolderError(folder) {
  if (!isNonAsciiFolder(folder)) return null
  return `包目录名「${folder}」含非 ASCII 字符(中文/全角等):引擎按目录名 require 加载包,`
    + '非 ASCII 目录会让游戏**启动即崩**(module \'packages.xxx\' not found)。'
    + '请改用 ASCII 目录名(如 mjs_moshi),中文显示名放进 Fk:loadTranslationTable。'
}

/** 旧入口(抛异常版),保留给外部直接调用;工具层走 asciiFolderError 返回错误对象。 */
export function assertAsciiFolderForWrite(folder) {
  const msg = asciiFolderError(folder)
  if (msg) throw new Error(msg)
}

/**
 * 解析「条目文件」参数(新月杀的条目在 skills/<技能id>.lua、init.lua、pkg/*.lua 里)。
 * file 缺省 = init.lua(包入口);只允许包内相对 .lua 路径,禁 ..,resolve 后必须仍在包目录内。
 * @returns {{rel:string, full:string}} rel 为 POSIX 斜杠相对路径
 */
export function safeEntryFilePath(gameDir, folder, file) {
  const { full: folderFull } = safeFolderPath(gameDir, folder)
  const rel = file == null || file === '' ? ENTRY_FILE : String(file).split('\\').join('/')
  if (!/\.lua$/i.test(rel) || rel.includes('..') || rel.startsWith('/')) {
    throw new Error(`非法的条目文件路径「${file}」:必须是包内的相对 .lua 路径(如 ${ENTRY_FILE} 或 skills/<技能id>.lua)。`)
  }
  const full = resolve(folderFull, rel)
  if (!full.startsWith(folderFull + sep)) {
    throw new Error('路径越界:目标文件不在包目录内。')
  }
  return { rel, full }
}

/** 递归枚举包内全部 .lua(POSIX 相对路径;跳过 backup/image/audio 等目录)。 */
export async function listPackageLuaFiles(gameDir, folder) {
  const { full: folderFull } = safeFolderPath(gameDir, folder)
  const out = []
  async function walk(dir, rel) {
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const childRel = rel ? rel + '/' + e.name : e.name
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        await walk(join(dir, e.name), childRel)
      } else if (e.isFile() && /\.lua$/i.test(e.name)) {
        // 历史备份文件(曾有版本误写到包根):<名>.<时间戳>.lua 命名,不是源码,排除
        if (/^[\w.-]+\.(?:pre-rollback\.)?\d{8}-\d{6}(?:-\d{6})?\.lua$/i.test(e.name)) continue
        out.push(childRel)
      }
    }
  }
  await walk(folderFull, '')
  return out.sort((a, b) => (a === ENTRY_FILE ? -1 : b === ENTRY_FILE ? 1 : a.localeCompare(b)))
}

/** 旧导出名兼容(无名杀时代叫 listPackageJsFiles;改名后留着,只有 .lua 语义)。 */
export const listPackageJsFiles = listPackageLuaFiles
