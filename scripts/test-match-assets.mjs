#!/usr/bin/env node
/*
 * test-match-assets.mjs —— 素材自动匹配(match-assets.js)的回归用例。
 *
 * 覆盖:
 *  1. 归一化:全角/半角标点、破折号写法、省略号、空格、引号 → 同一串;
 *  2. 打分:差标点/差空格仍高分,不相干文案低分;
 *  3. matchAssets:请求→文件映射(置信度)、未匹配请求(带候选)、**未被认领的文件**、纯列目录;
 *  4. 图片转 jpg:用 node zlib 手写一个 1x1 PNG,探到本机转换器就转并校验 JPEG 魔数(探不到则跳过)。
 *
 * 运行: node scripts/test-match-assets.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import zlib from 'node:zlib'
import { normText, similarity, matchAssets, findImageConverter, convertToJpg } from '../src/match-assets.js'

let pass = 0
const fails = []
function check(name, ok, detail) {
  if (ok) { console.log('  ✓ ' + name); pass++ } else { console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); fails.push(name) }
}

/* ---------- 1. 归一化 ---------- */
console.log('归一化')
const canonical = normText('格拉尼——各位、让我们把胜利带回罗德岛！')
check('破折号 + 全角标点归一', canonical === '格拉尼-各位让我们把胜利带回罗德岛', canonical)
check('半角写法与全角等价', normText('格拉尼--各位,让我们把胜利带回罗德岛!') === canonical, normText('格拉尼--各位,让我们把胜利带回罗德岛!'))
check('省略号归一', normText('等下……') === normText('等下...'), normText('等下……'))
check('全角空格与引号去掉', normText('「 好 的 」') === '好的', normText('「 好 的 」'))

/* ---------- 2. 打分 ---------- */
console.log('\n打分')
check('只差标点 → 高分(>=0.9)', similarity('格拉尼——各位、让我们把胜利带回罗德岛！', '格拉尼-各位,让我们把胜利带回罗德岛.mp3') >= 0.9,
  String(similarity('格拉尼——各位、让我们把胜利带回罗德岛！', '格拉尼-各位,让我们把胜利带回罗德岛.mp3')))
check('包含关系 → 高分', similarity('各位、让我们把胜利带回罗德岛', '格拉尼——各位、让我们把胜利带回罗德岛！') >= 0.8)
check('不相干 → 低分(<0.4)', similarity('格拉尼——各位、让我们把胜利带回罗德岛！', '银灰——真银斩,开天辟地') < 0.4,
  String(similarity('格拉尼——各位、让我们把胜利带回罗德岛！', '银灰——真银斩,开天辟地')))

/* ---------- 3. 目录匹配 ---------- */
console.log('\n目录匹配')
const dir = mkdtempSync(join(tmpdir(), 'xk-assets-'))
const VOICE_A = '格拉尼——各位、让我们把胜利带回罗德岛！.mp3'
const VOICE_B = '格拉尼-我的战场，可不只是在地面！.mp3'
const VOICE_C = '其他武将——随便说两句.mp3'
writeFileSync(join(dir, VOICE_A), Buffer.from([0x49, 0x44, 0x33, 1]))
writeFileSync(join(dir, VOICE_B), Buffer.from([0x49, 0x44, 0x33, 2]))
writeFileSync(join(dir, VOICE_C), Buffer.from([0x49, 0x44, 0x33, 3]))

const r = matchAssets({ dir, requests: ['格拉尼--各位,让我们把胜利带回罗德岛!', '格拉尼——我的战场,可不只是在地面!'], kind: 'audio' })
check('两条请求都命中', r.matches.every((m) => !!m.file), JSON.stringify(r.matches.map((m) => [m.request, m.file])))
check('命中项置信度为 high', r.matches.every((m) => m.confidence === 'high'), JSON.stringify(r.matches.map((m) => m.confidence)))
check('命中项没有互相抢同一个文件', new Set(r.matches.map((m) => m.file)).size === 2, JSON.stringify(r.matches.map((m) => m.file)))
check('没人认领的第三条语音被列出', r.unassigned.length === 1 && r.unassigned[0] === VOICE_C, JSON.stringify(r.unassigned))
check('未匹配请求为空', r.unmatched.length === 0, JSON.stringify(r.unmatched))

const miss = matchAssets({ dir, requests: ['格拉尼——完全不存在的台词'], kind: 'audio' })
check('找不到的请求 → unmatched 且不硬塞结果', miss.unmatched.length === 1 && miss.matches[0].file === null, JSON.stringify(miss.matches[0]))
const near = matchAssets({ dir, requests: ['格拉尼——我的战场,可不只是在地面!'], kind: 'audio', minScore: 0.99 })
check('阈值调高 → 未命中但给出最像的候选', near.matches[0].file === null && near.matches[0].alternates.length > 0, JSON.stringify(near.matches[0]))

const listing = matchAssets({ dir })
check('不传请求 → 只列目录', listing.ok && listing.matches.length === 0 && listing.listing.length === 3, JSON.stringify(listing.listing))

const empty = matchAssets({ dir: join(dir, '不存在') })
check('目录不存在 → ok=false + 明确报错', empty.ok === false && /不存在/.test(empty.error), empty.error)

/* ---------- 4. 图片转 jpg ---------- */
console.log('\n图片转 jpg')
function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0 }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function png1x1() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2
  const idat = zlib.deflateSync(Buffer.from([0, 200, 30, 30]))
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}
const pngPath = join(dir, 'ts_test立绘.png')
writeFileSync(pngPath, png1x1())
const converter = findImageConverter()
if (!converter) {
  console.log('  – SKIP 本机没有 Pillow/ImageMagick,转 jpg 用例跳过')
  const nr = convertToJpg(pngPath, join(dir, 'out.jpg'), null)
  check('没有转换器时如实报错(不假装成功)', nr.ok === false && /没找到/.test(nr.error), JSON.stringify(nr))
} else {
  const outJpg = join(dir, 'stage', 'ts_test立绘.jpg')
  const c = convertToJpg(pngPath, outJpg, converter)
  check(`转换成功(${converter.kind})`, c.ok && existsSync(outJpg), JSON.stringify(c))
  const head = existsSync(outJpg) ? readFileSync(outJpg).subarray(0, 2) : Buffer.alloc(0)
  check('产物是 JPEG(FF D8 魔数)', head[0] === 0xff && head[1] === 0xd8, head.toString('hex'))
}

const imgMatch = matchAssets({ dir, requests: ['ts_test立绘'], kind: 'image' })
check('图片模式只列图片', imgMatch.matches[0] && imgMatch.matches[0].file === 'ts_test立绘.png', JSON.stringify(imgMatch.matches[0]))

rmSync(dir, { recursive: true, force: true })
console.log(`\n${fails.length === 0 ? '全部通过' : '失败 ' + fails.length + ' 项'}: ${pass} passed${fails.length ? ', ' + fails.length + ' failed' : ''}`)
if (fails.length) { for (const f of fails) console.log('  - ' + f); process.exitCode = 1 }
