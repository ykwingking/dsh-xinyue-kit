/**
 * Lua 词法/结构扫描:跳过字符串与注释、括号配对、关键字与行首定位。
 *
 * 纯函数、无 IO——从 blocks.js 抽出来的第一段(它占原文件 1/4 且与业务无关)。
 * 上层 blocks.js 仍 re-export 这些名字,外部 import 路径不变。
 */
export function readLongBracket(text, i) {
  // 必须先确认起点就是 '[':否则 `-- [x] = 1` 这种**行注释**会被当成
  // `--[[` 长注释的开头(跳过空格后恰好是 '['),一路吃到后面某个 ']]' 才收手,
  // 把整段代码掩掉(实测:官方包 lunar_xsg 的 -- ["@[xxx]"] 注释就这样误吞 694 字符)
  if (text[i] !== '[') return { ok: false, unterminated: false, end: i + 1 }
  let j = i + 1
  let eq = 0
  while (text[j] === '=') { eq++; j++ }
  if (text[j] !== '[') return { ok: false, unterminated: false, end: i + 1 }
  const close = ']' + '='.repeat(eq) + ']'
  const at = text.indexOf(close, j + 1)
  if (at < 0) return { ok: true, unterminated: true, end: text.length }
  return { ok: true, unterminated: false, end: at + close.length }
}

/** 读一个 '…' / "…" 单行字符串。Lua 单行串不跨行(遇换行=未闭合)。 */
export function readQuoted(text, i) {
  const q = text[i]
  let j = i + 1
  while (j < text.length) {
    const c = text[j]
    if (c === '\\') { j += 2; continue }
    if (c === '\n') return { end: j, unterminated: true }
    if (c === q) return { end: j + 1, unterminated: false }
    j++
  }
  return { end: text.length, unterminated: true }
}

/**
 * 从 i 起(含)跳过一个字符串或注释,返回其后下标;i 不是字符串/注释起点时返回 -1。
 * 未闭合的串/长注释直接跳到文本末尾(关心闭合情况请用 scanLua)。
 */
export function skipLuaToken(text, i) {
  const c = text[i]
  if (c === '-' && text[i + 1] === '-') {
    const lb = readLongBracket(text, i + 2)
    if (lb.ok) return lb.end // 长注释(未闭合时=文本末尾)
    let j = i + 2
    while (j < text.length && text[j] !== '\n') j++
    return j
  }
  if (c === "'" || c === '"') return readQuoted(text, i).end
  if (c === '[') {
    const lb = readLongBracket(text, i)
    if (lb.ok) return lb.end
  }
  return -1
}

/**
 * 线性词法扫描:字符串/注释区间 + 未闭合错误。
 * @returns {{ranges:Array<[number,number]>, errors:string[]}} ranges 为 [start,end) 区间
 */
export function scanLua(code) {
  const ranges = []
  const errors = []
  const lineOf = (i) => code.slice(0, i).split('\n').length
  let i = 0
  const n = code.length
  while (i < n) {
    const c = code[i]
    if (c === '-' && code[i + 1] === '-') {
      const start = i
      const lb = readLongBracket(code, i + 2)
      if (lb.ok) {
        if (lb.unterminated) errors.push(`第 ${lineOf(start)} 行的长注释 --[[ 没有闭合的 ]]`)
        ranges.push([start, lb.end])
        i = lb.end
        continue
      }
      let j = i + 2
      while (j < n && code[j] !== '\n') j++
      ranges.push([start, j])
      i = j
      continue
    }
    if (c === "'" || c === '"') {
      const r = readQuoted(code, i)
      if (r.unterminated) errors.push(`第 ${lineOf(i)} 行的字符串没有闭合的引号`)
      ranges.push([i, r.end])
      i = r.end
      continue
    }
    if (c === '[') {
      const lb = readLongBracket(code, i)
      if (lb.ok) {
        if (lb.unterminated) errors.push(`第 ${lineOf(i)} 行的长字符串 [[ 没有闭合的 ]]`)
        ranges.push([i, lb.end])
        i = lb.end
        continue
      }
    }
    i++
  }
  return { ranges, errors }
}

/** 字符串/注释区间掩码(区间内字符替换成空格,换行保留——行号不漂)。
 *  必须按 **UTF-16 码元**切分(code.split('')):区间下标是码元偏移,而 [...code]
 *  是按码点迭代——遇到 emoji(surrogate pair,如官方包的 "🐌🪨🥛🐉")会整体错位一格,
 *  后面全部文本被掩错(实测:lunar_devteam/init.lua 因此误报括号不配对)。 */
function maskRanges(code, ranges) {
  if (!ranges.length) return code
  const chars = code.split('')
  for (const [s, e] of ranges) {
    for (let i = s; i < e && i < chars.length; i++) if (chars[i] !== '\n') chars[i] = ' '
  }
  return chars.join('')
}

/** 区间命中判定(掩码用)。 */
export function rangeHits(ranges, index) {
  for (const [s, e] of ranges) if (index >= s && index < e) return true
  return false
}

export const CLOSER = { '{': '}', '(': ')', '[': ']' }

/** 字符串感知的配对:返回与 text[openIndex] 配对的收口下标,找不到返回 -1。
 *  Lua 里 {} 只用于表构造,比 JS 简单;保留旧版同名导出(内部语义已换成 Lua 词法)。 */
export function matchBrace(text, openIndex) { return matchPaired(text, openIndex, '{', '}') }

export function matchPaired(text, openIndex, open, close) {
  if (text[openIndex] !== open) return -1
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    const skip = skipLuaToken(text, i)
    if (skip > i) { i = skip - 1; continue }
    const c = text[i]
    if (c === open) depth++
    else if (c === close) { depth--; if (depth === 0) return i }
  }
  return -1
}

// ─────────────────────────── Lua 语法结构检查 ───────────────────────────

function lineNumberOf(masked, index) {
  let line = 1
  for (let i = 0; i < index && i < masked.length; i++) if (masked[i] === '\n') line++
  return line
}

/** 括号配对检查(入参须已掩掉字符串/注释)。 */
function checkBrackets(masked) {
  const stack = []
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i]
    if (c === '{' || c === '(' || c === '[') stack.push({ c, i })
    else if (c === '}' || c === ')' || c === ']') {
      const top = stack.pop()
      if (!top) return `第 ${lineNumberOf(masked, i)} 行有多余的 '${c}'`
      if (CLOSER[top.c] !== c) {
        return `第 ${lineNumberOf(masked, i)} 行的 '${c}' 与第 ${lineNumberOf(masked, top.i)} 行的 '${top.c}' 不配对`
      }
    }
  }
  if (stack.length) {
    const top = stack[stack.length - 1]
    return `第 ${lineNumberOf(masked, top.i)} 行的 '${top.c}' 没有配对的 '${CLOSER[top.c]}'`
  }
  return null
}

/** Lua 块关键字收口计数(function/if/for/while/do/repeat 与 end/until)。
 *  说明:单计数器不区分块种类,只做整体平衡——足以拦住"漏 end / 写入被截断",
 *  不做完整语法分析(那是 Lua 解释器的事)。`elseif`/`else`/`then` 不参与计数;
 *  for/while 之后的 do 不额外计数(pendingDo),裸 `do … end` 才计一块。 */
function checkKeywords(masked) {
  const re = /\b(?:function|if|elseif|else|for|while|do|repeat|until|end|then)\b/g
  let depth = 0
  let pendingDo = 0
  let extraAt = -1
  let m
  while ((m = re.exec(masked))) {
    const t = m[0]
    if (t === 'function' || t === 'if') depth++
    else if (t === 'for' || t === 'while') { depth++; pendingDo++ }
    else if (t === 'do') { if (pendingDo > 0) pendingDo--; else depth++ }
    else if (t === 'repeat') depth++
    else if (t === 'until') { depth--; if (depth < 0 && extraAt < 0) extraAt = m.index }
    else if (t === 'end') { depth--; if (depth < 0 && extraAt < 0) extraAt = m.index }
  }
  if (extraAt >= 0) return `第 ${lineNumberOf(masked, extraAt)} 行的 end/until 多余(块已经收口)`
  if (depth > 0) return `语法结构不完整:缺少 ${depth} 个 end(function/if/for/while/do 或 repeat 未收口)——写入被截断了?`
  return null
}

/**
 * Lua 结构检查(写入门禁):词法闭合 → 括号配对 → 块关键字收口。
 * 只拦"结构性错误"(截断、漏 end、括号不配对、未闭合引号),不做语义校验。
 * @returns {{ok:boolean, message?:string}}
 */
export function luaSyntaxCheck(code) {
  if (typeof code !== 'string' || code.trim().length === 0) return { ok: false, message: '代码为空' }
  const { ranges, errors } = scanLua(code)
  if (errors.length) return { ok: false, message: `语法错误: ${errors[0]}` }
  const masked = maskRanges(code, ranges)
  const bad = checkBrackets(masked)
  if (bad) return { ok: false, message: `语法错误: ${bad}` }
  const kw = checkKeywords(masked)
  if (kw) return { ok: false, message: `语法错误: ${kw}` }
  return { ok: true }
}

// ───────────────────────────── 行 / 语句边界 ─────────────────────────────

export function lineStartAt(code, i) { return code.lastIndexOf('\n', i - 1) + 1 }
