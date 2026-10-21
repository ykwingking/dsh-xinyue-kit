/**
 * xinyue-kit 任务历史:每个扩展文件夹一份 xinyue-kit.history.json,跟着扩展走。
 * 记录:任务列表(类型/摘要/返工轮次/时间)、注意点(踩坑记录)、备份事件。
 * 历史面板(Web 界面)与 AI 的 xinyue_skills_written 都读写这份文件。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { extRootOf, safeFolderPath } from './write.js'
import { writeJsonAtomicSync } from './store.js'

const HISTORY_FILE = 'xinyue-kit.history.json'

function emptyHistory() {
  return { version: 1, tasks: [], notes: [], backups: [], changes: [] }
}

function folderPath(xinyueDir, folder) {
  const { full } = safeFolderPath(xinyueDir, folder)
  return full
}

export async function readHistory(xinyueDir, folder) {
  try {
    const raw = await readFile(join(folderPath(xinyueDir, folder), HISTORY_FILE), 'utf8')
    const parsed = JSON.parse(raw)
    const history = { ...emptyHistory(), ...parsed }
    // 形状容错:字段被手改坏(如 tasks:null)时回退默认,别让历史面板整页 500
    if (!Array.isArray(history.tasks)) history.tasks = []
    if (!Array.isArray(history.notes)) history.notes = []
    /* backups 也要兜:被手改坏(如 {})时 recordBackup 的 .push 会抛,
     * 异常会冒到写入工具层,把"已写入"报成"写入失败"(工具层 catch 在写入之后) */
    if (!Array.isArray(history.backups)) history.backups = []
    /* changes:自由修改(没有工坊任务 ID 的改动)的流水账,见 recordChange */
    if (!Array.isArray(history.changes)) history.changes = []
    return history
  } catch {
    return emptyHistory()
  }
}

async function updateHistory(xinyueDir, folder, mutate) {
  const full = folderPath(xinyueDir, folder)
  const history = await readHistory(xinyueDir, folder)
  mutate(history)
  writeJsonAtomicSync(join(full, HISTORY_FILE), history)
  return history
}

/**
 * 归档一条任务到扩展文件夹 history(幂等):同一 taskId 已存在时更新既有条目
 * (摘要/注意点合并,轮次取较大值),不再追加——防止"AI 收口 + 用户手动标记"
 * 各记一条导致的重复。
 */
export async function archiveTask(xinyueDir, { folder, taskId, kind, summary, notes, rounds }) {
  const full = folderPath(xinyueDir, folder)
  const history = await readHistory(xinyueDir, folder)
  let entry = taskId ? history.tasks.find((t) => t.taskId === taskId) : null
  if (!entry) {
    entry = {
      id: 'task-' + Date.now(),
      taskId: taskId || null,
      folder,
      /* 三值映射:任务层的值就是 general/card/mode,此前兜底成 character 与实际不符 */
      kind: kind === 'card' || kind === 'mode' ? kind : 'general',
      summary: '',
      notes: [],
      rounds: 1,
      at: Date.now(),
    }
    history.tasks.push(entry)
    if (history.tasks.length > 200) history.tasks = history.tasks.slice(-200)
  }
  if (summary) entry.summary = String(summary).slice(0, 2000)
  entry.rounds = Math.max(entry.rounds || 1, Number(rounds) || 1)
  if (Array.isArray(notes) && notes.length) {
    for (const n of notes) {
      const v = String(n).slice(0, 500)
      if (v && !history.notes.includes(v)) history.notes.push(v)
      if (v && !entry.notes.includes(v)) entry.notes.push(v)
    }
    if (history.notes.length > 100) history.notes = history.notes.slice(-100)
    if (entry.notes.length > 20) entry.notes = entry.notes.slice(-20)
  }
  entry.updatedAt = Date.now()
  writeJsonAtomicSync(join(full, HISTORY_FILE), history)
  return { ok: true, task: entry, totalTasks: history.tasks.length }
}

/** 记录一次写入事件(供备份清单展示)。 */
export async function recordBackup(xinyueDir, folder, backupFile) {  if (!backupFile) return
  return updateHistory(xinyueDir, folder, (history) => {
    history.backups.push({ file: backupFile, at: Date.now() })
    if (history.backups.length > 50) history.backups = history.backups.slice(-50)
  })
}

/**
 * 备份滚动清理的登记同步:备份文件被 pruneBackups 删除后,把 history.backups
 * 里指向它们的条目(含「回滚自 x」类文案条目)一并移除,避免登记指向不存在的文件。
 */
export async function pruneBackupRecords(xinyueDir, folder, removedFiles) {
  if (!Array.isArray(removedFiles) || !removedFiles.length) return
  const norm = (s) => String(s || '').split('\\').join('/')
  const removed = new Set(removedFiles.map(norm))
  const removedBase = new Set(removedFiles.map((f) => norm(f).split('/').pop()))
  await updateHistory(xinyueDir, folder, (history) => {
    if (!Array.isArray(history.backups)) return
    history.backups = history.backups.filter((b) => {
      const f = norm(b && b.file)
      if (!f) return true
      const base = f.split('/').pop()
      // basename 匹配只用于无路径的登记(如「回滚自 x」文案),防跨目录同名误删
      return !removed.has(f) && !(removedBase.has(base) && !f.includes('/'))
    })
  })
}

/** 删除一条注意点(历史页修剪用;不动 tasks 归档)。 */
export async function deleteNote(xinyueDir, folder, index) {
  const full = folderPath(xinyueDir, folder)
  const history = await readHistory(xinyueDir, folder)
  /* NaN/小数会穿过 range 检查:Number(undefined)=NaN,splice(NaN,1) 等价于删第 0 条
   * ——实测"删注意点"传 undefined 会把第一条悄悄删掉。必须整数校验 */
  if (!Number.isInteger(index) || !Array.isArray(history.notes) || index < 0 || index >= history.notes.length) {
    return { ok: false, error: '注意点不存在' }
  }
  history.notes.splice(index, 1)
  writeJsonAtomicSync(join(full, HISTORY_FILE), history)
  return { ok: true, noteCount: history.notes.length }
}

/**
 * 记录一次「自由修改」:没有工坊任务 ID 的改动(改势力图、公共函数、跨包调整、临时修 bug…)。
 * 工坊的任务模型是「一个任务 = 一个武将/卡牌/模式」,装不下这类改动;
 * 以前这类活干完就只剩对话,下次会话完全不知道发生过什么 —— 所以才有了这条流水账。
 * 与 tasks 分开存:changes 不参与「待确认/已确认」状态机。
 */
export async function recordChange(xinyueDir, { folder, summary, files, kind, taskId } = {}) {
  const text = String(summary || '').trim()
  if (!text) return { ok: false, error: 'summary 不能为空:用一句话说清这次改了什么' }
  const list = Array.isArray(files) ? files.map((f) => String(f).slice(0, 200)).slice(0, 50) : []
  const history = await updateHistory(xinyueDir, folder, (h) => {
    const entry = {
      id: 'change-' + Date.now(),
      kind: kind === 'discussion' || kind === 'fix' || kind === 'asset' ? kind : 'edit',
      summary: text.slice(0, 1000),
      files: list,
      taskId: taskId ? String(taskId) : null,
      at: Date.now(),
    }
    h.changes.push(entry)
    if (h.changes.length > 100) h.changes = h.changes.slice(-100)
  })
  return { ok: true, changeCount: history.changes.length, last: history.changes[history.changes.length - 1] }
}

/** 列出 extension 目录下所有带历史的扩展(历史面板用)。 */
export async function listExtensionHistories(xinyueDir) {
  const root = extRootOf(xinyueDir)
  let folders
  try { folders = await readdir(root, { withFileTypes: true }) } catch { return [] }
  const out = []
  for (const entry of folders) {
    if (!entry.isDirectory()) continue
    const history = await readHistory(xinyueDir, entry.name)
    const last = history.tasks[history.tasks.length - 1]
    const totalRounds = history.tasks.reduce((sum, t) => sum + (t.rounds || 1), 0)
    out.push({
      folder: entry.name,
      taskCount: history.tasks.length,
      totalRounds,
      noteCount: history.notes.length,
      backupCount: history.backups.length,
      lastTask: last ? { summary: last.summary, kind: last.kind, at: last.at } : null,
    })
  }
  return out.sort((a, b) => (b.lastTask?.at || 0) - (a.lastTask?.at || 0))
}
