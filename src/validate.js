/**
 * 新月杀 / FreeKill(Lua)静态校验器:纯静态检查,不执行任何用户代码。
 *
 * 语法层两段式(渐进式加载,不静默降级):
 *   1) 优先用 JS 版 Lua 解析器 luaparse(纯 JS,无需 lua.exe/luac.exe——
 *      FreeKill 只带 lua54.dll,系统里没有 lua 可执行文件)。插件目录没装
 *      luaparse 时 try/catch 兜住,绝不让插件挂掉;此时 syntaxEngine='builtin'。
 *   2) 降级到自带轻量 Lua 检查器:注释/长括号/字符串闭合、function/if/for/while/do
 *      与 end 配对、repeat-until 配对、()[]{} 配对。
 * 结果里用 syntaxEngine('luaparse' | 'builtin')明示走的哪条路,不静默降级。
 *
 * 规则层按 FreeKill 概念重写:包入口 init.lua(Package:new + 顶层 return)、
 * 技能文件(fk.CreateSkill + name + return)、General(...) 参数、addSkills 引用、
 * Fk:loadTranslationTable 翻译表、ID 前缀、全角标点(仅代码位置)。
 *
 * 结果契约保持兼容:{ ok, style, errors:[{line?,message}], warnings:[{message}] },
 * 另加 syntaxEngine 字段。
 */
import { readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve, isAbsolute } from 'node:path'
import { paramKeysFor, similarNames, specFieldsFor } from './engine-api.js'

/** 支持的 kind。'loader' / 'module' 是探测结果(不是给调用方的输入值):
 *  - 'loader':有些 init.lua 只是聚合壳(require/dofile 把子包拉进来),自己不建 Package。
 *  - 'module':包内的**普通 Lua 模块**(如 pkg/foo.lua、lib/helper.lua),既不是包入口
 *    也不是技能文件——只做语法/全角/语义检查,不要求 Package:new 或 return 技能。 */
const KINDS = new Set(['package', 'skill', 'general', 'loader', 'module'])
/** 代码区(字符串/注释之外)不允许出现的全角标点。 */
const FULLWIDTH = /[，。；：？！“”‘’【】（）〈〉《》、※；]/

/* ------------------------------------------------------------------ *
 * 1. Lua 词法:注释 / 字符串 / 长括号 / 括号配对
 * ------------------------------------------------------------------ */

function lineIndex(code) {
  const starts = [0]
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') starts.push(i + 1)
  return (index) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= index) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

/**
 * '=' 序列长度:[=[ / [==[ …;不是长括号返回 -1。
 * 收口 '[' 后面若紧跟引号/另一个 '['(`[["key"]]`、`a[b][c]`)或数字(`[1, x]`),
 * 那是索引/表访问,不是长字符串。这层判定不能省:把普通方括号误判成长括号会让
 * "闭合"吞掉后面一大段代码,括号配对整盘错乱。
 */
function longBracketLevel(code, i) {
  if (code[i] !== '[') return -1
  let j = i + 1
  while (j < code.length && code[j] === '=') j++
  if (code[j] !== '[') return -1
  const next = code[j + 1]
  if (next === '"' || next === "'" || next === '[' || /[0-9]/.test(next || '')) return -1
  return j - i - 1
}

function longBracketClose(code, from, level) {
  const closer = ']' + '='.repeat(level) + ']'
  const at = code.indexOf(closer, from)
  return at < 0 ? -1 : at + closer.length
}

/**
 * Lua 词法扫描。返回:
 *   mask   1 = 注释/长字符串/长注释内的字符(短字符串不算,它们是"值")
 *   issues 未闭合的引号 / 长括号 / 块注释 / 括号不配对
 *   tokens [{kind:'name'|'string'|'number'|'punct'|'longstr', value, start, end, pair?, unclosed?}]
 *          ——'string' 的 value 已是去引号内容;括号已做配对(pair = 对侧 token 下标)
 * 中文出现在字符串与注释里是允许的,全角扫描与规则提取都只看 token。
 */
function tokenizeLua(code, { skipUnclosed = false } = {}) {
  const mask = new Uint8Array(code.length)
  const issues = []
  const tokens = []
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '-' && code[i + 1] === '-') {
      const lb = longBracketLevel(code, i + 2)
      if (lb >= 0) {
        const from = i
        const openEnd = i + 2 + lb + 2
        const closeEnd = longBracketClose(code, openEnd, lb)
        i = openEnd
        if (closeEnd < 0) {
          while (i < code.length) mask[i++] = 1
          issues.push({ index: from, message: `块注释 --[${'='.repeat(lb)}[ 没有闭合(缺少对应的 ]${'='.repeat(lb)}] )` })
        } else {
          while (i < closeEnd) mask[i++] = 1
        }
      } else {
        while (i < code.length && code[i] !== '\n') mask[i++] = 1
      }
      continue
    }
    if (c === '[') {
      const lb = longBracketLevel(code, i)
      if (lb >= 0) {
        const from = i
        const openEnd = i + lb + 2
        const closeEnd = longBracketClose(code, openEnd, lb)
        let end = code.length
        if (closeEnd < 0) {
          i = code.length
          issues.push({ index: from, message: `长字符串 [${'='.repeat(lb)}[ 没有闭合(缺少对应的 ]${'='.repeat(lb)}] )` })
        } else {
          end = closeEnd
          i = closeEnd
        }
        while (end > from && /[\s]/.test(code[end - 1])) end--
        let s = from + lb + 2
        while (s < end && /\s/.test(code[s])) s++
        tokens.push({ kind: 'longstr', value: code.slice(s, end), start: from, end, unclosed: closeEnd < 0 })
        continue
      }
      // 不是长括号 = 普通 '[' 索引/表下标。必须作为 token 发出去:
      // 漏发会让括号配对整盘错乱(实测真包 init.lua 会报 84 个假不配对)。
      tokens.push({ kind: 'punct', value: '[', start: i, end: i + 1 })
      i++
      continue
    }
    if (c === '"' || c === "'") {
      const from = i
      let j = i + 1
      let closed = false
      let value = ''
      while (j < code.length) {
        const d = code[j]
        if (d === '\\') {
          value += code[j + 1] === undefined ? '' : code[j + 1]
          j += 2
          continue
        }
        if (d === '\n') break // Lua 短字符串不允许裸换行
        if (d === c) { closed = true; j++; break }
        value += d
        j++
      }
      if (!closed && !skipUnclosed) issues.push({ index: from, message: `字符串引号 ${c} 没有闭合` })
      tokens.push({ kind: 'string', value, start: from, end: j, isString: true })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i
      while (j < code.length && /[\w]/.test(code[j])) j++
      tokens.push({ kind: 'name', value: code.slice(i, j), start: i, end: j })
      i = j
      continue
    }
    if (/[0-9]/.test(c)) {
      let j = i
      while (j < code.length && /[\w.]/.test(code[j])) j++
      tokens.push({ kind: 'number', value: code.slice(i, j), start: i, end: j })
      i = j
      continue
    }
    if (/[ \t\r\n]/.test(c)) { i++; continue }
    tokens.push({ kind: 'punct', value: c, start: i, end: i + 1 })
    i++
  }

  // 括号配对(pair 字段指向配对 token 下标);用 token 流,不会被子串里的括号/等号干扰
  const stack = []
  const openers = { '(': ')', '[': ']', '{': '}' }
  const closers = { ')': '(', ']': '[', '}': '{' }
  const puncts = tokens.map((t, k) => (t.kind === 'punct' ? k : -1)).filter((k) => k >= 0)
  for (const k of puncts) {
    const t = tokens[k]
    if (openers[t.value]) stack.push(k)
    else if (closers[t.value]) {
      const top = stack.pop()
      if (top !== undefined && tokens[top].value === closers[t.value]) {
        tokens[top].pair = k
        t.pair = top
      } else if (top !== undefined) {
        stack.push(top)
        issues.push({ index: t.start, message: `括号不配对:「${tokens[top].value}」被「${t.value}」闭合` })
      } else if (!skipUnclosed) {
        issues.push({ index: t.start, message: `多余的右括号「${t.value}」` })
      }
    }
  }
  if (stack.length && !skipUnclosed) {
    for (const k of stack) issues.push({ index: tokens[k].start, message: `括号「${tokens[k].value}」没有闭合` })
  }
  return { mask, issues, tokens }
}

/** 括号配对的对侧下标(找不到返回 -1)。 */
function pairOf(tokens, k) {
  return tokens[k] && tokens[k].pair !== undefined ? tokens[k].pair : -1
}

/** 解析一层键值对:name = value / ["key"] = value / [1] = value。 */
function parseFields(tokens, open, close) {
  const fields = []
  let k = open + 1
  while (k < close) {
    const t = tokens[k]
    let key = null
    let valueStart = -1
    if (t.kind === 'name') {
      if (tokens[k + 1] && tokens[k + 1].kind === 'punct' && tokens[k + 1].value === '=') {
        key = { type: 'name', value: t.value, start: t.start }
        valueStart = k + 2
      } else { k++; continue }
    } else if (t.kind === 'punct' && t.value === '[') {
      const it = tokens[k + 1]
      let keyText = null
      if (it && it.kind === 'string') keyText = it.value
      else if (it && it.kind === 'number') keyText = it.value
      else if (it && it.kind === 'name') keyText = it.value
      const closeB = pairOf(tokens, k)
      if (keyText === null || closeB < 0 || !(tokens[closeB + 1] && tokens[closeB + 1].value === '=')) { k++; continue }
      key = { type: it.kind === 'string' ? 'string' : (it.kind === 'number' ? 'number' : 'name'), value: keyText, start: it.start }
      valueStart = closeB + 2
    } else { k++; continue }
    // value 结束于同层的 ',' 或 ';' 或结构收口
    let e = valueStart
    let nested = 0
    while (e < close) {
      const vt = tokens[e]
      if (vt.kind === 'punct') {
        if ('([{'.includes(vt.value)) nested++
        else if (')]}'.includes(vt.value)) {
          if (nested === 0) break
          nested--
        } else if (nested === 0 && (vt.value === ',' || vt.value === ';')) break
      }
      e++
    }
    if (e > valueStart) fields.push({ key, valueToken: tokens[valueStart], valueStart, valueEnd: e - 1 })
    k = e + 1
  }
  return fields
}

/* ------------------------------------------------------------------ *
 * 2. 语法层
 * ------------------------------------------------------------------ */

/* luaparse 用 createRequire 从「本文件所在插件的 node_modules」解析:
 * 插件不会因此崩(整个调用包在 try 里),装了就自动用上。 */
function loadLuaparse() {
  try {
    const require = createRequire(import.meta.url)
    const mod = require('luaparse')
    return mod && mod.parse ? mod : (mod && mod.default && mod.default.parse ? mod.default : null)
  } catch {
    return null
  }
}

let luaparseInstance
let luaparseTried = false
function getLuaparse() {
  if (!luaparseTried) { luaparseTried = true; luaparseInstance = loadLuaparse() }
  return luaparseInstance
}

/** luaparse 是否可用(测试/调用方可用它判断本机走哪条路)。 */
export function hasLuaparse() {
  return getLuaparse() !== null
}

function luaparseSyntaxCheck(code) {
  const parser = getLuaparse()
  if (!parser) return null
  try {
    parser.parse(code, { luaVersion: '5.3', comments: false, locations: true })
  } catch (error) {
    const loc = error.loc || error
    const line = loc && typeof loc.line === 'number' ? loc.line : (typeof error.line === 'number' ? error.line : undefined)
    const message = String(error.message || '语法错误').split('\n')[0]
    return { ok: false, line, message: `Lua 语法错误(luaparse): ${message}` }
  }
  return { ok: true }
}

/**
 * 自带轻量 Lua 检查器(没有 luaparse 时的降级路径)。
 * 覆盖:注释/字符串/长括号闭合、关键字块配对、括号配对。
 */
export function builtinLuaCheck(code) {
  const errors = []
  const { tokens, issues } = tokenizeLua(code)
  const at = lineIndex(code)
  const seen = new Set()
  const push = (index, message) => {
    const key = index + '|' + message
    if (seen.has(key)) return
    seen.add(key)
    errors.push({ line: at(index), message })
  }
  for (const issue of issues) push(issue.index, issue.message)

  const kwStack = []
  // Lua 里 `do` 有两义:for/while 头部的 do(由 for/while 那一层收口),以及裸 do 块
  // (自己需要 end)。判定看"栈顶那个块是不是 for/while"——不能用"上一个关键字":
  // 循环头里的变量(`for i=1,3 do` 的 i)会把上一个关键字冲掉,实测导致 for...do
  // 被当成裸 do 块,整个文件报「for 没有配对的 end」。
  const inLoopHeader = () => kwStack.length > 0 && (kwStack[kwStack.length - 1].kw === 'for' || kwStack[kwStack.length - 1].kw === 'while')
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind === 'punct' && ')]}'.includes(t.value)) {
      if (t.pair === undefined) push(t.start, `多余的右括号「${t.value}」`)
      continue
    }
    if (t.kind !== 'name') continue
    switch (t.value) {
      case 'function':
      case 'if':
      case 'for':
      case 'while':
        kwStack.push({ kw: t.value, index: t.start })
        break
      case 'repeat':
        kwStack.push({ kw: 'repeat', index: t.start })
        break
      case 'do':
        if (inLoopHeader()) break // 循环头的 do 不另开一层
        kwStack.push({ kw: 'do', index: t.start })
        break
      case 'until': {
        const top = kwStack.pop()
        if (!top || top.kw !== 'repeat') push(t.start, 'until 没有对应的 repeat')
        break
      }
      case 'end': {
        const top = kwStack.pop()
        if (!top) push(t.start, '多余的 end(没有与之配对的 function/if/for/while/do)')
        else if (top.kw === 'repeat') push(t.start, `第 ${at(top.index)} 行的 repeat 缺少 until`)
        break
      }
      default:
        break
    }
  }
  for (const k of kwStack) {
    push(k.index, k.kw === 'repeat' ? 'repeat 缺少配对的 until' : `「${k.kw}」没有配对的 end`)
  }
  return { ok: errors.length === 0, errors }
}

/**
 * 纯语法检查:优先 luaparse,拿不到则降级到自带检查器(引擎名一并返回)。
 * @param {string} code
 * @returns {{ok:boolean, syntaxEngine:'luaparse'|'builtin', message?:string, errors?:Array}}
 */
export function syntaxCheck(code) {
  if (typeof code !== 'string' || code.trim().length === 0) {
    return { ok: false, syntaxEngine: 'builtin', message: '代码为空' }
  }
  const viaParser = luaparseSyntaxCheck(code)
  if (viaParser) {
    return { ok: viaParser.ok, syntaxEngine: 'luaparse', ...(viaParser.ok ? {} : { message: viaParser.message, line: viaParser.line }) }
  }
  const viaBuiltin = builtinLuaCheck(code)
  if (viaBuiltin.ok) return { ok: true, syntaxEngine: 'builtin' }
  return {
    ok: false,
    syntaxEngine: 'builtin',
    message: `Lua 语法错误(内置检查器): ${viaBuiltin.errors.map((e) => e.message).join('; ')}`,
    errors: viaBuiltin.errors,
  }
}

/* ------------------------------------------------------------------ *
 * 3. 规则层:FreeKill 概念
 * ------------------------------------------------------------------ */

/** 代码区(非注释/非长字符串)的全角标点,最多报 10 处。宁可漏报,不误杀中文。 */
function scanFullwidth(code, tokens) {
  const at = lineIndex(code)
  const found = []
  const push = (line, text) => {
    for (const ch of text) {
      if (!FULLWIDTH.test(ch)) continue
      found.push({ line, message: `第 ${line} 行的代码区出现全角标点「${ch}」——Lua 语法区必须用半角字符(字符串与注释里的中文标点不受影响)。` })
      if (found.length >= 10) return true
    }
    return false
  }
  for (const t of tokens) {
    if (t.kind === 'string') continue // 短字符串里的中文标点合法
    if (t.kind === 'longstr') {
      // 正常闭合的长字符串内容合法;未闭合时剩下的"内容"其实是代码,要扫
      if (!t.unclosed) continue
      if (push(at(t.start), String(t.value))) return found
      continue
    }
    if (push(at(t.start), String(t.value))) return found
  }
  return found
}

/** 收集技能 id:fk.CreateSkill{ name = "x" } / Fk.CreateSkill 调用(两种写法都认)。 */
function collectSkillNames(tokens) {
  const out = []
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind !== 'name' || t.value !== 'CreateSkill') continue
    /* 两种等价写法都必须是"技能定义":
     *   fk.CreateSkill { ... }   —— 官方 test_rende.lua 风格
     *   fk.CreateSkill({ ... })  —— FreeKill 0.5.25 的 packages/ 下 250+ 个真实技能文件用这种;
     * 漏掉带括号的那种,会让这些合法技能文件被报"缺少 fk.CreateSkill"(接成写入门禁后=误拒写)。 */
    let braceK = -1
    const n1 = tokens[k + 1]
    if (n1 && n1.kind === 'punct') {
      if (n1.value === '{') braceK = k + 1
      else if (n1.value === '(' && tokens[k + 2] && tokens[k + 2].kind === 'punct' && tokens[k + 2].value === '{') braceK = k + 2
    }
    if (braceK >= 0) {
      const close = pairOf(tokens, braceK)
      if (close < 0) continue
      const fields = parseFields(tokens, braceK, close)
      const nameField = fields.find((f) => f.key.type === 'name' && f.key.value === 'name')
      out.push({ name: nameField && nameField.valueToken.kind === 'string' ? nameField.valueToken.value : null, index: t.start })
      k = close
    }
  }
  return out
}

/** 收集 General(...) / General:new(...) 的实参。 */
function collectGenerals(tokens) {
  const out = []
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind !== 'name' || t.value !== 'General') continue
    let open = -1
    const n1 = tokens[k + 1]
    const n2 = tokens[k + 2]
    const n3 = tokens[k + 3]
    if (n1 && n1.kind === 'punct' && n1.value === '(') open = k + 1
    else if (n1 && n1.kind === 'punct' && (n1.value === ':' || n1.value === '.') && n2 && n2.kind === 'name' && n2.value === 'new' && n3 && n3.kind === 'punct' && n3.value === '(') open = k + 3
    if (open < 0) continue
    const close = pairOf(tokens, open)
    const args = []
    let cur = []
    for (let j = open + 1; j < (close < 0 ? tokens.length : close); j++) {
      const vt = tokens[j]
      if (vt.kind === 'punct' && vt.value === ',') {
        // 顶层逗号:cur 里的括号都闭合了才算参数分隔
        let depth = 0
        for (const x of cur) {
          if (x.kind === 'punct' && '([{'.includes(x.value)) depth++
          else if (x.kind === 'punct' && ')]}'.includes(x.value)) depth--
        }
        if (depth === 0) { args.push(cur); cur = []; continue }
      }
      cur.push(vt)
    }
    args.push(cur)
    out.push({ args: args.map((a) => a.filter((x) => x.kind !== 'longstr')), index: t.start })
    if (close > 0) k = close
  }
  return out
}

/** 收集 addSkills / addSkill 里的技能 id 字符串。 */
function collectAddSkills(tokens) {
  const out = []
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind !== 'name' || (t.value !== 'addSkill' && t.value !== 'addSkills')) continue
    const n1 = tokens[k + 1]
    if (!n1 || n1.kind !== 'punct' || n1.value !== '{') continue
    const close = pairOf(tokens, k + 1)
    if (close < 0) continue
    for (let j = k + 2; j < close; j++) if (tokens[j].kind === 'string') out.push(tokens[j].value)
    k = close
  }
  return out
}

/** 收集 Fk:loadTranslationTable 的 key/value(key 必须是字符串)。 */
function collectTranslations(tokens) {
  const keys = new Set()
  const values = new Set()
  const suspicious = []
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind !== 'name' || t.value !== 'loadTranslationTable') continue
    const open = k + 1
    if (tokens[open] && tokens[open].kind === 'punct' && (tokens[open].value === '{' || tokens[open].value === '(')) {
      const close = pairOf(tokens, open)
      if (close < 0) continue
      for (const f of parseFields(tokens, open, close)) {
        if (f.key.type === 'string' || f.key.type === 'name') keys.add(f.key.value)
        else suspicious.push({ index: f.key.start, text: `[${f.key.value}]` })
        const v = f.valueToken
        if (v && v.kind === 'string') values.add(v.value)
        else if (v) suspicious.push({ index: v.start, text: `${f.key.value} 的值不是字符串字面量` })
      }
      k = close
    }
  }
  return { keys, values, suspicious }
}

/** 收集 loadSkillSkelsByPath 等指向的目录(做静态字符串求值)。 */
function collectLoadPaths(tokens, code) {
  const env = new Map()
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind !== 'name') continue
    if (tokens[k + 1] && tokens[k + 1].kind === 'punct' && tokens[k + 1].value === '=' &&
        tokens[k + 2] && tokens[k + 2].kind === 'string' && !env.has(t.value)) {
      env.set(t.value, tokens[k + 2].value)
    }
  }
  const out = []
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind !== 'name' || !/^load(?:SkillSkels|Cards|Generals)ByPath$/.test(t.value)) continue
    const open = k + 1
    if (!tokens[open] || tokens[open].kind !== 'punct' || tokens[open].value !== '(') continue
    const close = pairOf(tokens, open)
    if (close < 0) continue
    const parts = tokens.slice(open + 1, close)
    const expr = code.slice(parts.length ? parts[0].start : tokens[open].end, parts.length ? parts[parts.length - 1].end : tokens[open].end)
    out.push({ tokens: parts, expr, index: t.start })
    k = close
  }
  return { paths: out, env }
}

/** 静态求值 Lua 字符串:字面量 + 变量 + `..` 连接;求不出来返回 null(只报 warning)。 */
function evalStringTokens(parts, env) {
  const chunks = []
  let sawAny = false
  for (const t of parts) {
    if (t.kind === 'string') { chunks.push(t.value); sawAny = true; continue }
    if (t.kind === 'name') {
      if (env.has(t.value)) { chunks.push(env.get(t.value)); sawAny = true; continue }
      return null
    }
    if (t.kind === 'punct' && (t.value === '.' || t.value === '..')) continue
    return null
  }
  return sawAny ? chunks.join('') : null
}

/** 在新月杀目录下解析 `./packages/x/skills` 这类路径(限深、吞掉所有异常)。 */
function resolveSkillDir(rawPath, packageDir) {
  if (!rawPath || !packageDir) return { reason: '未提供 packages 根目录(packageDir)' }
  let base = null
  const m = rawPath.match(/(?:\.\/)?packages[/\\](.+)$/)
  if (m) {
    const root = packageDir.replace(/[/\\]packages[/\\].*$/, '')
    if (root && root !== packageDir) base = join(root, 'packages', m[1])
    else if (/[/\\]packages[/\\]?$/.test(packageDir)) base = join(packageDir, m[1])
  } else if (!/[.$]/.test(rawPath)) {
    const root = packageDir.replace(/[/\\]packages[/\\].*$/, '')
    base = root && root !== packageDir ? join(root, 'packages', rawPath) : join(packageDir, rawPath)
  }
  if (!base) return { reason: null }
  const abs = isAbsolute(base) ? base : resolve(base)
  try {
    if (!statSync(abs).isDirectory()) return { reason: `路径存在但不是目录:${abs}` }
    return { dir: abs }
  } catch {
    return { reason: `目录不存在:${abs}` }
  }
}

/** 列出目录下的 *.lua 文件名(限深 3 层,失败返回空)。 */
function listSkillFiles(dir) {
  const found = []
  const walk = (d, depth) => {
    let entries
    try { entries = readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.isDirectory()) { if (depth < 3) walk(join(d, e.name), depth + 1); continue }
      if (/\.lua$/i.test(e.name)) found.push(e.name.replace(/\.lua$/i, ''))
    }
  }
  walk(dir, 0)
  return found
}

/* 技能文件所在目录名:skills/ 最常见;FreeKill 0.5.25 的 packages/ 下实测还有
 * peixiu_skills/、rule_skills/、aux_skills/ 这类 <前缀>_skills/ 目录,一并认。 */
const SKILL_DIR_RE = /(^|\/)(?:[\w-]+_)?skills?\//i

/** 是否存在 `Package(...)` / `Package:new(...)` / `Package.new(...)` 调用。
 *  基于 token 而非文本正则:注释在词法阶段已被丢弃,字符串里的同名文本也不是 name token,
 *  因此翻译表/注释里出现 "Package:new" 字样不会误命中。 */
function hasPackageCall(tokens) {
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind !== 'name' || t.value !== 'Package') continue
    const n1 = tokens[k + 1]
    if (n1 && n1.kind === 'punct' && n1.value === '(') return true
    if (n1 && n1.kind === 'punct' && (n1.value === ':' || n1.value === '.') &&
        tokens[k + 2] && tokens[k + 2].kind === 'name' && tokens[k + 2].value === 'new' &&
        tokens[k + 3] && tokens[k + 3].kind === 'punct' && tokens[k + 3].value === '(') return true
  }
  return false
}

/**
 * 根据 filePath / 内容探测文件种类(探测结果就是返回的 style)。
 * 优先级(显式参数 > 路径形态 > 内容特征):
 *   1) 显式 kind(package/skill/general/loader)——调用方最清楚自己在写什么;
 *   2) filePath 形态:init.lua → package/loader;skills/ 目录 → skill;
 *   3) 内容:fk.CreateSkill → skill;Package(...) → package;General(...) → general;
 *      都没有 → package(保守,包入口是最常见形态)。
 * init.lua 必须先于 skills/ 判:`pkg/skills/init.lua`、`<pkg>/skills/init.lua` 都是
 * "把同目录技能 require 进来"的聚合壳(实测 215 个 init.lua 里 45 个只有 require/dofile、
 * 没有 Package),先判 skills/ 会把它们全判成技能文件并误报"缺少 fk.CreateSkill"。
 */
function detectKind(tokens, filePath, explicit) {
  const fromPath = String(filePath || '').replace(/\\/g, '/')
  const names = tokens.filter((t) => t.kind === 'name').map((t) => t.value)
  if (explicit && KINDS.has(explicit)) return explicit
  if (/(^|\/)init\.lua$/i.test(fromPath)) {
    // 聚合壳 init.lua(require/dofile 拉子包,自己不建 Package)按 loader 处理,
    // 否则会把真实的元包入口全部误判成"缺少 Package:new"(实测 215 个里 45 个)。
    if (hasPackageCall(tokens)) return 'package'
    if (names.includes('require') || names.includes('dofile')) return 'loader'
    return 'package'
  }
  if (SKILL_DIR_RE.test(fromPath)) return 'skill'
  if (names.includes('CreateSkill')) return 'skill'
  if (hasPackageCall(tokens)) return 'package'
  if (names.includes('General')) return 'general'
  // 包内普通模块(pkg/*.lua、lib/*.lua…):不是入口也不是技能,别按 package 报「缺少 Package:new」
  if (fromPath && !/(^|\/)init\.lua$/i.test(fromPath)) return 'module'
  return 'package'
}

/* ------------------------------------------------------------------ *
 * 3.5 语义校验:对着引擎索引查「这个符号真的存在吗」
 * ------------------------------------------------------------------ */

/** 取调用实参里第一层的 `{...}` 参数表(room:askToCards(pl, { min_num = 1 }) 的第二个参数) */
function argTablesAt(tokens, openParen) {
  const close = pairOf(tokens, openParen)
  if (close < 0) return []
  const out = []
  let depth = 0
  for (let k = openParen + 1; k < close; k++) {
    const t = tokens[k]
    if (t.kind !== 'punct') continue
    if (t.value === '{' && depth === 0) {
      out.push(k)
      const c = pairOf(tokens, k)
      if (c < 0) return out
      k = c
      continue
    }
    if (t.value === '(' || t.value === '[') depth++
    else if (t.value === ')' || t.value === ']') depth--
  }
  return out
}

/** 取 `{ ... }` 里第一层的 key(用于 room:askToCards{ min_num = 1 } 这类参数表) */
function tableKeysAt(tokens, open) {
  const close = pairOf(tokens, open)
  if (close < 0) return null
  const keys = []
  let depth = 0
  for (let k = open + 1; k < close; k++) {
    const t = tokens[k]
    if (t.kind === 'punct' && '([{'.includes(t.value)) { depth++; continue }
    if (t.kind === 'punct' && ')]}'.includes(t.value)) { depth--; continue }
    if (depth !== 0) continue
    const nx = tokens[k + 1]
    if ((t.kind === 'name' || t.kind === 'string') && nx && nx.kind === 'punct' && nx.value === '=') {
      keys.push({ name: t.value, start: t.start })
    }
  }
  return keys
}

/** 接收者名字 -> 引擎里必须有同名方法(否则就是拼错/臆造) */
const RECEIVERS = new Set(['room', 'player', 'card', 'to', 'target', 'from', 'self', 'skill', 'logic'])

/**
 * 语义检查(只报警告,绝不拦写):
 *  ① fk.Xxx —— 事件名/成员名是否存在;
 *  ② Cls.Member —— 引擎类上的常量/枚举是否存在;
 *  ③ xxx:method(...) —— 引擎里有没有这个方法名;
 *  ④ room:askToCards{...} —— 参数键是否在引擎注解的参数类里;
 *  ⑤ addEffect("atkrange", {...}) —— status skill spec 字段;
 *  ⑥ fk.CreateSkill{...} —— 技能 spec 顶层键(只提示疑似拼写)。
 */
function semanticChecks(tokens, index, at, addWarning) {
  if (!index || !index.files) return
  const knownEvents = Object.keys(index.events)
  const knownFk = Object.keys(index.fkMembers || {})
  const allMethods = Object.keys(index.methods)
  const methodNames = new Set(allMethods.map((k) => k.split(':').pop()))
  const memberExists = (key) => !!(index.constants[key] || (index.members && index.members[key]) ||
    index.classes[key] || index.methods[key] || index.methods['static:' + key])
  const saidFk = new Set()

  for (let k = 0; k + 3 < tokens.length; k++) {
    const a = tokens[k]
    const b = tokens[k + 1]
    const c = tokens[k + 2]
    if (a.kind !== 'name' || b.kind !== 'punct') continue

    // ① fk.Xxx
    if (a.value === 'fk' && b.value === '.' && c.kind === 'name') {
      const n = c.value
      if (!knownFk.includes(n) && !knownEvents.includes(n) && !memberExists('fk.' + n) && !saidFk.has(n)) {
        saidFk.add(n)
        const cand = similarNames(n, [...knownEvents, ...knownFk], 3).map((x) => 'fk.' + x)
        addWarning(`fk.${n} 在引擎索引里找不到${cand.length ? ` —— 是不是想写 ${cand.join(' / ')}?` : '(既不是事件名,也不是 fk 的成员)'}`, at(a.start))
      }
      continue
    }

    // ② Cls.Member(只查引擎已知的类名,避免误报用户自己的变量)
    if (b.value === '.' && c.kind === 'name' && index.moduleIndex[a.value] && !index.moduleIndex[`${a.value}.${c.value}`]) {
      const key = `${a.value}.${c.value}`
      const next = tokens[k + 3]
      const isDecl = next && next.kind === 'punct' && next.value === '='
      if (!isDecl && !memberExists(key)) {
        const cand = similarNames(c.value, Object.keys(index.constants).filter((x) => x.startsWith(a.value + '.')).map((x) => x.split('.').pop()), 3)
        addWarning(`${key} 不在引擎索引里${cand.length ? ` —— 是不是想写 ${a.value}.${cand.join(' / ' + a.value + '.')}?` : `(引擎里 ${a.value} 没有这个成员)`}`, at(a.start))
      }
      continue
    }

    // ③ xxx:method(...) / xxx.method(...)
    if ((b.value === ':' || b.value === '.') && c.kind === 'name') {
      const recv = a.value
      const isCall = tokens[k + 3] && tokens[k + 3].kind === 'punct' && (tokens[k + 3].value === '(' || tokens[k + 3].value === '{' || tokens[k + 3].value === '"')
      const method = c.value
      if (isCall && !methodNames.has(method) && (RECEIVERS.has(recv) || /(?:^|_)(?:player|room|card|skill|logic)$/.test(recv))) {
        const cand = similarNames(method, [...methodNames], 3)
        addWarning(`方法「${method}」在引擎索引里没有任何类定义过${cand.length ? ` —— 是不是想写 ${cand.join(' / ')}?` : ''}(${recv}:${method})`, at(a.start))
        continue
      }
      // ④ 参数表键校验:引擎该方法的参数类注解齐全时才有依据(>=3 个字段)
      if (isCall && (tokens[k + 3].value === '(' || tokens[k + 3].value === '{')) {
        const allowed = paramKeysFor(index, method)
        if (allowed && allowed.size >= 3) {
          // 参数表可能是第一个实参(askToCards{…}),也可能是第 N 个(askToCards(pl, {…}))
          const argTables = tokens[k + 3].value === '{' ? [k + 3] : argTablesAt(tokens, k + 3)
          for (const op of argTables) {
            const keys = tableKeysAt(tokens, op)
            if (!keys) continue
            const bad = keys.filter((x) => !allowed.has(x.name))
            for (const x of bad.slice(0, 3)) {
              const cand = similarNames(x.name, [...allowed], 2)
              addWarning(`${recv}:${method}{...} 的参数「${x.name}」不在引擎的 ${method} 参数注解里${cand.length ? ` —— 是不是想写 ${cand.join(' / ')}?` : `(可用:${[...allowed].slice(0, 10).join(', ')}…)`}`, at(x.start))
            }
          }
        }
      }
      continue
    }
  }

  // ⑤ addEffect("atkrange", { final_func = … })
  for (let k = 0; k + 4 < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind !== 'name' || t.value !== 'addEffect') continue
    if (!(tokens[k + 1].kind === 'punct' && tokens[k + 1].value === '(')) continue
    const s = tokens[k + 2]
    const brace = tokens[k + 4]
    if (!(s.kind === 'string' && tokens[k + 3] && tokens[k + 3].value === ',' && brace && brace.kind === 'punct' && brace.value === '{')) continue
    const allowed = specFieldsFor(index, s.value)
    if (!allowed || !allowed.size) continue
    const keys = tableKeysAt(tokens, k + 4)
    if (!keys) continue
    for (const x of keys.filter((y) => !allowed.has(y.name)).slice(0, 3)) {
      const cand = similarNames(x.name, [...allowed], 2)
      addWarning(`addEffect("${s.value}", {...}) 的字段「${x.name}」不在 spec 里${cand.length ? ` —— 是不是想写 ${cand.join(' / ')}?` : ''}(可用:${[...allowed].join(', ')})`, at(x.start))
    }
  }

  // ⑥ fk.CreateSkill{...} 顶层键:只提示疑似拼写(事件效果字段很多,不做穷举)
  const skillKeys = new Set([...(index.skillSpecFields ? Object.keys(index.skillSpecFields) : []),
    'name', 'tags', 'types', 'audio_index', 'anim_type', 'prompt', 'is_delay_effect', 'frequency', 'priority'])
  if (skillKeys.size > 10) {
    for (let k = 0; k + 3 < tokens.length; k++) {
      const t = tokens[k]
      if (t.kind !== 'name' || t.value !== 'CreateSkill') continue
      if (!(tokens[k + 1].kind === 'punct' && tokens[k + 1].value === '{')) continue
      const keys = tableKeysAt(tokens, k + 1)
      if (!keys) continue
      for (const x of keys.filter((y) => !skillKeys.has(y.name))) {
        const cand = similarNames(x.name, [...skillKeys], 2)
        if (cand.length) addWarning(`fk.CreateSkill{...} 的键「${x.name}」引擎里没读到 —— 是不是想写 ${cand.join(' / ')}?`, at(x.start))
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 4. 对外入口
 * ------------------------------------------------------------------ */

/**
 * 校验一份 FreeKill 扩展(Lua 包)代码。
 * @param {object} input
 * @param {string} input.code - Lua 文件全文。
 * @param {'package'|'skill'|'general'} [input.kind] - 文件种类提示(缺省按 filePath/内容探测)。
 * @param {string} [input.folder] - 包文件夹名。
 * @param {string} [input.filePath] - 包内相对路径(init.lua / skills/x.lua),用于种类探测与技能名一致。
 * @param {string} [input.packageDir] - 扩展包的**根目录**(绝对路径,即 `<游戏根>/packages/<包名>`;write.js 传的就是它),
 *   用于核对 loadSkillSkelsByPath 指向的目录是否存在、以及 addSkills 引用的技能能否在 `<packageDir>/skills/` 里找到。
 * @param {string} [input.idPrefix] - 内部 ID 前缀约定,如 test_。
 * @param {object} [input.apiIndex] - 引擎符号索引(engine-api.js 的 loadEngineIndex 结果)。
 *   给了就做语义检查(未知道具名/事件名/方法名/参数键/spec 字段),只出 warning;不给则跳过。
 * @returns {{ok:boolean, style:string, syntaxEngine:string, errors:Array, warnings:Array}}
 */
export function validateExtensionCode({ code, kind, style, folder, filePath, packageDir, idPrefix, apiIndex } = {}) {
  const errors = []
  const warnings = []
  // warnings 的元素结构在调用方 schema 里只有 message(additionalProperties:false),
  // 行号统一并进 message 文本,不额外加字段。
  const addError = (message, line) => errors.push(Number.isInteger(line) ? { line, message } : { message })
  const addWarning = (message, line) => warnings.push({ message: Number.isInteger(line) ? `第 ${line} 行:${message}` : message })
  if (typeof code !== 'string' || code.trim().length === 0) {
    return { ok: false, style: 'package', syntaxEngine: 'builtin', errors: [{ message: '代码为空' }], warnings }
  }

  const { tokens } = tokenizeLua(code)
  const at = lineIndex(code)
  const detected = detectKind(tokens, filePath, kind)
  if (style != null) {
    addWarning('style 参数(无名杀的 classic/module)在 Lua 校验里已废弃,请改用 kind: \'package\' | \'skill\' | \'general\';本次已忽略。')
  }
  if (kind && !KINDS.has(kind)) addWarning(`kind 参数「${kind}」不是 FreeKill 语义(package/skill/general),已按探测结果「${detected}」校验。`)

  // 1) 语法检查(luaparse 优先,降级到内置检查器;引擎名回传,不静默)
  const syntax = syntaxCheck(code)
  if (!syntax.ok) {
    const detail = syntax.errors && syntax.errors.length ? syntax.errors : [{ message: syntax.message, line: syntax.line }]
    for (const e of detail) addError(e.message, e.line)
  }

  // 2) 全角标点:只看代码位置
  errors.push(...scanFullwidth(code, tokens))

  // 3) 结构化规则
  const skillNames = collectSkillNames(tokens)
  const generals = collectGenerals(tokens)
  const addSkillsRefs = collectAddSkills(tokens)
  const translations = collectTranslations(tokens)
  const loadInfo = collectLoadPaths(tokens, code)
  for (const g of generals) g.line = at(g.index)
  for (const p of loadInfo.paths) p.line = at(p.index)

  const pkgTok = (() => {
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k]
      if (t.kind !== 'name' || t.value !== 'Package') continue
      let open = -1
      if (tokens[k + 1] && tokens[k + 1].kind === 'punct' && tokens[k + 1].value === '(') open = k + 1
      else if (tokens[k + 1] && tokens[k + 1].kind === 'punct' && (tokens[k + 1].value === ':' || tokens[k + 1].value === '.') &&
               tokens[k + 2] && tokens[k + 2].kind === 'name' && tokens[k + 2].value === 'new' &&
               tokens[k + 3] && tokens[k + 3].kind === 'punct' && tokens[k + 3].value === '(') open = k + 3
      if (open < 0) continue
      const close = pairOf(tokens, open)
      if (close < 0) continue
      const first = tokens[open + 1]
      return first && first.kind === 'string' ? { token: first } : { token: null }
    }
    return { token: null, absent: true }
  })()
  const packageName = pkgTok.token ? pkgTok.token.value : null

  // 顶层 return:行首 return + 后面有内容
  let retVar = null
  for (let k = 0; k < tokens.length - 1; k++) {
    if (tokens[k].kind !== 'name' || tokens[k].value !== 'return') continue
    const before = code.slice(0, tokens[k].start)
    const lineStart = before.lastIndexOf('\n') + 1
    if (!/^\s*$/.test(before.slice(lineStart))) continue
    const next = tokens[k + 1]
    if (next.kind === 'name' && ['end', 'until', 'else', 'elseif'].includes(next.value)) continue
    if (next.kind === 'name') retVar = next.value
    break
  }
  const hasReturn = retVar !== null || /(?:^|\n)\s*return\s+[^\s]/.test(code)

  if (detected === 'loader') {
    // 聚合壳 init.lua:自己只 require/dofile 子包,不建 Package、不要求 return 表
    if (!hasReturn && !/\bdofile\s*[( ]/.test(code)) {
      addWarning('这个 init.lua 看起来是聚合壳(require/dofile 子包),通常应以 return { ... } 汇总返回;未发现顶层 return,请确认。')
    }
  }

  if (detected === 'package') {
    if (pkgTok.absent) addError('包入口 init.lua 缺少 Package:new("包名")(或 Package("包名"))定义。')
    else if (!packageName) addWarning('Package:new(...) 的第 1 个参数看起来不是字符串字面量,无法静态核对包名。')
    if (!hasReturn) {
      addError('包入口 init.lua 末尾必须有顶层 `return <包表>`(如 return extension),否则 FreeKill 加载不到这个包。')
    } else if (retVar) {
      const occurrences = tokens.filter((t) => t.kind === 'name' && t.value === retVar).length
      if (occurrences < 2) addWarning(`return ${retVar} 里返回的变量在文件中找不到定义,请确认。`)
    }
    if (translations.keys.size === 0) {
      addWarning('没有发现 Fk:loadTranslationTable{...} —— 武将/技能在游戏内会显示原始 ID。')
    }
  }

  if (detected === 'skill') {
    if (skillNames.length === 0) addError('技能文件缺少 fk.CreateSkill{...}(或 Fk.CreateSkill{...})定义。')
    if (!hasReturn) addError('技能文件末尾必须有 `return <技能变量>`(如 return rende),否则引擎拿不到这个技能。')
    if (skillNames.length > 1) addWarning(`一个技能文件里出现了 ${skillNames.length} 个 CreateSkill,通常一个文件只放一个技能。`)
    const base = String(filePath || '').replace(/\\/g, '/').split('/').pop() || ''
    if (skillNames.length === 1 && /\.lua$/i.test(base)) {
      const expected = base.replace(/\.lua$/i, '')
      if (skillNames[0].name && skillNames[0].name !== expected) {
        addWarning(`CreateSkill 的 name「${skillNames[0].name}」与文件名「${expected}」不一致 —— 按约定应保持一致,否则排查困难。`, at(skillNames[0].index))
      }
    }
  }

  // 3.3 General(...) 参数个数与顺序
  const argText = (a) => a.map((t) => (t.kind === 'string' ? '"' + t.value + '"' : String(t.value))).join(' ')
  for (const g of generals) {
    const args = g.args
    const simple = (a) => a.length === 1
    if (args.length < 4) {
      addError(`General(...) 至少需要 4 个参数(extension, id, country, hp),当前只有 ${args.length} 个。`, g.line)
      continue
    }
    const a1 = args[1]
    const a2 = args[2]
    const a3 = args[3]
    const a4 = args[4]
    if (!(simple(a1) && (a1[0].kind === 'string' || a1[0].kind === 'name'))) {
      addError(`General 的第 2 个参数应是武将 id 字符串(如 "mouxusheng"),当前是「${argText(a1)}」。`, g.line)
    }
    if (!(simple(a2) && a2[0].kind === 'string')) {
      addWarning(`General 的第 3 个参数(势力)看起来不是字符串字面量(「${argText(a2)}」),无法静态核对。`, g.line)
    }
    if (!(simple(a3) && a3[0].kind === 'number')) {
      addError(`General 的第 4 个参数应是体力值数字(如 4,不能写成字符串 "4"),当前是「${argText(a3)}」。`, g.line)
    }
    if (a4 && !(simple(a4) && a4[0].kind === 'number')) {
      addWarning(`General 的第 5 个参数通常是 maxHp 数字,当前是「${argText(a4)}」。`, g.line)
    }
    if (a3 && a4 && simple(a3) && simple(a4) && a3[0].kind === 'number' && a4[0].kind === 'number' && Number(a4[0].value) < Number(a3[0].value)) {
      addWarning(`General 的 maxHp(${a4[0].value})小于 hp(${a3[0].value}),请确认。`, g.line)
    }
    if (args.length > 6) addWarning(`General(...) 有 ${args.length} 个参数,超出常见形式(extension, id, country, hp, maxHp, gender)。`, g.line)
  }

  // 3.4 技能引用 / 目录核对
  const definedNames = new Set(skillNames.map((s) => s.name).filter(Boolean))
  const externalDirs = []
  for (const p of loadInfo.paths) {
    const resolved = evalStringTokens(p.tokens, loadInfo.env)
    if (resolved == null) {
      addWarning(`load*ByPath 的路径不是可静态求值的字符串(「${p.expr}」),无法核对目录是否存在。`, p.line)
      continue
    }
    const dir = resolveSkillDir(resolved, packageDir)
    if (dir.reason) addWarning(`load*ByPath 指向的目录核对失败:${dir.reason}(路径「${resolved}」)。`, p.line)
    else if (dir.dir) externalDirs.push(dir.dir)
  }
  const externalNames = new Set()
  for (const d of externalDirs) for (const n of listSkillFiles(d)) externalNames.add(n)
  // 兜底:显式传了 packageDir 时顺带扫同级 skills/(init.lua 与 skills/ 通常并列)
  if (packageDir) for (const n of listSkillFiles(join(packageDir, 'skills'))) externalNames.add(n)
  for (const ref of addSkillsRefs) {
    if (definedNames.has(ref) || externalNames.has(ref)) continue
    addWarning(`addSkills 引用的技能「${ref}」在包内 skills/ 下没找到(可能是引擎内置技能如 "cheat"/"control",也可能拼错了)。`)
  }

  // 3.5 翻译表
  for (const s of translations.suspicious) {
    addWarning(`翻译表条目 ${s.text} —— FreeKill 的翻译 key/value 都应是字符串字面量。`, at(s.index))
  }
  const generalIds = generals.map((g) => {
    const a1 = g.args[1]
    if (!a1 || a1.length !== 1) return null
    if (a1[0].kind === 'string' || a1[0].kind === 'name') return a1[0].value
    return null
  }).filter(Boolean)
  const translationIds = new Set([...generalIds, ...definedNames])
  const missing = [...translationIds].filter((id) => !translations.keys.has(id))
  if (missing.length > 0) {
    addWarning(`以下武将/技能 id 没有对应的翻译条目:${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' 等' : ''} —— 请补 Fk:loadTranslationTable{ ["id"] = "中文名" }。`)
  }

  // 3.6 ID 前缀约定
  if (idPrefix && /^[A-Za-z][\w-]*$/.test(idPrefix)) {
    const ids = [...collectDefinedIds(code)]
    const offenders = ids.filter((id) => !id.startsWith(idPrefix))
    if (offenders.length > 0) {
      addWarning(`以下内部 ID 未使用前缀「${idPrefix}」:${offenders.slice(0, 8).join(', ')}${offenders.length > 8 ? ' 等' : ''} —— 技能/武将 id 与翻译键是全局命名空间,不加前缀容易与其他包冲突。`)
    }
  }
  if (folder && packageName && folder !== packageName) {
    /* 多子包结构(官方 mrfz / 本机 cfwl 都是这样)里,子包文件长这样:
     *   packages/<拓展>/pkg/<子包>/init.lua  →  Package:new("<拓展>_<子包>")
     * 包名**本来就不等于**拓展目录名,老规则每次都报一条,纯噪音(实测六个子包各报一次)。
     * 只有包根 init.lua 才值得比对。 */
    const inSubPackage = /(^|\/)pkg\//i.test(String(filePath || '').replace(/\\/g, '/'))
      || /(^|\/)pkg\//i.test(String(packageDir || '').replace(/\\/g, '/'))
    if (!inSubPackage) {
      addWarning(`Package:new 的包名「${packageName}」与目标文件夹名「${folder}」不一致,请确认(包名以 extensionName 为准)。`)
    }
  }

  // 4) 语义检查(需要引擎索引;只报警告)
  if (apiIndex) semanticChecks(tokens, apiIndex, at, addWarning)

  // 4.1) can_trigger 会**整体替换**基类的「目标持有该技能」检查
  //   (packages/freekill-core/ltk/core/skill_skeleton.lua:319-343 用 spec.can_trigger 覆盖
  //   sk.triggerable,基类 ltk/core/skill_type/trigger.lua:48-51 的 target:hasSkill 不再执行)
  //   → 忘了自己写 hasSkill,场上每个玩家都会触发。真实事故:cfwl「本源运算」让 AI 也挂上【灵光】。
  if (detected === 'skill') {
    const src = String(code || '')
    const hasCanTrigger = /\bcan_trigger\s*=\s*function/.test(src)
    const hasHasSkill = /hasSkill\s*\(/.test(src)
    const isGlobal = /\bglobal\s*=\s*true/.test(src)
    if (hasCanTrigger && !hasHasSkill && !isGlobal) {
      addWarning('本文件写了 can_trigger,但全篇没有 hasSkill(...):can_trigger 会整体替换基类'
        + '「目标是否持有该技能」的检查(packages/freekill-core/ltk/core/skill_skeleton.lua:319-343),'
        + '结果是场上每个玩家都会触发(真实事故:AI 玩家身上也出现了技能效果)。'
        + '除非这是 global 规则技,请在 can_trigger 首行补 player:hasSkill(技能名)。')
    }
  }

  return { ok: errors.length === 0, style: detected, syntaxEngine: syntax.syntaxEngine, errors, warnings }
}

/**
 * 收集代码里定义的内部 ID(技能名 / 武将 id / 包名),供写入链路的"防丢技能护栏"比对。
 * Lua 版:fk.CreateSkill 的 name、General(...) 的 id、Package:new 的包名。
 */
export function collectDefinedIds(code) {
  const ids = new Set()
  if (typeof code !== 'string' || !code) return ids
  const { tokens } = tokenizeLua(code, { skipUnclosed: true })
  for (const s of collectSkillNames(tokens)) if (s.name) ids.add(s.name)
  for (const g of collectGenerals(tokens)) {
    const a1 = g.args[1]
    if (a1 && a1.length === 1 && a1[0].kind === 'string') ids.add(a1[0].value)
  }
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.kind !== 'name' || t.value !== 'Package') continue
    const first = tokens[k + 2]
    if (tokens[k + 1] && tokens[k + 1].kind === 'punct' && tokens[k + 1].value === '(' && first && first.kind === 'string') ids.add(first.value)
  }
  return ids
}
