#!/usr/bin/env node
/**
 * 生成 knowledge/fkbook/:(1) 从《新月之书》仓库的 for-creators/ **原样复制**文本文件
 * (.rst / .lua,图片与音频一律不要),(2) 解析 rST 标题层级写出分节索引 index.json。
 *
 * 用法:
 *   node scripts/build-fkbook.mjs                # 只重建 index.json(文档已在库内)
 *   node scripts/build-fkbook.mjs <for-creators> # 先从该目录同步文档,再重建索引
 *
 * 注意:文档是**插件自带数据**,不是游戏目录;任何情况下都不碰 <游戏根>/packages/。
 * rST 保持原格式(不转 markdown):rST 标记对模型可读性足够,转换只会丢内容。
 * 编码:全程 node fs 以 UTF-8 读写,绝不经过 PowerShell 的 GBK 文本读写。
 */
import { readdir, mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _docIndexSnapshot } from '../src/reference.js'

const PLUGIN_ROOT = fileURLToPath(new URL('../', import.meta.url))
const DEST_ROOT = join(PLUGIN_ROOT, 'knowledge', 'fkbook')
/** 只收文本:.rst 原格式 + 少量 .lua(示例扩展与教学脚本);.jpg/.png/.mp3 一律跳过。 */
const KEEP = /\.(rst|lua)$/

const srcArg = process.argv[2]
let syncStats = null

if (srcArg) {
  const srcRoot = srcArg
  const files = []
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) await walk(p)
      else if (e.isFile() && KEEP.test(e.name)) files.push(p)
    }
  }
  await walk(srcRoot)
  files.sort()
  let bytes = 0
  for (const f of files) {
    const rel = relative(srcRoot, f).split('\\').join('/')
    const out = join(DEST_ROOT, rel)
    await mkdir(dirname(out), { recursive: true })
    await copyFile(f, out)
    bytes += (await stat(f)).size
  }
  syncStats = { src: srcRoot, files: files.length, bytes }
}

const snapshot = await _docIndexSnapshot()
const index = {
  $comment: '新月杀官方文档《新月之书》(for-creators)的分节索引。由 scripts/build-fkbook.mjs 生成,请勿手工编辑。',
  source: '新月之书 / fkbook-all-in-one(for-creators)',
  sourceRepo: 'https://gitee.com/Qsgs-Fans/fkbook-all-in-one',
  sourceReadTheDocs: 'https://fkbook-all-in-one.readthedocs.io/',
  scope: 'for-creators',
  files: snapshot.files,
  bytes: snapshot.bytes,
  sections: snapshot.sections,
}
await writeFile(join(DEST_ROOT, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8')

// 生成后自检:索引里的每个文件都必须真实存在,否则说明索引与文档漂移了
const missing = []
for (const s of snapshot.sections) {
  const rel = s.file.replace(/^fkbook\//, '')
  try { await stat(join(DEST_ROOT, rel)) } catch { missing.push(s.file) }
}
const byLevel = snapshot.sections.reduce((acc, s) => { acc[s.level] = (acc[s.level] || 0) + 1; return acc }, {})
const sample = snapshot.sections.find((s) => s.id === 'fkbook/rule/03-event.rst#事件与时机')
console.log(JSON.stringify({
  sync: syncStats,
  files: snapshot.files,
  bytes: snapshot.bytes,
  sections: snapshot.sections.length,
  sectionsByLevel: byLevel,
  missingFiles: [...new Set(missing)],
  sample,
}, null, 2))
if (missing.length) process.exitCode = 1
