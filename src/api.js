/**
 * 工坊 HTTP API(/xinyue-kit-api/*)——从 index.js 抽出的路由层。
 *
 * 为什么单独一层:index.js 原本 1400+ 行,工具注册 + 守卫 + 26 条 if 路由挤在一起,
 * 改一条路由要滚半天。这里只保留「请求 → 响应」,业务仍由 src/ 下各模块承担。
 *
 * 约定:
 * · 所有依赖经 deps 注入;其中 active / xinyueDir 是 getter(每次请求现取,
 *   否则用户在工坊里改完游戏目录后本进程会一直用旧值);
 * · 非 GET 请求先过 Origin / Content-Type 校验(CSRF / DNS rebinding),再看路由;
 * · 路由自上而下匹配;!active 闸门之前的都是「有没有游戏目录都能用」的接口。
 * @param {object} deps
 * @returns {(req: any, res: any) => Promise<void>}
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export function createApiHandler(deps) {
  const {
    config, saved, detectCache, settingsPath, dshHomeDir, pkgVersion,
    isValidGameDir, setActive, readSettingsFile, writeJsonAtomicSync,
    clampBashMaxOutput, BASH_MAX_OUTPUT_DEFAULT, BASH_MAX_OUTPUT_MIN, BASH_MAX_OUTPUT_MAX,
    listExtensionFolders, listTasks, createTask, skillFeedback, setSkillStatus, getTask,
    copyImages, setTaskImage, copyAudios, setSkillAudioFiles, setDieAudioFiles, audioTargetKind,
    deleteTask, reopenTask, completeById, archiveTask, updatePayload, declarativePreset,
    readPresetStatus, installPreset, presetDir, bundledDir, readExtension, listDirForPicker,
    listEntries, listEntrySkills, readHistory, listBackups, listExtensionHistories, deleteNote,
    migrateExtension, recordBackup, prunePackageBackups, rollbackExtension,
  } = deps

  return async function handleApiRequest(req, res) {
    const active = deps.active
    const xinyueDir = deps.xinyueDir
      const url = new URL(req.url ?? '/', 'http://x')
      /* json 必须是函数声明(或用前定义):下面的 CSRF 分支要用它,而 `const json = …`
       * 会让同步先执行的分支撞 TDZ → ReferenceError,403 根本发不出去(实测) */
      function json(status, body) {
        const bodyText = JSON.stringify(body)
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
        res.end(bodyText)
      }
      /* 同源防护(CSRF / DNS rebinding):本接口能改游戏目录、删任务、回滚文件,
       * 却只监听回环——浏览器里打开的任何恶意页面都能用简单请求(表单/text-plain)
       * 打到 127.0.0.1:<端口>。这里对**所有非 GET** 请求要求 Origin 为空(非浏览器)
       * 或为回环来源;来源可疑直接 403。 */
      if (req.method !== 'GET') {
        const origin = String(req.headers.origin || '')
        const host = String(req.headers.host || '')
        const allowed = (o) => {
          if (!o) return true
          try {
            const u = new URL(o)
            return (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '[::1]') && u.host === host
          } catch { return false }
        }
        if (!allowed(origin)) {
          return json(403, { ok: false, error: '仅接受来自本机工坊页面的请求(Origin 校验未通过)' })
        }
        /* 简单请求绕过预检的另一个口子:content-type 不是 JSON 的 POST 也拒 */
        const ctype = String(req.headers['content-type'] || '')
        if (ctype && !ctype.includes('application/json')) {
          return json(415, { ok: false, error: '请求必须是 application/json' })
        }
      }
      const readBody = async () => {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      }
      try {
        // 初始化三件套:任何状态下都可用(否则没配置时连向导都没法用)
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/status') {
          return json(200, { active, xinyueDir: active ? xinyueDir : '', source: config.xinyueDir && isValidGameDir(config.xinyueDir) ? 'cordis.yml' : (saved.xinyueDir ? 'workshop' : 'none') })
        }
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/detect') {
          // 结果缓存 60 秒:用户反复点扫描按钮时不要反复读盘
          if (detectCache.at && Date.now() - detectCache.at < 60_000) {
            return json(200, { candidates: detectCache.list })
          }
          const candidates = await detectCandidates()
          detectCache.at = Date.now()
          detectCache.list = candidates
          return json(200, { candidates })
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/init') {
          const body = await readBody()
          const result = setActive(body.xinyueDir)
          if (result.error) return json(400, { ok: false, error: result.error })
          const next = readSettingsFile()
          next.xinyueDir = xinyueDir
          writeJsonAtomicSync(settingsPath, next)
          console.log(`[xinyue-kit] 工坊向导已启用游戏目录: ${xinyueDir}`)
          return json(200, { ok: true, xinyueDir, adjustedFrom: result.adjustedFrom || null })
        }
        // 工坊设置(⚙ 子页):bash 输出阀门等。任何状态可读写;bash 阀门
        // 由 custom-bash 在新会话挂载时读取,保存后对新会话生效。
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/settings') {
          // 读文件而不是用启动时的 saved 快照:否则保存后刷新页面会看到改动前的值
          const current = readSettingsFile()
          return json(200, {
            version: pkgVersion,
            xinyueDir: active ? xinyueDir : '',
            source: config.xinyueDir && isValidGameDir(config.xinyueDir) ? 'cordis.yml' : (current.xinyueDir ? 'workshop' : 'none'),
            extensions: active ? listExtensionFolders(xinyueDir) : [],
            bashMaxOutputBytes: clampBashMaxOutput(current.bashMaxOutputBytes) ?? BASH_MAX_OUTPUT_DEFAULT,
            updateCheck: current.updateCheck !== false,
          })
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/settings') {
          const body = await readBody()
          const next = readSettingsFile()
          const applied = []
          if (body.bashMaxOutputBytes !== undefined) {
            const v = clampBashMaxOutput(body.bashMaxOutputBytes)
            if (v === null) return json(400, { ok: false, error: `bashMaxOutputBytes 必须是 ${BASH_MAX_OUTPUT_MIN}~${BASH_MAX_OUTPUT_MAX} 之间的整数` })
            next.bashMaxOutputBytes = v
            applied.push(`bash 单次输出上限 ${v} 字节`)
          }
          if (body.updateCheck !== undefined) {
            next.updateCheck = Boolean(body.updateCheck)
            applied.push(`启动时检查更新 ${next.updateCheck ? '开' : '关'}`)
          }
          if (!applied.length) return json(400, { ok: false, error: '没有可保存的设置项' })
          writeJsonAtomicSync(settingsPath, next)
          console.log(`[xinyue-kit] 设置已保存:${applied.join(' / ')}(新会话生效)`)
          return json(200, {
            ok: true,
            bashMaxOutputBytes: clampBashMaxOutput(next.bashMaxOutputBytes) ?? BASH_MAX_OUTPUT_DEFAULT,
            updateCheck: next.updateCheck !== false,
          })
        }
        // 任务登记处:读列表不要求已配置;创建/反馈/完成要求已配置(要有扩展文件夹)
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/tasks') {
          const openOnly = url.searchParams.get('open') === '1'
          return json(200, { tasks: await listTasks(dshHomeDir, { openOnly }) })
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/tasks') {
          if (!active) return json(503, { error: 'xinyue-kit 未配置 xinyueDir(或目录无效),无法创建任务' })
          const body = await readBody()
          const result = await createTask(dshHomeDir, body)
          return json(result.ok ? 200 : 400, result)
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/tasks/feedback') {
          if (!active) return json(503, { error: 'xinyue-kit 未配置 xinyueDir(或目录无效)' })
          const body = await readBody()
          const result = await skillFeedback(dshHomeDir, body)
          return json(result.ok ? 200 : 400, result)
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/tasks/skill-status') {
          if (!active) return json(503, { error: 'xinyue-kit 未配置 xinyueDir(或目录无效)' })
          const body = await readBody()
          const result = await setSkillStatus(dshHomeDir, body)
          if (!result.ok) return json(400, result)
          let archived = { totalTasks: 0 }
          if (result.autoCompleted) {
            archived = await archiveTask(xinyueDir, {
              folder: result.task.folder, taskId: result.task.id, kind: result.task.type,
              /* 缺图提示只对「需要图的任务」成立:mode 任务与编辑任务(isCompletable 已豁免)
               * 不该在历史摘要里被标「注意:缺图片」(实测:这两类全被误标) */
              summary: '全部技能确认无误' + ((result.task.image || result.task.type === 'mode' || result.task.target) ? '' : '(注意:缺图片)'),
              notes: result.task.notes, rounds: result.task.rounds,
            }).catch(() => ({ totalTasks: 0 }))
          }
          return json(200, { ok: true, autoCompleted: result.autoCompleted, confirmed: result.confirmed, total: result.total, archived: archived.totalTasks })
        }
        /* 只读目录浏览(工坊「📁 选择文件」用):让用户点着选文件,不必再手抄路径。
         * 无 dir → 只回常用位置;有 dir → 只列一层。
         * 只读、不递归、不写入;不依赖 xinyueDir,没配游戏目录也能挑素材。 */
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/fs/list') {
          const result = listDirForPicker({
            dir: url.searchParams.get('dir') || '',
            filter: url.searchParams.get('filter') || '',
            limit: url.searchParams.get('limit') || undefined,
          })
          return json(result.ok ? 200 : 400, result)
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/tasks/image') {
          // 补图 = 复制文件进扩展包 image/<kind>/ + 登记进任务(一步到位)
          if (!active) return json(503, { error: 'xinyue-kit 未配置 xinyueDir(或目录无效)' })
          const body = await readBody()
          const src = String(body.source || '').trim()
          if (!src) return json(400, { ok: false, error: '图片本地路径为空' })
          const fileName = String(body.fileName || '').trim() || src.split(/[\\/]/).pop() || ''
          // kind 优先取显式 body.kind;没传时按**任务类型**推导(卡牌任务→card,其余→generals),
          // 这样即使 UI 没送 kind(工坊「📷 补图」按钮当前就不送),卡图也不会落进 image/generals/。
          const taskForKind = body.taskId ? await getTask(dshHomeDir, body.taskId).catch(() => null) : null
          const taskType = taskForKind && (taskForKind.type || (taskForKind.task && taskForKind.task.type))
          const imgKind = (body.kind === 'card' || body.kind === 'generals')
            ? body.kind
            : (taskType === 'card' ? 'card' : 'generals')
          const copy = await copyImages(xinyueDir, { folder: body.folder, kind: imgKind, images: [{ source: src, target: fileName }] })
          if (!copy.ok) return json(400, { ok: false, error: copy.errors.map((e) => e.error).join('; ') })
          const result = await setTaskImage(dshHomeDir, { taskId: body.taskId, image: 'image/' + imgKind + '/' + fileName })
          if (!result.ok) return json(400, result)
          let archived = { totalTasks: 0 }
          if (result.autoCompleted) {
            archived = await archiveTask(xinyueDir, {
              folder: result.task.folder, taskId: result.task.id, kind: result.task.type,
              summary: '全部技能确认无误(补图后自动完成)', rounds: result.task.rounds,
              notes: result.task.notes,
            }).catch(() => ({ totalTasks: 0 }))
          }
          return json(200, { ok: true, autoCompleted: result.autoCompleted, task: result.task, copied: copy.copied, archived: archived.totalTasks })
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/tasks/audio') {
          // 补配音 = 复制 mp3 进扩展包 audio/ + 登记进任务(一步到位)。
          // target 必须带 skill/或death/ 前缀(client 负责拼);skill/ 时 body.skill
          // 指定归属技能(任务里的技能显示名),death/ 登记到任务级。
          if (!active) return json(503, { error: 'xinyue-kit 未配置 xinyueDir(或目录无效)' })
          const body = await readBody()
          const src = String(body.source || '').trim()
          const target = String(body.target || '').trim()
          if (!src) return json(400, { ok: false, error: '配音本地路径为空' })
          const kind = audioTargetKind(target)
          if (!kind) return json(400, { ok: false, error: '目标必须是 skill/文件名.mp3 或 death/文件名.mp3' })
          if (kind === 'skill' && !String(body.skill || '').trim()) {
            return json(400, { ok: false, error: '技能配音(skill/)需要指定归属技能(skill = 任务里的技能显示名)' })
          }
          const copy = await copyAudios(xinyueDir, { folder: body.folder, audios: [{ source: src, target }] })
          if (!copy.ok) return json(400, { ok: false, error: copy.errors.map((e) => e.error).join('; ') })
          const result = kind === 'skill'
            ? await setSkillAudioFiles(dshHomeDir, { taskId: body.taskId, skill: body.skill, files: [target] })
            : await setDieAudioFiles(dshHomeDir, { taskId: body.taskId, files: [target] })
          if (!result.ok) return json(400, result)
          let archived = { totalTasks: 0 }
          if (result.autoCompleted) {
            archived = await archiveTask(xinyueDir, {
              folder: result.task.folder, taskId: result.task.id, kind: result.task.type,
              summary: '全部技能确认无误(补配音后自动完成)', rounds: result.task.rounds,
              notes: result.task.notes,
            }).catch(() => ({ totalTasks: 0 }))
          }
          return json(200, { ok: true, autoCompleted: result.autoCompleted, task: result.task, copied: copy.copied, archived: archived.totalTasks })
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/tasks/delete') {
          if (!active) return json(503, { error: 'xinyue-kit 未配置 xinyueDir(或目录无效)' })
          const body = await readBody()
          const result = await deleteTask(dshHomeDir, body.taskId)
          return json(result.ok ? 200 : 400, result)
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/tasks/reopen') {
          // 重开已完成任务(补图/重新确认后再收口)
          if (!active) return json(503, { error: 'xinyue-kit 未配置 xinyueDir(或目录无效)' })
          const body = await readBody()
          const result = await reopenTask(dshHomeDir, body)
          return json(result.ok ? 200 : 400, result)
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/tasks/complete') {
          if (!active) return json(503, { error: 'xinyue-kit 未配置 xinyueDir(或目录无效)' })
          const body = await readBody()
          const done = await completeById(dshHomeDir, body)
          if (!done.ok) return json(400, done)
          const archived = await archiveTask(xinyueDir, {
            folder: done.task.folder, taskId: done.task.id, kind: done.task.type,
            summary: body.summary || done.task.summary || '手动标记完成',
            notes: (body.notes && body.notes.length ? body.notes : done.task.notes), rounds: Math.max(body.rounds || 1, done.task.rounds || 1),
          }).catch(() => ({ totalTasks: 0 }))
          return json(200, { ok: true, task: done.task, totalTasks: archived.totalTasks })
        }
        // 版本与一致性(⚙ 设置页):刻意放在下面这道 503 闸门之前 —— 没配游戏目录
        // 的新用户正是最需要看到「preset 未安装」的时候。
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/update') {
          return json(200, await updatePayload(false))
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/update/check') {
          return json(200, await updatePayload(true))
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/preset/install') {
          if (declarativePreset) {
            return json(200, {
              ok: false,
              error: '当前 DSH(0.1.7+)的 preset 是声明式的,随插件自动就位并随插件更新——无需也不可手动重装。改动要生效请重启 dsh。',
              preset: readPresetStatus(),
            })
          }
          const result = installPreset({ presetDir, bundledDir })
          if (result.ok) {
            console.log(`[xinyue-kit] preset 已重装${result.backup ? ',旧版备份到 ' + result.backup : ''}(新会话生效)`)
          }
          return json(result.ok ? 200 : 400, { ...result, preset: readPresetStatus() })
        }
        // 以下都需要已配置
        if (!active) return json(503, { error: 'xinyue-kit 未配置 xinyueDir(或目录无效):请在工坊「初始化向导」里完成配置' })
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/extension') {
          const folder = url.searchParams.get('folder') || ''
          try { return json(200, await readExtension(xinyueDir, folder)) } catch (error) {
            return json(200, { folder, files: [], error: error.message })
          }
        }
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/kingdoms') {
          // 工坊表单「势力」下拉：扫本机所有扩展包 init.lua 里 General(...) 的势力代号
          const base = { wei: '魏', shu: '蜀', wu: '吴', qun: '群', god: '神', jin: '晋', jin_: '晋', unknown: '未知', wild: '野心家', n_pigeon: '鸽' }
          const found = new Map()
          for (const code of Object.keys(base)) found.set(code, 0)
          const scan = function (file) {
            try {
              const code = readFileSync(file, 'utf8')
              const re = /General\s*\(\s*[^,]+,\s*[^,]+,\s*['"]([A-Za-z0-9_]+)['"]/g
              let m
              while ((m = re.exec(code)) !== null) found.set(m[1], (found.get(m[1]) || 0) + 1)
            } catch (error) { /* 未标注或读不到：跳过 */ }
          }
          try {
            const root = join(xinyueDir, 'packages')
            for (const dir of readdirSync(root, { withFileTypes: true })) {
              if (!dir.isDirectory()) continue
              scan(join(root, dir.name, 'init.lua'))
              try {
                for (const sub of readdirSync(join(root, dir.name, 'pkg'), { withFileTypes: true })) {
                  if (sub.isDirectory()) scan(join(root, dir.name, 'pkg', sub.name, 'init.lua'))
                }
              } catch (error) { /* 没有 pkg/ 子包 */ }
            }
          } catch (error) { /* packages/ 不可读时只回内置列表 */ }
          return json(200, {
            ok: true,
            kingdoms: Array.from(found.entries()).map(function (kv) {
              return { code: kv[0], count: kv[1], label: base[kv[0]] || kv[0] }
            }).sort(function (a, b) { return (b.count || 0) - (a.count || 0) }),
          })
        }
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/entries') {
          // 工坊「编辑已有武将/卡牌」下拉:列出包内条目 id(只读)
          const folder = url.searchParams.get('folder') || ''
          const kind = url.searchParams.get('kind') || ''
          try { return json(200, await listEntries(xinyueDir, folder, kind)) } catch (error) {
            return json(200, { ok: false, kind, entries: [], error: error.message })
          }
        }
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/entry-skills') {
          // 工坊「编辑已有武将」:列出选中条目 skills 数组里的技能(勾选候选,只读)
          const folder = url.searchParams.get('folder') || ''
          const entryId = url.searchParams.get('id') || ''
          try { return json(200, await listEntrySkills(xinyueDir, folder, entryId)) } catch (error) {
            return json(200, { ok: false, skills: [], error: error.message })
          }
        }
        if (req.method === 'GET' && url.pathname === '/xinyue-kit-api/history') {
          const folder = url.searchParams.get('folder')
          if (folder) {
            return json(200, { folder, history: await readHistory(xinyueDir, folder), backups: await listBackups(xinyueDir, folder) })
          }
          return json(200, { extensions: await listExtensionHistories(xinyueDir) })
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/history/note-delete') {
          // 注意点单条删除(历史页修剪;用户手动触发)
          if (!active) return json(503, { ok: false, error: 'xinyue-kit 未配置 xinyueDir' })
          const body = await readBody()
          try { return json(200, await deleteNote(xinyueDir, body.folder, Number(body.index))) }
          catch (error) { return json(400, { ok: false, error: error.message }) }
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/blocks/migrate') {
          // 锚点化迁移:只由用户在工坊手动触发,AI 侧没有任何工具能调它。
          // 多文件包:遍历全部 .js,对含条目的文件逐个锚点化(壳文件自动跳过)
          if (!active) return json(503, { ok: false, error: 'xinyue-kit 未配置 xinyueDir' })
          const body = await readBody()
          try {
            const result = await migrateExtension(xinyueDir, body.folder)
            if (result.ok) {
              for (const f of result.files) {
                if (f.backup) await recordBackup(xinyueDir, body.folder, f.backup)
              }
            }
            return json(result.ok ? 200 : 400, result)
          } catch (error) { return json(400, { ok: false, error: error.message }) }
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/backups/prune') {
          // 备份滚动清理(工坊历史面板按钮):包内所有 backup/ 只保留最新 3 个
          if (!active) return json(503, { ok: false, error: 'xinyue-kit 未配置 xinyueDir' })
          const body = await readBody()
          try { return json(200, await prunePackageBackups(xinyueDir, body.folder)) }
          catch (error) { return json(400, { ok: false, error: error.message }) }
        }
        if (req.method === 'POST' && url.pathname === '/xinyue-kit-api/rollback') {
          const body = await readBody()
          const result = await rollbackExtension(xinyueDir, body.folder, body.backup)
          await recordBackup(xinyueDir, body.folder, `回滚自 ${body.backup}`)
          return json(200, { ok: true, ...result })
        }
        return json(404, { error: 'not found' })
      } catch (error) {
        return json(500, { error: error.message })
      }
  }
}