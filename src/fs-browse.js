/**
 * dsh-xinyue-kit / src/fs-browse.js
 *
 * 工坊「📁 选择文件」用的只读目录浏览。
 * 职责只有两件事:列一层目录、给出常用位置。**绝不递归、绝不写入、绝不打开文件**,
 * 白名单只用来筛文件(目录永远列出,否则用户走不进子目录)。
 *
 * 为什么要有它:以前让用户把本地路径复制到输入框里,既要打字又容易错。
 * 这里只回答「这个目录里有什么」,选什么、复制到哪,仍由工坊那边决定。
 */
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { homedir } from 'node:os'

export const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']
export const AUDIO_EXT = ['.mp3']
/** 单目录条目上限:一次倒 10 万个文件名既没用又把响应撑爆 */
export const LIST_LIMIT = 500

/** 上次浏览到的目录(进程内记忆,只是给常用位置多一条,不落盘) */
let lastDir = ''

/** filter → 允许的扩展名数组;null 表示不过滤 */
export function extsFor(filter) {
  if (filter === 'image') return IMAGE_EXT
  if (filter === 'audio') return AUDIO_EXT
  return null
}

function safeStat(p) {
  try { return statSync(p) } catch { return null }
}

/** 常用位置:用户目录/桌面/下载/图片/文档 + 存在的盘符根 + 上次浏览目录 */
export function pickerPlaces() {
  const home = homedir()
  const out = []
  const push = (name, p) => {
    if (!p) return
    if (out.some((x) => x.path === p)) return
    if (!existsSync(p)) return
    out.push({ name, path: p })
  }
  push('🏠 用户目录', home)
  push('🖥 桌面', join(home, 'Desktop'))
  push('⬇ 下载', join(home, 'Downloads'))
  push('🖼 图片', join(home, 'Pictures'))
  push('📄 文档', join(home, 'Documents'))
  push('🕘 上次目录', lastDir)
  for (let i = 65; i <= 90; i += 1) {
    const letter = String.fromCharCode(i)
    const root = letter + ':\\'
    push('💽 ' + letter + ':', root)
  }
  return out
}

/**
 * 列一层目录。
 * 无 dir:只返回常用位置(客户端先给用户挑位置)。
 * 有 dir:返回 { dir, parent, entries[{name,path,isDir,size}], total, truncated }。
 * 目录在前、文件在后,各自按名排序(中文按 zh-Hans-CN 排)。
 */
export function listDirForPicker({ dir, filter, limit } = {}) {
  const max = Math.min(Math.max(Number(limit) || LIST_LIMIT, 1), LIST_LIMIT)
  const exts = extsFor(filter)
  if (!dir) {
    return { ok: true, dir: '', parent: '', places: pickerPlaces(), entries: [], total: 0, truncated: false }
  }
  const abs = resolve(String(dir))
  const st = safeStat(abs)
  if (!st) {
    return { ok: false, error: '目录不存在或无法访问: ' + abs, dir: abs, parent: '', places: pickerPlaces(), entries: [], total: 0, truncated: false }
  }
  if (!st.isDirectory()) {
    return { ok: false, error: '不是目录: ' + abs, dir: abs, parent: dirname(abs), places: pickerPlaces(), entries: [], total: 0, truncated: false }
  }
  let names
  try {
    names = readdirSync(abs)
  } catch (e) {
    return { ok: false, error: '目录读取失败: ' + ((e && e.message) || e), dir: abs, parent: dirname(abs), places: pickerPlaces(), entries: [], total: 0, truncated: false }
  }
  const dirs = []
  const files = []
  for (const name of names) {
    const p = join(abs, name)
    const s = safeStat(p)
    if (!s) continue
    if (s.isDirectory()) {
      dirs.push({ name, path: p, isDir: true, size: 0 })
      continue
    }
    if (!s.isFile()) continue
    const dot = name.lastIndexOf('.')
    const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ''
    if (exts && exts.indexOf(ext) < 0) continue
    files.push({ name, path: p, isDir: false, size: s.size })
  }
  const cmp = (a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hans-CN')
  dirs.sort(cmp)
  files.sort(cmp)
  const entries = dirs.concat(files)
  const truncated = entries.length > max
  lastDir = abs
  const parent = dirname(abs) === abs ? '' : dirname(abs)
  return {
    ok: true, dir: abs, parent, places: pickerPlaces(),
    entries: truncated ? entries.slice(0, max) : entries,
    total: entries.length, truncated, filter: filter || 'any', exts,
  }
}
