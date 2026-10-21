/** 自由修改流水(changes)测试：recordChange 写入/校验 + 历史读回。 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { recordChange, readHistory } from '../src/history.js'

let pass = 0
let fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✓', msg) } else { fail++; console.log('  ✗', msg) } }

const g = mkdtempSync(join(tmpdir(), 'fk-hist-'))
mkdirSync(join(g, 'packages', 'demo'), { recursive: true })

const r1 = await recordChange(g, { folder: 'demo', summary: '给 cfwl 生成势力图', kind: 'asset', files: ['image/kingdom/x.png'] })
ok(r1.ok && r1.changeCount === 1, '写入一条 asset 流水')
ok(r1.last && r1.last.kind === 'asset', 'kind 保留 asset')
ok(r1.last && r1.last.files.length === 1, 'files 保留')

const r2 = await recordChange(g, { folder: 'demo', summary: '   ' })
ok(r2.ok === false, '空摘要被拒')

const r3 = await recordChange(g, { folder: 'demo', summary: '随便写的 kind', kind: 'nonsense' })
ok(r3.last && r3.last.kind === 'edit', '未知 kind 归为 edit')

const h = await readHistory(g, 'demo')
ok(h.changes.length === 2, '读回 2 条')

// 形状容错:changes 被手改坏成对象时不应炸
writeFileSync(join(g, 'packages', 'demo', 'xinyue-kit.history.json'),
  JSON.stringify({ version: 1, tasks: [], notes: [], backups: [], changes: {} }), 'utf8')
const h2 = await readHistory(g, 'demo')
ok(Array.isArray(h2.changes), 'changes 被写坏时回退成数组')

rmSync(g, { recursive: true, force: true })
console.log(fail === 0 ? `全部通过（${pass} 项）` : `失败 ${fail} 项 / 通过 ${pass} 项`)
process.exit(fail === 0 ? 0 : 1)
