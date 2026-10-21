/**
 * match-assets.js —— 素材自动匹配(工坊优化 ③)
 *
 * 背景:任务是「格拉尼——各位、让我们把胜利带回罗德岛！」这样的**请求文本**,
 * 磁盘上是 `格拉尼——各位、让我们把胜利带回罗德岛！.mp3` 这样的**实际文件名**;
 * 两者常差在全角/半角标点、空格、破折号写法、句数笔误上。人工核对一轮要来回好几趟,
 * 于是这里做归一化 + 模糊匹配,先把「请求文本 → 实际文件(置信度)」的映射表摆出来。
 *
 * 本模块只做三件事(纯函数 + 目录扫描,不写游戏目录):
 *   1. normText / similarity —— 归一化与打分(可单测);
 *   2. matchAssets         —— 目录里模糊匹配,返回 命中 / 未匹配请求 / 未被分配的候选文件;
 *   3. findImageConverter / convertToJpg —— 立绘 png → jpg(借本机可用的外部转换器,探不到就如实说明)。
 */
import { existsSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join, extname, basename, dirname } from 'node:path'
import { homedir } from 'node:os'
import { execFileSync } from 'node:child_process'

const AUDIO_EXT = ['.mp3', '.ogg', '.wav', '.m4a', '.flac']
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']

/** 归一化:全角→半角、去掉标点/空白/引号、统一省略号与破折号、大小写归一。 */
export function normText(s) {
  return String(s == null ? '' : s)
    .normalize('NFKC')                                  // 全角字母数字标点 → 半角
    .replace(/[\u2018\u2019\u201c\u201d]/g, '')          // 弯引号
    .replace(/[…⋯]+/g, '.')                              // 省略号
    .replace(/[—–─ー－~～-]+/g, '-')                      // 各种破折号/连接号
    .replace(/[「」『』【】《》〈〉()（）\[\]{}]/g, '')      // 括号
    .replace(/[\s\u3000]+/g, '')                          // 空白(含全角空格)
    .replace(/[！!？?。.，,、;；:：'"`]+/g, '')            // 句读标点
    .toLowerCase()
}

/** 字符二元组 Dice 系数(短文本上比编辑距离更宽容,且对语序不敏感)。 */
function bigrams(s) {
  const out = new Map()
  if (!s) return out
  if (s.length === 1) { out.set(s, 1); return out }
  for (let i = 0; i + 1 < s.length; i++) {
    const g = s.slice(i, i + 2)
    out.set(g, (out.get(g) || 0) + 1)
  }
  return out
}

/** 文本相似度 0~1(相等 1;包含关系 0.82~1;否则 Dice)。 */
export function similarity(a, b) {
  const x = normText(a)
  const y = normText(b)
  if (!x && !y) return 1
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.includes(y) || y.includes(x)) {
    return 0.82 + 0.18 * (Math.min(x.length, y.length) / Math.max(x.length, y.length))
  }
  const A = bigrams(x)
  const B = bigrams(y)
  let inter = 0
  let total = 0
  for (const [g, n] of A) { total += n; inter += Math.min(n, B.get(g) || 0) }
  for (const [, n] of B) total += n
  return total ? (2 * inter) / total : 0
}

/** 请求文本里可能带「武将名——台词」,把两侧都按破折号切开,尾部(台词部分)单独比一次。
 *  注意:不能拿「武将名」这种短前缀去和整条文件名比 —— 那会让任何同武将的台词都算命中。 */
function scoreRequestAgainst(req, file) {
  const tail = (s) => {
    const parts = String(s).split(/[—–]{1,2}|--+/).map((p) => p.trim()).filter(Boolean)
    return parts.length > 1 ? parts[parts.length - 1] : ''
  }
  let best = similarity(req, file)
  const rt = tail(req)
  const ft = tail(file)
  if (rt && ft) best = Math.max(best, similarity(rt, ft))
  return best
}

function listFiles(dir, { recursive = false, exts = null } = {}) {
  const out = []
  const walk = (cur) => {
    let items
    try { items = readdirSync(cur, { withFileTypes: true }) } catch { return }
    for (const it of items) {
      const full = join(cur, it.name)
      if (it.isDirectory()) { if (recursive) walk(full); continue }
      if (!/\.(mp3|ogg|wav|m4a|flac|jpg|jpeg|png|gif|webp|bmp)$/i.test(it.name)) continue
      const ext = extname(it.name).toLowerCase()
      if (exts && !exts.includes(ext)) continue
      let size = 0
      try { size = statSync(full).size } catch { /* 忽略 */ }
      out.push({ name: it.name, path: full, ext, size })
    }
  }
  walk(dir)
  return out
}

function confidence(score) {
  if (score >= 0.85) return 'high'
  if (score >= 0.65) return 'mid'
  return 'low'
}

/**
 * 素材匹配。
 * @param {{dir:string, requests?:string[], recursive?:boolean, kind?:'audio'|'image'|'any', minScore?:number}} args
 * @returns {{ok:boolean, dir:string, files:number, matches:Array, unmatched:Array, unassigned:Array, error?:string}}
 */
export function matchAssets(args = {}) {
  const dir = String(args.dir || '').trim()
  if (!dir) return { ok: false, dir, files: 0, matches: [], unmatched: [], unassigned: [], error: 'dir 为空(需要素材所在目录的绝对路径)' }
  if (!existsSync(dir)) return { ok: false, dir, files: 0, matches: [], unmatched: [], unassigned: [], error: `目录不存在:${dir}` }
  const kind = args.kind || 'any'
  const exts = kind === 'audio' ? AUDIO_EXT : kind === 'image' ? IMAGE_EXT : null
  const all = listFiles(dir, { recursive: !!args.recursive, exts })
  const requests = (Array.isArray(args.requests) ? args.requests : []).map((r) => String(r == null ? '' : r)).filter((r) => r.trim())
  const minScore = typeof args.minScore === 'number' ? args.minScore : 0.55

  if (!requests.length) {
    return {
      ok: true, dir, files: all.length, matches: [], unmatched: [], unassigned: all.map((f) => f.name),
      listing: all.map((f) => ({ name: f.name, ext: f.ext, size: f.size })),
    }
  }

  // 全量打分后贪心指派(高分优先,一个文件只认领一次请求;每个请求只取一条最佳)
  const pairs = []
  for (let i = 0; i < requests.length; i++) {
    for (const f of all) {
      pairs.push({ i, name: f.name, path: f.path, ext: f.ext, score: scoreRequestAgainst(requests[i], f.name) })
    }
  }
  pairs.sort((a, b) => b.score - a.score)
  const takenReq = new Map()
  const takenFile = new Map()
  for (const p of pairs) {
    if (p.score < minScore) break
    if (takenReq.has(p.i) || takenFile.has(p.name)) continue
    takenReq.set(p.i, p)
    takenFile.set(p.name, p)
  }
  const matches = requests.map((req, i) => {
    const hit = takenReq.get(i)
    if (!hit) return { request: req, file: null, score: 0, confidence: 'none', alternates: alternatives(requests[i], all, takenFile, 3) }
    return { request: req, file: hit.name, path: hit.path, ext: hit.ext, score: Number(hit.score.toFixed(3)), confidence: confidence(hit.score) }
  })
  const unmatched = matches.filter((m) => !m.file).map((m) => m.request)
  const unassigned = all.filter((f) => !takenFile.has(f.name)).map((f) => f.name)
  return { ok: true, dir, files: all.length, matches, unmatched, unassigned }
}

/** 未命中时给几条最像的候选,省得再去列目录。 */
function alternatives(req, all, takenFile, limit) {
  return all
    .filter((f) => !takenFile.has(f.name))
    .map((f) => ({ file: f.name, score: Number(scoreRequestAgainst(req, f.name).toFixed(3)) }))
    .filter((x) => x.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** 找个能把 png 转 jpg 的本机转换器(Pillow / ImageMagick 都行);找不到就返回 null。
 *  探测一律用 stdio:'ignore' —— 受限沙箱下用管道接子进程输出会 EPERM,只看退出码最稳。 */
export function findImageConverter() {
  const probe = ['-c', 'import PIL, sys; sys.exit(0)']
  const pythons = []
  if (process.env.DSH_PYTHON) pythons.push(process.env.DSH_PYTHON)
  pythons.push('python3', 'python')
  for (const p of pythons) {
    try {
      execFileSync(p, probe, { stdio: 'ignore', timeout: 15000 })
      return { kind: 'pillow', cmd: p }
    } catch { /* 换下一个 */ }
  }
  // dsh 自带运行时里的 python(PATH 上那个常只是应用商店占位符,一跑就报"未找到")
  try {
    const rt = join(homedir(), '.dsh', 'dsh-runtimes')
    for (const d of readdirSync(rt)) {
      const cand = join(rt, d, 'dependencies', 'python', 'python.exe')
      if (!existsSync(cand)) continue
      try {
        execFileSync(cand, probe, { stdio: 'ignore', timeout: 20000 })
        return { kind: 'pillow', cmd: cand }
      } catch { /* 继续找 */ }
    }
  } catch { /* 没有该目录 */ }
  try {
    execFileSync('magick', ['-version'], { stdio: 'ignore', timeout: 15000 })
    return { kind: 'magick', cmd: 'magick' }
  } catch { /* 没有 magick */ }
  return null
}

/** png(或任意图片) → jpg。converter 传 findImageConverter() 的结果;未探到转换器时返回错误说明。 */
export function convertToJpg(src, dst, converter = null, { quality = 92 } = {}) {
  const conv = converter === undefined ? findImageConverter() : converter
  if (!conv) {
    return { ok: false, error: '本机没找到能转图的东西(Pillow / ImageMagick),无法自动转 jpg —— 请手动转换,或改用 .png 目标名(卡图官方就用 png)' }
  }
  try { mkdirSync(dirname(dst), { recursive: true }) } catch { /* 目标目录已存在 */ }
  try {
    if (conv.kind === 'pillow') {
      const script = 'from PIL import Image; import sys; im = Image.open(sys.argv[1]).convert("RGB"); '
        + `im.save(sys.argv[2], "JPEG", quality=${quality})`
      execFileSync(conv.cmd, ['-c', script, src, dst], { stdio: 'ignore', timeout: 60000 })
    } else {
      execFileSync(conv.cmd, [src, '-quality', String(quality), dst], { stdio: 'ignore', timeout: 60000 })
    }
    if (!existsSync(dst)) return { ok: false, error: '转换命令执行了但没有产出文件' }
    return { ok: true, path: dst, converter: conv.kind }
  } catch (e) {
    const code = e && e.status != null ? `(退出码 ${e.status})` : ''
    return { ok: false, error: `转换失败${code}:${String((e && e.message) || e).slice(0, 200)}` }
  }
}

export const __internals = { listFiles, scoreRequestAgainst, confidence }
export { basename }
