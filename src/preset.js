/**
 * 「新月杀开发模式」preset 的自检与安装。
 *
 * 为什么需要:preset 是插件行为的第二份手抄,装在 ~/.dsh/.agent-presets/xinyue-dev/,
 * 里面有 persona 正文、residentTools 工具名白名单、skills/SKILL.md 的参数文档。
 * 它和插件代码之间没有任何引用关系 —— install-preset.mjs 复制完就冻结了,插件
 * 运行时也不读它。所以代码更新后若没重装 preset,新会话会拿到自相矛盾的指令
 * (工具名对不上 → 工具在会话里静默消失;参数文档对不上 → AI 写出的调用被校验
 * 挡下),而且不报错。历史上已经踩过一次(noname_complete_task 改名残留 8 处)。
 *
 * 曾想用目录链接让漂移不可能发生,实测否决:DSH 的 preset discovery 用
 * readdir(withFileTypes).isDirectory() 判定(packages/preset/agent-presets/
 * src/discovery.ts:303),而 node 22 与 node 24 对 junction / symlink 都报
 * Dirent.isSymbolicLink()=true、isDirectory()=false(本机 win32 + node v24.21.0 复测)
 * —— 链接进去的 preset 会在界面上凭空消失(悬空链接同样静默消失,连报错都没有)。
 * 所以只能走「复制 + 盖章(内容哈希)+ 比对 + 一键重装」。
 */
import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export const PRESET_ID = 'xinyue-dev'
/** 盖章文件:记下"这份 preset 是什么时候装的、装进去的内容哈希是多少"。
 *  刻意不存版本号 —— 判定依据是内容不是版本(preset 不按版本管理)。 */
export const PRESET_MANIFEST = '.xinyue-kit-install.json'

const COMPOSITION_FILE = 'agent.cordis.yml'

/**
 * 宿主是否提供声明式 preset 机制(存在 @deepseek-ai/dsh-agent-preset 包)。
 *
 * DSH 0.1.7 起 preset 改为 profile YAML 声明(bundle patch 里的
 * @deepseek-ai/dsh-agent-preset 行随插件自动生效,见 cordis.patch.yml),
 * 目录式安装/哈希比对/重装全部不再需要;0.1.6 及以下仍走目录式。
 * 探测"机制是否存在"而非比较版本号:prerelease 与正式版都不用维护清单,
 * 宿主解析 peer 依赖时自然能找到(或找不到)这个包。
 */
export function hostHasDeclarativePreset() {
  try {
    createRequire(import.meta.url).resolve('@deepseek-ai/dsh-agent-preset/package.json')
    return true
  } catch {
    return false
  }
}

/**
 * DSH 家目录:优先 $DSH_HOME,否则 ~/.dsh。
 * 与 DSH 自身 home-paths 的优先级一致 —— 插件运行时有 ctx.dshHomePath() 可用,
 * 但 scripts/install-preset.mjs 是独立进程,必须自己按同一规则解析,否则在
 * DSH_HOME 隔离的测试环境里会把 preset 装进真实家目录。
 */
export function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME
  if (fromEnv && fromEnv.trim()) return resolve(fromEnv.trim())
  return join(homedir(), '.dsh')
}

/** 用户家目录里的 preset 安装位置。 */
export function presetDirOf(dshHome) {
  return join(dshHome, '.agent-presets', PRESET_ID)
}

/** 插件包内自带的 preset 源目录(唯一真源)。 */
export function bundledPresetDir() {
  return fileURLToPath(new URL('../presets/xinyue-dev/', import.meta.url))
}

function collectFiles(dir, prefix, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    // 跳过点开头的条目:既排除 OS 垃圾(.DS_Store),也排除本模块自己写的盖章文件
    // —— 否则"写入盖章"这个动作本身就会改变哈希,自检永远报过期。
    if (entry.name.startsWith('.')) continue
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = join(dir, entry.name)
    if (entry.isDirectory()) collectFiles(full, rel, out)
    else if (entry.isFile()) out.push({ rel, full })
  }
  return out
}

/**
 * 目录内容哈希:按相对路径排序后逐个把「路径 + 内容」喂给 sha256。
 * 与文件系统返回顺序、绝对路径、时间戳无关,只反映内容;目录不存在返回 null。
 * 行尾统一成 LF 再哈希:同一个文件在 Windows 上检出(git autocrlf 会转 CRLF)和
 * 打包产物里可能行尾不同(实测 pnpm 装 git 依赖时 clone+checkout 就转了 CRLF),
 * 但行为完全一样 —— 不归一化就会把"完全相同的两份"误报成不一致。
 */
export function hashDir(dir) {
  if (!existsSync(dir)) return null
  const files = collectFiles(dir, '', []).sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file.rel)
    hash.update('\0')
    hash.update(readFileSync(file.full, 'utf8').replace(/\r\n/g, '\n'))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function readManifest(presetDir) {
  try {
    return JSON.parse(readFileSync(join(presetDir, PRESET_MANIFEST), 'utf8'))
  } catch {
    return null
  }
}

/**
 * 自检已安装的 preset 与插件自带那份是否一致。
 * state: 'ok' 一致 / 'stale' 不一致 / 'missing' 没装 / 'unknown' 插件自带的源读不到(打包异常)。
 * 判定纯看内容哈希:比的是"正在运行的这个插件自己带的那份",所以同一个版本的用户
 * 永远是自洽的(装的是这版自带的,插件里也是这版)→ 只有"插件更新了而 preset 没重装"
 * 或"本地那份被改过"才会报不一致。界面只陈述哈希不同这个事实,不推断是哪种原因。
 */
export function presetStatus({ presetDir, bundledDir }) {
  // 先看插件自带那份是否完整:源不完整属打包异常,不能报成"你该重装"
  // ——否则用户点重装还会再失败一次,两步都困惑。
  const bundledHash = hashDir(bundledDir)
  if (!bundledHash || !existsSync(join(bundledDir, COMPOSITION_FILE))) {
    return { state: 'unknown', error: `插件自带的 preset 源不完整(缺 ${COMPOSITION_FILE}):${bundledDir}` }
  }
  if (!existsSync(presetDir)) {
    return { state: 'missing', bundledHash, installedHash: null, installedAt: null }
  }
  const manifest = readManifest(presetDir)
  const installedHash = hashDir(presetDir)
  return {
    state: installedHash === bundledHash ? 'ok' : 'stale',
    bundledHash,
    installedHash,
    installedAt: manifest?.installedAt ?? null,
  }
}

/** preset 备份滚动清理:只保留最新 3 个 .bak-<时间戳>(与扩展包 backup/ 的
 * 滚动清理同哲学——备份内容都源自插件仓库,git 历史里可溯源,堆多了只是垃圾)。
 * 只匹配 <presetDir>.bak-* 前缀,不碰兄弟 preset 与任何其他文件;
 * 清理失败不影响重装本身。 */
function prunePresetBackups(presetDir) {
  const PREFIX_KEEP = 3
  try {
    const dir = dirname(presetDir)
    const prefix = `${basename(presetDir)}.bak-`
    const baks = readdirSync(dir).filter((n) => n.startsWith(prefix)).sort()
    // 名字尾部是毫秒时间戳(等宽),字典序即时间序;留最新的 PREFIX_KEEP 个
    for (const name of baks.slice(0, Math.max(0, baks.length - PREFIX_KEEP))) {
      try { rmSync(join(dir, name), { recursive: true, force: true }) } catch { /* 单个删不掉跳过 */ }
    }
  } catch { /* 目录读不到就算了 */ }
}

/**
 * 目录是不是「指向别处的链接」——POSIX symlink 或 Windows junction。
 *
 * 判定条件来自本机实测(Node v24.21.0 / win32,`symlinkSync(target, p, 'junction')`
 * 造出来的真 junction):
 *   lstatSync(p)      → { isSymbolicLink: false, isDirectory: true }  ← 与普通目录完全一样
 *   statSync(p)       → { isSymbolicLink: false, isDirectory: true }
 *   readlinkSync(p)   → 抛 EINVAL(普通目录也抛 EINVAL,所以区分不开)
 *   realpathSync(p)   → 原样返回 junction 自己的路径(JS 实现不解析 junction)
 *   realpathSync.native(p) → 目标目录路径(只有 .native 才解析)
 *   rmSync(p,{recursive:false}) → 抛 ERR_FS_EISDIR;unlinkSync(p) → 抛 EPERM
 *                     (node 把它整个当目录看,不认为这是链接)
 *   readdirSync(父目录,{withFileTypes:true}) 里该条目 →
 *                     { isSymbolicLink: true, isDirectory: false }  ← 唯一认得出它的标准 API
 * 所以:主判 lstat.isSymbolicLink();Windows 上退回「父目录 Dirent 的 isSymbolicLink」
 * ——这也正是 DSH preset discovery 用的同一套 API(它按 Dirent.isDirectory() 过滤,
 * 于是链接进去的 preset 在界面上凭空消失,见文件头注释)。
 *
 * 刻意**不**用 realpathSync.native(p) !== resolve(p) 当判据:目标自己就是普通子目录、
 * 只是路径中间隔了一层 junction 时(实测 anc-link/sub → anc-target/sub)该不等式同样成立,
 * 会把普通目录误判成链接、进而被"删链接"式清理,风险更大。Dirent 是逐条目的直接证据。
 */
export function isDirLink(path) {
  let ls
  try { ls = lstatSync(path) } catch { return false }
  if (ls.isSymbolicLink()) return true // POSIX symlink(含 Windows 的 file/dir symlink)
  if (!ls.isDirectory()) return false
  try {
    const parent = dirname(path)
    const name = basename(path)
    const same = (n) => (n === name || (process.platform === 'win32' && n.toLowerCase() === name.toLowerCase()))
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (same(entry.name)) return entry.isSymbolicLink() // junction 在这里才现形
    }
  } catch { /* 父目录读不到就按普通目录处理(保守:不动它) */ }
  return false
}

/**
 * 摘掉一个链接入口,绝不递归进目标。
 * unlinkSync 对 POSIX symlink 有效,对 Windows junction 抛 EPERM(实测);
 * rmdirSync 恰好相反 —— RemoveDirectory 对 junction 只摘链接本身(实测目标内容完好),
 * 对 POSIX symlink 则抛 ENOTDIR。两者互补,先 unlink 再退回 rmdir。
 * 绝不用 rmSync(p, {recursive:true}):junction 没被识别成符号链接,递归删会把目标一起端掉。
 * @returns {Error|null} null=成功
 */
function removeDirLink(path) {
  try {
    unlinkSync(path)
    return null
  } catch { /* 交给 rmdir 再试 */ }
  try {
    rmdirSync(path)
    return null
  } catch (error) {
    return error
  }
}

/**
 * 安装/重装 preset:先把旧的那份整体备份成兄弟目录(名字带 .bak-<时间戳>,
 * 因为 PRESET_ID 不允许点号,DSH 的 discovery 会明确跳过这类名字,不会在
 * preset 列表里多出一条垃圾),再复制新的一份并盖章。备份滚动清理只保留
 * 最新 3 个。
 * 目标位置若是个链接(含 Windows junction)则只删链接本身,绝不递归进目标
 * ——判定见 isDirLink(普通目录照旧「备份 + 删除」,backup 非 null;链接则无备份)。
 */
export function installPreset({ presetDir, bundledDir }) {
  if (!existsSync(join(bundledDir, COMPOSITION_FILE))) {
    return { ok: false, error: `插件自带的 preset 目录不完整(缺 ${COMPOSITION_FILE}):${bundledDir}` }
  }
  let backup = null
  if (existsSync(presetDir)) {
    if (isDirLink(presetDir)) {
      const error = removeDirLink(presetDir)
      if (error) return { ok: false, error: `移除旧 preset 链接失败:${error.message}` }
    } else {
      backup = `${presetDir}.bak-${Date.now()}`
      try {
        cpSync(presetDir, backup, { recursive: true })
      } catch (error) {
        return { ok: false, error: `备份旧 preset 失败:${error.message}` }
      }
      try {
        rmSync(presetDir, { recursive: true, force: true })
      } catch (error) {
        return { ok: false, error: `清理旧 preset 失败:${error.message}`, backup }
      }
      prunePresetBackups(presetDir)
    }
  }
  try {
    mkdirSync(dirname(presetDir), { recursive: true })
    cpSync(bundledDir, presetDir, { recursive: true })
  } catch (error) {
    return { ok: false, error: `复制 preset 失败:${error.message}`, backup }
  }
  const hash = hashDir(presetDir)
  try {
    writeFileSync(join(presetDir, PRESET_MANIFEST), JSON.stringify({ hash, installedAt: Date.now() }, null, 2), 'utf8')
  } catch {
    // 盖章写不进去不影响 preset 本身可用,只是下次自检会报 stale —— 不视为失败
  }
  return { ok: true, target: presetDir, backup, hash }
}
