/**
 * dsh-xinyue-kit — Host 半(Node 侧)
 *
 * 新月杀(FreeKill)扩展开发工坊:AI 写扩展代码的受限开发套件。
 * - 注入规范知识(systemPrompt 常驻),取代用户手动喂知识库
 * - 注册 10 个工具:搜官方参考 / 查引擎符号 / 校验(含语义) / 读扩展 / 写扩展(校验门禁) / 素材匹配 / 复制图片 / 复制配音 / 任务收口 / 读官方文档
 * - 守卫:拦截通用 write/edit/bash 对游戏 extension 目录的写入(防绕过校验)
 * - HTTP API:历史记录与备份回滚(浏览器工坊面板用)
 *
 * 配置:cordis.yml 行上配 xinyueDir(新月杀/FreeKill 游戏本体目录,含 packages/ 与 lua/)。
 * 不配置时为"仅生成模式":工具可用,但不能写文件,守卫不激活。
 *
 * 浏览器半在 ./client.js(工坊页签 + 表单 + 结果卡片)。
 */
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { join, resolve } from 'node:path'
import { statSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { KNOWLEDGE_TEXT } from './src/knowledge.js'
import { validateExtensionCode } from './src/validate.js'
import { searchReference, readDoc, docOutline } from './src/reference.js'
import { loadEngineIndex, describeSymbol } from './src/engine-api.js'
import { matchAssets, findImageConverter, convertToJpg } from './src/match-assets.js'
import { listDirForPicker } from './src/fs-browse.js'
import { detectCandidates } from './src/detect.js'
import { writeExtension, readExtension, listBackups, rollbackExtension, extRootOf, migrateExtension, prunePackageBackups, listEntries, listEntrySkills, setBackupRoot, deletePackageFile } from './src/write.js'
import { readHistory, archiveTask, listExtensionHistories, recordBackup, deleteNote, recordChange } from './src/history.js'
import { copyImages } from './src/images.js'
import { generateKingdomAssets } from './src/kingdom.js'
import { listExtensionFolders } from './src/detect.js'
import { copyAudios, audioTargetKind } from './src/audio.js'
import { createTask, listTasks, skillFeedback, markSkillsWritten, setSkillStatus, setTaskImage, setSkillAudioFiles, setDieAudioFiles, completeById, deleteTask, reopenTask, getTask } from './src/tasks.js'
import { bundledPresetDir, hostHasDeclarativePreset, installPreset, presetDirOf, presetStatus } from './src/preset.js'
import { installSkillScaffold, SKILL_NAME } from './src/skill-scaffold.js'
import { cachedUpdate, checkForUpdate, detectInstall, installHint } from './src/update.js'
import { bashGuardReason, guardMessage, pathHitsProtected } from './src/guard.js'
import { readJsonSafeSync, writeJsonAtomicSync } from './src/store.js'
import pkg from './package.json' with { type: 'json' }
import { createApiHandler } from './src/api.js'
import { registerTools } from './src/tools.js'

/** bash 单次输出上限的出厂默认与允许范围(与 custom-bash.mjs 保持一致)。
 * 默认 64K=下限:阀门太小会增加调用轮数,总上下文消耗反而更大;256K 上限
 * 已够单次倾倒,更大的口子只会放大雪球。 */
const BASH_MAX_OUTPUT_DEFAULT = 64000
const BASH_MAX_OUTPUT_MIN = 64000
const BASH_MAX_OUTPUT_MAX = 256000

function clampBashMaxOutput(v) {
  const n = Number(v)
  if (!Number.isSafeInteger(n) || n < BASH_MAX_OUTPUT_MIN || n > BASH_MAX_OUTPUT_MAX) return null
  return n
}

export const name = 'xinyue-kit'

export const inject = ['tools', 'systemPrompt', 'dshHomePath']

/** 部署配置。xinyueDir 为空 = 仅生成模式。 */
export const Config = z.object({
  /** 新月杀(FreeKill)游戏本体目录(同时含 packages/ 与 lua/ 的那层)。 */
  xinyueDir: z.string().default(''),
})

/** 这些通用工具对 extension 目录的写入会被守卫拒绝——必须走 xinyue_write_package。 */
const GUARDED_TOOLS = new Set(['write', 'tool:write', 'edit', 'tool:edit', 'bash', 'tool:bash', 'str_replace_editor', 'tool:str_replace_editor'])

/** 取工具参数里的目标路径:不同写工具叫法不同(file_path / path)。 */
function pathArgOf(exec) {
  const args = exec.arguments ?? {}
  if (typeof args.file_path === 'string') return args.file_path
  if (typeof args.path === 'string') return args.path
  return null
}

/** /detect 的短缓存(60 秒),避免用户连续点击时反复扫盘。 */
const detectCache = { at: 0, list: [] }

/** 目录是否像一个新月杀(FreeKill)游戏本体根。
 * 判定:同时有 packages/ 与 lua/,且满足任一硬标志
 * (lua/core/package.lua = 引擎核心、FreeKill.exe = 本体、fk_ver = 版本文件)。
 * 注意与无名杀的区别:无名杀认 extension/ + noname.js,FreeKill 完全不认这两样。 */
function isValidGameDir(dir) {
  if (!dir) return false
  try {
    if (!statSync(join(dir, 'packages')).isDirectory()) return false
    if (!statSync(join(dir, 'lua')).isDirectory()) return false
    if (existsSync(join(dir, 'lua', 'core', 'package.lua'))) return true
    return existsSync(join(dir, 'FreeKill.exe')) || existsSync(join(dir, 'fk_ver'))
  } catch { return false }
}

export function apply(ctx, config) {
  // ── 0) 配置解析与初始化向导后端 ──────────────────────────────
  // 优先级:cordis.yml 行配置 > 工坊向导保存的设置文件 > 空(仅生成模式)。
  // 向导保存后立即热生效,不需要重启。
  // dshHomePath 是个解析函数,调用得到 Harness home(~/.dsh)
  const homeBase = typeof ctx.dshHomePath === 'function' ? ctx.dshHomePath() : (ctx.dshHomePath || join(homedir(), '.dsh'))
  const dshHomeDir = resolve(homeBase)
  const settingsPath = join(dshHomeDir, 'xinyue-kit.json')
  /* 安全读:解析失败先把原文件留档为 .corrupt-<ts> 再按空处理——以前的
   * `catch → {}` 会让"下次保存整份覆盖"把用户设置静默抹掉(实测数据丢失面)。 */
  const readSettingsFile = () => readJsonSafeSync(settingsPath, {})
  const saved = readSettingsFile()

  // 取第一个"有效"的来源:行配置 > 向导保存值;行配置无效时回落到向导值,
  // 这样换机/配错后用户在工坊向导里点一下就能修复,不用改 yml。
  const rowDir = config.xinyueDir ? resolve(config.xinyueDir) : ''
  const savedDir = saved.xinyueDir ? resolve(saved.xinyueDir) : ''
  let xinyueDir = isValidGameDir(rowDir) ? rowDir : (isValidGameDir(savedDir) ? savedDir : (rowDir || savedDir || ''))
  let active = isValidGameDir(xinyueDir)
  if (rowDir && !isValidGameDir(rowDir)) {
    console.warn(`[xinyue-kit] ⚠️ cordis.yml 里的 xinyueDir 不是有效的新月杀目录(缺少 packages/ 或 lua/): ${rowDir}`)
  }

  /** 校验并热切换当前游戏目录;返回 { error?, adjustedFrom? }。
   * 小白高频误填:结尾多带一层 \packages(真正要填的是 packages/ 所在的上一层)。
   * 该情形自动剥掉并记入 adjustedFrom,由调用方在成功响应里提示。 */
  const setActive = (dir) => {
    dir = String(dir || '').trim()
    if (!dir) return { error: '路径为空' }
    let resolved = resolve(dir)
    let adjustedFrom = null
    if (!isValidGameDir(resolved) && /[\\/]packages[\\/]?$/i.test(resolved)) {
      const parent = resolve(resolved, '..')
      if (isValidGameDir(parent)) {
        adjustedFrom = resolved
        resolved = parent
      }
    }
    if (!isValidGameDir(resolved)) {
      return {
        error: `「${resolved}」不像新月杀(FreeKill)游戏本体目录——这一层下面应该同时能看到 packages 文件夹和 lua 文件夹(其中 lua/core/package.lua 是最硬的标志)。如果你填的路径以 \\packages 结尾,请去掉这一层再试;游戏在非常规位置(如 D:\\games\\...)时手动填写即可。`,
      }
    }
    xinyueDir = resolved
    active = true
    return { adjustedFrom }
  }
  console.log(`[xinyue-kit] 加载成功,游戏目录: ${active ? xinyueDir : '(未配置或无效,仅生成模式;可在工坊向导里初始化)'}`)

  // ── 0.35) 备份落点移到扩展包外 ───────────────────────────────
  // 旧版把备份写在 `<包>/<目录>/backup/` 里,实测会把扩展包弄成「脏工作区」——
  // 联机时核心包(freekill-core)被改/被加文件就直接报 Workspace is dirty。
  // 现在统一放 <dsh home>/xinyue-kit/backups/<包>/<子目录>/,包内一个字节不留;
  // 展示与回滚仍用旧的包内伪路径(<子目录>/backup/<文件>.<ts>.lua),老备份照旧能回滚。
  const backupRoot = join(dshHomeDir, 'xinyue-kit', 'backups')
  try {
    mkdirSync(backupRoot, { recursive: true })
    setBackupRoot(backupRoot)
    console.log(`[xinyue-kit] 备份目录(包外): ${backupRoot}`)
  } catch (e) {
    console.warn(`[xinyue-kit] ⚠️ 无法创建包外备份目录,退回包内 backup/: ${e?.message || e}`)
  }

  // ── 0.4) 写技能专用 skill 的自动安装 ─────────────────────────
  // 正文源随插件发布(knowledge/skills/<name>/SKILL.md),这里装到 <dsh home>/skills/
  // (user 级 skills 根,rank 400,任何 cwd 的会话都能发现)。升级插件即升级 skill,
  // 本地那份被改坏也会在下次加载时修回。正文本身不进 system prompt —— 见
  // src/skill-scaffold.js 顶部说明。
  const skillInstall = installSkillScaffold(dshHomeDir)
  if (skillInstall.state === 'installed') console.log(`[xinyue-kit] 已安装 skill: ${SKILL_NAME} → ${skillInstall.path}`)
  else if (skillInstall.state === 'updated') console.log(`[xinyue-kit] 已更新 skill: ${SKILL_NAME} → ${skillInstall.path}`)
  else if (skillInstall.state === 'error') console.warn(`[xinyue-kit] ⚠️ skill 安装失败:${skillInstall.error}`)

  // ── 0.5) 版本与一致性自检 ────────────────────────────────────
  // preset(agent.cordis.yml 的 persona + residentTools 工具名白名单 + SKILL.md 的
  // 参数文档)是插件行为的第二份手抄,复制到 ~/.dsh/.agent-presets/ 后与代码再无
  // 任何关联:代码更新而 preset 没重装时,会话会拿到自相矛盾的指令(工具名对不上
  // →工具在会话里静默消失;参数文档对不上→AI 写出的调用被校验挡下),而且不报错。
  // 这里只负责"发现",修由用户在工坊 ⚙ 设置页点「重装 preset」。
  // (曾想用目录链接让漂移不可能发生,实测否决:DSH 的 discovery 用
  //  readdir().isDirectory() 判定,而 node 对 junction/symlink 一律报 isLink。)
  const presetDir = presetDirOf(dshHomeDir)
  const bundledDir = bundledPresetDir()
  // DSH 0.1.7 起 preset 声明在 bundle patch 里(@deepseek-ai/dsh-agent-preset 行,
  // 见 cordis.patch.yml),随插件加载自动就位——目录式安装/哈希比对/重装全部退役;
  // 0.1.6 及以下没有该机制,继续走 ~/.dsh/.agent-presets 目录式。
  const declarativePreset = hostHasDeclarativePreset()
  const readPresetStatus = () => declarativePreset
    ? { state: 'declarative' }
    : presetStatus({ presetDir, bundledDir })
  if (declarativePreset) {
    console.log('[xinyue-kit] 声明式 preset(新月杀开发模式)随插件自动就位,无需安装/重装')
  } else {
    const status = readPresetStatus()
    if (status.state === 'missing') {
      console.warn('[xinyue-kit] ⚠️ 「新月杀开发模式」preset 未安装:工坊 ⚙ 设置页点「重装 preset」,或跑 node scripts/install-preset.mjs')
    } else if (status.state === 'stale') {
      console.warn('[xinyue-kit] ⚠️ preset 与插件自带的不一致:工坊 ⚙ 设置页点「重装 preset」')
    } else if (status.state === 'unknown') {
      console.warn(`[xinyue-kit] ⚠️ ${status.error}`)
    }
  }
  // 版本检查只在启动时跑一次(结果缓存 6 小时,失败不缓存);link 安装直接短路,
  // 一个请求都不发。结果只进内存不落盘——一次网络查询不值得在用户家目录留状态。
  if (readSettingsFile().updateCheck !== false) {
    checkForUpdate({ currentVersion: pkg.version, dshHome: dshHomeDir }).then((result) => {
      if (result.error) {
        console.log(`[xinyue-kit] 版本检查未完成:${result.error}(不影响使用,可在 ⚙ 设置页手动重试)`)
      } else if (result.hasUpdate) {
        console.log(`[xinyue-kit] ⬆ 有新版本 v${result.latest}(当前 v${result.current},来源 ${result.source});升级:${result.installHint || '见 README'}`)
      }
    }).catch(() => {})
  }

  /** 设置页「版本与一致性」的载荷:本地探测不联网,网络结果只来自缓存或显式检查。 */
  const updatePayload = async (force) => {
    const install = detectInstall({ dshHome: dshHomeDir, packageName: pkg.name })
    const check = force ? await checkForUpdate({ currentVersion: pkg.version, dshHome: dshHomeDir, force: true }) : cachedUpdate()
    return {
      current: pkg.version,
      preset: readPresetStatus(),
      updateCheck: readSettingsFile().updateCheck !== false,
      installForm: install.form,
      installProfile: install.profile,
      installSpec: install.spec,
      installHint: installHint({ form: install.form, profile: install.profile, packageName: pkg.name, latest: check?.latest }),
      check: check || null,
    }
  }

  // ── 1) 常驻规范知识(文本随配置状态动态生成) ─────────────────
  // POSIX 形式路径:模型在 bash 里习惯 /d/... 写法,直接给两种形式免得它自己转换/寻找
  const posixPath = (p) => String(p || '')
    .replace(/^([A-Za-z]):[\\/]/, (_m, d) => '/' + d.toLowerCase() + '/')
    .replace(/\\/g, '/')
  ctx.systemPrompt.section({
    name: 'xinyue-kit',
    // 排在文件工具说明(1200-1300)之后、web 工具(2000)之前:模型先懂规矩再干活
    order: 1800,
    text: () => active
      ? KNOWLEDGE_TEXT + '\n## 当前环境(工坊已配置;路径就在下面,不需要寻找)\n'
        + '- 游戏本体目录: ' + xinyueDir + '(bash 里写作 ' + posixPath(xinyueDir) + ')\n'
        + '- 扩展写入根: ' + extRootOf(xinyueDir) + '(bash 里写作 ' + posixPath(extRootOf(xinyueDir)) + ')\n'
        + '- 需要核对引擎 API/源码时,直接在上述目录下对 lua/(引擎核心、客户端、服务端)与 packages/(官方扩展实现,尤其 packages/*/skills/*.lua)做窄窗口 grep——禁止用 ls/find 列盘符根、用户目录来寻找引擎或扩展路径(路径已在上面,找了也白找)。\n'
      : KNOWLEDGE_TEXT + '\n注意:当前部署未配置 xinyueDir,xinyue_write_package 与 xinyue_read_package 不可写/不可读,生成代码后让用户自行保存。',
  })

  // ── 2) 工具定义(已拆到 src/tools.js,按「检索 / 校验写入 / 素材 / 任务收口」分组)──
  registerTools(ctx, { get active() { return active }, get xinyueDir() { return xinyueDir }, dshHomeDir })

  // ── 3) 守卫:extension 目录的写操作必须走专用工具 ─────────────
  // 始终注册,内部动态判断 active:工坊向导热初始化后立即生效。
  // 判定逻辑在 src/guard.js(纯函数、有单测):路径归一化(反斜杠/正斜杠/
  // git-bash 盘符/.. 折叠)→ 归属判断;bash 另做"先 cd 进保护目录再相对写"
  // 的组合判定,并区分读写(纯读命令照旧放行)。
  ctx.tools.guard((exec) => {
    if (!active || !GUARDED_TOOLS.has(exec.name)) return undefined
    const protectRoot = extRootOf(xinyueDir)
    // 相对路径的解析基准:会话工作目录(DSH 写工具用的就是它)→ 进程 cwd → 游戏目录
    const baseDirs = []
    try {
      const sessionCwd = exec.agent?.session?.header?.cwd
      if (typeof sessionCwd === 'string' && sessionCwd) baseDirs.push(sessionCwd)
    } catch { /* 非 agent 调用没有 agent 字段 */ }
    try {
      /* custom-bash 的 workdir 参数优先于会话 cwd——不推进来就是个现成旁路
       * (`bash{command:"cat > extension.js", workdir:"…/extension/pk"}`) */
      const workdir = exec.arguments?.workdir
      if (typeof workdir === 'string' && workdir) baseDirs.unshift(workdir)
    } catch { /* 无该参数 */ }
    baseDirs.push(process.cwd(), xinyueDir)
    if (exec.name === 'bash' || exec.name === 'tool:bash') {
      const reason = bashGuardReason(String(exec.arguments?.command ?? ''), protectRoot, baseDirs)
      return reason ? guardMessage(reason) : undefined
    }
    const path = pathArgOf(exec)
    if (path && pathHitsProtected(path, protectRoot, baseDirs)) {
      return guardMessage(`写入目标落在游戏 extension 目录内(${path})`)
    }
    return undefined
  })

  // ── 4) HTTP API:状态/初始化向导/历史/回滚(浏览器工坊用) ─────
  // 可选注入:只有组合了 webServer 的部署(web UI)才挂路由;
  // headless 等无网页面部署里跳过,不阻塞启动。
  ctx.inject(['webServer'], (webCtx) => webCtx.webServer.register({
    kind: 'prefix',
    path: '/xinyue-kit-api',
    handler: createApiHandler({
      config, saved, detectCache, settingsPath, dshHomeDir, pkgVersion: pkg.version,
      get active() { return active },
      get xinyueDir() { return xinyueDir },
      isValidGameDir, setActive, readSettingsFile, writeJsonAtomicSync,
      clampBashMaxOutput, BASH_MAX_OUTPUT_DEFAULT, BASH_MAX_OUTPUT_MIN, BASH_MAX_OUTPUT_MAX,
      listExtensionFolders, listTasks, createTask, skillFeedback, setSkillStatus, getTask,
      copyImages, setTaskImage, copyAudios, setSkillAudioFiles, setDieAudioFiles, audioTargetKind,
      deleteTask, reopenTask, completeById, archiveTask, updatePayload, declarativePreset,
      readPresetStatus, installPreset, presetDir, bundledDir, readExtension, listDirForPicker,
      listEntries, listEntrySkills, readHistory, listBackups, listExtensionHistories, deleteNote,
      migrateExtension, recordBackup, prunePackageBackups, rollbackExtension,
    }),
  }))
}
