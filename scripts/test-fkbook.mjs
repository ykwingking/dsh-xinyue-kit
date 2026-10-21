#!/usr/bin/env node
/*
 * test-fkbook.mjs —— 官方文档检索源(knowledge/fkbook)回归用例。
 *
 * 背景:插件把《新月之书》的 for-creators 一册收成了**自带数据**
 * (knowledge/fkbook,72 个文本文件 / 约 290KB),并作为 searchReference 的
 * 第二个数据源(type='doc')。这类"手工落库 + 生成索引"的数据最容易在
 * 后续改动里悄悄漂移:文档被删、索引没重建、id 重复、中文被写成乱码、
 * readDoc 读回的正文与文件不一致……本测试把这些都钉死。
 *
 * 不依赖游戏目录:文档源是插件自带的,type='doc' 在没有 xinyueDir 时也能用。
 *
 * 运行: node scripts/test-fkbook.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { searchReference, readDoc, _docStats, _docIndexSnapshot } from '../src/reference.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BOOK = join(ROOT, 'knowledge', 'fkbook')

let pass = 0
const fails = []
function check(name, ok, detail) {
  if (ok) { console.log('  ✓ ' + name); pass++ } else { console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); fails.push(name) }
}

console.log('文档落库规模')
const stats = await _docStats()
check('文档文件数 = 72(.rst 66 + .lua 6)', stats.files === 72, '实得 ' + stats.files)
check('文档总字节 ≈ 290253', stats.bytes === 290253, '实得 ' + stats.bytes)
check('小节条目数 > 250', stats.sections > 250, '实得 ' + stats.sections)
check('建索引耗时 < 2s', stats.buildMs < 2000, '实得 ' + stats.buildMs + 'ms')

console.log('index.json 与实时解析一致(索引不会悄悄漂移)')
const onDisk = JSON.parse(readFileSync(join(BOOK, 'index.json'), 'utf8'))
const live = await _docIndexSnapshot()
check('index.json 的 sections 条数 = 实时解析条数', onDisk.sections.length === live.sections.length,
  onDisk.sections.length + ' vs ' + live.sections.length)
const key = (s) => [s.id, s.file, s.line, s.endLine, s.level, s.title, s.chars, s.path.join('>')].join('\u0001')
check('index.json 每条与实时解析逐字相同', onDisk.sections.map(key).join('\n') === live.sections.map(key).join('\n'))
const ids = new Set(live.sections.map((s) => s.id))
check('id 全局唯一', ids.size === live.sections.length, ids.size + ' vs ' + live.sections.length)
check('file 都是相对插件根的 fkbook/ 路径(不泄露本机绝对路径)',
  live.sections.every((s) => s.file.startsWith('fkbook/') && !/[A-Za-z]:[\\/]/.test(s.file)))
check('path 是祖先链(不含自身)', live.sections.every((s) => !s.path.includes(s.title)))

console.log('文档根里没有图片/音频被混进来')
const all = []
const walk = (d, prefix) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const rel = prefix ? prefix + '/' + e.name : e.name
    if (e.isDirectory()) walk(join(d, e.name), rel)
    else all.push(rel)
  }
}
walk(BOOK, '')
check('无 .jpg/.png/.mp3', !all.some((f) => /\.(jpg|jpeg|png|mp3)$/i.test(f)),
  JSON.stringify(all.filter((f) => /\.(jpg|jpeg|png|mp3)$/i.test(f))))

console.log('中文没有被打成乱码(GBK 误读的特征字)')
/* 特征字故意写成 \u 转义:一是让本文件自身不含这些乱码字符(否则全库"扫乱码"
 * 的自检会把自己当成命中),二是避免这份测试被任何文本工具有意无意地转码。 */
const moji = ['\u951B', '\u9428', '\u5A06', '\u7EEB', '\u935C', '\u9286', '\u93C4', '\u6D93', '\u6D63', '\u93C2', '\u6E40', '\u93C9']
const badFiles = []
for (const f of all.filter((f) => /\.(rst|lua|json|md)$/.test(f))) {
  const text = readFileSync(join(BOOK, f), 'utf8')
  if (text.includes('\uFFFD') || moji.some((c) => text.includes(c))) badFiles.push(f)
}
check('零 U+FFFD / 零乱码特征字', badFiles.length === 0, JSON.stringify(badFiles))
check('.rst 保持原格式(未被转成 markdown)',
  readFileSync(join(BOOK, 'rule', '03-event.rst'), 'utf8').includes('============'))

console.log('检索行为')
const a = await searchReference('', { query: '事件与时机', type: 'doc' })
check('type=doc 不需要游戏目录也能命中', a.ok === true)
check('事件与时机 → 命中 rule/03-event.rst 那节', a.matches[0] && a.matches[0].file === 'fkbook/rule/03-event.rst' && a.matches[0].source === 'doc',
  JSON.stringify(a.matches[0] && { file: a.matches[0].file, source: a.matches[0].source }))
check('标题精确命中给高分(≥150)', a.matches[0] && a.matches[0].score >= 150, a.matches[0] && String(a.matches[0].score))
const unknown = await searchReference('', { query: 'zzz不存在的词zzz', type: 'doc' })
check('不存在的词 → ok=false 且有条错误提示', unknown.ok === false && typeof unknown.error === 'string')
const noGame = await searchReference('', { query: '触发时机', type: 'any' })
check('type=any 且没配游戏目录 → 仍报未配置(行为不变)', noGame.ok === false && /未配置游戏本体目录/.test(noGame.error || ''))

console.log('readDoc 读回全文')
const full = await readDoc('fkbook/rule/03-event.rst#事件与时机')
const raw = readFileSync(join(BOOK, 'rule', '03-event.rst'), 'utf8')
check('按 id 读回成功', full.ok === true)
check('读回正文与该节在文件里的原文逐字相同', full.text === raw.replace(/\r\n/g, '\n'), 'chars=' + (full.text || '').length + ' / file=' + raw.length)
check('带来源文件与章节路径', full.file === 'fkbook/rule/03-event.rst' && Array.isArray(full.path))
const sub = await readDoc('rule/03-event.rst', '触发时机的结算流程')
check('按 file+section 读子节(短路径容错)', sub.ok === true && sub.title === '触发时机的结算流程')
check('子节带祖先章节路径', Array.isArray(sub.path) && sub.path[0] === '事件与时机', JSON.stringify(sub.path))
const lua = await readDoc('fkbook/anhe/example/xuexi.lua')
check('示例扩展的 .lua 也能整文件读回', lua.ok === true && lua.text.includes('fk.CreateTriggerSkill'), 'ok=' + lua.ok)
const miss = await readDoc('fkbook/rule/03-event.rst', '不存在的小节标题')
check('不存在的小节 → ok=false 并列出该文件的小节', miss.ok === false && /该文件的小节/.test(miss.error || ''))

console.log('\n全部通过:' + pass + ' 项' + (fails.length ? '，失败 ' + fails.length + ' 项:\n- ' + fails.join('\n- ') : ''))
if (fails.length) process.exitCode = 1
