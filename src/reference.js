/**
 * xinyue-kit 官方参考搜索:FreeKill(新月杀)Lua 源码检索。
 *
 * 思路与旧无名杀版一致,数据来源换成 Lua:
 * 1. 一次性建目录索引:扫描 `Fk:loadTranslationTable{ ... }` 里的
 *    `["id"] = "中文名"` 与 `[":id"] = "效果描述"`,得到 ID → 中文名/描述;
 *    同时记下「文件名(去 .lua) → 路径」——FreeKill 是「一技能一文件」
 *    (skills/<技能ID>.lua),文件名就是 ID,这一步让 ID 能直接定位到实现文件。
 * 2. 中文归一化匹配(全角→半角、小写、去空格),多关键词 AND;ID 精确匹配权重最高。
 * 3. 命中后按 **Lua 语法** 提取完整定义(-- 行注释、--[[ ]] 块注释、'' "" [[]] 字符串
 *    感知的括号配对):技能取 `fk.CreateSkill{...}` + 其后的 addEffect/addAuxSkill
 *    调用;武将取 `General(...)` / `General:new(...)` 调用 + 紧随的 addSkills{...}。
 * 4. 兜底:目录未命中时退回关键词全文评分;再用整句相似度(字符二元组包含率)。
 *
 * 内存策略(本机实测 packages/ + lua/ 下 8130 个 .lua 共 20.5MB):
 * 只常驻「文件路径 + 翻译目录」,源码文本按需惰性读取(带小 LRU),
 * 因此 8000+ 文件也不会把进程内存吃爆(建索引实测 <1s、常驻内存 ~60MB)。
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

/* 上限取值依据(本机 D:\无名杀\新月杀\FreeKill-v0.5.25\FreeKill-release 实测):
 * · lua/ + packages/ 下 .lua 共 8233 个 / 23.19MB;按搜索根收进来约 8100 个;
 *   MAX_FILES 取 12000,留 ~50% 余量防未来加包时截断(超限时按路径顺序截断)。
 * · 最大单文件 162KB(ltk/server/room.lua),MAX_FILE_BYTES 取 512KB,
 *   正常源码一个不漏,又能挡住意外的大文件(基座/生成物)。
 * · 目录最深 6 层(packages/ol/pkg/ol_gamemode/longbench/cards/skills/x.lua),
 *   MAX_DEPTH 取 8 留余量。 */
const MAX_FILE_BYTES = 512_000
const MAX_DEPTH = 8
const MAX_FILES = 12_000
const MAX_DEF_CHARS = 30_000
const MAX_DEF_LINES = 500
const CONTEXT_LINES = 10
const TEXT_CACHE_MAX = 64
const READ_BATCH = 64

/** 遍历时跳过的目录:素材/第三方 UI/工程垃圾,里面没有技能实现。 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.vscode', '.github', 'backup', 'dist',
  'image', 'images', 'audio', 'sound', 'font', 'fonts', 'qml', 'themes',
])

/**
 * 按类型给出搜索根(相对游戏根)。`*` 匹配一段,`**` 匹配任意多层;
 * 末段是 `.lua` 文件则按文件收,否则按目录递归收(自己在遍历里展开,不靠 shell glob)。
 */
function rootsFor(type) {
  // 技能实现:FreeKill 一技能一文件,skills/ 下最有参考价值;引擎核心兜底
  if (type === 'skill') return [
    'packages/*/skills',
    'packages/*/pkg/**/skills',
    'packages/*/aux_skills_dir',
    'packages/*/pkg/**/aux_skills_dir',
    'lua/core',
    'lua/lib',
  ]
  // 武将/Package 定义+翻译表:全在 init.lua 里
  if (type === 'general') return [
    'packages/*/init.lua',
    'packages/*/pkg/**/init.lua',
  ]
  // 引擎核心:触发时机、事件定义、API 实现
  if (type === 'engine') return ['lua/core', 'lua/lib']
  // any:整个 packages 树 + 引擎核心(卡牌 fk.CreateCard、玩法模式也在 packages 里)
  return ['packages', 'lua/core', 'lua/lib']
}

/** 段通配符转正则(`*` 不跨段)。 */
function wildcardRe(seg) {
  const body = seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/\\\\]*')
  return new RegExp('^' + body + '$')
}

/** 递归收目录下的 .lua。 */
async function collectFiles(root, depth, out) {
  if (depth > MAX_DEPTH || out.length > MAX_FILES) return
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    if (out.length > MAX_FILES) return
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      await collectFiles(full, depth + 1, out)
    } else if (entry.isFile() && entry.name.endsWith('.lua')) {
      out.push(full)
    }
  }
}

/** 展开带通配的搜索根。 */
async function expandPattern(cur, segs, i, depth, out) {
  if (depth > MAX_DEPTH || out.length > MAX_FILES) return
  if (i >= segs.length) { await collectFiles(cur, depth, out); return }
  const seg = segs[i]
  if (seg === '**') {
    await expandPattern(cur, segs, i + 1, depth, out)
    let entries
    try { entries = await readdir(cur, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue
      await expandPattern(join(cur, entry.name), segs, i, depth + 1, out)
    }
    return
  }
  const isLast = i === segs.length - 1
  if (!seg.includes('*')) {
    const next = join(cur, seg)
    if (isLast && seg.endsWith('.lua')) out.push(next)
    else await expandPattern(next, segs, i + 1, depth + 1, out)
    return
  }
  let entries
  try { entries = await readdir(cur, { withFileTypes: true }) } catch { return }
  const re = wildcardRe(seg)
  for (const entry of entries) {
    if (!re.test(entry.name) || SKIP_DIRS.has(entry.name)) continue
    if (isLast && seg.endsWith('.lua')) { if (entry.isFile()) out.push(join(cur, entry.name)) }
    else if (entry.isDirectory()) await expandPattern(join(cur, entry.name), segs, i + 1, depth + 1, out)
  }
}

/** 中文归一化:全角→半角、小写、去空白。 */
function normalize(str) {
  return String(str || '').toLowerCase()
    .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 65248))
    .replace(/\s+/g, '')
}

/** 行号计数器:一次扫描换行符位置,之后二分查找(O(n) 建、O(log n) 查)。 */
function makeLineCounter(text) {
  const nl = []
  let i = -1
  while ((i = text.indexOf('\n', i + 1)) >= 0) nl.push(i)
  return (idx) => {
    let lo = 0
    let hi = nl.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (nl[mid] < idx) lo = mid + 1
      else hi = mid
    }
    return lo + 1
  }
}

/** 长括号级别:`[[` / `[=[` → 等号个数;不是长括号返回 -1。 */
function longBracketLevel(text, i) {
  if (text[i] !== '[') return -1
  let j = i + 1
  while (text[j] === '=') j++
  return text[j] === '[' ? j - i - 1 : -1
}

/**
 * Lua 词法掩码:把注释与字符串的「内容」替换成空格(保留换行与原长度)。
 * 注释和字符串里的括号/引号因此不会干扰后续的括号配对与结构匹配。
 * 用「原样切片 + 空白段」拼接实现(不做 text.split(''),8000 个文件下快得多)。
 * @param {boolean} keepStrings - true 时保留字符串内容(只清注释),供键值对解析用。
 */
function maskLua(text, keepStrings) {
  const n = text.length
  const parts = []
  let last = 0
  const blank = (from, to) => {
    const f = Math.max(last, Math.min(n, from))
    const t = Math.max(f, Math.min(n, to))
    if (t <= f) return
    parts.push(text.slice(last, f), text.slice(f, t).replace(/[^\n]/g, ' '))
    last = t
  }
  let i = 0
  while (i < n) {
    const c = text[i]
    if (c === '-' && text[i + 1] === '-') {
      let j = i + 2
      const lvl = longBracketLevel(text, j)
      if (lvl >= 0) {
        // 长注释 --[[ ]] / --[==[ ]==]
        const close = ']' + '='.repeat(lvl) + ']'
        const end = text.indexOf(close, j + lvl + 2)
        const stop = end < 0 ? n : end + close.length
        blank(i, stop)
        i = stop
        continue
      }
      let end = text.indexOf('\n', j)
      if (end < 0) end = n
      blank(i, end)
      i = end
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n) {
        if (text[j] === '\\') { j += 2; continue }
        if (text[j] === c || text[j] === '\n') break
        j++
      }
      const stop = Math.min(n, j + 1)
      if (!keepStrings) blank(i + 1, stop)
      i = stop
      continue
    }
    if (c === '[') {
      const lvl = longBracketLevel(text, i)
      if (lvl >= 0) {
        const head = i + lvl + 2
        const close = ']' + '='.repeat(lvl) + ']'
        const end = text.indexOf(close, head)
        if (!keepStrings) blank(head, end < 0 ? n : end)
        i = end < 0 ? n : end + close.length
        continue
      }
    }
    i++
  }
  if (last < n) parts.push(text.slice(last))
  return parts.join('')
}

/** 在掩码文本上找与 openIdx 处开括号配对的闭括号下标;失败返回 -1。 */
function matchBracket(masked, openIdx) {
  const open = masked[openIdx]
  const close = open === '{' ? '}' : open === '(' ? ')' : open === '[' ? ']' : ''
  if (!close) return -1
  let depth = 0
  let i = openIdx
  const limit = masked.length
  for (; i < limit; i++) {
    const c = masked[i]
    if (c === open) depth++
    else if (c === close) { depth--; if (depth === 0) return i }
  }
  return -1
}

/** Lua 字符串字面量反转义(转义与中文标点原样保留)。 */
function unescapeLua(raw) {
  const s = String(raw || '')
  const longLvl = longBracketLevel(s, 0)
  if (longLvl >= 0) return s.slice(longLvl + 2, Math.max(longLvl + 2, s.length - longLvl - 2))
  const inner = s.slice(1, -1)
  return inner.replace(/\\(x[0-9a-fA-F]{2}|[0-9]{1,3}|.)/g, (_m, esc) => {
    if (esc[0] === 'x') return String.fromCharCode(parseInt(esc.slice(1), 16))
    if (/^[0-9]+$/.test(esc)) return String.fromCharCode(parseInt(esc, 10))
    const map = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v', '0': '\0' }
    if (esc === '\n') return '\n'
    return Object.prototype.hasOwnProperty.call(map, esc) ? map[esc] : esc
  })
}

const HAS_CN = /[\u4e00-\u9fff]/

/**
 * 记录一条翻译。约定(FreeKill):
 *   `["id"] = "中文名"`  → 技能/武将/卡牌显示名
 *   `[":id"] = "描述"`   → 技能效果描述(不是名字)
 *   `["#id"]` 称号、`["$id"]` 台词、`["~id"]` 阵亡台词、`["@@id"]` 标记名、`["designer:id"]` 等
 *   一律不进索引(与「中文名 → ID」的反查无关,反而会污染候选)。
 * 只用含中文的值:en_US/vi_VN 的翻译表也走同一个函数,不能让它们顶掉中文名
 * (test/init.lua 就先写中文再写 vi_VN,同一条 id 第二次就不会覆盖)。
 */
function putEntry(catalog, rawKey, value, relFile, line) {
  const key = String(rawKey || '')
  if (!key || !value || !HAS_CN.test(value)) return
  let id = key
  let kind = 'name'
  if (key[0] === ':') { id = key.slice(1); kind = 'info' }
  else if (key[0] === '#' || key[0] === '$' || key[0] === '~' || key[0] === '@') return
  else if (/^[A-Za-z_][\w-]*:/.test(key)) return // designer: / illustrator: / cv: 等
  if (!id) return
  let entry = catalog.get(id)
  if (!entry) {
    entry = { name: '', info: '', file: relFile, line }
    catalog.set(id, entry)
  }
  if (kind === 'info') {
    if (!entry.info) entry.info = value
  } else if (!entry.name) {
    entry.name = value
  }
  if (!entry.file) { entry.file = relFile; entry.line = line }
}

/** 保留内容的 Lua 字符串模式(单双引号短串 + [[ ]] 长串)。 */
const S_QUOTED = '(?:"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')'
const S_LONG = '\\[=*\\[[\\s\\S]*?\\]=*\\]'
const S_ANY = '(?:' + S_QUOTED + '|' + S_LONG + ')'
/** 键:`["xxx"]` 或 裸标识符 xxx。 */
const T_KEY = '(?:\\[\\s*(' + S_QUOTED + ')\\s*\\]|([A-Za-z_][\\w-]*))'
/** 值:一个字符串,或 `..` 串起来的多个字符串(技能描述常跨行拼接)。 */
const T_VALUE = '(' + S_ANY + '(?:\\s*\\.\\.\\s*' + S_ANY + ')*)'
const PAIR_RE = new RegExp(T_KEY + '\\s*=\\s*' + T_VALUE, 'g')
const STR_PART_RE = new RegExp(S_ANY, 'g')

/** 解析一段 loadTranslationTable 的表体(已清注释、保留字符串)。 */
function parseTranslationBody(body, line0, relFile, catalog) {
  const lineAt = (offset) => line0 + (body.slice(0, offset).split('\n').length - 1)
  PAIR_RE.lastIndex = 0
  let m
  while ((m = PAIR_RE.exec(body)) !== null) {
    const rawKey = m[1] !== undefined ? unescapeLua(m[1]) : (m[2] || '')
    const parts = m[3].match(STR_PART_RE)
    if (!parts) continue
    const value = parts.map(unescapeLua).join('')
    putEntry(catalog, rawKey, value, relFile, lineAt(m.index))
  }
}

/**
 * 扫描文件里的所有 `Fk:loadTranslationTable{ ... }` / `Fk:loadTranslationTable({ ... })`
 * 调用,把表体交给 parseTranslationBody。写法差异(空格、括号、换行)都在这里抹平。
 */
function extractTranslateEntries(text, relFile, catalog) {
  if (!text.includes('loadTranslationTable')) return   // 绝大多数文件没有翻译表,省下两次词法扫描
  const structural = maskLua(text, false)   // 注释+字符串都掩掉 → 只留结构,用于配对
  const commentless = maskLua(text, true)   // 只掩注释 → 值仍是原文,用于解析键值对
  const lineOf = makeLineCounter(text)
  const re = /loadTranslationTable\s*[({]/g
  let m
  while ((m = re.exec(structural)) !== null) {
    const openIdx = m.index + m[0].length - 1
    const closeIdx = matchBracket(structural, openIdx)
    const end = closeIdx < 0 ? text.length : closeIdx
    parseTranslationBody(commentless.slice(openIdx + 1, end), lineOf(openIdx), relFile, catalog)
    if (closeIdx < 0) break
    re.lastIndex = closeIdx
  }
}

/** 从 from 起,把属于同一技能变量的 `:addEffect(...)` / `:addAuxSkill{...}` 调用连成一段。 */
function extendSkillCalls(masked, from, varName) {
  if (!varName) return from
  let end = from
  const limit = Math.min(masked.length, from + 60_000)
  const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const callRe = new RegExp('\\s*' + esc + '\\s*:\\s*[A-Za-z_]\\w*\\s*[({]', 'g')
  for (;;) {
    callRe.lastIndex = end
    const m = callRe.exec(masked)
    if (!m || m.index > limit) break
    const open = m.index + m[0].length - 1
    const close = matchBracket(masked, open)
    if (close < 0 || close > limit) break
    end = close + 1
  }
  return end
}

/** 给一段源码加行号(与旧版输出格式一致,便于 AI 引用)。 */
function numberSnippet(text, startLine, relFile, note) {
  const clipped = text.length > MAX_DEF_CHARS
    ? text.slice(0, MAX_DEF_CHARS) + '\n…(过长截断)'
    : text
  const numbered = clipped.split('\n')
    .map((l, idx) => `${String(startLine + idx).padStart(5)} | ${l}`)
    .join('\n')
  return { file: relFile, line: startLine, snippet: note ? note + '\n' + numbered : numbered }
}

/**
 * 在 Lua 源码里提取某个 ID 的完整定义。
 * ① 一技能一文件(文件名去掉 .lua 就是 ID)→ 整个文件就是最完整的参考;
 * ② `fk.CreateSkill{ name = "id" }` 表构造 + 其后的 addEffect/addAuxSkill 调用;
 * ③ 武将:`General(...)` / `General:new(...)` 调用(参数里含 "id")+ 紧随的 addSkills{...};
 * 找不到返回 null,调用方退回「翻译表所在位置的行窗口」。
 */
function extractDefinition(text, relFile, id) {
  const base = basename(relFile).replace(/\.lua$/, '')
  const idEsc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const idQuoted = new RegExp('["\']' + idEsc + '["\']')
  // 任何定义都必然把 ID 写成字符串字面量;不匹配说明这个同名文件其实是别的技能
  // (FreeKill 里 skills/rende.lua 可能定义的是 mou__rende),直接放弃,让调用方换下一个候选文件
  if (!idQuoted.test(text)) return null
  const lines = text.split('\n')
  const structural = maskLua(text, false)
  const lineOf = makeLineCounter(text)

  // ① 技能定义表 `fk.CreateSkill{ name = "id" }` + 其后的 addEffect/addAuxSkill 调用
  const skillRe = /(?:fk|Fk)\s*\.\s*CreateSkill\s*[({]/g
  const nameHit = new RegExp('name\\s*=\\s*["\']' + idEsc + '["\']')
  let m
  while ((m = skillRe.exec(structural)) !== null) {
    const openIdx = m.index + m[0].length - 1
    const closeIdx = matchBracket(structural, openIdx)
    if (closeIdx < 0) continue
    if (!nameHit.test(text.slice(openIdx, closeIdx + 1))) continue
    // 变量名:`local xxx = fk.CreateSkill{...}` → 顺带收它后面的 addEffect 等调用
    const lineHead = text.slice(text.lastIndexOf('\n', m.index) + 1, m.index)
    const vm = /(?:local\s+)?([A-Za-z_]\w*)\s*=\s*$/.exec(lineHead)
    const end = extendSkillCalls(structural, closeIdx + 1, vm ? vm[1] : '')
    return numberSnippet(text.slice(m.index, end), lineOf(m.index), relFile)
  }

  // ② 武将定义 `General(...)` / `General:new(...)`(参数里含 "id")+ 紧随的 addSkills{...}
  const genRe = /General\s*(?::\s*new\s*)?\(/g
  while ((m = genRe.exec(structural)) !== null) {
    const openIdx = m.index + m[0].length - 1
    const closeIdx = matchBracket(structural, openIdx)
    if (closeIdx < 0) continue
    if (!idQuoted.test(text.slice(openIdx, closeIdx + 1))) continue
    let end = closeIdx + 1
    const lineHead = text.slice(text.lastIndexOf('\n', m.index) + 1, m.index)
    const vm = /(?:local\s+)?([A-Za-z_]\w*)\s*=\s*$/.exec(lineHead)
    const tail = structural.slice(end, end + 4000)
    const am = (vm
      ? new RegExp('\\b' + vm[1] + '\\s*:\\s*addSkills\\s*[({]')
      : /:\s*addSkills\s*[({]/).exec(tail)
    if (am) {
      const aopen = end + am.index + am[0].length - 1
      const aclose = matchBracket(structural, aopen)
      if (aclose > 0 && aclose - end <= 4000) end = aclose + 1
    }
    return numberSnippet(text.slice(m.index, end), lineOf(m.index), relFile)
  }

  // ③ 一技能一文件但没匹配到上面的结构(写法不常规)→ 整个文件就是最完整的参考
  if (base === id && lines.length <= MAX_DEF_LINES) {
    return numberSnippet(text, 1, relFile)
  }
  return null
}

const PUNCT_RE = /[\p{P}\p{S}\s]/gu
const STOP_CHARS = new Set('的一是了在和与就也都但被把将为对以从到于其这那之以及等后时可将会再且若则即又很更最非常应要需要能可以')

/** 相似度用清理:去标点/符号/空白,再去功能字。 */
function cleanForSimilarity(str) {
  return normalize(String(str || '').replace(PUNCT_RE, ''))
    .split('').filter((c) => !STOP_CHARS.has(c)).join('')
}

/** 字符二元组集合。 */
function bigramsOf(str) {
  const out = new Set()
  for (let i = 0; i < str.length - 1; i++) out.add(str.slice(i, i + 2))
  return out
}

/** 查询二元组在目标中的包含率(0~1)。 */
function containmentRatio(queryGrams, targetGrams) {
  if (queryGrams.size === 0) return 0
  let hit = 0
  for (const g of queryGrams) if (targetGrams.has(g)) hit++
  return hit / queryGrams.size
}

/** type 枚举:character 是旧无名杀说法,兼容为 general;card 已无独立语义(并入 any);
 *  doc 是**另一个数据源**(插件自带的《新月杀之书》官方文档),不是源码搜索范围;
 *  code 是 doc 的对偶——「只搜源码、范围不限」(any = 源码 + 文档,code = 源码)。 */
const TYPE_ALIAS = { skill: 'skill', general: 'general', character: 'general', engine: 'engine', card: 'any', code: 'code', doc: 'doc', any: 'any' }

/** 该文件是否属于该 type 的搜索根(用于按 type 过滤候选)。 */
function typeFilterOf(type) {
  const t = TYPE_ALIAS[type] || 'any'
  if (t === 'any' || t === 'doc' || t === 'code') return null
  if (t === 'engine') return (rel) => rel.startsWith('lua/core/') || rel.startsWith('lua/lib/')
  if (t === 'general') return (rel) => /(^|\/)init\.lua$/.test(rel)
  return (rel) => /(^|\/)aux_skills[^/]*\/[^/]+\.lua$/.test(rel)
    || /(^|\/)skills?\/[^/]+\.lua$/.test(rel)
    || rel.startsWith('lua/core/') || rel.startsWith('lua/lib/')
}

/**
 * 候选是否属于该 type。注意**不能只看翻译表所在文件**:很多官方包把技能名放在
 * `i18n/zh_CN.lua` 里(如 standard 的 rende),而实现是 `pkg/skills/rende.lua`。
 * 所以翻译表文件不匹配时,再按「文件名即 ID」反查到的实现文件判断。
 */
function entryTypeOk(index, id, entry, allowRel) {
  if (!allowRel) return true
  if (entry.file && allowRel(entry.file)) return true
  const files = index.byBase.get(id)
  return !!files && files.some(allowRel)
}

/** 惰性源码缓存:定义提取时按需读文件,只留最近 TEXT_CACHE_MAX 个。 */
const textCache = new Map()
async function readSource(path) {
  if (!path) return ''
  const hit = textCache.get(path)
  if (hit !== undefined) { textCache.delete(path); textCache.set(path, hit); return hit }
  let text = ''
  try {
    const info = await stat(path)
    if (info.size <= MAX_FILE_BYTES) text = await readFile(path, 'utf8')
  } catch { text = '' }
  textCache.set(path, text)
  if (textCache.size > TEXT_CACHE_MAX) textCache.delete(textCache.keys().next().value)
  return text
}

/** 进程级缓存:同一 DSH 进程内多次调用不重复扫描(首调约 1 秒)。 */
let cachedIndex = null

async function buildSearchIndex(xinyueDir) {
  const started = Date.now()
  const files = []
  const seen = new Set()
  for (const root of rootsFor('any')) {
    const out = []
    await expandPattern(xinyueDir, root.split('/'), 0, 0, out)
    for (const p of out) {
      const key = p.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      files.push(p)
    }
    if (files.length > MAX_FILES) break
  }
  const capped = files.slice(0, MAX_FILES)

  const byId = new Map()
  const byBase = new Map()   // 文件基名(去 .lua) → rel 列表:「一技能一文件」反查
  const byRel = new Map()    // rel → { path, rel }
  const loaded = []
  const ingest = (path, text) => {
    const rel = relative(xinyueDir, path).split('\\').join('/')
    const rec = { path, rel }
    loaded.push(rec)
    byRel.set(rel, rec)
    const base = basename(rel).replace(/\.lua$/, '')
    const arr = byBase.get(base)
    if (arr) arr.push(rel)
    else byBase.set(base, [rel])
    extractTranslateEntries(text, rel, byId)
  }
  // 分块并发读(顺序由 Promise.all 保持),8000 个文件的 I/O 不至于串行等
  for (let i = 0; i < capped.length; i += READ_BATCH) {
    const slice = capped.slice(i, i + READ_BATCH)
    const texts = await Promise.all(slice.map(async (path) => {
      try {
        const info = await stat(path)
        if (info.size > MAX_FILE_BYTES) return null
        return await readFile(path, 'utf8')
      } catch { return null }
    }))
    for (let k = 0; k < slice.length; k++) {
      if (texts[k] === null) continue
      ingest(slice[k], texts[k])
    }
  }
  // 既无中文名也无中文描述的条目(纯 en_US/vi_VN 表、UI 文案)对检索没价值,剪掉省内存
  for (const id of [...byId.keys()]) {
    const e = byId.get(id)
    if (!e.name && !e.info) byId.delete(id)
  }
  return { xinyueDir, byId, byBase, byRel, loaded, buildMs: Date.now() - started }
}

async function getIndex(xinyueDir) {
  if (cachedIndex && cachedIndex.xinyueDir === xinyueDir) return cachedIndex
  cachedIndex = await buildSearchIndex(xinyueDir)
  return cachedIndex
}

/**
 * ID → 候选实现文件(按可能性排序)。
 * 先按「文件名即 ID」(FreeKill 一技能一文件)找,再退回翻译表所在文件;
 * `packages/freekill-core/` 是引擎自带的另一份核心包副本,和顶层路径互为别名,
 * 同名时优先顶层那份(用户实际启用的是顶层包)。
 */
function codeFilesFor(index, id, entry) {
  const out = []
  const push = (rel) => { if (rel && !out.includes(rel)) out.push(rel) }
  for (const rel of index.byBase.get(id) || []) push(rel)
  if (entry && entry.file) push(entry.file)
  for (const rel of [...out]) {
    if (rel.includes('/freekill-core/')) push(rel.replace('/freekill-core/', '/'))
    else if (rel.startsWith('packages/')) push(rel.replace(/^packages\//, 'packages/freekill-core/'))
  }
  return out
    .filter((rel) => index.byRel.has(rel))
    .sort((a, b) => (a.includes('/freekill-core/') ? 1 : 0) - (b.includes('/freekill-core/') ? 1 : 0))
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 第二个数据源:插件自带的官方文档《新月杀之书》(for-creators,rST 原格式)
 *
 * 与源码源的区别(决定了检索方式必须不同):
 * · 源码是「按 ID/中文名找定义」,候选是定义体,命中后给完整代码块;
 * · 文档是「按关键词/中文描述找说明」,候选是**小节**,标题命中权重最高,
 *   条目体积比源码条目大得多,所以命中后应当用 readDoc 取该节全文而不是片段。
 * · 文档是**插件自带数据**(随包发布),路径一律相对插件根:`fkbook/rule/03-event.rst`,
 *   绝不出现 D:\... 这类绝对路径;不依赖用户配置的游戏目录。
 * · 规模实测:72 个文本文件(.rst 66 + .lua 6)/ 290KB,一次性读进内存即可,
 *   不像 8000 个 Lua 源码那样需要惰性读取 + LRU。
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 文档根:plugin/knowledge/fkbook/。 */
const DOC_ROOT = fileURLToPath(new URL('../knowledge/fkbook/', import.meta.url))
/** 对外 file 字段的前缀:标明「插件自带文档」并保持相对插件根。 */
const DOC_PREFIX = 'fkbook/'
const DOC_MAX_FILE_BYTES = 512_000
const DOC_MAX_FILES = 2_000
/** 每节开头截多长做 snippet(命中后应改用 readDoc 取全文)。 */
const DOC_SNIPPET_CHARS = 240
/** 单节全文上限:最长一节(16-extension.rst 整文件级别)< 24KB,60K 字符足够且能挡住误读整个目录。 */
const DOC_MAX_TEXT_CHARS = 60_000

/**
 * rST 标题识别:标题下一行是**同一标点重复 ≥2 次**的下划线。
 * 层级按 rST/Sphinx 的标准规则——**该标点在本文件内首次出现的顺序**:
 * 先出现的层级浅(`=`→1、`-`→2、`~`→3、`+`→4 …)。这不依赖某个写死的字符表,
 * 因为不同文档用 `+`/`^` 表示第几层并不统一(实测 rule/02-skel.rst 用 `+` 作第 3 层,
 * new-to-lua/18-list.rst 用 `+` 作第 4 层),按文件各自首次出现顺序才不会错位。
 * 下划线允许比标题长(常见),但比标题短 2 字符以上时视为普通文本/分隔线,
 * 避免把正文里的一行 `---` 误判成标题。
 */
const RST_UNDERLINE_RE = /^([=\-~^"'`#*+.:_])\1{1,}$/

/** 文档小节 id 里的 slug:只把空白折成 `-`、避开 `#`(id 用 `#` 分隔文件与小节)。 */
function docSlug(title) {
  return String(title || '').trim().replace(/\s+/g, '-').replace(/#/g, '＃')
}

/** 小节正文开头一段(原样 rST,只折行),给 snippet 用。 */
function docSnippetOf(body) {
  const flat = String(body || '').replace(/\r/g, '').split('\n')
    .map((l) => l.trim()).filter(Boolean).join('\n')
  return flat.length > DOC_SNIPPET_CHARS ? flat.slice(0, DOC_SNIPPET_CHARS) + ' …' : flat
}

/** 造一条文档小节记录(带检索用的归一化副本)。 */
function makeDocSection({ file, line, endLine, level, title, path, text, body }) {
  const bodyText = body === undefined ? '' : body
  return {
    file, line, endLine, level, title, path,
    chars: String(text || '').length,
    text: String(text || ''),
    snippet: docSnippetOf(bodyText),
    _titleNorm: normalize(title),
    _pathNorm: normalize((path || []).join(' ')),
    _textNorm: normalize(text),
    _bodyHead: bodyText.slice(0, 400),
  }
}

/**
 * 把一个 .rst 文件切成小节条目。`line` 是标题行(1-based,不含下划线),
 * `endLine` 是独占结束行;`path` 是**祖先章节路径**(不含自身)。
 * 没有任何标题的文件(纯指令/纯正文)退化成「整个文件一节」,按文件名起题。
 */
function parseRstSections(text, fileRel, relPath) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n')
  const levelOf = new Map()
  const heads = []
  for (let i = 1; i < lines.length; i++) {
    const under = lines[i]
    if (under.length < 2) continue
    const m = RST_UNDERLINE_RE.exec(under)
    if (!m) continue
    const title = lines[i - 1].trim()
    if (!title) continue
    if (title.length > under.length + 2) continue
    if (RST_UNDERLINE_RE.test(title)) continue
    if (title.startsWith('..')) continue          // rST 指令(.. code-block:: 等)
    const ch = m[1]
    if (!levelOf.has(ch)) levelOf.set(ch, levelOf.size + 1)
    const level = levelOf.get(ch)
    heads.push({ line: i - 1, level, title })
  }
  if (heads.length === 0) {
    return [makeDocSection({
      file: fileRel,
      line: 1,
      endLine: lines.length + 1,
      level: 1,
      title: basename(fileRel).replace(/\.rst$/, ''),
      path: relPath.split('/').slice(0, -1),
      text,
      body: text,
    })]
  }
  const out = []
  const stack = []
  for (let h = 0; h < heads.length; h++) {
    const head = heads[h]
    while (stack.length && stack[stack.length - 1].level >= head.level) stack.pop()
    stack.push(head)
    let endEx = lines.length
    for (let k = h + 1; k < heads.length; k++) {
      if (heads[k].level <= head.level) { endEx = heads[k].line; break }
    }
    out.push(makeDocSection({
      file: fileRel,
      line: head.line + 1,
      endLine: endEx + 1,
      level: head.level,
      title: head.title,
      path: stack.slice(0, -1).map((s) => s.title),
      text: lines.slice(head.line, endEx).join('\n'),
      body: lines.slice(head.line + 2, endEx).join('\n'),
    }))
  }
  return out
}

/** .lua 文档(示例扩展/教学脚本):整文件一节,按文件名起题,目录段作章节路径。 */
function parseLuaDoc(text, fileRel, relPath) {
  return [makeDocSection({
    file: fileRel,
    line: 1,
    endLine: String(text || '').split('\n').length + 1,
    level: 1,
    title: basename(fileRel).replace(/\.lua$/, ''),
    path: relPath.split('/').slice(0, -1),
    text,
    body: text,
  })]
}

/** 进程级缓存:文档只有 290KB,建一次常驻。 */
let cachedDocIndex = null

async function buildDocIndex() {
  const started = Date.now()
  const files = []
  const walk = async (dir, depth) => {
    if (depth > MAX_DEPTH || files.length >= DOC_MAX_FILES) return
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (files.length >= DOC_MAX_FILES) return
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        await walk(full, depth + 1)
      } else if (entry.isFile() && (entry.name.endsWith('.rst') || entry.name.endsWith('.lua'))) {
        files.push(full)
      }
    }
  }
  await walk(DOC_ROOT, 0)
  files.sort()

  const sections = []
  const ids = new Set()
  let bytes = 0
  let scanned = 0
  for (const path of files) {
    let text = ''
    try {
      const info = await stat(path)
      if (info.size > DOC_MAX_FILE_BYTES) continue
      text = await readFile(path, 'utf8')
      bytes += info.size
      scanned++
    } catch { continue }
    const rel = relative(DOC_ROOT, path).split('\\').join('/')
    const fileRel = DOC_PREFIX + rel
    const parsed = path.endsWith('.rst')
      ? parseRstSections(text, fileRel, rel)
      : parseLuaDoc(text, fileRel, rel)
    for (const s of parsed) {
      // id 稳定且唯一:`<相对插件根的文件>#<小节标题>`,同文件同名小节加序号
      const base = s.file + '#' + docSlug(s.title)
      let id = base
      let n = 2
      while (ids.has(id)) id = base + '-' + (n++)
      ids.add(id)
      s.id = id
      sections.push(s)
    }
  }
  return { root: DOC_ROOT, files: scanned, bytes, sections, buildMs: Date.now() - started }
}

async function getDocIndex() {
  if (!cachedDocIndex) cachedDocIndex = await buildDocIndex()
  return cachedDocIndex
}

/** 子串出现次数(关键词打分用),不做正则,避免用户输入里的元字符。 */
function countOccurrences(hay, needle) {
  if (!needle) return 0
  let n = 0
  let i = hay.indexOf(needle)
  while (i >= 0) {
    n++
    if (n >= 30) break
    i = hay.indexOf(needle, i + needle.length)
  }
  return n
}

/**
 * 文档小节打分:关键词必须**全部命中**(AND),标题命中权重远高于正文。
 * 这是文档侧与源码侧最不一样的地方——用户是拿「触发时机」「事件栈」这类
 * 章节词来找说明的,标题命中就该排在最前。
 */
function docScoreFor(section, keywords, raw) {
  for (const k of keywords) {
    if (!section._textNorm.includes(k)) return -1
  }
  let score = 0
  for (const k of keywords) {
    if (section._titleNorm === k) score += 120
    else if (section._titleNorm.includes(k)) score += 70
    if (section._pathNorm.includes(k)) score += 25
    score += Math.min(countOccurrences(section._textNorm, k), 6) * 4
  }
  // 整句查询词干全落在标题里 → 强信号
  if (keywords.length > 1 && keywords.every((k) => section._titleNorm.includes(k))) score += 40
  // 标题就是查询原文(去掉空格/标点后相等)→ 最强信号
  if (cleanForSimilarity(raw) && cleanForSimilarity(section.title) === cleanForSimilarity(raw)) score += 60
  return score
}

/** 一条文档命中转成对外 match(source='doc',name=小节标题,info=章节路径)。 */
function docMatch(section, score, simRatio) {
  const pathText = section.path.length ? section.path.join(' / ') : '(顶层)'
  return {
    id: section.id,
    name: section.title,
    info: `${pathText} · ${section.file}:${section.line}`,
    score: simRatio === undefined ? score : simRatio,
    file: section.file,
    line: section.line,
    snippet: section.snippet
      || '(该节只有标题,无正文)',
    source: 'doc',
    _rank: simRatio === undefined ? Math.min(score / 200, 1) : simRatio,
  }
}

/** 文档检索:标题/章节路径/正文三路评分 + 二元组相似度兜底。 */
async function searchDocMatches({ raw, keywords, maxMatches }) {
  const index = await getDocIndex()
  const scored = []
  const seen = new Set()
  for (const s of index.sections) {
    const sc = docScoreFor(s, keywords, raw)
    if (sc < 0) continue
    scored.push({ s, score: sc })
  }
  scored.sort((a, b) => b.score - a.score)
  const matches = []
  for (const hit of scored) {
    if (matches.length >= maxMatches) break
    if (seen.has(hit.s.id)) continue
    seen.add(hit.s.id)
    matches.push(docMatch(hit.s, hit.score))
  }

  // 相似度兜底:整句描述(「摸牌后可以弃置一张牌」这类)靠关键词 AND 命中不了时,
  // 用与源码侧同一套 cleanForSimilarity/字符二元组包含率,阈值同为 50%。
  let truncated = 0
  const qClean = cleanForSimilarity(raw)
  const qGrams = bigramsOf(qClean)
  if (qGrams.size >= 3) {
    const sims = []
    for (const s of index.sections) {
      if (seen.has(s.id)) continue
      const grams = bigramsOf(cleanForSimilarity(s.title + ' ' + s.path.join(' ') + ' ' + s._bodyHead))
      const ratio = containmentRatio(qGrams, grams)
      if (ratio >= 0.5) sims.push({ s, ratio })
    }
    sims.sort((a, b) => b.ratio - a.ratio)
    for (const hit of sims) {
      if (matches.length >= maxMatches) { truncated++; continue }
      seen.add(hit.s.id)
      matches.push(docMatch(hit.s, 0, Math.round(hit.ratio * 100) / 100))
    }
  }
  return { matches, truncated, scanned: index.files }
}

/** 合并两个来源的结果:按内部归一化相关度排序,并保证两种 source 都能露头。 */
function mergeBySource(codeMatches, docMatches, maxMatches) {
  const all = [...codeMatches, ...docMatches]
  all.sort((a, b) => (b._rank || 0) - (a._rank || 0))
  const out = all.slice(0, maxMatches)
  if (maxMatches >= 2 && codeMatches.length && docMatches.length) {
    const need = []
    if (!out.some((m) => m.source === 'code')) need.push(codeMatches[0])
    if (!out.some((m) => m.source === 'doc')) need.push(docMatches[0])
    for (const m of need) {
      if (out.includes(m)) continue
      while (out.length >= maxMatches) out.pop()
      out.push(m)
    }
  }
  return out
}

/** 文档路径归一化:接受 fkbook/、knowledge/fkbook/、for-creators/ 前缀与裸相对路径。 */
function normalizeDocPath(raw) {
  let p = String(raw || '').trim().replace(/\\/g, '/').replace(/^\.\//, '')
  if (p.startsWith('doc:')) p = p.slice(4).trim()
  p = p.replace(/^\/+/, '')
  for (const prefix of ['knowledge/fkbook/', 'for-creators/', 'fkbook/']) {
    if (p.toLowerCase().startsWith(prefix)) { p = p.slice(prefix.length); break }
  }
  return DOC_PREFIX + p.replace(/^\/+/, '')
}

/**
 * 《新月之书》章节地图。数据是插件自带的 outline.json(fkbook/OUTLINE.md 的机器可读版),
 * 由 build-fkbook 阶段一并维护:八大部分 → 章节(file/title/keys)+ 按任务查表 + 已核实要点。
 * 工具 xinyue_doc_index 直接返回它,让模型"先挑章、再读原文"。
 * @returns {Promise<{ok:boolean,source?:string,files?:number,parts?:Array,taskRoutes?:Array,verifiedNotes?:string[],error?:string}>}
 */
export async function docOutline() {
  const file = fileURLToPath(new URL('../knowledge/fkbook/outline.json', import.meta.url))
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    return { ok: false, error: `章节地图缺失(${file}):${error.message}` }
  }
  let data
  try {
    data = JSON.parse(raw)
  } catch (error) {
    return { ok: false, error: `章节地图 JSON 解析失败:${error.message}` }
  }
  const parts = (Array.isArray(data.parts) ? data.parts : []).map((part) => ({
    id: String(part.id || ''),
    title: String(part.title || ''),
    intro: String(part.intro || ''),
    chapters: (Array.isArray(part.chapters) ? part.chapters : []).map((chapter) => ({
      id: 'fkbook/' + String(chapter.file || ''),
      title: String(chapter.title || ''),
      keys: Array.isArray(chapter.keys) ? chapter.keys.map(String) : [],
    })),
  }))
  return {
    ok: true,
    source: String(data.source || ''),
    files: Number(data.files || 0),
    parts,
    taskRoutes: Array.isArray(data.taskRoutes) ? data.taskRoutes : [],
    verifiedNotes: Array.isArray(data.verifiedNotes) ? data.verifiedNotes.map(String) : [],
  }
}

/**
 * 读回某个文档小节的**原样 rST 全文**(不转 markdown、不重写正文)。
 * 定位方式(任选):
 *   · id:`fkbook/rule/03-event.rst#事件与时机`(可带 `doc:` 前缀,前缀可省)
 *   · file + section:file='fkbook/rule/03-event.rst',section='事件与时机'
 *   · 只给 file → 返回整个文件
 * @param {string} idOrPath
 * @param {string} [sectionTitle]
 * @returns {Promise<{ok:boolean,id?:string,title?:string,path?:string[],file?:string,line?:number,endLine?:number,chars?:number,text?:string,source?:'doc',truncated?:string,error?:string}>}
 */
export async function readDoc(idOrPath, sectionTitle) {
  const index = await getDocIndex()
  let raw = String(idOrPath || '').trim()
  let section = sectionTitle === undefined || sectionTitle === null ? '' : String(sectionTitle).trim()
  if (raw.startsWith('doc:')) raw = raw.slice(4).trim()
  const hash = raw.indexOf('#')
  if (hash >= 0) {
    if (!section) {
      // 标题里可能带裸 `%`(如「造成 50% 伤害」),decodeURIComponent 会抛 URIError —— 只在解得动时用
      const frag = raw.slice(hash + 1).trim()
      try { section = decodeURIComponent(frag) } catch { section = frag }
    }
    raw = raw.slice(0, hash)
  }
  if (!raw) {
    return { ok: false, error: 'id/file 不能为空:传 id(如 fkbook/rule/03-event.rst#事件与时机)或 file=fkbook/rule/03-event.rst。' }
  }
  const fileRel = normalizeDocPath(raw)
  let pool = index.sections.filter((s) => s.file === fileRel)
  if (pool.length === 0) {
    // 容错:允许只给文件名后缀(03-event.rst / rule/03-event.rst)
    const tail = fileRel.slice(DOC_PREFIX.length)
    pool = index.sections.filter((s) => s.file === DOC_PREFIX + tail
      || s.file.endsWith('/' + tail) || s.file.endsWith('/' + basename(tail)))
  }
  if (pool.length === 0) {
    return {
      ok: false,
      error: `文档里没有 ${fileRel}。可先用 xinyue_search_reference(type='doc') 搜关键词拿到 id,再按 id 读取。`,
    }
  }
  const readWholeFile = async (title, pathArr) => {
    let text = ''
    try { text = await readFile(join(DOC_ROOT, fileRel.slice(DOC_PREFIX.length)), 'utf8') } catch { text = pool.map((s) => s.text).join('\n\n') }
    text = text.replace(/\r\n/g, '\n')
    const clipped = text.length > DOC_MAX_TEXT_CHARS
    const result = {
      ok: true,
      id: pool[0].file,
      title,
      path: pathArr,
      file: fileRel,
      line: 1,
      endLine: text.split('\n').length + 1,
      chars: text.length,
      text: clipped ? text.slice(0, DOC_MAX_TEXT_CHARS) : text,
      source: 'doc',
    }
    if (clipped) result.truncated = `该文件 ${text.length} 字符,已截断到 ${DOC_MAX_TEXT_CHARS};请给 section 参数读单节。`
    return result
  }
  if (!section) {
    const top = pool.find((s) => s.level === 1) || pool[0]
    return readWholeFile(top.title, top.path)
  }
  const secNorm = normalize(section)
  const slug = docSlug(section)
  const hit = pool.find((s) => s.title === section)
    || pool.find((s) => normalize(s.title) === secNorm)
    || pool.find((s) => s.id.endsWith('#' + slug))
    || pool.find((s) => normalize(s.title).includes(secNorm))
    || pool.find((s) => normalize(s.title + ' ' + s.path.join(' ')).includes(secNorm))
  if (!hit) {
    return {
      ok: false,
      file: fileRel,
      error: `文件 ${fileRel} 里没有题为「${section}」的小节。该文件的小节:${pool.map((s) => s.title).join(' / ')}`,
    }
  }
  const clipped = hit.text.length > DOC_MAX_TEXT_CHARS
  const result = {
    ok: true,
    id: hit.id,
    title: hit.title,
    path: hit.path,
    file: hit.file,
    line: hit.line,
    endLine: hit.endLine,
    chars: hit.chars,
    text: clipped ? hit.text.slice(0, DOC_MAX_TEXT_CHARS) : hit.text,
    source: 'doc',
  }
  if (clipped) result.truncated = `该节 ${hit.text.length} 字符,已截断到 ${DOC_MAX_TEXT_CHARS}。`
  return result
}

/**
 * 搜索官方实现与官方文档。
 *
 * 源码检索 = 目录索引 + 中文匹配 + Lua 定义提取(见下方 searchCodeMatches);
 * 文档检索 = 小节标题/章节路径/正文三路关键词评分 + 相似度兜底(见 searchDocMatches)。
 * `type='any'`(默认)同时搜两边,结果按相关度合并且保证两种 source 都能出现;
 * `type='doc'` 只搜《新月杀之书》,不依赖游戏目录是否配置。
 *
 * @param {string} xinyueDir - 游戏本体目录(FreeKill 根目录);type='doc' 时可省。
 * @param {object} input
 * @param {string} input.query - 中文名(仁德)、技能 ID(test_rende)、章节词(触发时机)、
 *   或空格分隔多关键词("摸牌 discard")。
 * @param {'any'|'skill'|'general'|'engine'|'doc'} [input.type] - 也可传旧值 character/card。
 * @param {number} [input.limit]
 */
export async function searchReference(xinyueDir, { query, type = 'any', limit = 5 } = {}) {
  const raw = String(query || '').trim()
  if (!raw) {
    return { ok: false, error: 'query 不能为空:支持中文名(仁德)、技能 ID(test_rende)、章节词(触发时机)、或空格分隔的多关键词(摸牌 discard)。' }
  }
  const resolvedType = TYPE_ALIAS[type] || 'any'
  const wantCode = resolvedType !== 'doc'
  const wantDoc = resolvedType === 'doc' || resolvedType === 'any'
  if (wantCode && !xinyueDir) {
    // 报错必须给 AI 指明出路,否则它会退回 bash 自己找 —— 实测会从系统根目录开始
    // 全盘检索,用户等几分钟都没结果(issue #1)
    return { ok: false, error: '未配置游戏本体目录(FreeKill 根目录),xinyue_search_reference 无法搜索。请让用户在工坊「⚙ 设置」页配置游戏本体目录;配置之前不要用 bash 在磁盘/系统目录里检索源码——那会全盘扫描,耗时极长。(官方文档检索 type=\'doc\' 不受此限制。)' }
  }
  const keywords = raw.split(/\s+/).map(normalize).filter(Boolean)
  const maxMatches = Math.max(1, Math.min(limit, 10))

  let codeRes = { matches: [], simHitsTruncated: 0, scanned: 0 }
  if (wantCode) {
    const index = await getIndex(xinyueDir)
    codeRes = await searchCodeMatches(index, { raw, type: resolvedType, keywords, maxMatches })
  }
  let docRes = { matches: [], truncated: 0, scanned: 0 }
  if (wantDoc) {
    docRes = await searchDocMatches({ raw, keywords, maxMatches })
  }

  let matches
  if (wantCode && wantDoc) {
    matches = mergeBySource(codeRes.matches, docRes.matches, maxMatches)
  } else {
    matches = (wantCode ? codeRes.matches : docRes.matches).slice(0, maxMatches)
  }

  const scanned = codeRes.scanned + docRes.scanned
  const result = { ok: matches.length > 0, matches, scanned, query: raw }
  const truncParts = []
  if (codeRes.simHitsTruncated > 0) {
    truncParts.push(`${codeRes.simHitsTruncated} 条源码相似度结果因 limit=${maxMatches} 被截断——收窄关键词,或传更大的 limit(上限 10)。`)
  }
  if (docRes.truncated > 0) {
    truncParts.push(`${docRes.truncated} 条文档小节因 limit=${maxMatches} 被截断——收窄关键词,或传更大的 limit(上限 10)。`)
  }
  if (truncParts.length) result.truncated = truncParts.join(' ')
  if (matches.length === 0) {
    result.error = '未命中:可尝试——①中文技能名(仁德);②技能 ID(test_rende);③空格分隔的效果关键词(摸牌 discard);④整句效果描述(相似度≥50% 才列出);⑤type=\'doc\' 搜官方文档的章节词(触发时机)。'
  }
  // _rank 是合并排序用的内部字段,不能混进对外结果(无损 JSON / schema 都要求干净)
  for (const m of matches) delete m._rank
  return result
}

/** 供验证脚本读取文档索引规模(不属于 index.js 的调用契约)。 */
export async function _docStats() {
  const index = await getDocIndex()
  return { files: index.files, sections: index.sections.length, bytes: index.bytes, buildMs: index.buildMs }
}

/** index.json 生成用:文档索引的公开字段快照(不含检索用的归一化副本)。 */
export async function _docIndexSnapshot() {
  const index = await getDocIndex()
  return {
    files: index.files,
    bytes: index.bytes,
    sections: index.sections.map((s) => ({
      id: s.id, file: s.file, line: s.line, endLine: s.endLine,
      level: s.level, title: s.title, path: s.path, chars: s.chars,
    })),
  }
}

/** 源码检索主体(原 searchReference 逻辑,未改判定)。 */
async function searchCodeMatches(index, { raw, type, keywords, maxMatches }) {
  const allowRel = typeFilterOf(type)
  const matches = []
  let simHitsTruncated = 0

  // ── 阶段 1:目录索引命中(中文名/描述/ID)→ 提取完整定义块 ──
  const candidates = []
  for (const [id, entry] of index.byId) {
    if (!entryTypeOk(index, id, entry, allowRel)) continue
    const name = normalize(entry.name)
    const info = normalize(entry.info)
    const hay = normalize(id) + ' ' + name + ' ' + info
    const hitAll = keywords.length > 0 && keywords.every((k) => hay.includes(k))
    const idExact = keywords.length === 1 && normalize(id) === keywords[0]
    if (!hitAll && !idExact) continue
    let score = idExact ? 100 : 0
    for (const k of keywords) {
      if (name === k) score += 60
      else if (name.includes(k)) score += 10
      if (info.includes(k)) score += 2
    }
    // 有 `[":id"]` 描述的才是真技能;带 %arg 之类的多半是 ask/prompt 提示文案,降权
    if (entry.info) score += 8
    if (/%\w/.test(entry.name)) score -= 10
    candidates.push({ id, entry, score })
  }
  candidates.sort((a, b) => b.score - a.score)

  const seen = new Set()
  for (const cand of candidates) {
    if (matches.length >= maxMatches) break
    if (seen.has(cand.id)) continue
    let def = null
    for (const rel of codeFilesFor(index, cand.id, cand.entry)) {
      const f = index.byRel.get(rel)
      if (!f) continue
      const text = await readSource(f.path)
      if (!text) continue
      def = extractDefinition(text, rel, cand.id)
      if (def) break
    }
    if (!def) {
      // 定义提取失败:退回翻译表记录处的行窗口(至少给出 ID 与中文名的位置与上下文)
      const fe = index.byRel.get(cand.entry.file)
      const text = fe ? await readSource(fe.path) : ''
      if (!text) continue
      const lines = text.split('\n')
      const s = Math.max(0, cand.entry.line - 3)
      def = {
        file: cand.entry.file,
        line: cand.entry.line,
        snippet: lines.slice(s, Math.min(lines.length, cand.entry.line + 8))
          .map((l, i) => `${String(s + i + 1).padStart(5)} | ${l}`).join('\n') + '\n…(定义块提取失败,仅显示翻译表位置)',
      }
    }
    seen.add(cand.id)
    matches.push({
      id: cand.id,
      name: cand.entry.name,
      info: (cand.entry.info || '').slice(0, 200),
      file: def.file,
      line: def.line,
      snippet: def.snippet,
      source: 'code',
      _rank: Math.min(Math.max(cand.score, 0) / 200, 1),
    })
  }

  // ── 阶段 2:目录未命中时,退回全文关键词评分(惰性读文件,读完即弃,不占常驻内存) ──
  if (matches.length === 0) {
    const scored = []
    for (const file of index.loaded) {
      if (allowRel && !allowRel(file.rel)) continue
      const text = await readSource(file.path)
      if (!text) continue
      const lower = text.toLowerCase()
      let score = 0
      let allHit = true
      for (const token of keywords) {
        const t = token.toLowerCase()
        const count = lower.split(t).length - 1
        if (count === 0) allHit = false
        score += Math.min(count, 30)
      }
      if (score === 0 || (keywords.length > 1 && !allHit && score < keywords.length * 5)) continue
      scored.push({ file, score })
      if (scored.length >= maxMatches * 8) break
    }
    scored.sort((a, b) => b.score - a.score)
    for (const { file } of scored.slice(0, maxMatches)) {
      const text = await readSource(file.path)
      const lower = text.toLowerCase()
      let bestIndex = -1
      for (const token of keywords) {
        const idx = lower.indexOf(token.toLowerCase())
        if (idx >= 0 && (bestIndex === -1 || idx < bestIndex)) bestIndex = idx
      }
      if (bestIndex < 0) continue
      const line = makeLineCounter(text)(bestIndex)
      const lines = text.split('\n')
      const snippet = lines.slice(Math.max(0, line - 5), Math.min(lines.length, line + CONTEXT_LINES))
        .map((l, i) => `${String(Math.max(0, line - 5) + i + 1).padStart(5)} | ${l}`).join('\n')
      matches.push({ id: '', name: '', info: '', file: file.rel, line, snippet, source: 'code', _rank: 0.3 })
      if (matches.length >= maxMatches) break
    }
  }

  // ── 阶段 3:描述相似度匹配(≥50% 全部列出,按相似度降序,与已有结果去重) ──
  // ID 精确命中说明用户已经找到目标,再列一堆"相似"的技能只会淹掉结果,直接跳过
  const exactIdHit = matches.some((m) => m.id && keywords.includes(normalize(m.id)))
  const qClean = cleanForSimilarity(raw)
  const qGrams = bigramsOf(qClean)
  if (qGrams.size >= 3 && !exactIdHit) {
    const existIds = new Set(matches.map((m) => m.id).filter(Boolean))
    const simHits = []
    for (const [id, entry] of index.byId) {
      if (!entryTypeOk(index, id, entry, allowRel)) continue
      if (!entry.name && !entry.info) continue
      if (existIds.has(id)) continue
      // 不缓存 _grams:目录条目上万,缓存二元组集合反而比源码文本更吃内存,
      // 相似度阶段只在整句查询时走一次,现算更划算(描述只取前 300 字)。
      const grams = bigramsOf(cleanForSimilarity(entry.name + ' ' + String(entry.info || '').slice(0, 300)))
      const ratio = containmentRatio(qGrams, grams)
      if (ratio >= 0.5) simHits.push({ id, entry, ratio })
    }
    simHits.sort((a, b) => b.ratio - a.ratio)
    /* 按 limit 截断:相似度阶段此前整段列出(实测 limit:1 仍回 6 条、整句查询可能
     * 回几百行紧凑结果 → 撑爆上下文)。精确命中(前两阶段)优先占额度,
     * 这里补满到 limit 为止;确实被截掉时在结果里说清楚,便于 AI 收窄查询。 */
    const room = Math.max(0, maxMatches - matches.length)
    let simHitsFinal = simHits
    if (room > 0) {
      simHitsTruncated = Math.max(0, simHits.length - room)
      simHitsFinal = simHits.slice(0, room)
    } else {
      simHitsTruncated = simHits.length
      simHitsFinal = []
    }
    for (const hit of simHitsFinal) {
      const score = Math.round(hit.ratio * 100) / 100
      const info = (hit.entry.info || '(索引中无描述)').replace(/<[^>]+>/g, '')
      matches.push({
        id: hit.id, name: hit.entry.name,
        info: info.slice(0, 400),
        score,
        file: hit.entry.file, line: hit.entry.line,
        snippet: `相似度 ${Math.round(score * 100)}% · ID: ${hit.id} · 名称: ${hit.entry.name || '-'} · ${hit.entry.file}:${hit.entry.line}
  描述: ${info.slice(0, 160)}
  (对该 ID 再搜一次可获取完整定义)`,
        source: 'code',
        _rank: hit.ratio,
      })
    }
  }

  return { matches, simHitsTruncated, scanned: index.loaded.length }
}

// 供验证脚本读取索引规模(不属于 index.js 的调用契约)
export async function _indexStats(xinyueDir) {
  const index = await getIndex(xinyueDir)
  return { files: index.loaded.length, entries: index.byId.size, bases: index.byBase.size, buildMs: index.buildMs }
}
