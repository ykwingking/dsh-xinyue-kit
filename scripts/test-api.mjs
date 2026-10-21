/**
 * 路由层冒烟测试:不启动 dsh、不碰真实游戏目录,用桩替身跑 src/api.js。
 * 目的:抽出 API 层后,任何路由改名/依赖漏注入都能在几秒内发现。
 * 用法:node scripts/test-api.mjs
 */
import { createApiHandler } from '../src/api.js'

const noop = async () => ({ ok: true })
const deps = {
  config: { xinyueDir: 'D:/fake-game' },
  saved: {},
  detectCache: { at: 0, list: [] },
  settingsPath: 'D:/fake-dsh/xinyue-kit.json',
  dshHomeDir: 'D:/fake-dsh',
  pkgVersion: '9.9.9',
  get active() { return true },
  get xinyueDir() { return 'D:/fake-game' },
  isValidGameDir: () => true,
  setActive: () => ({ ok: true }),
  readSettingsFile: () => ({ bashMaxOutputBytes: 64000 }),
  writeJsonAtomicSync: () => {},
  clampBashMaxOutput: (v) => (v === null || v === undefined ? null : Number(v)),
  BASH_MAX_OUTPUT_DEFAULT: 64000,
  BASH_MAX_OUTPUT_MIN: 64000,
  BASH_MAX_OUTPUT_MAX: 256000,
  listExtensionFolders: () => ['cfwl'],
  listTasks: async () => [],
  createTask: noop,
  skillFeedback: noop,
  setSkillStatus: async () => ({ ok: true, autoCompleted: false, confirmed: 0, total: 0 }),
  getTask: async () => null,
  copyImages: async () => ({ ok: true, copied: [] }),
  setTaskImage: noop,
  copyAudios: async () => ({ ok: true, copied: [] }),
  setSkillAudioFiles: noop,
  setDieAudioFiles: noop,
  audioTargetKind: () => 'skill',
  deleteTask: noop,
  reopenTask: noop,
  completeById: noop,
  archiveTask: async () => ({ totalTasks: 0 }),
  updatePayload: async () => ({ ok: true }),
  declarativePreset: true,
  readPresetStatus: () => ({ ok: true }),
  installPreset: () => ({ ok: true }),
  presetDir: 'D:/fake-preset',
  bundledDir: 'D:/fake-bundled',
  readExtension: async () => ({ files: [] }),
  listDirForPicker: () => ({ ok: true, entries: [] }),
  listEntries: async () => ({ ok: true, entries: [] }),
  listEntrySkills: async () => ({ ok: true, skills: [] }),
  readHistory: async () => ({}),
  listBackups: async () => [],
  listExtensionHistories: async () => [],
  deleteNote: noop,
  migrateExtension: async () => ({ ok: true, files: [] }),
  recordBackup: async () => {},
  prunePackageBackups: noop,
  rollbackExtension: noop,
}

const handler = createApiHandler(deps)

function call(method, url, { headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url,
      headers: { host: '127.0.0.1:1234', ...headers },
      async *[Symbol.asyncIterator]() { if (body !== null) yield Buffer.from(JSON.stringify(body)) },
    }
    const res = {
      status: 0,
      payload: null,
      writeHead(status) { this.status = status },
      end(text) { try { this.payload = JSON.parse(text) } catch { this.payload = text } resolve(this) },
    }
    handler(req, res).catch(reject)
  })
}

let failed = 0
function check(name, ok, extra = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`)
}

const status = await call('GET', '/xinyue-kit-api/status')
check('GET /status → 200 且带 xinyueDir', status.status === 200 && status.payload.xinyueDir === 'D:/fake-game', JSON.stringify(status.payload))

const settings = await call('GET', '/xinyue-kit-api/settings')
check('GET /settings → 版本号来自 deps.pkgVersion', settings.status === 200 && settings.payload.version === '9.9.9', JSON.stringify(settings.payload))

const tasks = await call('GET', '/xinyue-kit-api/tasks')
check('GET /tasks → 200', tasks.status === 200)

const notFound = await call('GET', '/xinyue-kit-api/nope')
check('未知路由 → 404', notFound.status === 404)

const badOrigin = await call('POST', '/xinyue-kit-api/init', { headers: { origin: 'https://evil.example' }, body: { xinyueDir: 'x' } })
check('跨站 Origin → 403', badOrigin.status === 403)

const badType = await call('POST', '/xinyue-kit-api/init', { headers: { origin: 'http://127.0.0.1:1234', 'content-type': 'text/plain' }, body: {} })
check('非 JSON → 415', badType.status === 415)

const okOrigin = await call('POST', '/xinyue-kit-api/history/note-delete', { headers: { origin: 'http://127.0.0.1:1234', 'content-type': 'application/json' }, body: { folder: 'cfwl', index: 0 } })
check('同源 JSON POST → 路由命中', okOrigin.status === 200 || okOrigin.status === 400, JSON.stringify(okOrigin.payload))

console.log(failed ? `\n${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
