/**
 * xinyue-kit 新月杀(FreeKill / Lua)扩展包读写:所有对 <游戏根>/packages/** 的落盘都经过这里。
 *
 * 与无名杀(JS)版的差异(重要):
 *   根目录 extension/ → **packages/**;入口文件 extension.js → **init.lua**;
 *   一个技能一个文件(skills/<技能id>.lua),不再有一个塞下全部条目的巨型文件;
 *   不再生成 info.json(FreeKill 的可选包信息文件叫 metadata.lua,本工具只读不写);
 *   写入门禁 = validate.js 的全量规则校验(Lua 语法 + FreeKill 结构规则),拿不到
 *   validate.js 时退回 blocks.luaSyntaxCheck 的纯结构检查(见 ruleGate)。
 *
 * 路径安全:包名只允许安全字符,解析后必须仍在 packages/ 内(防路径逃逸);
 * 覆盖前自动备份到 <包>/backup/<名>.<时间戳>.lua(每目录保留最新 3 份)。
 */
import { copyFile, mkdir, readFile, readdir, writeFile, unlink, stat } from 'node:fs/promises'
import { join, resolve, basename, relative, sep, dirname } from 'node:path'
import {
  ENTRY_FILE, scanBlocks, extractBlock, assembleBlocks, checkFidelity,
  migrateCode, stripAnchors, virtualBlocks, virtualCharacterBlocks, translateEntries,
  collectLuaIds, countVirtualBlocks, luaSyntaxCheck,
} from './blocks.js'
import { loadEngineIndex } from './engine-api.js'
import { extRootOf, safeFolderPath, safeEntryFilePath, listPackageLuaFiles, listPackageJsFiles, isNonAsciiFolder, asciiFolderError, assertAsciiFolderForWrite, SKIP_DIRS } from './write/paths.js'
export { extRootOf, safeFolderPath, safeEntryFilePath, listPackageLuaFiles, listPackageJsFiles, isNonAsciiFolder, asciiFolderError, assertAsciiFolderForWrite } from './write/paths.js'


/** 多文件包扫描时跳过的目录(素材/备份/依赖,绝不会有可写条目)。 */

/* ── 备份落点(1.14.0 起)────────────────────────────────────────────
 * 旧行为:备份写在源文件旁边的 `<目录>/backup/`,好处是自包含,坏处是**往扩展包里
 * 塞产物**——实测一个改过几个武将的包会攒出十几个 backup/ 目录 + history.json,
 * 联机时核心包的 git 工作区因此变成 dirty(用户真实事故:「Workspace is dirty」)。
 * 新行为:备份统一放到包外的 <dshHome>/xinyue-kit/backups/<包>/<子目录>/,
 * 备份文件在**展示与回滚**时仍用旧的包内伪路径(`pkg/x/skills/backup/init.<ts>.lua`),
 * 这样历史面板、rollback 入参、老备份全部兼容;只有真实落点变了。 */
let backupRootDir = ''

/** 设置包外备份根(插件启动时调用)。空 = 退回旧的包内 backup/。 */
export function setBackupRoot(dir) {
  backupRootDir = dir ? resolve(dir) : ''
}

export function getBackupRoot() {
  return backupRootDir
}

/** 真实备份目录:包外在 backupRoot/<包>/<相对源文件目录>,包内是 <目录>/backup。 */
function backupDirOf(gameDir, folder, target) {
  if (!backupRootDir) return join(dirname(target), 'backup')
  const { full: folderFull } = safeFolderPath(gameDir, folder)
  const relDir = relative(folderFull, dirname(target))
  return relDir ? join(backupRootDir, folder, relDir) : join(backupRootDir, folder)
}

/** 备份文件的「展示路径」:仍是相对 gameDir 的 `<packages/包>/<子目录>/backup/<文件名>`,
 *  和 1.13 及更早完全一致(历史面板、日志、手动查文件都对得上)。 */
function pseudoBackupPath(gameDir, folder, target, name) {
  const relDir = relative(gameDir, dirname(target)).split(sep).join('/')
  return relDir + '/backup/' + name
}

/** 把展示用伪路径还原成真实备份文件路径(包外优先,兼容旧包内备份)。 */
function resolveBackupFile(gameDir, folder, pseudoRel) {
  const { full: folderFull } = safeFolderPath(gameDir, folder)
  const folderRel = relative(gameDir, folderFull).split(sep).join('/')
  let rel = String(pseudoRel).split('\\').join('/')
  if (rel.startsWith(folderRel + '/')) rel = rel.slice(folderRel.length + 1)
  const segs = rel.split('/')
  const idx = segs.lastIndexOf('backup')
  if (idx < 0 || idx === segs.length - 1) throw new Error('非法的备份路径。')
  const name = segs[idx + 1]
  if (!/^[\w.-]+\.lua$/.test(name)) throw new Error('非法的备份文件名。')
  const dirSegs = segs.slice(0, idx)
  if (dirSegs.some((x) => !/^[\w.-]+$/.test(x))) throw new Error('非法的备份路径。')
  const srcDir = join(folderFull, ...dirSegs)
  const external = backupRootDir ? join(backupRootDir, folder, ...dirSegs, name) : join(srcDir, 'backup', name)
  const internal = join(srcDir, 'backup', name)
  const target = join(srcDir, ...segs.slice(idx + 1).map((n) =>
    n.replace(/\.(?:pre-rollback\.)?\d{8}-\d{6}(?:-\d{6})?\.lua$/i, '.lua')))
  return { external, internal, target }
}


let lastStampSeq = 0
/* 备份名时间戳:精确到毫秒 + 进程内递增。此前只到秒——同一秒内连写两次
 * (AI 一轮里"写入→改一处→再写"很常见)备份名完全相同,后一次把前一次的
 * 备份直接覆盖掉,BACKUP_KEEP=3 名不副实、可回滚的历史只剩最后一次。 */
function timestamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  lastStampSeq = (lastStampSeq + 1) % 1000
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${ms}${String(lastStampSeq).padStart(3, '0')}`
}

/** 每个备份目录保留的最新备份数(超出按文件修改时间从旧到新删除)。 */
const BACKUP_KEEP = 3

/**
 * 备份滚动清理:backupDir 里只保留最新 BACKUP_KEEP 个 .lua 备份,其余删除。
 * 返回被删文件的相对路径(相对 gameDir,POSIX)——供调用方同步清理
 * history.backups 登记,避免登记指向已不存在的文件。
 */
async function pruneBackups(backupDir, relBase) {
  let names
  try { names = await readdir(backupDir) } catch { return [] }
  const stats = []
  for (const n of names) {
    if (!/\.lua$/i.test(n)) continue
    try { stats.push({ n, m: (await stat(join(backupDir, n))).mtimeMs }) } catch { /* 刚被并发删掉 */ }
  }
  stats.sort((a, b) => b.m - a.m)
  const removed = []
  for (const s of stats.slice(BACKUP_KEEP)) {
    try { await unlink(join(backupDir, s.n)); removed.push((relBase + '/' + s.n).replace(/\\/g, '/')) } catch { /* 已不存在 */ }
  }
  return removed
}

/** 备份文件清理后,同步清掉 history 里指向它们的登记(含「回滚自 x」类文案条目)。 */
async function pruneHistoryBackups(gameDir, folder, removedFiles) {
  if (!removedFiles.length) return
  try {
    const h = await import('./history.js') // 动态加载避免 write↔history 循环依赖
    await h.pruneBackupRecords(gameDir, folder, removedFiles)
  } catch { /* 登记清理失败不影响写入主流程 */ }
}

/** 滚动清理某个备份目录,并把被删文件的「展示伪路径」从 history 里抹掉。 */
async function pruneAndRecord(gameDir, folder, target, backupDir) {
  const removed = await pruneBackups(backupDir, '')
  if (!removed.length) return
  const names = removed.map((x) => x.replace(/^\//, ''))
  await pruneHistoryBackups(gameDir, folder, names.map((n) => pseudoBackupPath(gameDir, folder, target, n)))
}

/** collect all backup/ dirs inside the package (subdir modules each keep their own). */
async function collectBackupDirs(folderFull) {
  const dirs = []
  async function walk(dir) {
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue
      const child = join(dir, e.name)
      if (e.name === 'backup') { dirs.push(child); continue } // backup 内不再嵌套,不递归
      if (SKIP_DIRS.has(e.name)) continue
      await walk(child)
    }
  }
  await walk(folderFull)
  return dirs
}

/** 主动清理整个包的备份(工坊历史面板按钮):每目录保留最新 3 个,
 *  包外备份根与包内旧 backup/ 都清,并同步清除 history 里指向被删文件的登记。 */
export async function prunePackageBackups(gameDir, folder) {
  const { full } = safeFolderPath(gameDir, folder)
  try { await readdir(full) } catch { return { ok: false, error: '扩展包不存在。' } }
  let removedCount = 0
  let touchedDirs = 0
  const folderRel = relative(gameDir, full).split(sep).join('/')

  // 1) 包外备份根(mirror 目录结构,目录本身就装 .lua)
  if (backupRootDir) {
    const walkExt = async (dir, relDir) => {
      let entries = []
      try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
      if (entries.some((e) => e.isFile() && /\.lua$/i.test(e.name))) {
        const removed = await pruneBackups(dir, '')
        if (removed.length) {
          touchedDirs++
          removedCount += removed.length
          await pruneHistoryBackups(gameDir, folder, removed.map((x) => folderRel + '/' + (relDir ? relDir + '/' : '') + 'backup/' + x.replace(/^\//, '')))
        }
      }
      for (const e of entries) {
        if (e.isDirectory()) await walkExt(join(dir, e.name), relDir ? relDir + '/' + e.name : e.name)
      }
    }
    await walkExt(join(backupRootDir, folder), '')
  }

  // 2) 包内旧 backup/
  const dirs = await collectBackupDirs(full)
  for (const d of dirs) {
    const removed = await pruneBackups(d, '')
    if (!removed.length) continue
    touchedDirs++
    removedCount += removed.length
    const relDir = relative(full, dirname(d)).split(sep).join('/')
    await pruneHistoryBackups(gameDir, folder,
      removed.map((x) => folderRel + '/' + (relDir ? relDir + '/' : '') + 'backup/' + x.replace(/^\//, '')))
  }
  return { ok: true, removedCount, dirs: touchedDirs }
}

/** 技能文件所在目录的路径形态(与 validate.js 的探测规则保持一致:
 *  skills/ 与真实数据里常见的 peixiu_skills/、rule_skills/ 这类 <前缀>_skills/)。 */
const SKILL_PATH_RE = /(^|\/)(?:[\w-]+_)?skills?\//i

/** 剥掉 Lua 注释(块注释 --[[…]] / 行注释 --…),只用于种类的粗判:
 *  注释里写着的示例文字不该影响"这个文件是不是包入口"。 */
function stripLuaComments(code) {
  return String(code)
    .replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, ' ')
    .replace(/--[^\n]*/g, ' ')
}

/** 代码里是否存在"语句形态"的 `Package(...)` / `Package:new(...)`。
 *  两道限制:Package 前必须是词边界(否则 `function Package:addSkinPackage(`
 *  里的 `Package(` 尾巴会被当成构造)、Package 所在行之前不能出现引号
 *  (翻译表值里的 "Package()" 不算)。 */
function hasPackageCtor(code) {
  const s = stripLuaComments(code)
  return /(^|\n)[ \t]*[^\n"']*?\bPackage\s*[:.]\s*new\s*\(/.test(s) || /(^|\n)[ \t]*[^\n"']*?\bPackage\s*\(/.test(s)
}

/**
 * 写入门禁要显式传给 validate.js 的 kind(不依赖自动探测的兜底)。
 * 能判定的显式给:skills/ 形态 → 'skill';出现 Package 构造 → 'package'。
 * 判不定的不给(交回自动探测)。两处刻意的取舍:
 *  - init.lua 判定**先于** skills/:`pkg/skills/init.lua`、`<pkg>/skills/init.lua`
 *    是"把同目录技能 require 进来"的聚合壳,先判 skills/ 会把它当技能文件误报
 *    "缺少 fk.CreateSkill"(与 validate.js 的探测优先级保持一致);
 *  - 不写死「init.lua 一律 package」:官方包里有 45 个聚合壳 init.lua 只有
 *    require/dofile、不建 Package,强制 package 会让它们误报"缺少 Package:new"。
 */
function validateKindFor(file, code) {
  const p = String(file || '').replace(/\\/g, '/')
  if (/(^|\/)init\.lua$/i.test(p)) return hasPackageCtor(code) ? 'package' : undefined
  if (SKILL_PATH_RE.test(p)) return 'skill'
  if (hasPackageCtor(code)) return 'package'
  // 包内普通 Lua 模块(pkg/*.lua、lib/*.lua…):显式判成 module,别让自动探测兜成
  // package 后误报「缺少 Package:new」(实测:pkg/mjs_moshi_equip.lua 就这么被拒过)。
  return 'module'
}

/** 区块标识归一化:`skill:xxx` / `character:xxx` / `skill:xxx` 这类带种类前缀的写法
 *  在工具入参里很常见,但内部区块 id 是**裸 id**;统一剥掉前缀,避免"照抄报错文本"
 *  反而触发 `要删除的区块「translate:translate」不存在` 这种二次事故。 */
function normalizeBlockId(id) {
  const s = String(id == null ? '' : id)
  const m = /^(?:skill|card|character|translate|package)[:：](.+)$/.exec(s)
  return m ? m[1] : s
}

/** 抢救「整段代码被转义压成一行」的提交:真实换行 ≤2 个、却出现 ≥5 个字面量 \n
 *  (实测:技能文件被压成一行后报假语法错 `unexpected identifier 'Fk' near ':'`)。
 *  只在这种强特征下解码一次;换行正常的代码原样返回,不做任何改写。 */
function demangleEscapes(code) {
  if (typeof code !== 'string') return { code, fixed: false }
  if ((code.match(/\n/g) || []).length > 2) return { code, fixed: false }
  const literal = (code.match(/\\n/g) || []).length
  if (literal < 5) return { code, fixed: false }
  const und = code
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
  return { code: und, fixed: true }
}

/** errors 里最多回传几条(其余压成一条汇总,避免刷屏)。 */
const MAX_GATE_ERRORS = 8

/**
 * 写入门禁:调用 validate.js 做全量校验(Lua 语法 + FreeKill 结构规则),
 * 有 error 一律拒写。
 *
 * 动态 import 且包在 try/catch 里:validate.js 是另一个模块,导出名/加载路径变了
 * 也只让本次校验降级,不会把整个插件拖挂。拿不到校验器(或它自己抛异常)时,**必须**
 * 退回 blocks.luaSyntaxCheck 的结构检查——门禁绝不能因为依赖缺失而失效。
 *
 * 注意:不转发已废弃的 style 参数(传了只会多一条无关 warning)。
 * @returns {Promise<{ok:boolean, errors:Array<{message:string,line?:number}>, warnings:Array<{message:string}>}>}
 */
async function ruleGate(code, { folder, file, packageDir, idPrefix, gameDir, apiIndex }) {
  let validate = null
  let degraded = ''
  try {
    const mod = await import('./validate.js')
    if (mod && typeof mod.validateExtensionCode === 'function') validate = mod.validateExtensionCode
    else degraded = 'validate.js 没有导出 validateExtensionCode'
  } catch (error) {
    degraded = `无法加载 validate.js(${error && error.message ? error.message : error})`
  }
  if (validate) {
    try {
      const kind = validateKindFor(file, code)
      const index = apiIndex || (gameDir ? loadEngineIndex(gameDir) : null)
      const verdict = validate({
        code,
        folder,
        filePath: file,
        packageDir,
        idPrefix,
        ...(index ? { apiIndex: index } : {}),
        ...(kind ? { kind } : {}),
      })
      if (verdict && typeof verdict.ok === 'boolean') {
        return {
          ok: verdict.ok,
          errors: Array.isArray(verdict.errors) ? verdict.errors : [],
          warnings: Array.isArray(verdict.warnings) ? verdict.warnings : [],
        }
      }
      degraded = 'validate.js 返回了非预期的结果'
    } catch (error) {
      degraded = `validate.js 校验时抛异常(${error && error.message ? error.message : error})`
    }
  }
  const fallback = luaSyntaxCheck(code)
  if (!fallback.ok) return { ok: false, errors: [{ message: fallback.message }], warnings: [] }
  return { ok: true, errors: [], warnings: [{ message: `规则校验器不可用(${degraded}),本次只做了 Lua 结构检查(词法闭合/括号配对/end 与 until 收口)。` }] }
}

/** 区块锚点(`--#xinyue-kit-begin kind:id`)的正文快照,用于「这次动了哪些区块」。 */
function anchorBodies(code) {
  const out = new Map()
  const BEGIN = /^\s*--\s*#xinyue-kit-begin\s+(.+?)\s*$/
  const END = /^\s*--\s*#xinyue-kit-end\s+(.+?)\s*$/
  let cur = null
  let buf = []
  for (const l of String(code == null ? '' : code).split(/\r?\n/)) {
    const b = BEGIN.exec(l)
    if (b) { cur = b[1]; buf = []; continue }
    const e = END.exec(l)
    if (e && cur) { out.set(cur, buf.join('\n')); cur = null; continue }
    if (cur) buf.push(l)
  }
  return out
}

/**
 * 写入前的 diff 摘要(给 AI/用户一眼看清这次改了多少):增删行数(多重集口径,
 * 不做逐行对齐 —— 只是摘要,不是 patch)+ 内容变过的区块锚点。
 */
export function diffSummary(oldCode, newCode) {
  const lines = (c) => String(c == null ? '' : c).split(/\r?\n/)
  const A = lines(oldCode)
  const B = lines(newCode)
  const count = (ls) => { const m = new Map(); for (const l of ls) m.set(l, (m.get(l) || 0) + 1); return m }
  const ca = count(A)
  const cb = count(B)
  let removedLines = 0
  let addedLines = 0
  for (const [l, n] of ca) { const k = cb.get(l) || 0; if (n > k) removedLines += n - k }
  for (const [l, n] of cb) { const k = ca.get(l) || 0; if (n > k) addedLines += n - k }
  const ba = anchorBodies(oldCode)
  const bb = anchorBodies(newCode)
  const changedAnchors = []
  for (const k of new Set([...ba.keys(), ...bb.keys()])) {
    if ((ba.get(k) || '') !== (bb.get(k) || '')) changedAnchors.push(k)
  }
  return { addedLines, removedLines, changedAnchors, oldLines: A.length, newLines: B.length }
}

/**
 * 校验并写入扩展包文件。两种模式:
 * - 全文模式(默认):提交 code 全文;已有文件可带 editScope 做保真校验
 *   (范围外区块必须与旧文件逐字节一致,否则拒写)。新建 skills/<id>.lua 走这条路。
 * - 区块模式(提交 blocks/edits/deletes 之一即触发):只提交改动的区块,
 *   其余文本由工具从旧文件逐字节保留——未提交区域物理上不可能被改。
 * @returns 校验失败 → {ok:false, wrote:false, errors, warnings};成功 → {ok:true, wrote:true, path, backup};
 *          manual 模式 → {ok:true, wrote:false, code}
 */
export async function writeExtension(gameDir, { folder, file, code, blocks, edits, deletes, editScope, style, kind, infoJson, idPrefix, writeMode }) {
  // style / kind 是历史上无名杀版的入参,新月杀版一律按 filePath 判定种类(见 validateKindFor)
  void style; void kind
  // 非 ASCII 目录名一律拒写(引擎 require 不到 → 启动崩);放在 mkdir 之前,免得先建出坏目录
  const folderErr = asciiFolderError(folder)
  if (folderErr) return { ok: false, wrote: false, style: 'lua', errors: [{ message: folderErr }], warnings: [] }
  const blockMode = Array.isArray(blocks) || Array.isArray(edits) || Array.isArray(deletes)
  const full = safeFolderPath(gameDir, folder).full
  await mkdir(full, { recursive: true })
  const entryPath = safeEntryFilePath(gameDir, folder, file)
  const target = entryPath.full
  const warnings = []

  // 代码「被转义压成一行」的抢救(整段无真实换行却满是字面量 \n):自动解码一次并说明
  const dm = demangleEscapes(code)
  if (dm.fixed) {
    code = dm.code
    warnings.push({ message: '提交的代码像是被转义压成了一行(只有字面量 \\n、没有真实换行),已自动解码一次后继续;若结果不对,请用真实换行重新提交。' })
  }
  if (Array.isArray(blocks)) {
    let anyFixed = false
    blocks = blocks.map((b) => {
      const d = demangleEscapes(b && b.code)
      if (!d.fixed) return b
      anyFixed = true
      return { ...b, id: normalizeBlockId(b.id), code: d.code }
    })
    if (anyFixed) warnings.push({ message: '有区块的代码同样是被转义压成一行的,已自动解码后继续。' })
  }
  // deletes 故意不剥前缀:`kind:id` 要能区分同 id 的技能块与翻译块,
  // 裸 id 的解析与歧义保护都在 blocks.js 的 assembleBlocks 里做。

  // 旧文件:两种模式都先读(区块模式组装、全文模式保真/防丢都依赖它)
  let oldCode = null
  try { oldCode = await readFile(target, 'utf8') } catch { /* 首次写入,无旧文件 */ }
  await mkdir(dirname(target), { recursive: true })

  if (infoJson && String(infoJson).trim()) {
    warnings.push({ message: '新月杀(FreeKill)不用 info.json:包信息是可选的 metadata.lua,由包自己维护,工具不会生成或覆盖,该参数已忽略。' })
  }

  let finalCode = code
  if (blockMode) {
    const preErrors = []
    if (!oldCode) {
      preErrors.push(`区块模式用于已有文件:新文件(如新建 skills/<技能id>.lua)请用全文模式提交 code 参数。`)
    } else {
      const r = assembleBlocks(oldCode, blocks || [], edits || [], deletes || [])
      if (r.errors.length) preErrors.push(...r.errors)
      else { finalCode = r.code; warnings.push(...r.warnings.map((m) => ({ message: m }))) }
    }
    if (preErrors.length) {
      return { ok: false, wrote: false, style: 'lua', errors: preErrors.map((m) => ({ message: m })), warnings }
    }
  } else {
    if (typeof finalCode !== 'string' || !finalCode.trim()) {
      return { ok: false, wrote: false, style: 'lua', errors: [{ message: '缺少 code 参数(全文模式必须提交完整文件内容)。' }], warnings }
    }
    if (oldCode && Array.isArray(editScope)) {
      // 全文模式保真校验:范围外区块逐字节一致。
      // 未申报的改动**不再拒写**,而是自动并入申报范围并说明——真正防丢的是下面的
      // 「内部 ID 消失」护栏;这条硬拦除了白跑一轮,没有额外安全收益(实测)。
      const scope = [...new Set(editScope.map(normalizeBlockId))]
      const f = checkFidelity(oldCode, finalCode, scope)
      if (!f.ok) {
        const merged = [...new Set([...scope, ...f.changed])]
        const f2 = checkFidelity(oldCode, finalCode, merged)
        if (f2.ok) {
          warnings.push({ message: `提交内容改动了未申报的区块 [${f.changed.join(', ')}],已自动并入 editScope 后继续(不是错误)。` })
        } else {
          return {
            ok: false, wrote: false, style: 'lua',
            errors: f2.changed.map((id) => ({ message: `区块「${id}」与旧文件不一致,且无法通过并入 editScope 放行——请检查提交内容是否只改了你想改的部分。` })),
            warnings,
          }
        }
      }
    }
  }

  // 写入门禁:validate.js 全量校验(语法 + FreeKill 结构规则),有 error 直接拒写;
  // 拿不到 validate.js 时它内部会退回 blocks.luaSyntaxCheck 的结构检查。
  // packageDir 传**包根目录**(不是文件所在目录):validate.js 用它反推 packages/ 根,
  // 并顺带扫同级 skills/ 来核对 addSkills 引用。
  const gate = await ruleGate(finalCode, { folder, file: entryPath.rel, packageDir: full, idPrefix, gameDir })
  if (!gate.ok) {
    const errors = gate.errors.slice(0, MAX_GATE_ERRORS).map((e) => ({
      message: e && typeof e.message === 'string' ? e.message : String(e),
      ...(e && Number.isInteger(e.line) ? { line: e.line } : {}),
    }))
    if (gate.errors.length > MAX_GATE_ERRORS) {
      errors.push({ message: `……共 ${gate.errors.length} 条错误,只列出前 ${MAX_GATE_ERRORS} 条。` })
    }
    return { ok: false, wrote: false, style: 'lua', errors, warnings }
  }
  warnings.push(...gate.warnings)

  // 防丢护栏:旧代码里定义、新代码里消失的内部 ID → 拒写。
  // 比对前剥掉锚点注释行(锚点是纯注释,ID 语义不变)。
  // 区块模式下 deletes[] 声明的删除豁免;多技能逐个实现时这是安全网。
  if (oldCode) {
    const oldIds = collectLuaIds(stripAnchors(oldCode))
    const newIds = new Set(collectLuaIds(stripAnchors(finalCode)))
    const declared = new Set((deletes || []).map((k) => String(k).split(':')[1] || k))
    const lost = oldIds.filter((id) => !newIds.has(id) && !declared.has(id))
    if (lost.length > 0) {
      return {
        ok: false, wrote: false, style: 'lua',
        errors: [{ message: `检测到 ${lost.length} 个内部 ID 在新代码中消失: ${lost.join(', ')}——直接覆盖会丢失它们。若确要删除,请在需求中明确说明后再试;否则请把它们的定义补回新代码。` }],
        warnings,
      }
    }
  }

  // 手动复制模式:所有门禁过了之后,返回组装/校验后的代码,不落盘
  if (writeMode === 'manual') {
    const s = oldCode ? diffSummary(oldCode, finalCode) : null
    return { ok: true, wrote: false, style: 'lua', code: finalCode, errors: [], warnings, summary: s || undefined }
  }

  // 覆盖前备份(展示路径仍用包内伪路径 backup/x.lua,真实落点在包外备份根)
  let backup = ''
  if (oldCode) {
    const backupDir = backupDirOf(gameDir, folder, target)
    await mkdir(backupDir, { recursive: true })
    const backupName = `${basename(target, '.lua')}.${timestamp()}.lua`
    backup = pseudoBackupPath(gameDir, folder, target, backupName)
    await copyFile(target, join(backupDir, backupName))
    await pruneAndRecord(gameDir, folder, target, backupDir)
  }
  await writeFile(target, finalCode, 'utf8')

  // 写入后给 diff 摘要 + 回滚线索(备份路径就是历史面板与 rollbackExtension 的入参)
  const summary = oldCode ? diffSummary(oldCode, finalCode) : null
  if (summary && (summary.addedLines || summary.removedLines)) {
    warnings.push({
      message: `本次改动:+${summary.addedLines} / -${summary.removedLines} 行`
        + (summary.changedAnchors.length ? `,动着区块:${summary.changedAnchors.join(', ')}` : '')
        + (backup ? `;回滚用备份 ${backup}` : ''),
    })
  }

  // info.json 不再生成(FreeKill 没有这个文件);infoWritten 恒为 false,
  // 初值必须是 boolean 而非 null——output schema 里它就是 boolean
  const result = {
    ok: true, wrote: true, style: 'lua',
    path: relative(gameDir, target).split(sep).join('/'),
    infoWritten: false, errors: [], warnings,
  }
  // undefined 会让对象的 JSON 往返不保真(宿主层报 "value is not lossless JSON"),
  // 所以没有备份/摘要是「不写这个键」而不是写成 undefined。
  if (backup) result.backup = backup
  if (summary) result.summary = summary
  return result
}

/** 读包信息(可选文件 metadata.lua):只取 name/author/description/version 四个字符串字段,不做 Lua 求值。 */
async function readPackageMeta(full) {
  let code
  try { code = await readFile(join(full, 'metadata.lua'), 'utf8') } catch { return null }
  const out = {}
  for (const key of ['name', 'author', 'description', 'version']) {
    const m = new RegExp('\\b' + key + '\\s*=\\s*["\']([^"\']*)["\']').exec(code)
    if (m) out[key] = m[1]
  }
  return Object.keys(out).length ? out : null
}

/**
 * 读取扩展包内容。file 缺省 = init.lua。
 * - 默认:该文件全文整读(兼容)
 * - opts.listBlocks=true:未指定 file 时**聚合全包**(每块带 file 归属、顶层 files
 *   清单);指定 file 时只返回该文件的目录
 * - opts.block='kind:id':file 给定 → 只在该文件找;未给定 → 先 init.lua,
 *   再看 skills/<id>.lua 快速路径,最后按序扫全包,首个命中即返回(块带 file)
 */
export async function readExtension(gameDir, folder, opts = {}) {
  const { full } = safeFolderPath(gameDir, folder)
  const fileRel = opts.file == null || opts.file === '' ? ENTRY_FILE : String(opts.file).split('\\').join('/')
  const target = safeEntryFilePath(gameDir, folder, fileRel).full
  const names = await readdir(full)
  const result = { folder, file: fileRel, files: names.filter((n) => !n.startsWith('.')) }
  let code
  try { code = await readFile(target, 'utf8') } catch { /* 文件可能不存在 */ }
  if (opts.listBlocks) {
    if (opts.file == null || opts.file === '') {
      // 聚合全包:每个含条目的文件一段目录,块带 file 归属
      const files = await listPackageLuaFiles(gameDir, folder)
      const blocks = []
      const fileSummaries = []
      for (const f of files) {
        let c
        try { c = await readFile(join(full, f), 'utf8') } catch { continue }
        const sb = scanBlocks(c)
        if (!sb.blocks.length) continue
        fileSummaries.push({ file: f, anchored: sb.anchored, blocks: sb.blocks.length })
        for (const b of sb.blocks) blocks.push({ ...b, file: f })
      }
      result.blocks = { anchored: fileSummaries.some((f) => f.anchored), blocks, files: fileSummaries }
    } else {
      result.blocks = code !== undefined ? scanBlocks(code) : { anchored: false, blocks: [] }
    }
  } else if (opts.block) {
    const m = /^([\w]+):([^:\s]+)$/.exec(String(opts.block))
    if (!m) result.error = 'block 参数格式应为 kind:id,例如 skill:test_rende。'
    else {
      let fileMissing = false
      // 查找范围:指定 file → 只查该文件;未指定 → init.lua → skills/<id>.lua → 全包
      // (init.lua 里通常没有技能定义,不能因为它存在就停止查找)
      let tryFiles
      if (opts.file != null && opts.file !== '') tryFiles = [fileRel]
      else {
        const all = await listPackageLuaFiles(gameDir, folder)
        const fast = m[1] === 'skill' ? `skills/${m[2]}.lua` : null
        tryFiles = [fileRel]
        if (fast && all.includes(fast)) tryFiles.push(fast)
        tryFiles.push(...all.filter((f) => f !== fileRel && f !== fast))
      }
      for (const f of tryFiles) {
        let c
        try { c = await readFile(join(full, f), 'utf8') } catch { if (f === fileRel) fileMissing = true; continue }
        const text = extractBlock(c, m[1], m[2])
        if (text != null) { result.code = text; result.block = { kind: m[1], id: m[2], file: f }; break }
      }
      if (result.code === undefined) result.error = fileMissing ? `文件 ${fileRel} 不存在。` : `未找到区块「${opts.block}」(可用 listBlocks 查看目录)。`
    }
  } else if (code !== undefined) {
    result.code = code
  }
  const meta = await readPackageMeta(full)
  if (meta) result.info = meta
  return result
}

/**
 * 锚点化迁移(用户在工坊手动触发):对无锚文件插入 Lua 锚点注释行,一个代码字符不动;
 * 写前跑 Lua 结构检查(不过不落盘),通过后自动备份再写。
 * file 缺省 = init.lua;包内每层目录各自迁移。
 */
export async function migrateAnchors(gameDir, folder, file) {
  const target = safeEntryFilePath(gameDir, folder, file).full
  let oldCode
  try { oldCode = await readFile(target, 'utf8') } catch { return { ok: false, error: '该文件不存在。' } }
  const r = migrateCode(oldCode)
  if (r.error) return { ok: false, error: r.error }
  // 迁移只加注释行,自检用 Lua 结构检查即可
  const verdict = luaSyntaxCheck(r.code)
  if (!verdict.ok) return { ok: false, error: '迁移后结构检查失败(不应发生,已放弃写入): ' + (verdict.message || '未知') }
  const backupDir = backupDirOf(gameDir, folder, target)
  await mkdir(backupDir, { recursive: true })
  const backupName = `${basename(target, '.lua')}.${timestamp()}.lua`
  const backup = pseudoBackupPath(gameDir, folder, target, backupName)
  await copyFile(target, join(backupDir, backupName))
  await pruneAndRecord(gameDir, folder, target, backupDir)
  await writeFile(target, r.code, 'utf8')
  return { ok: true, inserted: r.inserted, commas: r.commas, blocks: r.blocks, backup }
}

/**
 * 多文件迁移:遍历包内全部 .lua,对「含可锚定条目」的文件逐个锚点化(幂等:
 * 已锚文件剥旧锚重打;无条目的壳文件/纯翻译数据文件自动跳过)。
 * 返回逐文件明细;全部失败才 ok:false。
 */
export async function migrateExtension(gameDir, folder) {
  const files = await listPackageLuaFiles(gameDir, folder)
  if (!files.length) return { ok: false, error: '扩展包里没有任何 .lua 文件。' }
  const results = []
  for (const file of files) {
    let code
    try { code = await readFile(safeEntryFilePath(gameDir, folder, file).full, 'utf8') } catch { continue }
    if (!countVirtualBlocks(code)) continue // 壳文件/无条目文件:跳过
    const r = await migrateAnchors(gameDir, folder, file)
    results.push({ file, ...r, entries: countVirtualBlocks(code) })
  }
  const done = results.filter((r) => r.ok)
  if (!done.length) {
    const firstErr = results.find((r) => r.error)
    return { ok: false, error: firstErr ? `迁移失败: ${firstErr.file} —— ${firstErr.error}` : '包内没有可锚定的条目(所有文件均为空或无法识别)。' }
  }
  return {
    ok: true,
    files: done.map((r) => ({ file: r.file, inserted: r.inserted, commas: r.commas, blocks: r.blocks, entries: r.entries, backup: r.backup })),
    filesSkipped: files.length - results.filter((r) => r.ok || r.error).length,
    failed: results.filter((r) => r.error).map((r) => ({ file: r.file, error: r.error })),
    totalFiles: done.length,
    totalInserted: done.reduce((n, r) => n + r.inserted, 0),
    totalCommas: done.reduce((n, r) => n + r.commas, 0),
    totalBlocks: done.reduce((n, r) => n + r.blocks, 0),
  }
}

/** 可删除的文件后缀:只允许包内的源码/文档类文件,绝不删素材(误删不可逆)。 */
const DELETABLE_RE = /\.(?:lua|md|txt|json)$/i

/**
 * 删除扩展包内的一个文件(只删文件、不删目录),删前先备份。
 * 用途:写入通道没有删文件能力时,误建的技能文件/废弃子包只能手删;
 * 而 pwsh 删 packages/ 会被沙箱拒绝。这里给工坊一条带备份的正规通道。
 * @returns {{ok:true, file:string, backup:string}|{ok:false, error:string}}
 */
export async function deletePackageFile(gameDir, folder, file) {
  const rel0 = String(file == null ? '' : file).split('\\').join('/')
  if (!DELETABLE_RE.test(rel0) || rel0.includes('..') || rel0.startsWith('/')) {
    return { ok: false, error: '只能删除包内的 .lua/.md/.txt/.json 文件(素材请勿删)。' }
  }
  const { full: folderFull } = safeFolderPath(gameDir, folder)
  const full = resolve(folderFull, rel0)
  if (!full.startsWith(folderFull + sep)) return { ok: false, error: '路径越界:目标不在包目录内。' }
  let st
  try { st = await stat(full) } catch { return { ok: false, error: `文件 ${rel0} 不存在。` } }
  if (!st.isFile()) return { ok: false, error: `${rel0} 不是文件(本工具不删目录)。` }
  let backup = ''
  try {
    const bdir = backupDirOf(gameDir, folder, full)
    await mkdir(bdir, { recursive: true })
    const bname = `${basename(full, '.lua')}.${timestamp()}.lua`
    backup = pseudoBackupPath(gameDir, folder, full, bname)
    await copyFile(full, join(bdir, bname))
    await pruneAndRecord(gameDir, folder, full, bdir)
  } catch (e) {
    return { ok: false, error: '备份失败,已拒绝删除(不允许无备份的删除): ' + (e?.message || e) }
  }
  await unlink(full)
  return { ok: true, file: rel0, backup }
}

/** 列出某扩展包的备份文件(新→旧)。包外备份根优先,同时兼容包内旧备份。 */
export async function listBackups(gameDir, folder) {
  const { full } = safeFolderPath(gameDir, folder)
  const folderRel = relative(gameDir, full).split(sep).join('/')
  const out = new Set()
  /* 1) 包外备份根(1.14.0 起):<backupRoot>/<包>/<子目录>/<文件>.<ts>.lua,
   *    对外仍用老的 gameDir 相对伪路径 `<packages/包>/<子目录>/backup/<文件>.<ts>.lua`。 */
  if (backupRootDir) {
    const walkExt = async (dir, relDir) => {
      let entries = []
      try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const abs = join(dir, e.name)
        if (e.isDirectory()) await walkExt(abs, relDir ? relDir + '/' + e.name : e.name)
        else if (e.isFile() && /\.lua$/i.test(e.name)) {
          out.add(folderRel + '/' + (relDir ? relDir + '/' : '') + 'backup/' + e.name)
        }
      }
    }
    await walkExt(join(backupRootDir, folder), '')
  }
  /* 2) 包内 backup/(旧版遗留,以及没设置备份根时的回落):递归,子目录各有自己的 backup/。 */
  const walk = async (dir, prefix) => {
    let entries = []
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const abs = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'backup') {
          try {
            for (const n of await readdir(abs)) {
              if (n.endsWith('.lua')) out.add(folderRel + '/' + (prefix ? prefix + '/' : '') + 'backup/' + n)
            }
          } catch { /* 忽略 */ }
        } else if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) {
          await walk(abs, prefix ? prefix + '/' + e.name : e.name)
        }
      }
    }
  }
  await walk(full, '')
  return [...out].sort().reverse()
}

/** 回滚:把指定备份覆盖回源文件。返回旧内容备份名。
 *  入参仍是包内伪路径(init.2026...lua / pkg/x/skills/backup/init.2026...lua),
 *  真实备份可能在包外备份根,也可能还在包内 backup/(旧版遗留)。 */
export async function rollbackExtension(gameDir, folder, backupName) {
  const rel0 = String(backupName || '').split('\\').join('/')
  if (rel0.includes('..') || rel0.startsWith('/') || !/\.lua$/.test(rel0)) {
    throw new Error('非法的备份文件名。')
  }
  // 单段名(init.<ts>.lua)= 包根备份,补上 backup/ 段统一处理
  const rel = rel0.includes('/') ? rel0 : 'backup/' + rel0
  const { external, internal, target } = resolveBackupFile(gameDir, folder, rel)
  let backupPath = external
  try {
    await readFile(backupPath, 'utf8')
  } catch {
    backupPath = internal
    await readFile(backupPath, 'utf8') // 仍不存在 → 抛错给调用方
  }
  // 回滚前把当前版本也备份一份,保证不丢
  try {
    await readFile(target, 'utf8')
    const bdir = backupDirOf(gameDir, folder, target)
    await mkdir(bdir, { recursive: true })
    const preName = `${basename(target, '.lua')}.pre-rollback.${timestamp()}.lua`
    await copyFile(target, join(bdir, preName))
    await pruneAndRecord(gameDir, folder, target, bdir)
  } catch { /* 当前不存在 */ }
  await copyFile(backupPath, target)
  return { folder, restored: backupName }
}

/** 尽力从翻译表提取条目显示名(工坊「编辑已有条目」下拉的括号注):
 *  新月杀的翻译键 `["test_rende"] = "给牌"`;带 `:`/`#`/`$`/`~`/`designer:` 前缀的
 *  是描述/台词/作者署名,不算显示名。提不到就不入表。 */
function extractDisplayNames(code) {
  const names = new Map()
  for (const e of translateEntries(code)) {
    if (!e.value) continue
    if (/^[:#$~]/.test(e.key)) continue
    if (/^(?:designer|illustrator|translator|cv|program|design)[:：]/.test(e.key)) continue
    if (!names.has(e.base)) names.set(e.base, e.value)
  }
  return names
}

/**
 * 列出扩展包内指定种类的全部条目(工坊「编辑已有武将/卡牌」的目标下拉)。
 * 聚合全包:技能来自 skills/*.lua 的 fk.CreateSkill{name=…},武将来自 General(pkg,"id",…),
 * 卡牌来自 fk.CreateCard{name=…};每项带 file 归属。显示名全包聚合
 * (技能名常在技能自己文件的翻译表里,武将名在 init.lua)。
 * 只读,不写任何文件。
 */
export async function listEntries(gameDir, folder, kind) {
  if (!['character', 'card', 'skill'].includes(kind)) {
    return { ok: false, kind, entries: [], error: 'kind 应为 character / card / skill。' }
  }
  const { full } = safeFolderPath(gameDir, folder)
  const files = await listPackageLuaFiles(gameDir, folder)
  if (!files.length) return { ok: false, kind, entries: [], error: '扩展包里没有任何 .lua 文件。' }
  const names = new Map()
  const codes = []
  for (const f of files) {
    let code
    try { code = await readFile(join(full, f), 'utf8') } catch { continue }
    codes.push({ f, code })
    for (const [id, name] of extractDisplayNames(code)) if (!names.has(id)) names.set(id, name)
  }
  const entries = []
  const seenIds = new Set()
  for (const { f, code } of codes) {
    for (const b of scanBlocks(code).blocks) {
      if (b.kind !== kind) continue
      if (seenIds.has(b.id)) continue // 跨文件同名:保留先见文件(init.lua 优先)
      seenIds.add(b.id)
      entries.push({ id: b.id, lines: b.lines, name: names.get(b.id) || '', file: f })
    }
  }
  if (!entries.length) {
    const hasInit = files.includes(ENTRY_FILE)
    return { ok: true, kind, entries, error: hasInit ? undefined : `该扩展包没有 ${ENTRY_FILE}。` }
  }
  return { ok: true, kind, entries }
}

/** 从武将条目源码提取 addSkills 里的技能 id(工坊「编辑已有武将」的技能勾选)。
 *  新月杀两种写法:`general:addSkills { "a", "b" }` 与 `addSkills("a", "b")`。
 *  都认不出就返回空数组。 */
function entrySkillIds(entryText) {
  const ids = []
  const push = (raw) => {
    for (const part of String(raw).split(',')) {
      const t = part.trim().replace(/^['"]|['"]$/g, '').trim()
      if (/^[\w\u4e00-\u9fff-]+$/.test(t)) ids.push(t)
    }
  }
  const re = /:?addSkills\s*(?:\(\s*)?\{([^}]*)\}|:?addSkills\s*\(([^)]*)\)/g
  let m
  while ((m = re.exec(entryText))) push(m[1] !== undefined ? m[1] : m[2])
  return [...new Set(ids)]
}

/** 列出某个条目(武将或卡牌——卡牌也可能带技能)的技能(勾选候选):
 * id + 翻译表显示名(尽力,全包聚合)。只读。 */
export async function listEntrySkills(gameDir, folder, entryId) {
  if (typeof entryId !== 'string' || !entryId.trim()) {
    return { ok: false, skills: [], error: '缺少条目 id。' }
  }
  const { full } = safeFolderPath(gameDir, folder)
  const files = await listPackageLuaFiles(gameDir, folder)
  let entry = null
  const names = new Map()
  for (const f of files) {
    let code
    try { code = await readFile(join(full, f), 'utf8') } catch { continue }
    for (const [id, name] of extractDisplayNames(code)) if (!names.has(id)) names.set(id, name)
    if (!entry) {
      entry = virtualBlocks(code, 'character').find((b) => b.id === entryId.trim())
        || virtualBlocks(code, 'card').find((b) => b.id === entryId.trim())
    }
  }
  if (!entry) return { ok: true, skills: [] }
  const skills = entrySkillIds(entry.text).map((id) => ({ id, name: names.get(id) || '' }))
  return { ok: true, skills }
}

/** 深度枚举目录下全部 .lua 绝对路径;目录不存在/读不了返回空。 */
async function listLuaDeepAbs(absDir) {
  const out = []
  let entries
  try { entries = await readdir(absDir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const child = join(absDir, e.name)
    if (e.isDirectory()) out.push(...await listLuaDeepAbs(child))
    else if (e.isFile() && /\.lua$/i.test(e.name)) out.push(child)
  }
  return out
}

/** 武将只可能定义在包根 *.lua(init.lua 等)或 pkg/ 里;skills/ 是技能、i18n/ 是翻译,
 *  不进这个清单(省读盘——官方全量包有上千个 lua 文件)。 */
async function listGeneralSourceFiles(pkgDir) {
  const out = []
  let entries
  try { entries = await readdir(pkgDir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const abs = join(pkgDir, e.name)
    if (e.isFile() && /\.lua$/i.test(e.name)) out.push(abs)
    else if (e.isDirectory() && (e.name === 'pkg' || e.name === 'generals' || e.name === 'general')) {
      out.push(...await listLuaDeepAbs(abs))
    }
  }
  return out.sort()
}

/**
 * 头像列表(工坊「人物标识」下拉数据源):直接扫游戏目录,不依赖游戏运行。
 * 新月杀 = <游戏根>/packages/<包名>/,武将来自 General(pkg, "id", …)(包根 *.lua 与 pkg 子目录),
 * 显示名从同一批文件里的翻译表聚合(官方包的英文名在 i18n/ 里,取不到只显示 id)。
 * 引擎内核包 freekill-core 跳过(只有技能与规则)。
 * 只读;全部包扫下来不便宜,调用方自行缓存。返回 [{id,name}],按中文名排序。
 */
export async function listAvatars(gameDir) {
  const ids = []
  const seen = new Set()
  const add = (id) => {
    if (id && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  const names = new Map()
  const rootDir = extRootOf(gameDir)
  let folders = []
  try {
    folders = (await readdir(rootDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)
  } catch { /* 没有 packages 目录:返回空表 */ }
  for (const folder of folders) {
    if (folder === 'freekill-core') continue
    for (const abs of await listGeneralSourceFiles(join(rootDir, folder))) {
      let code
      try { code = await readFile(abs, 'utf8') } catch { continue }
      for (const [id, name] of extractDisplayNames(code)) if (!names.has(id)) names.set(id, name)
      for (const b of virtualCharacterBlocks(code)) add(b.id)
    }
  }
  const list = ids.map((id) => ({ id, name: names.get(id) || '' }))
  list.sort((a, b) => {
    const an = a.name || a.id
    const bn = b.name || b.id
    try { return an.localeCompare(bn, 'zh-Hans-CN') } catch { return an < bn ? -1 : 1 }
  })
  return list
}
