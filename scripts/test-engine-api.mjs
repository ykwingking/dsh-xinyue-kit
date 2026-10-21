#!/usr/bin/env node
/*
 * test-engine-api.mjs —— 引擎符号索引(engine-api.js) + 语义校验 + 写入通道加固 的回归用例。
 *
 * 覆盖三件事:
 *  1. 索引能从真实游戏目录里抽出事件名/状态技字段/方法参数键 —— 这是"别乱编 API"的地基;
 *  2. validate.js 拿到索引后能给出「疑似写错」的**警告**(不是 error,不拒写);
 *  3. write.js 的四条加固:非 ASCII 目录拒写、包内普通模块放行、
 *     转义压成一行的代码自动解码、editScope 未申报改动自动并入(不再白跑一轮)。
 *
 * 运行: node scripts/test-engine-api.mjs
 *   引擎相关用例需要真实游戏目录;没配到就跳过(不算失败)。
 */
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadEngineIndex, similarNames, paramKeysFor, specFieldsFor, findUsages } from '../src/engine-api.js'
import { validateExtensionCode } from '../src/validate.js'
import { writeExtension, diffSummary } from '../src/write.js'

const GAME = process.env.FK_GAME_DIR || 'D:\\新月杀\\新月杀\\FreeKill-v0.5.25\\FreeKill-release'
const hasGame = existsSync(join(GAME, 'packages', 'freekill-core', 'lua'))

let pass = 0
const fails = []
function check(name, ok, detail) {
  if (ok) { console.log('  ✓ ' + name); pass++ } else { console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); fails.push(name) }
}

/* ---------- 1. 引擎索引 ---------- */
if (!hasGame) {
  console.log(`跳过引擎索引用例(未找到游戏目录: ${GAME})`)
} else {
  console.log('引擎索引')
  const t0 = Date.now()
  const index = loadEngineIndex(GAME, { rebuild: true, cacheFile: join(tmpdir(), `xk-index-${process.pid}.json`) })
  const ms = Date.now() - t0
  check(`索引建立成功(${index.files} 个文件, ${ms}ms)`, index && !index.empty && index.files > 300, JSON.stringify({ files: index && index.files }))
  check('认得 fk.RoundStart 事件', !!index.events.RoundStart)
  check('认得 fk.Damaged 事件', !!index.events.Damaged)
  check('认得 Player 类', !!index.classes.Player)
  check('认得 atkrange 效果规格(→AttackRangeSpec)', index.effectSpecs.atkrange === 'AttackRangeSpec', JSON.stringify(index.effectSpecs))
  const specFields = specFieldsFor(index, 'atkrange')
  check('atkrange 规格字段可取(final_func/without_func)', !!specFields && ['final_func', 'without_func', 'correct_func'].every((f) => specFields.has(f)),
    specFields ? JSON.stringify([...specFields]) : 'null')
  const askKeys = paramKeysFor(index, 'askToCards')
  check('认得 askToCards 的参数键', !!askKeys && askKeys.has('expand_pile'), askKeys ? JSON.stringify([...askKeys]) : 'null')
  check('认得 Card 常量', (index.constants['Card.Red'] !== undefined) || !!index.constants['Card.TypeEquip'] || Object.keys(index.constants).some((k) => k.startsWith('Card.')))
  check('相似名建议可用', similarNames('RoundStrat', Object.keys(index.events), 3).includes('RoundStart'))
  check('fk 成员表含 CreateSkill(不把常用 API 误报为不存在)', index.fkMembers && index.fkMembers.CreateSkill === true, JSON.stringify(Object.keys(index.fkMembers || {}).slice(0, 8)))
  const usages = findUsages(GAME, 'addTableMark', { limit: 2 })
  check('findUsages 能找到官方用法', !!(usages && Array.isArray(usages.rows) && usages.rows.length > 0), JSON.stringify(usages))

  /* ---------- 2. 语义校验:只警告,不拒写 ---------- */
  console.log('\n语义校验(警告)')
  const warnOf = (code) => {
    const v = validateExtensionCode({ code, folder: 'xk_probe', filePath: 'skills/xk_probe_foo.lua', idPrefix: 'xk', apiIndex: index })
    return { ok: v.ok, warnings: (v.warnings || []).map((w) => String(w.message || w)) }
  }
  const good = `local xk_probe_foo = fk.CreateSkill { name = "xk_probe_foo" }\nreturn xk_probe_foo\n`
  const badEvent = `local xk_probe_foo = fk.CreateSkill {\n  name = "xk_probe_foo",\n}\nxk_probe_foo:addEffect(fk.RoundStrat, { on_use = function() end })\nreturn xk_probe_foo\n`
  const r1 = warnOf(badEvent)
  check('拼错的事件名给出建议', r1.warnings.some((w) => w.includes('RoundStart')), JSON.stringify(r1.warnings))
  const badSpec = `local xk_probe_foo = fk.CreateSkill {\n  name = "xk_probe_foo",\n}\nxk_probe_foo:addEffect("atkrange", { final_funcx = function(self, player) return 0 end })\nreturn xk_probe_foo\n`
  const r2 = warnOf(badSpec)
  check('状态技写错字段名给出建议', r2.warnings.some((w) => w.includes('final_func')), JSON.stringify(r2.warnings))
  const badParam = `local xk_probe_foo = fk.CreateSkill {\n  name = "xk_probe_foo",\n  on_use = function(self, room)\n    room:askToCards(room.current, { min_num = 1, expand_pile_x = {} })\n  end,\n}\nreturn xk_probe_foo\n`
  const r3 = warnOf(badParam)
  check('方法参数写错键名给出建议', r3.warnings.some((w) => w.includes('expand_pile')), JSON.stringify(r3.warnings))
  check('fk.CreateSkill 不再被误报为未知符号', !r3.warnings.some((w) => w.includes('CreateSkill')), JSON.stringify(r3.warnings))
  const rGood = warnOf(good)
  check('正常代码不报警(仍通过)', rGood.ok === true)
}

/* ---------- 3. 写入通道加固(临时游戏目录) ---------- */
console.log('\n写入通道加固')
const game = mkdtempSync(join(tmpdir(), 'xk-game-'))
mkdirSync(join(game, 'packages'), { recursive: true })
const skillCode = `local xk_probe_foo = fk.CreateSkill { name = "xk_probe_foo" }\n\nFk:loadTranslationTable { ["xk_probe_foo"] = "探针" }\n\nreturn xk_probe_foo\n`

const cn = await writeExtension(game, { folder: '名将杀', file: 'init.lua', code: 'return nil\n' })
check('非 ASCII 目录名被拒写', cn.ok === false && cn.errors.some((e) => e.message.includes('非 ASCII')), JSON.stringify(cn.errors))
check('拒写时不会建出坏目录', !existsSync(join(game, 'packages', '名将杀')))

const modOk = await writeExtension(game, { folder: 'xk_probe', file: 'pkg/helper.lua', code: 'local M = {}\nfunction M.add(a, b) return a + b end\nreturn M\n' })
check('包内普通模块 pkg/helper.lua 放行', modOk.ok === true, JSON.stringify(modOk.errors))

const first = await writeExtension(game, { folder: 'xk_probe', file: 'skills/xk_probe_foo.lua', code: skillCode })
check('技能文件首写成功', first.ok === true, JSON.stringify(first.errors))
check('首写后文件存在', existsSync(join(game, 'packages', 'xk_probe', 'skills', 'xk_probe_foo.lua')))

const escaped = skillCode.replace(/\n/g, '\\n')
const dm = await writeExtension(game, { folder: 'xk_probe', file: 'skills/xk_probe_foo.lua', code: escaped })
check('转义压成一行的代码被自动解码写入', dm.ok === true && (dm.warnings || []).some((w) => w.message.includes('转义')),
  JSON.stringify({ ok: dm.ok, warnings: dm.warnings, errors: dm.errors }))

const changed = skillCode.replace('"探针"', '"探针二"')
const merge = await writeExtension(game, { folder: 'xk_probe', file: 'skills/xk_probe_foo.lua', code: changed, editScope: ['nothing_here'] })
check('editScope 未申报的改动自动并入(不拒写)', merge.ok === true && (merge.warnings || []).some((w) => w.message.includes('自动并入')),
  JSON.stringify({ ok: merge.ok, warnings: merge.warnings, errors: merge.errors }))
check('自动并入后内容确实更新', readFileSync(join(game, 'packages', 'xk_probe', 'skills', 'xk_probe_foo.lua'), 'utf8').includes('探针二'))
check('写入返回 diff 摘要(增删行数)', !!(merge.summary && merge.summary.addedLines >= 1 && merge.summary.removedLines >= 1), JSON.stringify(merge.summary))

console.log('\ndiff 摘要')
const d1 = diffSummary('a\nb\nc\n', 'a\nB\nc\nd\n')
check('行数口径:增 2 删 1', d1.addedLines === 2 && d1.removedLines === 1, JSON.stringify(d1))
const anchoredA = '--#xinyue-kit-begin skill:x\nA\n--#xinyue-kit-end skill:x\n'
const anchoredB = '--#xinyue-kit-begin skill:x\nB\n--#xinyue-kit-end skill:x\n'
check('认出内容变过的区块锚点', diffSummary(anchoredA, anchoredB).changedAnchors.join() === 'skill:x', JSON.stringify(diffSummary(anchoredA, anchoredB).changedAnchors))
check('没动锚点就不报区块变化', diffSummary(anchoredA, anchoredA).changedAnchors.length === 0)

const lost = await writeExtension(game, { folder: 'xk_probe', file: 'skills/xk_probe_foo.lua', code: 'local other = fk.CreateSkill { name = "xk_probe_bar" }\nreturn other\n' })
check('内部 ID 消失仍被拒写(防丢护栏保留)', lost.ok === false && lost.errors.some((e) => e.message.includes('xk_probe_foo')), JSON.stringify(lost.errors))

console.log(`\n${fails.length === 0 ? '全部通过' : '失败 ' + fails.length + ' 项'}: ${pass} passed${fails.length ? ', ' + fails.length + ' failed' : ''}`)
if (fails.length) { for (const f of fails) console.log('  - ' + f); process.exitCode = 1 }
