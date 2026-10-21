/**
 * 工具注册层:15 个 xinyue_* 工具从 index.js 抽出。
 *
 * 纯装配:每个工具的参数 schema / 输出 schema / 渲染器都原样搬过来,
 * 只把三处闭包状态换成 deps 注入:
 *   · deps.active / deps.xinyueDir —— **getter**,每次 execute 现取(工坊向导热初始化后立即可用);
 *   · deps.dshHomeDir —— 任务登记处所在目录(启动时固定)。
 *
 * 为什么拆:这些工具占原 index.js 的 800 行,和守卫、HTTP 路由挤在一起时
 * 改一个 schema 要滚很久;拆开后 index.js 只剩装配顺序。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { validateExtensionCode } from './validate.js'
import { searchReference, readDoc, docOutline } from './reference.js'
import { loadEngineIndex, describeSymbol } from './engine-api.js'
import { matchAssets, findImageConverter, convertToJpg } from './match-assets.js'
import { listDirForPicker } from './fs-browse.js'
import { writeExtension, readExtension, listBackups, rollbackExtension, migrateExtension, prunePackageBackups, listEntries, listEntrySkills, setBackupRoot, deletePackageFile } from './write.js'
import { readHistory, archiveTask, listExtensionHistories, recordBackup, deleteNote, recordChange } from './history.js'
import { copyImages } from './images.js'
import { generateKingdomAssets } from './kingdom.js'
import { copyAudios, audioTargetKind } from './audio.js'
import { createTask, listTasks, skillFeedback, markSkillsWritten, setSkillStatus, setTaskImage, setSkillAudioFiles, setDieAudioFiles, completeById, deleteTask, reopenTask, getTask } from './tasks.js'
import { detectCandidates, listExtensionFolders } from './detect.js'

/**
 * @param {{ tools: { register: (tool: any) => void } }} ctx
 * @param {{ active: boolean, xinyueDir: string, dshHomeDir: string }} deps active / xinyueDir 必须是 getter
 */
export function registerTools(ctx, deps) {
  // ── 2) 工具定义 ──────────────────────────────────────────────
  ctx.tools.register(defineTool({
    name: 'xinyue_search_reference',
    description: 'Search 新月杀(FreeKill) references: official Lua source AND the official documentation 《新月杀之书》 (the book is bundled with this plugin, no download needed). Five ways: (1) Chinese skill name, e.g. 仁德; (2) skill/general ID, e.g. rende; (3) space-separated effect keywords, e.g. 摸牌 弃置; (4) a full effect sentence — similarity >=50% returns ALL close matches as compact rows ranked by score (re-search the ID of an interesting row to load its full code; add distinguishing words if too many); (5) a rules/chapter term, e.g. 触发时机 / 事件栈 / 结算流程 — documentation sections score title hits highest. Tips: prefer core effect words (摸牌/弃置/伤害/回合), one skill per query, drop filler words. Every match carries source: "code" (game side: packages/*/skills official skill Lua, packages/*/init.lua General definitions, lua/ engine core) or "doc" (the official book; file is plugin-relative, e.g. fkbook/rule/03-event.rst). type=any (default) searches BOTH; type=code searches only game source; type=doc searches only the book (works even when no game directory is configured). A "doc" match is a SECTION, not code — call xinyue_read_doc with its id to read the whole section instead of the snippet.',
    parameters: {
      query: { type: 'string', required: true, description: 'Keywords, space-separated.' },
      type: { type: 'string', enum: ['any', 'skill', 'general', 'engine', 'code', 'doc'], description: 'Scope, default any (code + doc). skill=official skill implementations; general=General definitions; engine=lua/ core APIs; code=game source, any scope, no docs; doc=official documentation 《新月杀之书》 only.' },
      limit: { type: 'integer', description: 'Max matches, default 5.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        matches: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string' }, name: { type: 'string' }, info: { type: 'string' },
          score: { type: 'number' },
          file: { type: 'string', required: true }, line: { type: 'integer', required: true }, snippet: { type: 'string', required: true },
          source: { type: 'string', description: 'code = game source (packages/, lua/); doc = official documentation《新月杀之书》(plugin-relative fkbook/... path, read it with xinyue_read_doc).' },
        } } },
        scanned: { type: 'integer' },
        query: { type: 'string' },
        truncated: { type: 'string' },
        error: { type: 'string'},
      } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      return searchReference(deps.xinyueDir, args)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_api_lookup',
    description: 'Look up a 新月杀(FreeKill) ENGINE symbol in a prebuilt index of lua/ + packages/freekill-core/**: signature, definition file:line, doc comments (---@param / ---@field), status-skill spec fields, and 1-3 real official usages. Use this BEFORE writing code whenever you are unsure whether an event name, class method, enum constant (Card.XXX), or addEffect spec field really exists — it is far cheaper than grepping the engine. Accepts: event name (fk.RoundStart / RoundStart), method (Player:getAttackRange / getAttackRange), constant (Card.SubtypeOffensiveRide), effect key (atkrange / maxcards / targetmod), or a class/param class (AskToCardsParams). Misses return did-you-mean candidates. The index auto-builds once from the game dir (~seconds) and is cached in the plugin folder; pass rebuild=true after a game update.',
    parameters: {
      query: { type: 'string', required: true, description: 'Symbol to look up, e.g. fk.RoundStart, getAttackRange, Player:getAttackRange, Card.SubtypeOffensiveRide, atkrange, AskToCardsParams.' },
      kind: { type: 'string', enum: ['any', 'event', 'method', 'constant', 'spec', 'class'], description: 'Restrict the hit kind. Default any.' },
      limit: { type: 'integer', description: 'Max hits / did-you-mean candidates, default 6.' },
      rebuild: { type: 'boolean', description: 'Rebuild the engine index from source (needed after a game update), default false.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        symbol: { type: 'string' },
        hits: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          kind: { type: 'string', required: true },
          symbol: { type: 'string', required: true },
          note: { type: 'string' },
          doc: { type: 'string' },
          file: { type: 'string' }, line: { type: 'integer' }, value: { type: 'string' },
          params: { type: 'array', items: { type: 'string' } },
          parent: { type: 'string' },
          usage: { type: 'string' },
          fields: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
            name: { type: 'string', required: true }, type: { type: 'string' }, desc: { type: 'string' }, optional: { type: 'boolean' }, from: { type: 'string' },
          } } },
        } } },
        candidates: { type: 'array', items: { type: 'string' } },
        usages: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          file: { type: 'string', required: true }, line: { type: 'integer', required: true }, snippet: { type: 'string', required: true },
        } } },
        index: { type: 'object', additionalProperties: false, properties: {
          files: { type: 'integer' }, builtAt: { type: 'string' }, empty: { type: 'boolean' }, rebuilt: { type: 'boolean' },
        } },
        error: { type: 'string' },
      } },
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: `没查到:${value.error}${(value.candidates || []).length ? `\n相近的:${value.candidates.join(' / ')}` : ''}` }]
        const lines = []
        for (const h of value.hits) {
          const where = h.file ? `  ← ${h.file}:${h.line}` : ''
          lines.push(`[${h.kind}] ${h.note || h.symbol}${where}`)
          if (h.doc) lines.push(`    ${h.doc.replace(/\s+/g, ' ').slice(0, 300)}`)
          if (h.fields && h.fields.length) {
            lines.push('    字段: ' + h.fields.map((f) => `${f.name}${f.optional ? '?' : ''}${f.type ? ':' + f.type : ''}`).join(', '))
          }
        }
        if ((value.candidates || []).length) lines.push('相近的: ' + value.candidates.join(' / '))
        if ((value.usages || []).length) {
          lines.push('官方用例:')
          for (const u of value.usages) lines.push(`  ${u.file}:${u.line}  ${u.snippet}`)
        }
        lines.push(`(索引 ${value.index && value.index.files} 个引擎文件${value.index && value.index.rebuilt ? ',本轮已重建' : ''})`)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      if (!deps.active) return { ok: false, hits: [], candidates: [], error: '未配置 xinyueDir,无法读取引擎源码建索引。' }
      try {
        const index = loadEngineIndex(deps.xinyueDir, { rebuild: !!args.rebuild })
        const r = describeSymbol(index, { symbol: args.query, kind: args.kind, limit: args.limit, gameDir: deps.xinyueDir })
        r.index = { files: index.files, builtAt: index.builtAt || undefined, empty: !!index.empty, rebuilt: !!args.rebuild }
        return r
      } catch (error) {
        return { ok: false, hits: [], candidates: [], error: error.message }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_match_assets',
    description: 'Fuzzy-match requested asset texts (voice lines / image names from a task message, e.g. 「格拉尼——各位、让我们把胜利带回罗德岛！」) against the ACTUAL file names in a local folder — normalizes full-width vs half-width punctuation, spaces, dashes, ellipsis and quote marks. Returns a mapping table: request → file (with confidence high/mid/low), which requests matched NOTHING (with closest alternatives), and which files were left UNASSIGNED (a voice line nobody claimed). Call this BEFORE xinyue_copy_audio / xinyue_copy_images and show the table to the user to confirm; then copy. Pass no requests to just list the folder. For 立绘 png sources pass kind=image so the result flags non-jpg files (convertToJpg=true also transcodes them into a staging folder and returns the staged path to copy).',
    parameters: {
      dir: { type: 'string', required: true, description: 'Absolute path of the local folder holding the assets.' },
      requests: { type: 'array', items: { type: 'string' }, description: 'Requested texts from the task message (one per voice line / image). Omit to simply list the folder.' },
      kind: { type: 'string', enum: ['any', 'audio', 'image'], description: 'Filter by file type; audio=mp3/ogg/wav/m4a/flac, image=jpg/png/gif/webp/bmp. Default any.' },
      recursive: { type: 'boolean', description: 'Scan subdirectories too, default false.' },
      minScore: { type: 'number', description: 'Minimum similarity to accept a match, default 0.55 (raise it to be stricter).' },
      convertToJpg: { type: 'boolean', description: 'For image matches that are not jpg: transcode into a staging folder and return staged paths to pass to xinyue_copy_images. Default false.' },
      taskId: { type: 'string', description: 'Optional task ID; when given, the staged jpgs are recorded on the task so the copy step can reuse them.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        dir: { type: 'string' },
        files: { type: 'integer' },
        matches: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          request: { type: 'string', required: true },
          file: { type: 'string' }, path: { type: 'string' }, ext: { type: 'string' },
          score: { type: 'number' }, confidence: { type: 'string', required: true },
          staged: { type: 'string' },
          alternates: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
            file: { type: 'string', required: true }, score: { type: 'number', required: true },
          } } },
        } } },
        unmatched: { type: 'array', items: { type: 'string' } },
        unassigned: { type: 'array', items: { type: 'string' } },
        listing: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          name: { type: 'string', required: true }, ext: { type: 'string' }, size: { type: 'integer' },
        } } },
        converter: { type: 'string' },
        warnings: { type: 'array', items: { type: 'string' } },
        error: { type: 'string' },
      } },
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: `素材匹配失败:${value.error}` }]
        const lines = [`目录 ${value.dir}(${value.files} 个素材文件)`]
        if (value.listing) {
          for (const f of value.listing) lines.push(`  · ${f.name}`)
          return [{ type: 'text', text: lines.join('\n') }]
        }
        for (const m of value.matches || []) {
          const tag = m.confidence === 'none' ? '未命中' : `${m.confidence} ${m.score}`
          lines.push(`  ${m.file ? '✓' : '✗'} ${m.request}\n      → ${m.file || '(没有匹配到)'}  [${tag}]`)
          if (m.staged) lines.push(`      已转 jpg: ${m.staged}`)
          if (m.alternates && m.alternates.length) lines.push(`      候选: ${m.alternates.map((a) => `${a.file}(${a.score})`).join(' / ')}`)
        }
        if ((value.unmatched || []).length) lines.push(`未匹配请求 ${value.unmatched.length} 条:${value.unmatched.join(' ; ')}`)
        if ((value.unassigned || []).length) lines.push(`未被认领的文件 ${value.unassigned.length} 个:${value.unassigned.join(' ; ')}`)
        for (const w of value.warnings || []) lines.push(`! ${w}`)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        const r = matchAssets(args)
        if (!r.ok) return r
        if (!args.convertToJpg || !r.matches.length) return r
        const warnings = []
        const need = r.matches.filter((m) => m.file && !/\.jpe?g$/i.test(m.file))
        if (!need.length) return r
        const converter = findImageConverter()
        if (!converter) {
          warnings.push('本机没探到图片转换器(Pillow / ImageMagick),png 未转 jpg;请手动转换或把目标名写成 .png')
          r.warnings = warnings
          return r
        }
        const stageDir = join(deps.dshHomeDir || homedir(), '.dsh-xinyue-kit', 'asset-stage', String(args.taskId || 'adhoc'))
        for (const m of need) {
          const dst = join(stageDir, basename(m.file).replace(/\.[^.]+$/, '') + '.jpg')
          const c = convertToJpg(m.path, dst, converter)
          if (c.ok) m.staged = c.path
          else warnings.push(`${m.file} 转 jpg 失败:${c.error}`)
        }
        r.converter = converter.kind
        r.warnings = warnings
        return r
      } catch (error) {
        return { ok: false, matches: [], unmatched: [], unassigned: [], error: error.message }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_read_doc',
    description: 'Read the FULL text of one section of the official 新月杀(FreeKill) documentation 《新月杀之书》(the book bundled with this plugin) — this reads DOCUMENTATION, not game source code (for source use xinyue_read_package or xinyue_search_reference + the match snippet). Text is the original rST, not converted. Locate by: (a) id from a previous xinyue_search_reference(type=doc) match, e.g. id="fkbook/rule/03-event.rst#事件与时机"; (b) file="fkbook/rule/03-event.rst" plus section="事件与时机"; (c) file alone to read the whole file. Use this whenever a searched doc section looks relevant — the section is the real content, the search snippet is only its first lines. Book coverage: rules/结算 (rule/), the 安河 tutorial (anhe/), Lua basics (new-to-lua/), misc guides, and a runnable example package (anhe/example/*.lua).',
    parameters: {
      id: { type: 'string', description: 'Section id from a search match, e.g. "fkbook/rule/03-event.rst#事件与时机" (a leading "doc:" is accepted). Alternative to file+section.' },
      file: { type: 'string', description: 'Documentation file, plugin-relative or shortened, e.g. fkbook/rule/03-event.rst / rule/03-event.rst / 03-event.rst. Alone, returns the whole file.' },
      section: { type: 'string', description: 'Section title inside that file, e.g. 触发时机的结算流程. Omit to read the whole file.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        id: { type: 'string' },
        title: { type: 'string' },
        path: { type: 'array', items: { type: 'string' }, description: 'Ancestor chapter titles, outermost first (empty for a top-level section).' },
        file: { type: 'string' },
        line: { type: 'integer' },
        endLine: { type: 'integer' },
        chars: { type: 'integer' },
        text: { type: 'string', description: 'The section body in original rST form.' },
        source: { type: 'string' },
        truncated: { type: 'string' },
        error: { type: 'string' },
      } },
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: `读取失败: ${value.error}` }]
        const where = value.path && value.path.length ? `${value.path.join(' / ')} / ` : ''
        return [{ type: 'text', text: `── ${where}${value.title}(${value.file}:${value.line},${value.chars} 字符,官方文档 rST 原文)──\n${value.text}${value.truncated ? '\n\n' + value.truncated : ''}` }]
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await readDoc(args.id || args.file, args.section)
      } catch (error) {
        return { ok: false, error: error.message }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_doc_index',
    description: '《新月之书》(official FreeKill docs bundled with this plugin) chapter map — call this BEFORE reading documentation chapters, to pick the right chapter for the task at hand. Returns eight parts (入门 / 技能 / 规则与结算 / 美术音频 / 模式配置 / 发布调试 / Lua 入门 / API 参考), each with chapters (id + title + keywords), a task→chapter routing table, and engine facts the book states loosely. Then read the chosen chapter with xinyue_read_doc(id) or search inside it with xinyue_search_reference(type=doc). NOTE: the api-reference part is autodoc stubs only (~100 bytes each) — use xinyue_api_lookup for real signatures.',
    parameters: {
      part: { type: 'string', description: 'Optional part id to narrow: start | skill | rule | asset | mode | ship | lua | api. Omit for the whole map.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        source: { type: 'string' },
        files: { type: 'integer' },
        parts: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          intro: { type: 'string' },
          chapters: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            keys: { type: 'array', items: { type: 'string' } },
          } } },
        } } },
        taskRoutes: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          want: { type: 'string' },
          read: { type: 'array', items: { type: 'string' } },
          then: { type: 'array', items: { type: 'string' } },
        } } },
        verifiedNotes: { type: 'array', items: { type: 'string' } },
        error: { type: 'string' },
      } },
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: `读取失败: ${value.error}` }]
        const lines = [`── 《新月之书》章节地图(${value.files} 个文件;${value.source})──`]
        for (const part of value.parts || []) {
          lines.push(`\n【${part.title}】${part.intro ? ' ' + part.intro : ''}`)
          for (const chapter of part.chapters || []) {
            lines.push(`  · ${chapter.title} — ${chapter.id}${chapter.keys.length ? ' [' + chapter.keys.join('/') + ']' : ''}`)
          }
        }
        if ((value.taskRoutes || []).length) {
          lines.push('\n【按任务找章节】')
          for (const route of value.taskRoutes) {
            lines.push(`  · ${route.want} → ${route.read.join(' + ')}${route.then.length ? '(再读 ' + route.then.join(' + ') + ')' : ''}`)
          }
        }
        if ((value.verifiedNotes || []).length) {
          lines.push('\n【书外已核实(以引擎源码为准)】')
          for (const note of value.verifiedNotes) lines.push(`  · ${note}`)
        }
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        const outline = await docOutline()
        if (outline.ok && args && args.part) {
          const part = String(args.part).trim()
          const parts = (outline.parts || []).filter((item) => item.id === part)
          if (!parts.length) return { ok: false, error: `没有这个部分:${part}(可选 start/skill/rule/asset/mode/ship/lua/api)` }
          outline.parts = parts
        }
        return outline
      } catch (error) {
        return { ok: false, error: error.message }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_validate',
    description: 'Validate a 新月杀(FreeKill) Lua file before writing it. Checks Lua syntax (via luaparse, falling back to a built-in Lua checker) plus FreeKill structure rules: Package:new + top-level return, fk.CreateSkill name matching the file name, General(...) argument order, addSkills references, Fk:loadTranslationTable completeness, and full-width punctuation in code positions.',
    parameters: {
      code: { type: 'string', required: true, description: 'Full Lua file content (init.lua or skills/<id>.lua).' },
      kind: { type: 'string', enum: ['package', 'skill', 'general'], description: 'Structure hints to apply. Omit to auto-detect from filePath/content.' },
      filePath: { type: 'string', description: "Relative path inside the package, e.g. 'skills/test_rende.lua'. Used for kind detection and the skill-name/filename consistency check." },
      packageDir: { type: 'string', description: 'Absolute path of the package directory. Lets the validator check that loadSkillSkelsByPath points at a real directory and that addSkills references resolve.' },
      folder: { type: 'string', description: 'Package (folder) name, for name-consistency check.' },
      idPrefix: { type: 'string', description: 'ID prefix (e.g. fk_) for the prefix-convention check on skill names / general ids / package name.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        style: { type: 'string', required: true },
        syntaxEngine: { type: 'string', description: "走的是哪条语法检查:'luaparse' 或 'builtin'(降级)。" },
        errors: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { line: { type: 'integer' }, message: { type: 'string', required: true } } } },
        warnings: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { message: { type: 'string', required: true } } } },
      } },
      render: (_args, value) => [{
        type: 'text',
        text: value.ok
          ? `校验通过。${value.warnings.length ? '警告(建议参考):\n' + value.warnings.map((w) => `- ${w.message}`).join('\n') : '无警告。'}`
          : `校验失败,${value.errors.length} 个错误必须修复:\n${value.errors.map((e) => `- ${e.message}`).join('\n')}${value.warnings && value.warnings.length ? '\n警告:\n' + value.warnings.map((w) => `- ${w.message}`).join('\n') : ''}`,
      }],
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      return validateExtensionCode(args)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_read_package',
    description: 'Read one installed xinyue extension. Prefer listBlocks/block extraction on large files: list the block directory first, then read only the block you need.',
    parameters: {
      folder: { type: 'string', required: true, description: 'Extension folder name.' },
      file: { type: 'string', description: 'Relative .js path inside the extension package (multi-file packs keep entries in e.g. character/character.js). Defaults to extension.js.' },
      listBlocks: { type: 'boolean', description: 'Return the block directory (id/kind/lines/file) instead of full text. Without file, aggregates ALL .js files of the package.' },
      block: { type: 'string', description: 'Read one block only, format kind:id — kind is skill/card/character/translate (e.g. skill:cs_tianfa, card:cs_bangbang). Without file, searches the whole package and returns where it was found.' },
      notes: { type: 'boolean', description: 'Also return this package history notes (engine-level lessons). Fetch only when relevant to the current task.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        folder: { type: 'string', required: true },
        file: { type: 'string' },
        files: { type: 'array', required: true, items: { type: 'string' } },
        code: { type: 'string'},
        info: { type: 'object', additionalProperties: true },
        block: { type: 'object', additionalProperties: false, properties: {
          kind: { type: 'string', required: true },
          id: { type: 'string', required: true },
          file: { type: 'string' },
        } },
        blocks: { type: 'object', additionalProperties: false, properties: {
          anchored: { type: 'boolean', required: true },
          blocks: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: {
            key: { type: 'string', required: true },
            kind: { type: 'string', required: true },
            id: { type: 'string', required: true },
            lines: { type: 'integer', required: true },
            virtual: { type: 'boolean', required: true },
            file: { type: 'string' },
          } } },
          files: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
            file: { type: 'string', required: true },
            anchored: { type: 'boolean', required: true },
            blocks: { type: 'integer', required: true },
          } } },
        } },
        error: { type: 'string'},
        notes: { type: 'array', items: { type: 'string' } },
      } },
      render: (_args, value) => {
        // render 文本是模型唯一能看到的工具结果——所有数据必须原样进文本,不能只给摘要
        if (value.error) return [{ type: 'text', text: `读取失败: ${value.error}` }]
        const parts = []
        if (value.notes) {
          parts.push(`历史注意点 ${value.notes.length} 条:`)
          value.notes.forEach((n, i) => parts.push(`${i + 1}. ${n}`))
        }
        const fileTag = (f) => (f && f !== 'extension.js' ? ` @ ${f}` : '')
        if (value.blocks) {
          const fileNames = (value.blocks.files || []).map((f) => `${f.file}(${f.blocks} 块${f.anchored ? ',已锚点化' : ''})`).join('、')
          if (fileNames) parts.push(`涉及文件: ${fileNames}`)
          parts.push(`区块目录 ${value.blocks.blocks.length} 项(${value.blocks.anchored ? '已锚点化' : '未锚点,虚拟划分'}):`)
          value.blocks.blocks.forEach((b) => parts.push(`- ${b.key}(${b.lines} 行${b.virtual ? ',虚拟' : ''})${fileTag(b.file)}`))
          parts.push(`用 block:'区块key' 读取具体区块内容;多文件包的区块读写记得带上对应的 file 参数。`)
        }
        if (value.block) {
          parts.push(`── 区块 ${value.block.kind}:${value.block.id}${fileTag(value.block.file)} ──`)
          parts.push(value.code ?? '(空)')
        } else if (!value.blocks && !value.notes) {
          parts.push(`── ${value.folder}/${value.file ?? 'extension.js'} 全文(共 ${value.code ? value.code.split('\n').length : 0} 行)──`)
          parts.push(value.code ?? '(该文件不存在或为空)')
          if (value.files && value.files.length) parts.push(`包内文件: ${value.files.join('、')}(条目可能在子目录模块,listBlocks 聚合可见)`)
        }
        return [{ type: 'text', text: parts.join('\n') }]
      },
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      if (!deps.active) return { folder: args.folder, files: [], error: '未配置 xinyueDir,无法读取游戏目录。' }
      try {
        const r = await readExtension(deps.xinyueDir, args.folder, { file: args.file, listBlocks: args.listBlocks, block: args.block })
        if (args.notes && !r.error) r.notes = (await readHistory(deps.xinyueDir, args.folder)).notes || []
        return r
      } catch (error) { return { folder: args.folder, files: [], error: error.message } }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_write_package',
    description: 'Write a 新月杀(FreeKill) Lua package file (validates first; the only write channel). Packages live at <gameDir>/packages/<folder>/ — init.lua is the package entry, skills/<id>.lua holds one skill per file. Two modes: full-text (code) for a new file or an unindexed legacy file (pass editScope so untouched content must stay byte-identical); block-assembly (blocks/edits/deletes) for existing files — the tool keeps everything you do not submit, so transcription errors are structurally impossible.',
    parameters: {
      folder: { type: 'string', required: true, description: 'Package folder name under packages/ (the extension package directory).' },
      file: { type: 'string', description: "Relative .lua path inside the package: 'init.lua' (package entry) or 'skills/<skillId>.lua' (one skill per file). Defaults to init.lua." },
      code: { type: 'string', description: 'Full Lua file content. Required in full-text mode; omit in block mode.' },
      kind: { type: 'string', enum: ['package', 'skill', 'general'], description: 'Structure hint passed to the validator. Pass skill for skills/*.lua and package for init.lua; the validator misdetects when it is omitted, so give it explicitly.' },
      idPrefix: { type: 'string', description: 'ID prefix (e.g. fk_) for the prefix-convention check on skill names / general ids / package name.' },
      writeMode: { type: 'string', enum: ['auto', 'manual'], description: 'auto=write; manual=return code only. Ignored when taskId is given — the workshop-registered mode (user form choice) wins.' },
      taskId: { type: 'string', description: 'Task ID from the task message. When given, the task-registered writeMode (user form choice) overrides the writeMode parameter.' },
      blocks: { type: 'array', description: 'Block-assembly mode: submit complete new blocks for the IDs you change; everything else is kept from the old file by the tool.', items: { type: 'object', additionalProperties: false, properties: {
        id: { type: 'string', required: true, description: 'Internal ID, e.g. fk_test_rende.' },
        kind: { type: 'string', enum: ['skill', 'card', 'character', 'translate', 'package'], required: true, description: 'Block type. skill=one fk.CreateSkill statement; character=one General(...) + its addSkills; translate=Fk:loadTranslationTable entries for one base id; package=the Package:new declaration.' },
        code: { type: 'string', required: true, description: 'Full block text (complete Lua statement(s), e.g. the whole fk.CreateSkill{...} plus its addEffect chains).' },
      } } },
      edits: { type: 'array', description: 'Exact small patches for regions outside any block (e.g. a Package:new option, a require line). find must occur exactly once in the current file.', items: { type: 'object', additionalProperties: false, properties: {
        find: { type: 'string', required: true, description: 'Verbatim text copied from the current file.' },
        replace: { type: 'string', required: true },
      } } },
      deletes: { type: 'array', items: { type: 'string' }, description: 'Block keys to remove, e.g. skill:fk_old. Declared deletions bypass the loss guard.' },
      editScope: { type: 'array', items: { type: 'string' }, description: 'Full-text mode on existing files: internal IDs allowed to change; anything else that differs from the old file is rejected.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        wrote: { type: 'boolean', required: true },
        style: { type: 'string'},
        path: { type: 'string'},
        backup: { type: 'string'},
        errors: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { message: { type: 'string', required: true }, line: { type: 'integer' } } } },
        warnings: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { message: { type: 'string', required: true } } } },
        code: { type: 'string'},
        infoWritten: { type: 'boolean' },
        infoError: { type: 'string'},
        summary: { type: 'object', additionalProperties: false, properties: {
          addedLines: { type: 'integer', required: true },
          removedLines: { type: 'integer', required: true },
          changedAnchors: { type: 'array', items: { type: 'string' } },
          oldLines: { type: 'integer' }, newLines: { type: 'integer' },
        }, description: '改了多少:增删行数 + 内容变过的区块锚点。' },
        error: { type: 'string'},
      } },
      render: (_args, value) => {
        const diff = value.summary && (value.summary.addedLines || value.summary.removedLines)
          ? `\n改动:+${value.summary.addedLines} / -${value.summary.removedLines} 行`
            + (value.summary.changedAnchors && value.summary.changedAnchors.length ? `(动着板块:${value.summary.changedAnchors.join(', ')})` : '')
          : ''
        return [{
          type: 'text',
          text: value.error ? `写入被拒: ${value.error}`
            : !value.ok ? `校验未通过,未写入。错误:\n${(value.errors || []).map((e) => `- ${e.message}`).join('\n')}`
            : value.wrote ? `已写入 ${value.path}${value.backup ? `(旧版备份于 ${value.backup};要回滚就用这个路径)` : ''}。请让用户重开游戏或重载扩展查看效果。${diff}`
              + `\n硬规则:技能改完把这一轮新核实的引擎事实/新坑补进 skill「${SKILL_NAME}」的 §6(带 文件:行 出处),否则下个会话还得重踩。`
            : `手动模式:代码已生成并通过校验,等用户复制保存。${diff}`,
        }]
      },
    },
    async execute(args) {
      if (!deps.active) {
        return { ok: false, wrote: false, error: '未配置 xinyueDir(游戏本体目录):请在插件配置里填 xinyueDir 后重启,或直接复制代码手动保存。' }
      }
      try {
        // 写入方式是用户在工坊表单里的决定,不以 AI 传参为准:带 taskId 时用任务
        // 登记的 writeMode 覆盖(实测 AI 曾把「自动写入」任务误按 manual 调用)。
        if (args.taskId) {
          const task = await getTask(deps.dshHomeDir, args.taskId)
          if (task && task.writeMode && task.writeMode !== args.writeMode) {
            args = { ...args, writeMode: task.writeMode }
          }
        }
        const result = await writeExtension(deps.xinyueDir, args)
        if (result.wrote && result.backup) await recordBackup(deps.xinyueDir, args.folder, result.backup)
        return result
      } catch (error) {
        return { ok: false, wrote: false, error: error.message }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_delete_file',
    description: 'Delete ONE file inside a 新月杀 package (e.g. a skill file that must be removed, an abandoned subpackage file, a stray file written to the wrong directory). Only .lua/.md/.txt/.json are deletable — never images/audio. The file is backed up to the out-of-package backup store first, so a mistaken delete is always recoverable with rollback. Never delete directories.',
    parameters: {
      folder: { type: 'string', required: true, description: 'Package folder name under packages/.' },
      file: { type: 'string', required: true, description: "Relative path inside the package, e.g. 'skills/old_skill.lua' or 'pkg/xianfeng/skills/dead.lua'." },
      reason: { type: 'string', description: 'Why it is deleted (shown to the user).' },
      taskId: { type: 'string', description: 'Task ID from the task message (optional; records delivery).' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        file: { type: 'string' },
        backup: { type: 'string' },
        error: { type: 'string' },
      } },
      render: (_args, value) => [{
        type: 'text',
        text: value.error ? `删除被拒: ${value.error}`
          : `已删除 ${value.file}${value.backup ? `(删前备份于 ${value.backup},可用回滚恢复)` : ''}。`,
      }],
    },
    async execute(args) {
      if (!deps.active) {
        return { ok: false, error: '未配置 xinyueDir(游戏本体目录),无法删除包内文件。' }
      }
      try {
        const result = await deletePackageFile(deps.xinyueDir, args.folder, args.file)
        if (result.ok && result.backup) await recordBackup(deps.xinyueDir, args.folder, result.backup)
        return result
      } catch (error) {
        return { ok: false, error: error.message }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_copy_images',
    description: 'Copy user-selected local images into the extension image folder (image/generals/ for general art, image/card/ for card art). Pass taskId to mark the task image as delivered.',
    parameters: {
      folder: { type: 'string', required: true, description: 'Extension folder name.' },
      kind: { type: 'string', enum: ['generals', 'card', 'anim', 'kingdom', 'mark'], description: 'Image purpose: generals=武将立绘 (image/generals/), card=卡牌图 (image/card/), anim=特效图 (image/anim/, 配 room:doSuperLightBox), kingdom=势力图 (image/kingdom/，尺寸有讲究，建议改用 xinyue_kingdom_assets 生成), mark=标记角标 (image/mark/). Defaults to generals.' },
      taskId: { type: 'string', description: 'Task ID from the task message. Passing it records the images as delivered so the task can auto-complete.' },
      images: {
        type: 'array', required: true,
        description: 'Images to copy.',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            source: { type: 'string', required: true, description: 'Absolute local source path.' },
            target: { type: 'string', required: true, description: 'Plain file name only, e.g. ts_muou.jpg (no subpaths, no directories).' },
          },
        },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        copied: { type: 'array', items: { type: 'string' } },
        errors: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          source: { type: 'string' }, error: { type: 'string', required: true },
        } } },
        autoCompleted: { type: 'boolean' },
      } },
      render: (args, value) => [{
        type: 'text',
        text: value.ok
          ? `已复制 ${value.copied.length} 张图片到扩展包 image/${(args && args.kind) || 'generals'}/ 目录。${value.autoCompleted ? '任务已自动完成并归档,无需再调用 xinyue_skills_written。' : ''}`
          : `图片复制失败: ${(value.errors || []).map((e) => e.error).join('; ')}`,
      }],
    },
    async execute(args) {
      if (!deps.active) return { ok: false, errors: [{ error: '未配置 xinyueDir,无法复制图片。' }] }
      const result = await copyImages(deps.xinyueDir, args)
      if (result.ok && args.taskId) {
        // 与工坊补图路由同语义:复制成功 → 登记 image/<kind>/<名> → 满足条件自动完成+归档
        // kind 缺省与 images.js 的默认值保持一致(不传就是 generals)。
        const imgKind = args.kind === 'card' ? 'card' : 'generals'
        const firstTarget = String((args.images && args.images[0] && args.images[0].target) || '').replace(/^image\//, '')
        const done = await setTaskImage(deps.dshHomeDir, { taskId: args.taskId, image: firstTarget ? 'image/' + imgKind + '/' + firstTarget : '' })
        if (!done.ok) {
          /* 图片已复制但登记失败(任务不存在/taskId 写错)时不能静默:
           * 此前被无视,工具照样回 ok,任务永远卡在"缺图"上。 */
          result.warning = `图片已复制,但任务登记失败:${done.error || '未知原因'}——请核对 taskId 是否与任务列表一致`
        }
        if (done.autoCompleted) {
          result.autoCompleted = true
          await archiveTask(deps.xinyueDir, {
            folder: args.folder, taskId: args.taskId, kind: done.task.type,
            summary: '全部技能确认无误(AI 复图后自动完成)', rounds: done.task.rounds,
            notes: done.task.notes,
          }).catch(() => ({ totalTasks: 0 }))
        }
      }
      return result
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_kingdom_assets',
    description: 'Generate the FIVE image files a custom 势力(kingdom) needs, from a kingdom emblem and (optionally) a crystal icon: <code>.png 75x75 / <code>-magatama.png 22x27 / <code>-magatama-l,-r 13x20 / <code>-back.png 175x233. Sizes match what FreeKill actually draws (GeneralCardItem.qml:55 badge at 34px wide; PhotoBase back scaled 0.75, only the left ~30px strip shows in game), so do NOT hand-crop. The back gets a vertical KaiTi glyph of the kingdom name baked into its left strip; pass char to choose it.',
    parameters: {
      folder: { type: 'string', required: true, description: 'Extension folder name under packages/.' },
      font: { type: 'string', description: 'KaiTi font path (default C:/Windows/Fonts/simkai.ttf).' },
      kingdoms: {
        type: 'array', required: true,
        description: 'One entry per kingdom.',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            code: { type: 'string', required: true, description: 'Kingdom code used in General(...), e.g. xinglinggan (becomes the file name).' },
            char: { type: 'string', description: 'Single Chinese character baked into the card back strip, e.g. 星.' },
            accent: { type: 'array', items: { type: 'number' }, description: 'RGB accent [r,g,b] sampled from the emblem; drives the strip/back gradient.' },
            icon: { type: 'string', description: 'Absolute path of the kingdom emblem (png/webp/jpg).' },
            crystal: { type: 'string', description: 'Absolute path of the hp crystal icon (optional; without it no magatama files are produced).' },
          },
        },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        dir: { type: 'string' },
        files: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        error: { type: 'string' },
      } },
      render: (_args, value) => [{
        type: 'text',
        text: value.ok
          ? `已生成 ${value.files.length} 张势力图到 ${value.dir}${value.warnings && value.warnings.length ? `\n注意:${value.warnings.join('; ')}` : ''}`
          : `势力图生成失败: ${value.error}`,
      }],
    },
    async execute(args) {
      if (!deps.active) return { ok: false, error: '未配置 xinyueDir(游戏本体目录)。' }
      try {
        return generateKingdomAssets(deps.xinyueDir, args)
      } catch (error) {
        return { ok: false, error: error.message }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_copy_audio',
    description: 'Copy user-provided local voice mp3 files into the extension audio folder (audio/skill for skill voices, audio/death for death voices). NEVER copies into the game core audio directory. Pass taskId (plus skill for skill voices) to record delivery so the task can auto-complete.',
    parameters: {
      folder: { type: 'string', required: true, description: 'Extension folder name.' },
      taskId: { type: 'string', description: 'Task ID from the task message. Passing it records delivery so the task can auto-complete.' },
      audios: {
        type: 'array', required: true,
        description: 'Voice files to copy. One entry per mp3; a skill may have any number of them.',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            source: { type: 'string', required: true, description: 'Absolute local source path (.mp3).' },
            target: { type: 'string', required: true, description: 'audio/ relative path: skill/<skillId>.mp3 for skill voices, death/<generalId>.mp3 for death voices (FreeKill does NOT split one file per line — use a single <ID>.mp3, no <n> suffix; the legacy alias "die" is accepted and normalized to death/). No other directories, no ..' },
            skill: { type: 'string', description: 'For skill/ targets: the skill display name from the task message (records delivery to that skill). death/ targets do not need it.' },
          },
        },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        copied: { type: 'array', items: { type: 'string' } },
        errors: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          source: { type: 'string' }, error: { type: 'string', required: true },
        } } },
        autoCompleted: { type: 'boolean' },
      } },
      render: (_args, value) => [{
        type: 'text',
        text: value.ok
          ? `已复制 ${value.copied.length} 个配音到扩展包 audio/ 目录。${value.autoCompleted ? '任务已自动完成并归档,无需再调用 xinyue_skills_written。' : ''}`
          : `配音复制失败: ${(value.errors || []).map((e) => e.error).join('; ')}`,
      }],
    },
    async execute(args) {
      if (!deps.active) return { ok: false, errors: [{ error: '未配置 xinyueDir,无法复制配音。' }] }
      const result = await copyAudios(deps.xinyueDir, args)
      if (result.ok && args.taskId) {
        // 按 target 目录分流登记:skill/ → 对应技能(需 skill 名),death/ → 任务级。
        // 任一 setter 触发自动完成即记下任务、循环后归档一次——后续 setter 对已
        // done 的任务返回 autoCompleted=false,不能让它覆盖完成信号。
        const bySkill = new Map()
        const deathFiles = []
        const invalid = []
        for (const item of args.audios || []) {
          const target = String(item.target || '').replace(/\\/g, '/')
          const kind = audioTargetKind(target)
          const skill = String(item.skill || '').trim()
          if (kind === 'skill' && skill) {
            const list = bySkill.get(skill) || []
            list.push(target)
            bySkill.set(skill, list)
          } else if (kind === 'death') {
            deathFiles.push(target)
          } else {
            invalid.push({ source: item.source, error: kind === 'skill'
              ? `target「${target}」是技能配音但没带 skill 参数(任务里的技能显示名),该句已复制但交付未登记`
              : `target「${target}」不是 skill/ 或 death/ 开头,无法归属` })
          }
        }
        let completedTask = null
        let setterError = null
        for (const [skill, files] of bySkill) {
          const r = await setSkillAudioFiles(deps.dshHomeDir, { taskId: args.taskId, skill, files })
          if (r.ok) { if (r.autoCompleted) completedTask = r.task } else setterError = `${skill}: ${r.error}`
        }
        if (deathFiles.length) {
          const r = await setDieAudioFiles(deps.dshHomeDir, { taskId: args.taskId, files: deathFiles })
          if (r.ok) { if (r.autoCompleted) completedTask = r.task } else setterError = r.error
        }
        if (invalid.length) {
          result.errors = (result.errors || []).concat(invalid)
          result.ok = false
        }
        if (setterError) {
          result.errors = (result.errors || []).concat([{ source: '', error: setterError }])
          result.ok = false
        }
        if (completedTask) {
          result.autoCompleted = true
          await archiveTask(deps.xinyueDir, {
            folder: args.folder, taskId: args.taskId, kind: completedTask.type,
            summary: '全部技能确认无误(配音齐后自动完成)', rounds: completedTask.rounds,
            notes: completedTask.notes,
          }).catch(() => ({ totalTasks: 0 }))
        }
      }
      return result
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_skills_written',
    description: 'Mark task skills as written (awaiting user in-game test). Call after all skills of the task are implemented, validated and written. The task auto-completes when the user confirms every skill. For mode tasks (custom game mode), the names are rule-node names from the task message and are registered dynamically on first call — pass every rule node verbatim.',
    parameters: {
      taskId: { type: 'string', required: true, description: 'Task ID from the task message, verbatim.' },
      skills: { type: 'array', required: true, items: { type: 'string' }, description: 'Skill display names implemented in this round (mode task: rule-node names, registered dynamically).' },
      notes: { type: 'array', items: { type: 'string' }, description: 'OPTIONAL engine-level, reusable lessons only (API behavior, global pitfalls) worth keeping for future tasks of this package. NEVER task-specific implementation details.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        marked: { type: 'integer' },
        missing: { type: 'array', items: { type: 'string' } },
        notesStored: { type: 'integer' },
        confirmed: { type: 'integer' },
        total: { type: 'integer' },
        autoCompleted: { type: 'boolean' },
        reopened: { type: 'boolean' },
        error: { type: 'string'},
      } },
      render: (_args, value) => [{
        type: 'text',
        text: value.ok
          ? `已标记 ${value.marked} 个技能待测试(确认 ${value.confirmed}/${value.total})${value.notesStored ? `,存 ${value.notesStored} 条注意点` : ''}。告诉用户:可以进游戏测试了,测试通过请在任务列表点「✅ 确认无误」。`
          : `标记失败: ${value.error}`,
      }],
    },
    async execute(args) {
      if (!deps.active) return { ok: false, error: '未配置 xinyueDir,无法更新任务。' }
      const result = await markSkillsWritten(deps.dshHomeDir, args)
      if (!result.ok) {
        // markSkillsWritten 的 missing 分支不设 error 字段——这里绝不能把
        // undefined 塞进返回对象(lossless JSON 拒收,实测「标记既有技能名」必炸)。
        const detail = result.error
          || ((result.missing || []).length
            ? '这些名称不在任务技能清单里: ' + result.missing.join('、')
              + ((result.task && result.task.skills || []).length
                ? '(任务技能节点: ' + result.task.skills.map((s) => s.name).join('、') + ')——skills 参数必须逐字使用任务技能节点的名称'
                : '')
            : '任务更新失败。')
        return { ok: false, error: detail }
      }
      return { ok: true, marked: result.marked, missing: result.missing, reopened: Boolean(result.reopened), notesStored: result.notesStored || 0, confirmed: result.task.skills.filter((s) => s.status === 'confirmed').length, total: result.task.skills.length, autoCompleted: false }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'xinyue_record_change',
    description: 'Record a FREE-FORM change (no workshop task ID) into the package history — use it for work the task model cannot hold: kingdom art, shared helper functions, cross-package adjustments, a stray-file cleanup, an ad-hoc bug fix, or a design discussion worth remembering. Entries land in <package>/xinyue-kit.history.json under changes[] and never affect the 待确认/已确认 state machine. Call it once after finishing such work, with one clear sentence plus the files touched.',
    parameters: {
      folder: { type: 'string', required: true, description: 'Package folder name under packages/.' },
      summary: { type: 'string', required: true, description: 'One sentence: what changed and why (shown in the history panel).' },
      kind: { type: 'string', enum: ['edit', 'fix', 'asset', 'discussion'], description: 'edit=改代码/结构, fix=修 bug, asset=素材/图片/语音, discussion=只讨论未落地。Defaults to edit.' },
      files: { type: 'array', items: { type: 'string' }, description: 'Package-relative files touched, e.g. ["pkg/xianfeng/skills/x.lua", "image/kingdom/xinglinggan.png"].' },
      taskId: { type: 'string', description: 'Attach to a workshop task ID if this really belongs to one.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        changeCount: { type: 'integer' },
        error: { type: 'string' },
      } },
      render: (_args, value) => [{
        type: 'text',
        text: value.ok
          ? `已记入 ${value.changeCount} 条自由修改流水(历史面板可见)。`
          : `记录失败: ${value.error}`,
      }],
    },
    async execute(args) {
      if (!deps.active) return { ok: false, error: '未配置 xinyueDir,无法写入历史。' }
      try {
        return await recordChange(deps.xinyueDir, args)
      } catch (error) {
        return { ok: false, error: error.message }
      }
    },
  }))

  // ── 3) 守卫:extension 目录的写操作必须走专用工具 ─────────────
  // 始终注册,内部动态判断 active:工坊向导热初始化后立即生效。
  // 判定逻辑在 src/guard.js(纯函数、有单测):路径归一化(反斜杠/正斜杠/
  // git-bash 盘符/.. 折叠)→ 归属判断;bash 另做"先 cd 进保护目录再相对写"
  // 的组合判定,并区分读写(纯读命令照旧放行)。
}