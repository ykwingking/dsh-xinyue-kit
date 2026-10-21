import { skipLuaToken, scanLua, matchBrace, matchPaired, luaSyntaxCheck, readLongBracket, readQuoted, lineStartAt, rangeHits, CLOSER } from './blocks/lua-scan.js'
export { skipLuaToken, scanLua, matchBrace, matchPaired, luaSyntaxCheck } from './blocks/lua-scan.js'
/**
 * xinyue-kit 锚点区块:新月杀(FreeKill / Lua)扩展包区块化读写的文本核心(纯函数,无 IO)。
 *
 * 与无名杀(JS)版本的根本差异(重要):
 *   无名杀把所有技能/武将/卡牌塞进 <包>/extension.js 一个文件,只能靠锚点注释
 *   (//#noname-kit-begin skill:cs_tianfa)在巨型 JS 对象里定位单个条目——所以旧版
 *   需要 STRUCTURAL_NAMES、字符串感知的花括号配对、JS 引号/模板串/注释识别那一整套;
 *   新月杀是 Lua,一个包一个目录、**一个技能一个文件**,天然文件级粒度:
 *
 *   <包>/init.lua                包入口:Package 声明 + General(...) 武将 + 翻译表
 *   <包>/skills/<技能id>.lua      一个技能一个文件:fk.CreateSkill{...} + 自己的翻译表
 *
 *   于是区块模型从「JS 对象条目级」降为「Lua 语句级」:区块边界按 **Lua 语句**划分,
 *   不再需要在 JS 花括号森林里配对。
 *
 * 锚点格式(Lua 行注释,引擎忽略):
 *   --#xinyue-kit-begin skill:test_rende
 *   ...(该区块的全部 Lua 文本)
 *   --#xinyue-kit-end skill:test_rende
 *   同理 character:<武将id> / card:<牌id> / translate:<id> / package:<包id>(对 init.lua)。
 *
 * 无锚文件(官方风格/存量包)用「虚拟区块」现场划分。Lua 侧不猜对象字面量,而是找
 * **构造调用**(实测 FreeKill 官方包的四种写法,见 packages/standard、standard_cards、test):
 *   fk.CreateSkill{ name = "x" } → skill:x        local s = fk.CreateSkill{...} → skill:x
 *   fk.CreateCard{ name = "x" }  → card:x
 *   General(pkg, "x", ...)       → character:x    (General:new(...) 两种写法都认)
 *   Package:new("x") / Package("x") → package:x
 * 区块范围 = 该调用所在**整条 Lua 语句**(含 `local v = ` 前缀与 chained `:addSkills{}`),
 * 外加紧跟其后的 `v.` / `v:` 续语句——真实样例:
 *   local test2 = General(extension, "mouxusheng", "wu", 4, 4, General.Female)
 *   test2.shield = 3
 *   test2:addSkills { "test_rende", ... }      ← 三句同属 character:mouxusheng
 * 翻译条目(Fk:loadTranslationTable{ ["x"] = "名", [":x"] = "描述" })按基础 id 分组成
 * translate:x;只把**连续**的同 id 条目算成一个块(见 virtualTranslateBlocks 的注释)。
 *
 * Lua 词法扫描(轻量,不做完整语法解析):认 -- 行注释、--[[ ]] / --[==[ ]==] 长注释、
 * '…' "…" 字符串、[[ ]] / [==[ ]==] 长字符串,以及 {} / () / [] 配对。
 * luaSyntaxCheck 在词法之上再做「括号配对 + function/if/for/while/do/repeat 与
 * end/until 的收口计数」,用来拦截断/漏 end 的写入(不是 Lua 解释器,见其注释)。
 */

/** 包入口文件名(无名杀版是 extension.js)。 */
export const ENTRY_FILE = 'init.lua'

/** 内容块种类(与旧版同名同序,index.js/validate.js 的契约):skill / card / character。 */
export const CONTENT_KINDS = ['skill', 'card', 'character']
/** 全部可锚定的块种类(多出 translate 与 package:init.lua 的包声明段)。 */
export const ALL_KINDS = [...CONTENT_KINDS, 'translate', 'package']

/**
 * 结构键黑名单:这些名字是布局骨架,不是内容 ID。validate.js 的 ID 收集直接复用它
 * (旧版是给 package.skill.skill 这类嵌套容器挡垃圾;Lua 侧留着同样语义,防键名撞车)。
 */
export const STRUCTURAL_NAMES = new Set([
  'skill', 'translate', 'character', 'card', 'package', 'help', 'config',
  'content', 'precontent', 'arenaReady', 'name', 'author', 'version',
  'editable', 'connect', 'type', 'list', 'metadata', 'skills', 'generals',
])

const BEGIN_RE = /^[ \t]*--[ \t]*#xinyue-kit-begin[ \t]+([\w]+):([^:\s]+)[ \t\r]*$/
const END_RE = /^[ \t]*--[ \t]*#xinyue-kit-end[ \t]+([\w]+):([^:\s]+)[ \t\r]*$/
// 行尾允许 \r:CRLF 文件里锚点行可能带回车(编辑器/git autocrlf 会把整个文件转 CRLF),
// 行尾锚漏了 \r 就会认不出锚点、以为文件没锚过
const ANCHOR_LINE_RE = /^[ \t]*--[ \t]*#xinyue-kit-(?:begin|end)[ \t]+/

function anchorBegin(kind, id) { return `--#xinyue-kit-begin ${kind}:${id}` }
function anchorEnd(kind, id) { return `--#xinyue-kit-end ${kind}:${id}` }

// ─────────────────────────────── Lua 词法 ───────────────────────────────

/**
 * 读一个长括号结构 [[…]] / [=[…]=] / [==[…]==]。
 * @returns {{ok:boolean, unterminated:boolean, end:number}} end=闭括号之后的下标
 *   (未闭合时=文本长度);ok=false 表示这不是长括号(如 `[1]`/`["k"]`),end 无意义。
 */

/** 语句结束下标(含行尾换行)。括号深度归零后的第一个换行即语句边界;
 *  字符串/注释整体跳过,故长字符串里的换行不会误判成语句结束。 */
function luaStatementEnd(code, from) {
  let depth = 0
  let i = from
  while (i < code.length) {
    const skip = skipLuaToken(code, i)
    if (skip > i) { i = skip; continue }
    const c = code[i]
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') { if (depth > 0) depth-- }
    else if (c === '\n' && depth <= 0) return i + 1
    i++
  }
  return code.length
}

/** 语句的赋值目标变量名(`local v = …` / `v = …`),用于吞掉紧跟的 v.x / v:y 续语句。 */
function assignTargetOf(code, start, callIndex) {
  const seg = code.slice(start, callIndex)
  const m = /(?:^|\n)[ \t]*(?:local[ \t]+)?([A-Za-z_]\w*)[ \t]*=[ \t]*$/.exec(seg)
  return m ? m[1] : ''
}

/** 从 end 起,吞掉所有首 token 为 `v` 且紧跟 . 或 : 的续语句(同属一个条目)。 */
function extendOverContinuations(code, varName, end) {
  if (!varName) return end
  const re = new RegExp('^[ \\t]*' + varName + '[ \\t]*[.:]')
  let at = end
  while (at < code.length) {
    const next = skipBlank(code, at)
    if (next < 0 || !re.test(code.slice(next, next + varName.length + 8))) break
    at = luaStatementEnd(code, next)
  }
  return at
}

/** 跳过空白与注释,返回下一处有效字符下标;-1=到文件末尾。 */
function skipBlank(code, at) {
  let i = at
  while (i < code.length) {
    const skip = skipLuaToken(code, i)
    if (skip > i) { i = skip; continue }
    const c = code[i]
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue }
    return i
  }
  return -1
}

// ───────────────────────────── 区块发现(虚拟) ─────────────────────────────

/** 构造调用模式:kind → 触发正则 + 取 id 的方式。
 *  table 形态(fk.CreateSkill{ name = "x" }):在表里找第一个 name = "…";
 *  call  形态(General(pkg, "x", …)):在实参里找第一个字符串字面量。 */
const CREATORS = [
  { kind: 'skill', re: /\bfk\s*\.\s*CreateSkill\b/g, form: 'table', key: 'name' },
  { kind: 'card', re: /\bfk\s*\.\s*CreateCard\b/g, form: 'table', key: 'name' },
  { kind: 'character', re: /\bGeneral\s*(?::\s*new\s*)?\(/g, form: 'call' },
  { kind: 'package', re: /\bPackage\s*(?::\s*new\s*)?\(/g, form: 'call' },
]

/** Lua id 文本:官方包的 id 不止 \w,还有 `&`(如标准包的 qinglong_emblem&)、`+`、
 *  中文等——按"非引号非空白"取,别用 \w 白名单把它们漏掉。 */
const ID_TEXT = '([^"\'\\s]+)'

/** `local v = "字面量"` 解析:有些官方技能写成 `local skill_name = "discard_skill"`
 *  再 `name = skill_name`,名称是变量而不是字面量,能解析就解析。 */
function resolveLocalString(code, varName) {
  const re = new RegExp('(?:^|[\\n;])[ \\t]*(?:local[ \\t]+)?' + varName + '[ \\t]*=[ \\t]*(?:"([^"\\n]*)"|\'([^\'\\n]*)\')')
  const m = re.exec(code)
  if (!m) return ''
  return (m[1] !== undefined ? m[1] : m[2]).trim()
}

/** 找出某一种 kind 的全部虚拟区块(构造调用 + 续语句)。 */
function creatorBlocks(code, kind) {
  const spec = CREATORS.find((c) => c.kind === kind)
  if (!spec) return []
  const { ranges } = scanLua(code)
  const out = []
  const seenIds = new Set()
  const re = new RegExp(spec.re.source, 'g')
  let m
  while ((m = re.exec(code))) {
    if (rangeHits(ranges, m.index)) continue
    let id = ''
    if (spec.form === 'call') {
      const openParen = m.index + m[0].length - 1
      const close = matchPaired(code, openParen, '(', ')')
      const args = code.slice(openParen + 1, close < 0 ? code.length : close)
      const hit = new RegExp('["\\\']' + ID_TEXT + '["\\\']').exec(args)
      if (!hit) continue
      id = hit[1].trim()
    } else {
      // 表形态:fk.CreateSkill{…} 或 fk.CreateSkill({…})
      let open = m.index + m[0].length
      while (open < code.length && (code[open] === ' ' || code[open] === '\t')) open++
      if (code[open] === '(') {
        open++
        while (open < code.length && (code[open] === ' ' || code[open] === '\t')) open++
      }
      if (code[open] !== '{') continue
      const close = matchBrace(code, open)
      if (close < 0) continue
      const table = code.slice(open, close + 1)
      const hit = new RegExp('\\b' + spec.key + '\\s*=\\s*(?:"([^"\\n]*)"|\'([^\'\\n]*)\'|([A-Za-z_]\\w*))').exec(table)
      if (!hit) continue
      id = (hit[1] !== undefined ? hit[1] : (hit[2] !== undefined ? hit[2] : '')).trim()
      if (!id && hit[3]) id = resolveLocalString(code, hit[3]) // name = skill_name 形态
      if (!id) continue
    }
    if (!id || seenIds.has(id)) continue // 同一 id 只保留第一处
    seenIds.add(id)
    const start = lineStartAt(code, m.index)
    const varName = assignTargetOf(code, start, m.index)
    const end = extendOverContinuations(code, varName, luaStatementEnd(code, m.index))
    out.push({ key: kind + ':' + id, kind, id, start, end, text: code.slice(start, end), anchored: false })
  }
  return out.sort((a, b) => a.start - b.start)
}

/** 翻译条目基础 id:`["test_rende"]`、`[":test_rende"]`、`["#test_rende-active"]`、
 *  `["~mouxusheng"]`、`["designer:xxx"]` 都归到同一个基础 id。 */
export function translateBaseId(key) {
  let k = String(key || '').trim()
  k = k.replace(/^[:#$~]/, '')
  k = k.replace(/^(?:designer|illustrator|translator|cv|program|design)[:：]/, '')
  k = k.replace(/[-#].*$/, '') // "#test_rende-active" → "test_rende"
  return k
}

/** 找出文件里全部翻译表(Fk:loadTranslationTable{…} / (…, "vi_VN") 两种写法)。 */
function translationTables(code) {
  const { ranges } = scanLua(code)
  const out = []
  const re = /\bFk\s*[:.]\s*loadTranslationTable\s*(?:\(\s*)?\{/g
  let m
  while ((m = re.exec(code))) {
    if (rangeHits(ranges, m.index)) continue
    const open = code.indexOf('{', m.index + m[0].length - 1)
    if (open < 0 || rangeHits(ranges, open)) continue
    const close = matchBrace(code, open)
    if (close < 0) continue
    out.push({ open, close })
  }
  return out
}

/** code 在 i 处(可带空白)若是字符串字面量,返回其内容,否则 ''。 */
function readStringLiteral(code, i) {
  let j = i
  while (j < code.length && /\s/.test(code[j])) j++
  const q = code[j]
  if (q !== '"' && q !== "'") return ''
  const r = readQuoted(code, j)
  return code.slice(j + 1, r.end - 1)
}

/**
 * 翻译条目枚举:[{key, base, value, start, end}]。
 * key=原始键(不含引号/方括号),value=字符串字面量内容(非字符串值为 ''),start/end=条目区间。
 */
export function translateEntries(code) {
  const out = []
  for (const sec of translationTables(code)) {
    for (const p of sectionProperties(code, sec.open, sec.close)) {
      out.push({ key: p.name, base: translateBaseId(p.name), value: readStringLiteral(code, p.valueStart), start: p.start, end: p.end })
    }
  }
  return out
}

function lineEndAt(code, i) {
  const nl = code.indexOf('\n', i)
  return nl < 0 ? code.length : nl + 1
}

/**
 * 无锚文件:翻译条目按基础 id 分组。
 * **只把连续的同 id 条目算作一个块**——若同 id 的条目中间夹了别的 id(如多语言表里
 * 同一武将的两种译文),把区间硬拉通会在替换时吞掉中间那些条目(数据丢失)。
 * 非连续的第二段不属于任何块,保持原样、不参与写入。
 */
export function virtualTranslateBlocks(code) {
  const out = []
  const seenIds = new Set()
  let run = null
  const flush = () => {
    if (!run) return
    if (!seenIds.has(run.id)) {
      seenIds.add(run.id)
      out.push(run)
    }
    run = null
  }
  for (const e of translateEntries(code)) {
    if (run && run.id === e.base) {
      run.end = lineEndAt(code, e.end)
      run.text = code.slice(run.start, run.end)
      continue
    }
    flush()
    if (seenIds.has(e.base)) continue // 同 id 的第二段不建块,避免键冲突与误吞
    const start = lineStartAt(code, e.start)
    const end = lineEndAt(code, e.end)
    run = { key: 'translate:' + e.base, kind: 'translate', id: e.base, start, end, text: code.slice(start, end), anchored: false }
  }
  flush()
  return out
}

/** 按种类取虚拟块(translate 走分组逻辑,其余走构造调用)。 */
export function virtualBlocks(code, kind) {
  if (kind === 'translate') return virtualTranslateBlocks(code)
  return creatorBlocks(code, kind)
}

export function virtualSkillBlocks(code) { return creatorBlocks(code, 'skill') }
export function virtualCardBlocks(code) { return creatorBlocks(code, 'card') }
export function virtualCharacterBlocks(code) { return creatorBlocks(code, 'character') }
export function virtualPackageBlocks(code) { return creatorBlocks(code, 'package') }

/** 某文件内全部可锚定条目数(用于迁移时跳过无内容的壳/数据文件)。 */
export function countVirtualBlocks(code) {
  return ['skill', 'card', 'character', 'translate'].reduce((n, kind) => n + virtualBlocks(code, kind).length, 0)
}

// ─────────────── Lua 表区段 / 属性枚举(validate.js 与翻译共用) ───────────────

/**
 * 找出所有 `name = { … }` 表区段(local name = {…} 也认)。
 * 导出给 validate.js 的 ID 收集共用(与旧版签名相同;实现换成 Lua 的赋值语句形态)。
 */
export function findAllSections(code, name) {
  const { ranges } = scanLua(code)
  const out = []
  const seen = new Set()
  const re = new RegExp('(?:^|[\\n;])[ \\t]*(?:local[ \\t]+)?' + name + '[ \\t]*=[ \\t]*\\{', 'g')
  let m
  while ((m = re.exec(code))) {
    const open = code.indexOf('{', m.index + m[0].length - 1)
    if (open < 0 || rangeHits(ranges, open) || seen.has(open)) continue
    const close = matchBrace(code, open)
    if (close < 0) continue
    seen.add(open)
    out.push({ open, close })
  }
  return out.sort((a, b) => a.open - b.open)
}

// Lua 表键:`["str"] =` / `['str'] =` / `bare_ident =`
const KEY_RE = /^[ \t]*\[?[ \t]*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([A-Za-z_]\w*))[ \t]*\]?[ \t]*=[ \t]*/

/** 值收口:对象/数组/长字符串整体配对,否则扫到本层逗号或表收口,再去掉尾随空白与逗号。 */
function scanValueEnd(code, valueStart, close) {
  let j = valueStart
  while (j < close && /\s/.test(code[j])) j++
  if (j >= close) return -1
  const c = code[j]
  if (c === '{') return matchBrace(code, j)
  if (c === '(') return matchPaired(code, j, '(', ')')
  if (c === '[') {
    const lb = readLongBracket(code, j)
    if (lb.ok) return lb.end - 1
  }
  let d = 0
  let k = j
  while (k < close) {
    const skip = skipLuaToken(code, k)
    if (skip > k) { k = skip; continue }
    const ch = code[k]
    if (d === 0 && ch === ',') break
    if (ch === '{' || ch === '(' || ch === '[') d++
    else if (ch === '}' || ch === ')' || ch === ']') {
      if (d === 0) break
      d--
    }
    k++
  }
  let e = k - 1
  while (e > j && /[\s,]/.test(code[e])) e--
  return e
}

/**
 * 枚举表区段内 depth-1 的属性:[{name, start(键起点), end(值末字符), valueStart}]。
 * 导出给 validate.js 的 ID 收集共用。键只认字符串键与裸标识符键(数值键是数组项,不是 ID)。
 * 已知边界:Lua 表里嵌的 `function(...) … end` 值会被"扫到本层逗号"截断,
 * 属性边界可能不准——翻译表(纯字符串值)与技能表(取 name 键)不受影响。
 */
export function sectionProperties(code, open, close) {
  const props = []
  let i = open + 1
  while (i < close) {
    const c = code[i]
    if (c === '[' || c === '"' || c === "'" || /[A-Za-z_]/.test(c)) {
      const m = KEY_RE.exec(code.slice(i, close + 1))
      if (m) {
        const name = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3])
        const valueStart = i + m[0].length
        const end = scanValueEnd(code, valueStart, close)
        if (end >= 0) {
          props.push({ name, start: i, end, valueStart })
          i = end + 1
          continue
        }
      }
    }
    const skip = skipLuaToken(code, i)
    if (skip > i) { i = skip; continue }
    if (c === '{' || c === '(' || c === '[') {
      const e = matchPaired(code, i, c, CLOSER[c])
      i = e >= 0 ? e + 1 : i + 1
      continue
    }
    i++
  }
  return props
}

// ───────────────────────────── 锚点区块 ─────────────────────────────

/** 扫描锚点区块(按文本顺序):[{key, kind, id, start, end, innerStart, innerEnd, text}]。 */
export function scanAnchored(code) {
  const lines = code.split('\n')
  const out = []
  let cur = null
  let offset = 0
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    if (cur === null) {
      const m = BEGIN_RE.exec(line)
      if (m) {
        cur = { key: m[1] + ':' + m[2], kind: m[1], id: m[2], start: offset, innerStart: offset + line.length + 1 }
      }
    } else {
      const m = END_RE.exec(line)
      if (m && m[1] + ':' + m[2] === cur.key) {
        const innerEnd = offset
        const end = offset + line.length + 1
        out.push({ ...cur, innerEnd, end })
        cur = null
      }
    }
    offset += line.length + 1
  }
  for (const b of out) b.text = code.slice(b.innerStart, b.innerEnd)
  return out
}

/** 剥掉全部锚点注释行(迁移自检用)。 */
export function stripAnchors(code) {
  return code.split('\n').filter((l) => !ANCHOR_LINE_RE.test(l)).join('\n')
}

/**
 * 现存区块全集:锚点块优先,虚拟块补足(同 key 不重复)。
 * 新月杀的包几乎都是"官方风格无锚"文件,所以虚拟块必须能参与写入/删除,
 * 不能像旧版那样把无锚文件挡在区块模式之外。
 */
export function collectBlocks(code) {
  const out = []
  const seen = new Set()
  for (const b of scanAnchored(code)) {
    seen.add(b.key)
    out.push({ ...b, anchored: true })
  }
  for (const kind of ALL_KINDS) {
    for (const b of virtualBlocks(code, kind)) {
      if (seen.has(b.key)) continue
      seen.add(b.key)
      out.push({ ...b, anchored: false })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/** 区块目录:锚点优先;无锚时虚拟划分。 */
export function scanBlocks(code) {
  const anchored = scanAnchored(code)
  if (anchored.length) {
    return {
      anchored: true,
      blocks: anchored.map((b) => ({ key: b.key, kind: b.kind, id: b.id, lines: b.text.split('\n').length, virtual: false })),
    }
  }
  const items = []
  for (const kind of ALL_KINDS) for (const b of virtualBlocks(code, kind)) items.push(b)
  items.sort((a, b) => a.start - b.start)
  return {
    anchored: false,
    blocks: items.map((b) => ({ key: b.key, kind: b.kind, id: b.id, lines: b.text.split('\n').length, virtual: true })),
  }
}

/** 按块取内文:key 形如 'skill:test_rende'。锚点优先,退回虚拟。 */
export function extractBlock(code, kind, id) {
  const key = kind + ':' + id
  const hit = collectBlocks(code).find((b) => b.key === key)
  return hit ? hit.text : null
}

/** 文件里定义的内部 ID(skill/card/character 三类,用于防丢护栏)。 */
export function collectLuaIds(code) {
  const ids = []
  const seen = new Set()
  for (const b of collectBlocks(code)) {
    if (!CONTENT_KINDS.includes(b.kind)) continue
    if (seen.has(b.id)) continue
    seen.add(b.id)
    ids.push(b.id)
  }
  return ids
}

// ───────────────────────────── 组装写入 ─────────────────────────────

/** 条目正文归一:去掉行尾空白;原块是"表内条目"(文本以逗号收尾,如
 *  `fk.CreateSkill{name="x"},`)而新块把逗号弄丢时补回来——Lua 表里条目间必须有
 *  逗号,丢了就是语法错误,而结构检查只查括号/end 配对、查不出漏逗号。
 *  语句级块(武将 General(...)、包声明)本来就不会以逗号收尾,不受影响。 */
function normalizeBlockCode(kind, raw, original) {
  const text = String(raw == null ? '' : raw).replace(/[ \t\r]+$/, '').replace(/\s+$/, '')
  const hadComma = original ? /,\s*$/.test(String(original).replace(/\s+$/, '')) : kind === 'translate'
  if (hadComma && !/,$/.test(text)) return text + ','
  return text
}

function anchorWrap(key, body) {
  const [kind, id] = key.split(':')
  return anchorBegin(kind, id) + '\n' + ensureNewline(body) + anchorEnd(kind, id) + '\n'
}

function ensureNewline(text) {
  return text.endsWith('\n') ? text : text + '\n'
}

/** 插入点所在的最近一层 `{ … }`(不是表内则返回 null)。 */
function enclosingTable(code, at) {
  const stack = []
  let i = 0
  while (i < code.length && i < at) {
    const skip = skipLuaToken(code, i)
    if (skip > i) { i = skip; continue }
    const c = code[i]
    if (c === '{' || c === '(' || c === '[') stack.push({ c, i })
    else if (c === '}' || c === ')' || c === ']') {
      const top = stack.pop()
      if (!top || CLOSER[top.c] !== c) return null
    }
    i++
  }
  for (let k = stack.length - 1; k >= 0; k--) if (stack[k].c === '{') return { open: stack[k].i }
  return null
}

/** 全文件最后一条顶格 `return …` 的行首下标(插入尾部内容的落位点);没有则 -1。
 *  只认顶格(function/lambda 里的 return 都是缩进的),避免落进函数体里。 */
function lastReturnStart(code) {
  const re = /(?:^|\n)return\b/g
  let last = -1
  let m
  while ((m = re.exec(code))) last = m.index + (m[0][0] === '\n' ? 1 : 0)
  return last
}

function lastNonWsIndex(code, end) {
  let i = end - 1
  while (i >= 0 && /[ \t\r\n]/.test(code[i])) i--
  return i
}

/**
 * 新块的插入方案。落位优先级:
 *   1) 同类最后一个块之后(最常见:往已有的技能表/武将段后面追加);
 *   2) translate 且文件里已有翻译表 → 最后一个翻译表的收口 } 之前;
 *   3) 顶格 return 之前;
 *   4) 文件末尾。
 * @returns {{at:number, inTable:boolean, newTable?:boolean}}
 */
function insertPlan(code, kind) {
  const all = collectBlocks(code).filter((b) => b.kind === kind)
  if (all.length) {
    const last = all[all.length - 1]
    return { at: last.end, inTable: !!enclosingTable(code, last.end) }
  }
  if (kind === 'translate') {
    const tables = translationTables(code)
    if (tables.length) {
      const t = tables[tables.length - 1]
      return { at: t.close, inTable: true }
    }
    const ret = lastReturnStart(code)
    return { at: ret >= 0 ? ret : code.length, inTable: false, newTable: true }
  }
  const ret = lastReturnStart(code)
  return { at: ret >= 0 ? ret : code.length, inTable: false }
}

/**
 * 区块组装:把提交的块替换/插入进旧文件,其余文本逐字节保留。
 * 纯文本操作;任何错误整单拒绝并返回原码。
 * @returns {{code:string, applied:string[], deleted:string[], errors:string[], warnings:string[]}}
 */
export function assembleBlocks(oldCode, blocks = [], edits = [], deletes = []) {
  const errors = []
  const warnings = []
  const applied = []
  const deleted = []
  let code = oldCode
  const anchoredFile = scanAnchored(code).length > 0

  // 1) 解析删除声明:key 支持 `kind:id`(工具文档写法)与裸 `id`——write.js 的
  //    normalizeBlockId 会把 `translate:xxx` 剥成 `xxx`,所以两种写法都得认;
  //    但裸 id 可能同时命中技能块与它的翻译块(两者 id 相同),此时必须报歧义,
  //    绝不猜测要删哪一个。
  const allBlocks = collectBlocks(code)
  const deleteKeys = new Set()
  for (const key of deletes) {
    const exact = allBlocks.filter((b) => b.key === key)
    if (exact.length > 0) {
      exact.forEach((b) => deleteKeys.add(b.key))
      continue
    }
    const byId = allBlocks.filter((b) => b.id === key)
    if (byId.length === 0) {
      errors.push(`要删除的区块「${key}」不存在(现存区块可用 listBlocks 查看)`)
    } else if (byId.length > 1) {
      errors.push(`要删除的区块「${key}」不唯一(有 ${byId.map((b) => b.key).join('、')}),请用 kind:id 形式指定`)
    } else {
      deleteKeys.add(byId[0].key)
    }
  }
  // 2) 提交块查重
  const seen = new Set()
  for (const item of blocks) {
    const key = item.kind + ':' + item.id
    if (seen.has(key)) errors.push(`区块「${key}」重复提交,一次只提交一份`)
    seen.add(key)
  }
  if (errors.length) return { code: oldCode, applied, deleted, errors, warnings }

  // 3) 删除区块(从后往前,偏移不失效)
  const delRegions = allBlocks
    .filter((b) => deleteKeys.has(b.key))
    .sort((a, b) => b.start - a.start)
  for (const r of delRegions) {
    code = code.slice(0, r.start) + code.slice(r.end)
    deleted.push(r.key)
  }

  // 4) 替换已有块(从后往前)。锚点块区间含两行锚点 → 替换时重新包锚点;
  //    虚拟块按语句区间原样替换(不擅自给官方风格文件加注释)。
  const cur = new Map(collectBlocks(code).map((b) => [b.key, b]))
  const replacing = []
  const inserting = []
  for (const item of blocks) {
    const key = item.kind + ':' + item.id
    const hit = cur.get(key)
    if (hit) {
      const body = normalizeBlockCode(item.kind, item.code, hit.text)
      replacing.push({ key, text: hit.anchored ? anchorWrap(key, body) : ensureNewline(body), region: hit })
    } else {
      inserting.push({ key, kind: item.kind, body: normalizeBlockCode(item.kind, item.code, null) })
    }
  }
  for (const r of replacing.sort((a, b) => b.region.start - a.region.start)) {
    code = code.slice(0, r.region.start) + r.text + code.slice(r.region.end)
    applied.push(r.key)
  }

  // 5) 插入新块:同类最后一个块之后 / 翻译表内 / return 之前
  for (const kind of ALL_KINDS) {
    const list = inserting.filter((x) => x.kind === kind)
    if (!list.length) continue
    const plan = insertPlan(code, kind)
    let body = list.map((x) => ensureNewline(x.body)).join('')
    if (anchoredFile) body = list.map((x) => anchorWrap(x.key, x.body)).join('')
    else if (plan.newTable) body = 'Fk:loadTranslationTable{\n' + body + '}\n'
    let pos = plan.at
    if (plan.inTable) {
      // 往表里塞新条目:前一个条目可能没有尾逗号(Lua 表最后一项常省),
      // 补在它末尾(而不是新行行首,避免 ", " 落在行首的难看输出)
      const lastIdx = lastNonWsIndex(code, plan.at)
      if (lastIdx >= 0 && code[lastIdx] !== ',' && code[lastIdx] !== '{') {
        code = code.slice(0, lastIdx + 1) + ',' + code.slice(lastIdx + 1)
        pos++
      }
    }
    code = code.slice(0, pos) + body + code.slice(pos)
    for (const x of list) applied.push(x.key)
  }

  // 6) 精确小补丁:find 必须恰好命中一次
  for (const e of edits) {
    let count = 0
    let p = 0
    while ((p = code.indexOf(e.find, p)) >= 0) { count++; p += e.find.length }
    if (count === 0) errors.push(`edits:未找到目标文本(必须从当前代码原样复制):「${String(e.find).slice(0, 60)}」`)
    else if (count > 1) errors.push(`edits:目标文本出现 ${count} 次,无法唯一定位:「${String(e.find).slice(0, 60)}」`)
  }
  if (errors.length) return { code: oldCode, applied, deleted, errors, warnings }
  for (const e of edits) {
    const at = code.indexOf(e.find)
    code = code.slice(0, at) + e.replace + code.slice(at + e.find.length)
  }

  // 7) 写入后自查:提交的 key 应仍能被识别(虚拟块边界是启发式,漂了就提示)
  const afterKeys = new Set(collectBlocks(code).map((b) => b.key))
  for (const item of blocks) {
    const key = item.kind + ':' + item.id
    if (!afterKeys.has(key)) {
      warnings.push(`区块「${key}」写入后未能被重新识别(技能/卡牌要有 name = "…",武将要有 General(pkg, "…", …))——请确认内容与 id 一致。`)
    }
  }
  return { code, applied, deleted, errors, warnings }
}

/**
 * 保真校验(全文模式写存量文件用):scope 外的内容区块必须逐字节一致
 * (按行尾空白/回车归一后比较,避免无害差异误报)。覆盖 skill/card/character/translate。
 */
export function checkFidelity(oldCode, newCode, scopeIds = []) {
  const scope = new Set(scopeIds)
  const collect = (code) => {
    const map = new Map()
    for (const b of collectBlocks(code)) map.set(b.key, b)
    return map
  }
  const newBlocks = collect(newCode)
  const changed = []
  for (const b of collect(oldCode).values()) {
    if (scope.has(b.id)) continue
    const nb = newBlocks.get(b.key)
    if (!nb || normalizeForCompare(b.text) !== normalizeForCompare(nb.text)) changed.push(b.id)
  }
  return { ok: changed.length === 0, changed }
}

function normalizeForCompare(code) {
  return code.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\r/g, '')
}

/**
 * 锚点化迁移:对无锚文件插入 Lua 锚点注释行,一个代码字符不动。
 * 自检:剥掉锚点行后必须与原文逐行一致,否则放弃。
 * (与旧版不同:不再补行尾逗号——Lua 侧新块插入由 assembleBlocks 在落位时精确补逗号,
 *  迁移只需保证"只加注释行",自检因此能做成逐字节严格相等。)
 */
export function migrateCode(oldCode) {
  // 幂等:已锚点文件先剥旧锚再重扫(锚点规范升级后直接重新建立索引即可)
  const base = scanAnchored(oldCode).length ? stripAnchors(oldCode) : oldCode
  const items = []
  for (const kind of ['skill', 'card', 'character', 'translate']) items.push(...virtualBlocks(base, kind))
  items.sort((a, b) => a.start - b.start)
  if (!items.length) {
    return { error: '未能识别出可锚定的区块(技能 fk.CreateSkill{ name = … } / 卡牌 fk.CreateCard{ name = … } / 武将 General(pkg, "…", …) / 翻译 Fk:loadTranslationTable{…})——该文件可能是包入口壳或纯数据文件,不需要锚点。' }
  }
  const byAt = new Map()
  const addAt = function (at, text) {
    const parts = byAt.get(at) || []
    parts.push(text)
    byAt.set(at, parts)
  }
  let inserted = 0
  for (const b of items) {
    addAt(lineStartAt(base, b.start), anchorBegin(b.kind, b.id) + '\n')
    addAt(b.end, anchorEnd(b.kind, b.id) + '\n')
    inserted += 2
  }
  let code = base
  for (const at of [...byAt.keys()].sort((a, b) => b - a)) {
    code = code.slice(0, at) + byAt.get(at).join('') + code.slice(at)
  }
  // 自检:剥掉锚点行后必须与原文逐字节一致(迁移只允许新增锚点注释行这一种差异)
  if (stripAnchors(code) !== base) {
    return { error: '锚点插入自检失败(除锚点行外内容发生变化),已放弃写入。' }
  }
  return { code, inserted, commas: 0, blocks: items.length }
}

// ───────────────────────────── 路径约定(纯字符串) ─────────────────────────────

/** `skills/<id>.lua`(或带任意前缀目录的 …/skills/<id>.lua)判定。 */
export function isSkillFile(rel) {
  return /(?:^|\/)skills?\/[^/]+\.lua$/i.test(String(rel || ''))
}

/** `skills/<id>.lua` → <id>(非技能文件返回 '')。 */
export function skillIdFromFile(rel) {
  const m = /(?:^|\/)skills?\/([^/]+)\.lua$/i.exec(String(rel || ''))
  return m ? m[1] : ''
}
