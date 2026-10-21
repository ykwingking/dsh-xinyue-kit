/**
 * engine-api.js —— 引擎符号索引(把「写码前的源码考古」压成一次查询)
 *
 * 索引对象(JSON 可序列化):
 *   {
 *     version, gameDir, builtAt, files,
 *     methods:   { "Player:getAttackRange": { cls, name, params[], doc, file, line } },
 *     events:    { "RoundStart": { name:"RoundStart", file, line, doc } },   // 事件(不含 fk. 前缀)
 *     constants: { "Card.SubtypeOffensiveRide": { value, file, line } },
 *     classes:   { "AskToCardsParams": { parent, fields:[{name,optional,type,desc}], file, line } },
 *     effectSpecs: { "atkrange": "AttackRangeSpec" },   // addEffect 的 key -> spec 类
 *     moduleIndex: { "Card": true }                      // 见过的枚举/类名(用于粗判 xxx.Yyy 是否存在)
 *   }
 *
 * 数据来源:`<游戏根>/lua/**` + `<游戏根>/packages/freekill-core/**` 的 LuaLS 注解
 * (`---@class` / `---@field` / `---@param`)与函数定义行——引擎注释很全,索引直接吃这些。
 *
 * 用途:① xinyue_api_lookup 工具查签名/官方用例;② validate.js 的语义校验(未知道具名、
 * 事件名、方法名、`{...}` 参数键、status skill spec 字段)。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const INDEX_VERSION = 1
/** 索引缓存目录:插件自身目录下的 .cache/(不进游戏目录) */
const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache')
const CACHE_FILE = join(CACHE_DIR, 'engine-index.json')
/** 缓存最长可用天数(超过就重建;引擎升级后靠它兜底) */
const CACHE_MAX_AGE_DAYS = 7

const SKIP_DIRS = new Set(['node_modules', '.git', 'backup', '__pycache__', '.cache'])
/** 扫描根(相对游戏根):引擎核心 + 引擎自带包 */
const SCAN_ROOTS = ['lua', join('packages', 'freekill-core')]
/** 查官方用例时扫的目录(相对游戏根):官方扩展实现 */
const USAGE_ROOT = 'packages'

/** @returns {string[]} 目录下所有 .lua 文件(递归,跳过备份/依赖目录) */
export function walkLuaFiles(root, out = []) {
  let entries
  try { entries = readdirSync(root, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      walkLuaFiles(join(root, e.name), out)
    } else if (e.isFile() && /\.lua$/i.test(e.name)) {
      out.push(join(root, e.name))
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 抽取
 * ------------------------------------------------------------------ */

const FIELD_RE = /^---@field\s+(?:public\s+|protected\s+|private\s+)?([\w.]+)(\?)?\s+(.+)$/
// 类注解可能带多个父类:`---@class SkillSkeleton : Object, SkillSkeletonSpec`
// (早期只认单个父类,导致这类类的 @field 全部丢失 → 效果规格字段表是空的)
const CLASS_RE = /^---@class\s+([\w.:]+)\s*(?::\s*([\w.,:\s]+?))?\s*(?:@\s.*)?$/
const PARAM_RE = /^---@param\s+([\w.]+)\s+([\w.:|\[\]"<>, ]+?)?\s*(?:@\s*(.*))?$/

function cleanType(t, max = 70) {
  const s = String(t || '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/** 从一段 `---` 注释行里取摘要(说明文字) */
function docOf(lines) {
  const out = []
  for (const l of lines) {
    const m = /^---\s*(.*)$/.exec(l)
    if (!m) continue
    const t = m[1].trim()
    if (!t || /^@(class|field|param|return|type|overload|generic|see|deprecated)\b/.test(t)) continue
    out.push(t)
  }
  return out.join(' ').slice(0, 200)
}

/** 解析一个 .lua 文件的注解与定义行,写进 index */
function scanFile(file, text, index) {
  const lines = text.split(/\r?\n/)
  let pendingDocs = []
  let curClass = null
  let inCreateSkill = false
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    const ln = i + 1

    if (/^function\s+SkillSkeleton:create\w*Skill\b/.test(line)) inCreateSkill = true
    else if (inCreateSkill && /^end\s*$/.test(line)) inCreateSkill = false
    if (inCreateSkill) {
      for (const sm of line.matchAll(/spec\.(\w+)/g)) index.skillSpecFields[sm[1]] = true
    }

    if (line.startsWith('---')) {
      // 事件注解(要先于 CLASS_RE 处理,否则会被当成普通类而 continue 掉)
      const ea = /^---@class\s+fk\.(\w+)\s*:\s*([\w.]*\w+Event)\b/.exec(line)
      if (ea && !index.events[ea[1]]) index.events[ea[1]] = { name: ea[1], full: 'fk.' + ea[1], parent: ea[2], file, line: ln }
      const c = CLASS_RE.exec(line)
      if (c) {
        curClass = { parent: c[2] ? c[2].split(',')[0].trim() : null, fields: [], file, line: ln }
        if (!index.classes[c[1]]) index.classes[c[1]] = curClass
        pendingDocs = []
        continue
      }
      const f = FIELD_RE.exec(line)
      if (f && curClass) {
        const rest = f[3]
        const at = rest.indexOf(' @ ')
        const type = at >= 0 ? rest.slice(0, at) : rest
        const desc = at >= 0 ? rest.slice(at + 3).trim() : ''
        const field = { name: f[1], optional: !!f[2], type: cleanType(type), desc: desc.slice(0, 120) }
        curClass.fields.push(field)
        // status skill: addEffect fun(self:…, key: "atkrange", data: AttackRangeSpec, …)
        const km = /key:\s*"(\w+)"\s*,\s*data:\s*([\w.]+)/.exec(rest)
        if (km && !index.effectSpecs[km[1]]) index.effectSpecs[km[1]] = km[2]
        pendingDocs.push(line)
        continue
      }
      if (!CLASS_RE.test(line) && !FIELD_RE.test(line)) { pendingDocs.push(line); continue }
      pendingDocs.push(line)
      continue
    }
    curClass = null

    const p = PARAM_RE.exec(line)
    if (p) { pendingDocs.push(line); continue }

    // 常量/枚举:Card.SubtypeOffensiveRide = 6
    const cm = /^([A-Z][\w]*(?:\.[\w]+)*)\.(\w+)\s*=\s*(-?\d+(?:\.\d+)?|"[^"]*"|'[^']*')\s*(?:--.*)?$/.exec(line)
    if (cm) {
      const key = `${cm[1]}.${cm[2]}`
      if (!index.constants[key]) index.constants[key] = { value: cm[3], file, line: ln }
      if (!index.moduleIndex[cm[1]]) index.moduleIndex[cm[1]] = true
    }

    // fk.X = … 或 function fk.X(…)  (fk 表的成员:fk.CreateSkill / fk.getCardById …)
    const fkm = /^(?:function\s+fk\.(\w+)|fk\.(\w+)\s*=)/.exec(line)
    if (fkm) index.fkMembers[fkm[1] || fkm[2]] = true

    // 任意 `Cls.member = …`(不限于字面量):用于判断「这个成员在引擎里存在过」
    const am = /^([A-Z][\w]*(?:\.[\w]+)*)\.(\w+)\s*=/.exec(line)
    if (am) {
      const mkey = `${am[1]}.${am[2]}`
      if (!index.members) index.members = {}
      index.members[mkey] = true
    }

    // 事件:引擎里写成 `fk.RoundStart = RoundEvent:subclass("fk.RoundStart")`
    // (基类随事件族变化:RoundEvent/TurnEvent/PhaseEvent/GameEvent…,所以只认
    //  「基类名以 Event 结尾」的声明;`X = TriggerData:subclass(...)` 是数据类,不是事件)
    const em = /^(?:fk\.)?(\w+)\s*=\s*([\w.]*\w+Event):subclass\(/.exec(line)
    if (em) {
      const name = em[1]
      if (!index.events[name]) index.events[name] = { name, full: 'fk.' + name, parent: em[2], file, line: ln }
    }

    // 函数定义(方法/静态/本地)
    let cls = null
    let name = null
    let params = null
    let fm = /^(?:local\s+)?function\s+([\w.]+)(?::|\.)(\w+)\s*\(([^)]*)\)/.exec(line)
    if (fm) { cls = fm[1].split('.').pop(); name = fm[2]; params = fm[3] }
    if (!fm) {
      fm = /^([\w.]+)[:.](\w+)\s*=\s*function\s*\(([^)]*)\)/.exec(line)
      if (fm) { cls = fm[1].split('.').pop(); name = fm[2]; params = fm[3] }
    }
    if (!fm) {
      fm = /^local\s+function\s+(\w+)\s*\(([^)]*)\)/.exec(line)
      if (fm) { cls = 'local'; name = fm[1]; params = fm[2] }
    }
    if (fm && name) {
      const key = `${cls}:${name}`
      if (!index.methods[key]) {
        const names = String(params || '').split(',').map((s) => s.trim()).filter(Boolean)
        // 参数名 → 注解里的类型(`---@param params AskToCardsParams`):
        // paramClassesOf 靠它把「方法 → 参数表类 → 允许的键」串起来。
        const types = {}
        for (const l of pendingDocs) {
          const p = PARAM_RE.exec(l)
          if (p && p[2]) types[String(p[1]).split('.').pop()] = cleanType(p[2], 60)
        }
        index.methods[key] = {
          cls,
          name,
          params: names,
          paramTypes: names.map((n) => types[n] || null),
          doc: docOf(pendingDocs),
          line: ln,
          file,
        }
      }
    }
    pendingDocs = []
  }
}

/** 构建索引(全量扫描;约数百毫秒~数秒) */
export function buildEngineIndex(gameDir) {
  const index = {
    version: INDEX_VERSION,
    gameDir: String(gameDir || ''),
    builtAt: new Date().toISOString(),
    files: 0,
    methods: {},
    events: {},
    constants: {},
    classes: {},
    effectSpecs: {},
    moduleIndex: {},
    fkMembers: {},
    skillSpecFields: {},
  }
  if (!gameDir || !existsSync(gameDir)) return index
  for (const rel of SCAN_ROOTS) {
    const root = join(gameDir, rel)
    for (const file of walkLuaFiles(root)) {
      let text
      try { text = readFileSync(file, 'utf8') } catch { continue }
      index.files++
      scanFile(file.replace(/\\/g, '/'), text, index)
    }
  }
  return index
}

/** 引擎是否变化(拿一个核心文件当哨兵,便宜) */
function engineStamp(gameDir) {
  const sentinel = join(gameDir, 'packages', 'freekill-core', 'ltk', 'core', 'skill_skeleton.lua')
  try { return String(statSync(sentinel).mtimeMs) } catch { return '0' }
}

const memo = new Map()

/**
 * 取(必要时构建)引擎索引。进程内 memo + 磁盘缓存。
 * @param {string} gameDir 游戏根
 * @param {{rebuild?:boolean, cacheFile?:string}} [opts]
 */
export function loadEngineIndex(gameDir, opts = {}) {
  const key = String(gameDir || '')
  if (!key || !existsSync(key)) return emptyIndex(key)
  if (!opts.rebuild && memo.has(key)) return memo.get(key)
  const cacheFile = opts.cacheFile || CACHE_FILE
  if (!opts.rebuild) {
    const cached = readCache(cacheFile, key)
    if (cached) { memo.set(key, cached); return cached }
  }
  const built = buildEngineIndex(key)
  built.stamp = engineStamp(key)
  memo.set(key, built)
  writeCache(cacheFile, built)
  return built
}

function emptyIndex(gameDir) {
  return { version: INDEX_VERSION, gameDir, builtAt: null, files: 0, methods: {}, events: {}, constants: {}, classes: {}, effectSpecs: {}, moduleIndex: {}, fkMembers: {}, skillSpecFields: {}, empty: true }
}

function readCache(cacheFile, gameDir) {
  try {
    if (!existsSync(cacheFile)) return null
    const ageDays = (Date.now() - statSync(cacheFile).mtimeMs) / 86400000
    if (ageDays > CACHE_MAX_AGE_DAYS) return null
    const data = JSON.parse(readFileSync(cacheFile, 'utf8'))
    if (!data || data.version !== INDEX_VERSION || data.gameDir !== gameDir) return null
    if (data.stamp && data.stamp !== engineStamp(gameDir)) return null
    return data
  } catch { return null }
}

function writeCache(cacheFile, index) {
  try {
    mkdirSync(dirname(cacheFile), { recursive: true })
    writeFileSync(cacheFile, JSON.stringify(index), 'utf8')
  } catch { /* 缓存写不了不影响功能 */ }
}

/* ------------------------------------------------------------------ *
 * 查询
 * ------------------------------------------------------------------ */

/** 简单编辑距离(用于「你是指」候选) */
function distance(a, b) {
  const m = a.length; const n = b.length
  if (!m || !n) return Math.max(m, n)
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

function similar(target, all, limit = 5) {
  const t = target.toLowerCase()
  const scored = []
  for (const k of all) {
    const kk = k.toLowerCase()
    let score
    if (kk === t) score = 0
    else if (kk.includes(t) || t.includes(kk)) score = 1 - Math.min(kk.length, t.length) / Math.max(kk.length, t.length)
    else score = distance(t, kk) / Math.max(t.length, kk.length)
    if (score <= 0.5) scored.push([score, k])
  }
  scored.sort((x, y) => x[0] - y[0] || x[1].localeCompare(y[1]))
  return scored.slice(0, limit).map((x) => x[1])
}

/** 相似名候选(供「你是指」提示) */
export function similarNames(target, all, limit = 5) {
  return similar(target, all, limit)
}

/** 类字段(含父类,沿 parent 链上溯) */
export function classFields(index, name, depth = 0) {
  const c = index.classes[name]
  if (!c || depth > 8) return []
  const own = c.fields || []
  const parent = c.parent ? classFields(index, c.parent, depth + 1) : []
  const seen = new Set(parent.map((f) => f.name))
  return [...parent, ...own.filter((f) => !seen.has(f.name))]
}

/** 官方用例:在 packages/ 下按符号名窄扫(lazy,只扫含该名的行) */
export function findUsages(gameDir, symbol, { limit = 3, maxFiles = 4000 } = {}) {
  const bare = String(symbol || '').split(/[:.]/).pop()
  if (!bare || bare.length < 3 || !gameDir) return { rows: [], scanned: 0, truncated: false }
  const root = join(gameDir, USAGE_ROOT)
  const files = walkLuaFiles(root)
  const re = new RegExp(`\\b${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  const rows = []
  let scanned = 0
  for (const file of files) {
    if (scanned >= maxFiles) return { rows, scanned, truncated: true }
    scanned++
    const rel = file.replace(/\\/g, '/')
    // 定义处所在文件自己不算用例
    let text
    try {
      text = readFileSync(file, 'utf8') } catch { continue }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length && rows.length < limit; i++) {
      if (!re.test(lines[i])) continue
      if (/^\s*(?:local\s+)?function\b/.test(lines[i])) continue // 定义行跳过
      rows.push({ file: rel.replace(/^.*?\/packages\//, 'packages/'), line: i + 1, snippet: lines[i].trim().slice(0, 160) })
    }
    if (rows.length >= limit) break
  }
  return { rows, scanned, truncated: false }
}

/**
 * 查符号:返回签名/说明/定义位置 + 官方用例。
 * @param {object} index loadEngineIndex 的结果
 * @param {{symbol:string, kind?:string, limit?:number, gameDir?:string}} args
 */
export function describeSymbol(index, args = {}) {
  const raw = String(args.symbol || '').trim()
  if (!raw) return { ok: false, error: 'symbol 为空' }
  const limit = Math.max(1, Math.min(20, args.limit || 6))
  const sym = raw.replace(/\(\)$/, '').replace(/^fk[:.]/, '').replace(/^Fk[:.]/, 'Fk:')
  const out = { ok: true, symbol: raw, hits: [], candidates: [], index: { files: index.files, builtAt: index.builtAt, empty: !!index.empty } }
  const kindFilter = args.kind || 'any'

  const push = (kind, key, obj, extra = {}) => out.hits.push({ kind, symbol: key, ...extra, ...obj })

  if (kindFilter === 'any' || kindFilter === 'event') {
    const e = index.events[sym] || index.events[sym.replace(/^fk\./, '')]
    if (e) push('event', 'fk.' + e.name, { file: e.file, line: e.line, doc: e.doc || '', usage: `fk.${e.name}`, note: `GameEvent 事件,定义 ${e.full}` })
  }
  if (kindFilter === 'any' || kindFilter === 'constant') {
    const c = index.constants[sym]
    if (c) push('constant', sym, { file: c.file, line: c.line, value: c.value, note: `= ${c.value}` })
    // 模糊:只给前缀时列同类常量(如 Card.Subtype)
    const prefix = sym.endsWith('.') ? sym : sym + '.'
    const kin = Object.keys(index.constants).filter((k) => k.startsWith(prefix)).slice(0, 12)
    if (kin.length && !c) out.candidates.push(...kin)
  }
  if (kindFilter === 'any' || kindFilter === 'method') {
    const key = sym.includes(':') ? sym : null
    const m = (key && index.methods[key]) || null
    if (m) push('method', key, { file: m.file, line: m.line, params: m.params, doc: m.doc, note: `${key}(${m.params.join(', ')})`, fieldClass: index.effectSpecs[key] || null })
    // 只给方法名(不带类)时,列所有同名方法
    if (!key) {
      const same = Object.keys(index.methods).filter((k) => k.split(':')[1] === sym).slice(0, limit)
      for (const k of same) {
        const mm = index.methods[k]
        push('method', k, { file: mm.file, line: mm.line, params: mm.params, doc: mm.doc, note: `${k}(${mm.params.join(', ')})` })
      }
    }
  }
  if (kindFilter === 'any' || kindFilter === 'class' || kindFilter === 'spec' || kindFilter === 'param') {
    if (index.classes[sym]) {
      const fields = classFields(index, sym)
      push('class', sym, {
        file: index.classes[sym].file, line: index.classes[sym].line,
        parent: index.classes[sym].parent || undefined,
        fields: fields.slice(0, 40),
        note: `类 ${sym}${index.classes[sym].parent ? ' : ' + index.classes[sym].parent : ''},字段 ${fields.length} 个`,
      })
    }
    const specOwner = Object.entries(index.effectSpecs).find(([, v]) => v === sym)
    if (specOwner) out.candidates.push(`addEffect("${specOwner[0]}", {...}) 的 spec 类`)
  }
  // 参数类:方法 -> 其 params 的类名(用于校验 {key=…})
  if (!out.hits.length) {
    const all = [
      ...Object.keys(index.events).map((k) => 'fk.' + k),
      ...Object.keys(index.constants),
      ...Object.keys(index.methods),
      ...Object.keys(index.classes),
      ...Object.keys(index.effectSpecs),
    ]
    out.candidates.push(...similar(sym, all, limit))
    if (!all.length) out.candidates.length = 0
    out.ok = out.candidates.length > 0
    if (!out.ok) out.error = `索引里没有「${raw}」(索引 ${index.files} 个引擎文件)`
  }
  // 官方用例(lazy 扫描)
  if (out.hits.length && args.gameDir) {
    const bare = out.hits.find((h) => h.kind === 'method') ? out.hits.find((h) => h.kind === 'method').symbol.split(':')[1] : raw
    out.usages = findUsages(args.gameDir, bare, { limit: 3 }).rows
  }
  return out
}

/**
 * 参数类字典:方法名 -> 允许的 {…} 参数键(用于 room:askToCards{...} 这类校验)。
 * 数据来自 `---@param params AskToCardsParams` + 该类的 @field(含继承)。
 */
export function paramClassesOf(index) {
  if (index.__paramClasses) return index.__paramClasses
  const map = {}
  for (const [key, m] of Object.entries(index.methods)) {
    const types = Array.isArray(m.paramTypes) ? m.paramTypes : []
    for (const pt of types) {
      if (!pt) continue
      const cls = String(pt).split(/[=:|]/).pop().trim()
      if (index.classes[cls]) {
        if (!map[key]) map[key] = new Set()
        for (const f of classFields(index, cls)) map[key].add(f.name)
      }
    }
  }
  index.__paramClasses = map
  return map
}

/** 只给方法名(不带类)时的参数键集合:同名方法取并集(命中任一实现即可) */
export function paramKeysFor(index, methodName) {
  const all = paramClassesOf(index)
  const keys = new Set()
  let found = false
  for (const [key, set] of Object.entries(all)) {
    if (key.split(':').pop() !== methodName) continue
    found = true
    for (const k of set) keys.add(k)
  }
  return found ? keys : null
}

/** addEffect("atkrange", {...}) -> 该 spec 类允许的字段集合(含继承) */
export function specFieldsFor(index, effectKey) {
  const cls = index.effectSpecs[effectKey]
  if (!cls || !index.classes[cls]) return null
  return new Set(classFields(index, cls).map((f) => f.name))
}
