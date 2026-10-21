#!/usr/bin/env node
/**
 * xinyue-kit 单测:锚点区块(Lua 词法 / 区块识别 / 翻译分组 / 组装 / 保真 / 迁移 / 集成写入)。
 * 运行:node scripts/test-blocks.mjs
 *
 * 模型提示(src/blocks.js 已从"JS 花括号条目级"换成「Lua 语句级」):
 *   锚点是 Lua 行注释 --#xinyue-kit-begin <kind>:<id>,kind ∈ skill|character|card|translate|package;
 *   区块范围 = 整条 Lua 语句 + 紧跟的 v. / v: 续语句(如 test2.shield=3、test2:addSkills{…});
 *   翻译表按基础 id 分组,只把**连续**的同 id 条目算一块;
 *   无锚文件(官方风格)靠构造调用现场划"虚拟区块"(fk.CreateSkill{} / General(…) / Package(…))。
 *
 * 夹具优先用**真实包**的文件(默认 <游戏根>/packages/,可用 XINYUE_GAME_DIR 覆盖);
 * 游戏目录不存在时那几项打印 SKIP 而不是变红。造假包写在 XINYUE_TMP_DIR(默认
 * D:\\无名杀\\tmp-tools),脚本结束时清理。
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

let passed = 0
let skippedCount = 0
function ok(cond, label) {
  assert.ok(cond, label)
  passed++
  console.log('  ✓ ' + label)
}
function skip(label) {
  skippedCount++
  console.log('  – SKIP ' + label)
}

/** 临时根:优先任务指定的 D:\无名杀\tmp-tools,建不出来就退回系统临时目录。 */
function makeTempRoot() {
  const base = process.env.XINYUE_TMP_DIR || 'D:\\无名杀\\tmp-tools'
  try {
    mkdirSync(base, { recursive: true })
    return mkdtempSync(join(base, 'test-blocks-'))
  } catch {
    return mkdtempSync(join(tmpdir(), 'xinyue-kit-blocks-'))
  }
}

const GAME_DIR = process.env.XINYUE_GAME_DIR || 'D:\\无名杀\\新月杀\\FreeKill-v0.5.25\\FreeKill-release'
const PKG_DIR = join(GAME_DIR, 'packages')
const HAS_REAL = existsSync(join(PKG_DIR, 'test', 'init.lua'))

const tmpRoot = makeTempRoot()
const blocks = await import('../src/blocks.js')
const { writeExtension, readExtension, migrateAnchors } = await import('../src/write.js')

/** 读真实包文件;游戏目录不在时返回 null(调用处包在 realOnly 里)。 */
function real(rel) {
  try { return readFileSync(join(PKG_DIR, rel), 'utf8') } catch { return null }
}

/** 真实夹具专用断言:夹具拿不到就 SKIP。 */
function realCase(rel, fn) {
  const code = real(rel)
  if (code === null) { skip(rel + '(游戏目录不可用)'); return }
  fn(code)
}

/** 比较除 submittedKeys 外的区块文本是否逐字节未动;返回第一个漂移的 key,全同返回 null。 */
function driftedBlock(oldCode, newCode, submittedKeys) {
  const before = new Map(blocks.collectBlocks(oldCode).map((b) => [b.key, b.text]))
  const after = new Map(blocks.collectBlocks(newCode).map((b) => [b.key, b.text]))
  for (const [key, text] of before) {
    if (submittedKeys.includes(key)) continue
    if (!after.has(key) || after.get(key) !== text) return key
  }
  return null
}

/** 递归枚举目录下全部 .lua(排除素材/备份)。 */
function walkLua(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (!['backup', 'image', 'audio', '.git', 'node_modules'].includes(e.name)) walkLua(p, out)
    } else if (/\.lua$/i.test(e.name)) out.push(p)
  }
  return out
}

// ── 锚点夹具(带锚的不可锚模型;真实包几乎都无锚,所以两套都要覆盖)──
const ANCHORED = [
  'local extension = Package("anchored_pkg")',
  '',
  '--#xinyue-kit-begin skill:ak_a',
  'local a = fk.CreateSkill {',
  '  name = "ak_a",',
  '  desc = "A",',
  '}',
  '',
  'a:addEffect("active", {})',
  '--#xinyue-kit-end skill:ak_a',
  '',
  '--#xinyue-kit-begin skill:ak_b',
  'local b = fk.CreateSkill {',
  '  name = "ak_b",',
  '}',
  '--#xinyue-kit-end skill:ak_b',
  '',
  'Fk:loadTranslationTable{',
  '--#xinyue-kit-begin translate:ak_a',
  '  ["ak_a"] = "甲",',
  '--#xinyue-kit-end translate:ak_a',
  '}',
  '',
  'return extension',
  '',
].join('\n')

let fakeGame
try {
  // ═══════════════════ 1) Lua 词法 ═══════════════════
  console.log('\n[1] Lua 词法(注释 / 字符串 / 配对)')

  const s1 = 'local t = { a = "}", b = 1 }'
  ok(blocks.matchBrace(s1, s1.indexOf('{')) === s1.lastIndexOf('}'), 'matchBrace:字符串里的 } 不参与配对')
  const s2 = 'local t = { a = 1, -- }\n b = 2 }'
  ok(blocks.matchBrace(s2, s2.indexOf('{')) === s2.lastIndexOf('}'), 'matchBrace:行注释里的 } 被跳过')
  const s3 = 'local t = { a = 1, --[[ } } ]]\n b = 2 }'
  ok(blocks.matchBrace(s3, s3.indexOf('{')) === s3.lastIndexOf('}'), 'matchBrace:--[[ ]] 长注释里的 } 被跳过')
  const s4 = 'local t = { a = [[ } ]], b = 2 }'
  ok(blocks.matchBrace(s4, s4.indexOf('{')) === s4.lastIndexOf('}'), 'matchBrace:[[ ]] 长字符串里的 } 被跳过')
  const s5 = 'local t = { a = [==[ ] } ]==], b = 2 }'
  ok(blocks.matchBrace(s5, s5.indexOf('{')) === s5.lastIndexOf('}'), 'matchBrace:分级长括号 [==[ ]==] 正确闭合')
  const s6 = 'call("a)b", inner(1))'
  ok(blocks.matchPaired(s6, s6.indexOf('('), '(', ')') === s6.length - 1, 'matchPaired:短字符串里的 ) 被跳过、嵌套括号正确配对')
  const s7 = "local s = '\\'' .. \"x\""
  ok(blocks.luaSyntaxCheck(s7 + '\n').ok, "转义引号 \\' 不会把字符串提前收口")

  // 坑 1:行注释里带 [ 不能被当成长注释/长字符串开头(真实包 lunar_xsg 的 -- ["@[xxx]"])
  const c1 = '-- ["@[xxx]"] = 1\nlocal a = 2\n'
  ok(blocks.skipLuaToken(c1, 0) === c1.indexOf('\n'), '行注释 -- ["@[…"] 只吃到行尾,不当长注释')
  ok(blocks.scanLua(c1).ranges.length === 1 && blocks.scanLua(c1).ranges[0][1] === c1.indexOf('\n'), 'scanLua:该注释区间正好到行尾')
  const brTable = 'Fk:loadTranslationTable{\n  ["a"] = 1,\n  -- ["@[b]"] = 2,\n  ["c"] = 3,\n}\n'
  ok(blocks.translateEntries(brTable).length === 2, '行注释里的 [ 不吞掉后面的翻译条目(仍识别 2 条)')
  ok(blocks.luaSyntaxCheck(brTable).ok, '含 -- ["@[…"] 的表结构检查通过')
  realCase('lunar/pkg/lunar_xsg/skills/chongyu.lua', (code) => {
    ok(blocks.luaSyntaxCheck(code).ok, '真实 chongyu.lua:-- ["@[…"] + --[[ ]] 混合注释结构检查通过')
    const keys = blocks.translateEntries(code).map((e) => e.key)
    ok(keys.includes('$fkxsg__chongyu1'), '真实 chongyu.lua:注释之后的翻译条目仍被识别(注释没吞后续)')
  })

  // 坑 2:emoji(surrogate pair)不能让掩码按码点错位
  const emojiCode = 'local a = "🐌🪨🥛🐉"\nlocal b = "}"\nlocal c = "{"\n'
  ok(blocks.luaSyntaxCheck(emojiCode).ok, 'emoji 不使掩码错位(字符串里的不配对括号被正确掩掉)')
  ok(!blocks.luaSyntaxCheck(emojiCode + '}\n').ok, 'emoji 之后的真实括号失衡仍被抓到(不是整体掩错)')
  realCase('lunar/pkg/lunar_devteam/init.lua', (code) => {
    ok(code.includes('🐌🪨🥛🐉'), '夹具确认:lunar_devteam 含 emoji 翻译')
    ok(blocks.luaSyntaxCheck(code).ok, '真实含 emoji 的包结构检查通过')
  })

  ok(blocks.scanLua('local a = 1 --[[ x\n').errors.length === 1, 'scanLua:未闭合长注释报错')
  ok(blocks.scanLua('local a = "x\n').errors.length === 1, 'scanLua:未闭合字符串报错')
  ok(blocks.scanLua('local a = [[x\n').errors.length === 1, 'scanLua:未闭合长字符串报错')

  // ═══════════════════ 2) luaSyntaxCheck(写入门禁)═══════════════════
  console.log('\n[2] luaSyntaxCheck 结构门禁')

  ok(!blocks.luaSyntaxCheck('').ok && /空/.test(blocks.luaSyntaxCheck('').message), '空代码被拒')
  ok(!blocks.luaSyntaxCheck('   \n\t').ok, '纯空白被拒')
  ok(blocks.luaSyntaxCheck('local a = { 1, 2 }\n').ok, '普通语句通过')
  ok(!blocks.luaSyntaxCheck('function f()\n  return 1\n').ok, 'function 漏 end 被拦')
  ok(/缺少/.test(blocks.luaSyntaxCheck('function f()\n').message), '漏 end 的报错文案提到缺少(报错可读)')
  ok(!blocks.luaSyntaxCheck('local a = 1\nend\n').ok, '多余 end 被拦')
  ok(!blocks.luaSyntaxCheck('local t = { a = 1\n').ok, '括号不配对被拦')
  ok(!blocks.luaSyntaxCheck('local t = { a = 1 }\n}\n').ok, '多余 } 被拦')
  ok(blocks.luaSyntaxCheck('for i = 1, 3 do\n  f(i)\nend\n').ok, 'for … do … end 只计一块(do 不重复计数)')
  ok(blocks.luaSyntaxCheck('while true do\n  break\nend\n').ok, 'while … do … end 收口正确')
  ok(blocks.luaSyntaxCheck('repeat\n  local a = 1\nuntil true\n').ok, 'repeat … until 收口正确')
  ok(!blocks.luaSyntaxCheck('repeat\n  local a = 1\n').ok, 'repeat 漏 until 被拦')
  ok(blocks.luaSyntaxCheck('if a then\n  b()\nelseif c then\n  d()\nelse\n  e()\nend\n').ok, 'if/elseif/else/end 只计一块')

  // ═══════════════════ 3) 区块识别(真实包 + 锚点夹具)═══════════════════
  console.log('\n[3] 区块识别')

  if (HAS_REAL) {
    const rende = real('test/skills/test_rende.lua')
    const initLua = real('test/init.lua')
    const lunarDev = real('lunar/pkg/lunar_devteam/init.lua')

    const rd = blocks.scanBlocks(rende)
    ok(rd.anchored === false && rd.blocks.every((b) => b.virtual === true), '真实技能文件:无锚 → 全部标记虚拟区块')
    ok(rd.blocks.map((b) => b.key).join(',') === 'skill:test_rende,translate:test_rende', '技能文件目录 = 1 技能 + 1 翻译组')
    const skillText = blocks.extractBlock(rende, 'skill', 'test_rende')
    ok(skillText.includes('rende:addEffect'), '技能块含 v: 续语句(rende:addEffect)')
    ok(skillText.includes('on_use') && !skillText.includes('loadTranslationTable'), '技能块边界停在翻译表之前')
    ok(blocks.collectLuaIds(rende).join(',') === 'test_rende', 'collectLuaIds 只收内容 ID(不含翻译)')
    ok(blocks.extractBlock(rende, 'translate', 'test_rende').includes('#test_rende-active'), '翻译块合并同基础 id 的三条')
    ok(blocks.extractBlock(rende, 'skill', '不存在') === null, '不存在的块返回 null')

    const idir = blocks.scanBlocks(initLua)
    ok(idir.anchored === false, '真实 init.lua:无锚')
    ok(idir.blocks.some((b) => b.key === 'package:test_p_0'), 'Package:new("id") 识别为 package 块')
    const charKeys = idir.blocks.filter((b) => b.kind === 'character').map((b) => b.key)
    ok(charKeys.join(',') === 'character:mouxusheng,character:blank_shibing,character:blank_nvshibing', 'General(…) 识别出 3 个武将(按文本顺序)')
    const mouxu = blocks.extractBlock(initLua, 'character', 'mouxusheng')
    ok(mouxu.includes('test2.shield = 3') && mouxu.includes('test2:addSkills'), '武将块含 v. / v: 续语句(shihd/endnote/addSkills)')
    ok(!mouxu.includes('blank_shibing'), '武将块边界不越到下一个武将')
    ok(mouxu.includes('return') === false, '武将块不含文件末尾的 return')
    ok(blocks.collectLuaIds(initLua).length === 3, 'init.lua 收集到 3 个内容 ID')

    // 翻译:只把**连续**同 id 条目算一块(第二个 ["blank_shibing"] 在 vi_VN 大表里)
    const tb = blocks.virtualTranslateBlocks(initLua).filter((b) => b.id === 'blank_shibing')
    ok(tb.length === 1, '同 id 的条目在文件里出现两段 → 只建一个翻译块')
    ok(!tb[0].text.includes('Nam Binh Sĩ'), '翻译块只含连续条目,不把后面第二段并进来')
    ok(initLua.includes('Nam Binh Sĩ'), '第二段同 id 条目原样留在文件里(不参与写入也不被删)')
    const tEntries = blocks.translateEntries(initLua)
    ok(tEntries.length > 20 && tEntries.every((e) => e.key && typeof e.base === 'string'), 'translateEntries 枚举全部条目(含 key/base/value)')

    ok(blocks.countVirtualBlocks(lunarDev) === 10, 'lunar_devteam:10 个可锚定条目')
    ok(blocks.extractBlock(lunarDev, 'character', 'fk_dev__rem') !== null, 'General:new(…) 也识别为武将')
    const muyi = blocks.extractBlock(lunarDev, 'character', 'fk_dev__muyiliuli')
    ok(muyi !== null && muyi.includes(':addSkills'), '链式 General(…):addSkills{…} 整条归该武将')
    ok(blocks.collectLuaIds(lunarDev).length === 4, 'lunar_devteam:4 个武将')
  } else {
    skip('真实包夹具(游戏目录不可用):init.lua / test_rende.lua / lunar_devteam')
  }

  const aDir = blocks.scanBlocks(ANCHORED)
  ok(aDir.anchored === true && aDir.blocks.length === 3, '锚点文件:目录标记 anchored 且 3 块')
  ok(blocks.scanAnchored(ANCHORED).length === 3, 'scanAnchored:扫描到 3 个锚点块')
  const aCollected = blocks.collectBlocks(ANCHORED)
  ok(['skill:ak_a', 'skill:ak_b', 'translate:ak_a'].every((k) => aCollected.find((b) => b.key === k)?.anchored === true), 'collectBlocks:锚点块 anchored=true')
  ok(aCollected.some((b) => b.key === 'package:anchored_pkg' && b.anchored === false), 'collectBlocks:未锚的包声明由虚拟划分补足(anchored=false)')
  ok(blocks.extractBlock(ANCHORED, 'skill', 'ak_a').includes('a:addEffect'), '锚点块内文含续语句')
  ok(!blocks.stripAnchors(ANCHORED).includes('#xinyue-kit'), 'stripAnchors 剥掉全部锚点行')
  ok(blocks.stripAnchors(ANCHORED).includes('name = "ak_a"'), 'stripAnchors 不碰正文')
  const crlfAnchored = ANCHORED.split('\n').join('\r\n')
  ok(blocks.scanAnchored(crlfAnchored).length === 3, 'CRLF 文件的锚点行(行尾 \\r)能被认出')

  // 翻译基础 id 归组
  console.log('\n[4] 翻译基础 id')
  ok(blocks.translateBaseId('test_rende') === 'test_rende', '普通 key')
  ok(blocks.translateBaseId(':test_rende') === 'test_rende', '描述键前导冒号')
  ok(blocks.translateBaseId('#test_rende-active') === 'test_rende', '技能提示键 #id-xxx')
  ok(blocks.translateBaseId('~test_rende') === 'test_rende', '阵亡台词键 ~id')
  ok(blocks.translateBaseId('designer:test_rende') === 'test_rende', 'designer: 前缀')
  ok(blocks.translateBaseId('illustrator:test_rende') === 'test_rende', 'illustrator: 前缀')

  // ═══════════════════ 5) 组装:替换 + 未提交区块逐字节未动 ═══════════════════
  console.log('\n[5] assembleBlocks:替换')

  const repA = blocks.assembleBlocks(ANCHORED, [{ kind: 'skill', id: 'ak_b', code: 'local b = fk.CreateSkill {\n  name = "ak_b",\n  desc = "B2",\n}\n' }])
  ok(repA.errors.length === 0 && repA.applied.includes('skill:ak_b'), '锚点文件:替换提交成功')
  ok(blocks.extractBlock(repA.code, 'skill', 'ak_b').includes('desc = "B2"'), '替换内容生效')
  ok(blocks.extractBlock(repA.code, 'skill', 'ak_a') === blocks.extractBlock(ANCHORED, 'skill', 'ak_a'), '未提交区块逐字节未动')
  ok(repA.code.includes('--#xinyue-kit-begin skill:ak_b\n') && repA.code.includes('--#xinyue-kit-end skill:ak_b\n'), '锚点块替换后重新包锚点')
  ok(blocks.scanBlocks(repA.code).anchored === true, '替换后仍是锚点文件')
  ok(repA.code.slice(0, repA.code.indexOf('--#xinyue-kit-begin skill:ak_b')) === ANCHORED.slice(0, ANCHORED.indexOf('--#xinyue-kit-begin skill:ak_b')), '替换点之前的内容逐字节保留')

  if (HAS_REAL) {
    const rende = real('test/skills/test_rende.lua')
    const newSkill = 'local rende = fk.CreateSkill {\n  name = "test_rende",\n  desc = "v2",\n}\n\nrende:addEffect("active", {})\n'
    const repV = blocks.assembleBlocks(rende, [{ kind: 'skill', id: 'test_rende', code: newSkill }])
    ok(repV.errors.length === 0 && repV.applied.includes('skill:test_rende'), '真实技能文件:替换技能块成功')
    ok(blocks.luaSyntaxCheck(repV.code).ok, '替换后结构检查通过')
    ok(repV.code.slice(repV.code.indexOf('Fk:loadTranslationTable')) === rende.slice(rende.indexOf('Fk:loadTranslationTable')), '替换后翻译表逐字节未动')
    ok(driftedBlock(rende, repV.code, ['skill:test_rende']) === null, '除提交块外无任何区块漂移')

    const initLua = real('test/init.lua')
    const repT = blocks.assembleBlocks(initLua, [{ kind: 'translate', id: 'mouxusheng', code: '  ["mouxusheng"] = "谋徐盛改",\n  ["~mouxusheng"] = "遗言改",\n' }])
    ok(repT.errors.length === 0 && repT.code.includes('谋徐盛改'), '真实 init.lua:替换翻译组成功')
    ok(driftedBlock(initLua, repT.code, ['translate:mouxusheng']) === null, '翻译组替换不影响其他区块')
    ok(blocks.luaSyntaxCheck(repT.code).ok, '替换后 init.lua 结构检查通过')
  }

  // ═══════════════════ 6) 组装:删除 + return 保留 ═══════════════════
  console.log('\n[6] assembleBlocks:删除 / 无锚文件 / return 保留')

  const delA = blocks.assembleBlocks(ANCHORED, [], [], ['skill:ak_b'])
  ok(delA.errors.length === 0 && delA.deleted.includes('skill:ak_b'), '锚点文件:声明删除生效')
  ok(blocks.extractBlock(delA.code, 'skill', 'ak_b') === null, '被删块已消失')
  ok(blocks.extractBlock(delA.code, 'skill', 'ak_a') !== null, '删除不影响其他块')
  ok(blocks.luaSyntaxCheck(delA.code).ok, '删除后结构检查通过')
  const delMissing = blocks.assembleBlocks(ANCHORED, [], [], ['skill:不存在'])
  ok(delMissing.errors.length === 1 && delMissing.code === ANCHORED, '删除不存在的块 → 整单拒绝且原码返回')

  if (HAS_REAL) {
    const initLua = real('test/init.lua')
    const del = blocks.assembleBlocks(initLua, [], [], ['character:blank_shibing', 'translate:blank_shibing'])
    ok(del.errors.length === 0 && del.deleted.length === 2, '真实 init.lua:无锚文件删除武将 + 其翻译组')
    ok(blocks.collectLuaIds(del.code).join(',') === 'mouxusheng,blank_nvshibing', '删除后 ID 列表正确')
    ok(del.code.includes('return extension'), '文件末尾的 return extension 保留')
    ok((del.code.match(/blank_shibing/g) || []).length === 1, '只删了两段中的相关块,大表里的第二处同 id 条目未被动')
    ok(blocks.luaSyntaxCheck(del.code).ok, '删除后真实 init.lua 结构检查通过')
    ok(driftedBlock(initLua, del.code, ['character:blank_shibing', 'translate:blank_shibing']) === null, '删除只动声明的那两块')
    const repNonAnchored = blocks.assembleBlocks(real('test/skills/test_rende.lua'), [{ kind: 'skill', id: 'test_rende', code: 'local rende = fk.CreateSkill {\n  name = "test_rende",\n  desc = "x",\n}\n' }])
    ok(!repNonAnchored.code.includes('#xinyue-kit'), '无锚文件替换不会擅自加锚点注释')
  }

  // ═══════════════════ 7) 组装:插入新块 ═══════════════════
  console.log('\n[7] assembleBlocks:插入')

  const insA = blocks.assembleBlocks(ANCHORED, [{ kind: 'skill', id: 'ak_c', code: 'local c = fk.CreateSkill {\n  name = "ak_c",\n}\n' }])
  ok(insA.errors.length === 0 && insA.applied.includes('skill:ak_c'), '锚点文件:插入新技能成功')
  ok(insA.code.includes('--#xinyue-kit-begin skill:ak_c\n') && insA.code.includes('--#xinyue-kit-end skill:ak_c\n'), '新块自动包上锚点')
  ok(blocks.extractBlock(insA.code, 'skill', 'ak_c').includes('name = "ak_c"'), '插入的新块可被读出')
  ok(insA.code.indexOf('skill:ak_c') > insA.code.indexOf('skill:ak_b'), '新块落在同类最后一块之后')
  ok(blocks.luaSyntaxCheck(insA.code).ok, '插入后结构检查通过')

  if (HAS_REAL) {
    const rende = real('test/skills/test_rende.lua')
    const ins = blocks.assembleBlocks(rende, [{ kind: 'skill', id: 'test_new', code: 'local tn = fk.CreateSkill {\n  name = "test_new",\n}\n' }])
    ok(ins.errors.length === 0 && ins.applied.includes('skill:test_new'), '真实技能文件:插入新技能成功')
    ok(ins.code.indexOf('name = "test_new"') < ins.code.indexOf('Fk:loadTranslationTable'), '新技能落在翻译表之前(同类块之后)')
    ok(ins.code.slice(ins.code.indexOf('Fk:loadTranslationTable')) === rende.slice(rende.indexOf('Fk:loadTranslationTable')), '插入后原有尾部逐字节未动')
    ok(blocks.collectLuaIds(ins.code).join(',') === 'test_rende,test_new', '插入后两个技能 ID 都在')
    ok(blocks.luaSyntaxCheck(ins.code).ok, '插入后结构检查通过')

    const initLua = real('test/init.lua')
    const insC = blocks.assembleBlocks(initLua, [{ kind: 'character', id: 'newguy', code: 'local newguy = General(extension, "newguy", "wu", 4)\nnewguy.hidden = true\n' }])
    ok(insC.errors.length === 0 && insC.applied.includes('character:newguy'), '真实 init.lua:插入新武将成功')
    ok(insC.code.indexOf('"newguy"') < insC.code.lastIndexOf('return extension'), '新武将落在顶格 return 之前')
    ok(insC.code.includes('newguy.hidden = true'), '续语句随新块一起写入')
    ok(blocks.collectLuaIds(insC.code).includes('newguy'), '插入的武将能被 ID 收集识别')
    ok(blocks.luaSyntaxCheck(insC.code).ok, '插入后 init.lua 结构检查通过')
  }

  const noComma = 'local t = 1\nFk:loadTranslationTable{\n  ["a"] = "A"\n}\nreturn t\n'
  const insT = blocks.assembleBlocks(noComma, [{ kind: 'translate', id: 'b', code: '  ["b"] = "B",\n' }])
  ok(insT.errors.length === 0, '插入新翻译条目成功')
  ok(insT.code.indexOf('["b"]') < insT.code.lastIndexOf('}'), '新翻译条目落进翻译表内部(收口 } 之前)')
  ok(/\["a"\] = "A",\n/.test(insT.code), '表内插入自动给前一条补上逗号')
  ok(blocks.translateEntries(insT.code).map((e) => e.key).join(',') === 'a,b', '补逗号后两条翻译都能被解析')
  ok(blocks.luaSyntaxCheck(insT.code).ok, '插入翻译后结构检查通过')

  const noReturn = 'local x = 1\n'
  const insEOF = blocks.assembleBlocks(noReturn, [{ kind: 'character', id: 'g', code: 'local g = General(extension, "g", "wu", 4)\n' }])
  ok(insEOF.errors.length === 0 && insEOF.code.endsWith('General(extension, "g", "wu", 4)\n'), '没有 return 的文件:新块追加到文件末尾')
  ok(blocks.collectBlocks(insEOF.code).some((b) => b.key === 'character:g'), '追加后能被识别')

  const dup = blocks.assembleBlocks(ANCHORED, [
    { kind: 'skill', id: 'ak_x', code: 'local x = fk.CreateSkill { name = "ak_x" }\n' },
    { kind: 'skill', id: 'ak_x', code: 'local x2 = fk.CreateSkill { name = "ak_x" }\n' },
  ])
  ok(dup.errors.length === 1 && /重复/.test(dup.errors[0]), '同一 key 重复提交被拒')
  ok(dup.code === ANCHORED, '重复提交整单拒绝,原码返回')

  // ═══════════════════ 8) edits 精确补丁 ═══════════════════
  console.log('\n[8] assembleBlocks:edits')

  const base = 'local a = 1\nlocal b = 2\nlocal a = 1\n'
  const e1 = blocks.assembleBlocks(base, [], [{ find: 'local b = 2', replace: 'local b = 3' }])
  ok(e1.errors.length === 0 && e1.code.includes('local b = 3'), 'edits:唯一命中即应用')
  const e0 = blocks.assembleBlocks(base, [], [{ find: '不存在', replace: 'x' }])
  ok(e0.errors.length === 1 && e0.code === base, 'edits:未命中整单拒绝')
  const e2 = blocks.assembleBlocks(base, [], [{ find: 'local a = 1', replace: 'local a = 9' }])
  ok(e2.errors.length === 1 && /2 次/.test(e2.errors[0]) && e2.code === base, 'edits:命中 2 次整单拒绝')

  // ═══════════════════ 9) 保真校验 ═══════════════════
  console.log('\n[9] checkFidelity')

  if (HAS_REAL) {
    const rende = real('test/skills/test_rende.lua')
    const tampered = rende.replace('"给牌"', '"给牌改"')
    const out = blocks.checkFidelity(rende, tampered, [])
    ok(!out.ok && out.changed.includes('test_rende'), '范围外的区块改动被标出')
    const inside = blocks.checkFidelity(rende, tampered, ['test_rende'])
    ok(inside.ok && inside.changed.length === 0, '申报范围内的改动放行')
    ok(blocks.checkFidelity(rende, rende, []).ok, '完全一致放行')
  }

  // ═══════════════════ 10) 锚点化迁移 ═══════════════════
  console.log('\n[10] 迁移(只加锚点注释行)')

  if (HAS_REAL) {
    const rende = real('test/skills/test_rende.lua')
    const m1 = blocks.migrateCode(rende)
    ok(!m1.error && m1.blocks === 2 && m1.inserted === 4, '真实技能文件:识别 2 块、插 4 行锚点')
    ok(blocks.stripAnchors(m1.code) === rende, '迁移自检:剥掉锚点后与原文逐字节一致')
    ok(blocks.scanBlocks(m1.code).anchored === true, '迁移后目录标记 anchored')
    ok(blocks.extractBlock(m1.code, 'skill', 'test_rende').includes('on_use'), '迁移后按块读取仍正常')
    ok(blocks.luaSyntaxCheck(m1.code).ok, '迁移后结构检查通过')
    const m2 = blocks.migrateCode(m1.code)
    ok(!m2.error && blocks.stripAnchors(m2.code) === rende, '重复迁移幂等(剥旧锚重打,内容不变)')

    const initLua = real('test/init.lua')
    const m3 = blocks.migrateCode(initLua)
    ok(!m3.error && blocks.stripAnchors(m3.code) === initLua, '真实 init.lua:CRLF 文件迁移后逐字节还原')
    ok(blocks.luaSyntaxCheck(m3.code).ok, 'CRLF 迁移后结构检查通过')
  }
  const mNo = blocks.migrateCode('local x = 1\n')
  ok(typeof mNo.error === 'string' && /可锚定/.test(mNo.error), '没有可锚定条目的文件:迁移报错而非写空锚点')

  // ═══════════════════ 11) 集成:writeExtension / readExtension ═══════════════════
  console.log('\n[11] 集成写入(临时假游戏目录)')

  fakeGame = join(tmpRoot, 'fake-game')
  mkdirSync(join(fakeGame, 'packages'), { recursive: true })
  mkdirSync(join(fakeGame, 'lua', 'core'), { recursive: true })
  writeFileSync(join(fakeGame, 'lua', 'core', 'package.lua'), '-- fake engine core\n')
  const skillFile = join(fakeGame, 'packages', 'test_pkg', 'skills', 'test_a.lua')
  const skillCode = (desc) => 'local ta = fk.CreateSkill {\n  name = "test_a",\n  desc = "' + desc + '",\n}\n\nFk:loadTranslationTable{\n  ["test_a"] = "技A",\n}\n\nreturn ta\n'

  const wFirst = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_a.lua', code: skillCode('v1'), idPrefix: 'test_' })
  ok(wFirst.ok && wFirst.wrote && wFirst.backup === undefined, '首写新技能文件:成功且不返回 backup 键(undefined 不写进返回)')
  ok(wFirst.path === 'packages/test_pkg/skills/test_a.lua', '返回包内相对路径')
  ok(readFileSync(skillFile, 'utf8').includes('desc = "v1"'), '文件内容已落盘')

  const wOver = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_a.lua', code: skillCode('v2'), idPrefix: 'test_', editScope: ['test_a'] })
  ok(wOver.ok && wOver.wrote, '全文 + editScope 覆盖成功')
  ok(typeof wOver.backup === 'string' && wOver.backup !== '' && existsSync(join(fakeGame, wOver.backup)), '覆盖生成备份文件')
  ok(readFileSync(join(fakeGame, wOver.backup), 'utf8').includes('desc = "v1"'), '备份里是旧内容')
  ok(readdirSync(join(fakeGame, 'packages', 'test_pkg', 'skills', 'backup')).length >= 1, '备份落在 <包>/skills/backup/')

  const beforeReject = readFileSync(skillFile, 'utf8')
  const wScope = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_a.lua', code: beforeReject.replace('v2', 'v3'), idPrefix: 'test_', editScope: ['别的id'] })
  ok(wScope.ok && wScope.wrote && (wScope.warnings || []).some((w) => /自动并入/.test(w.message)), 'editScope 未申报的改动 → 自动并入并给出警告(不再拒写)')
  ok(readFileSync(skillFile, 'utf8').includes('desc = "v3"'), '自动并入后新内容确实落盘')

  const beforeSyn = readFileSync(skillFile, 'utf8')
  const wSyn = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_a.lua', code: 'local x = fk.CreateSkill{ name = "test_a"\n', idPrefix: 'test_' })
  ok(!wSyn.ok && !wSyn.wrote && wSyn.errors.length > 0, '语法错 → 拒写')
  ok(/语法/.test(wSyn.errors.map((e) => e.message).join(' ')), '语法错的报错文案可读')
  ok(readFileSync(skillFile, 'utf8') === beforeSyn, '语法错拒写后文件未被改动')

  const wLost = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_a.lua', code: 'local tb = fk.CreateSkill {\n  name = "test_b",\n}\n\nreturn tb\n', idPrefix: 'test_' })
  ok(!wLost.ok && /消失/.test(wLost.errors[0].message), '防丢护栏:全文覆盖丢掉内部 ID 被拦')

  const wBlock = await writeExtension(fakeGame, {
    folder: 'test_pkg', file: 'skills/test_a.lua', idPrefix: 'test_',
    blocks: [{ kind: 'skill', id: 'test_a', code: 'local ta = fk.CreateSkill {\n  name = "test_a",\n  desc = "v4",\n}\n' }],
  })
  ok(wBlock.ok && wBlock.wrote, '区块模式写入成功')
  ok(readFileSync(skillFile, 'utf8').includes('desc = "v4"'), '区块写入内容生效')
  ok(readFileSync(skillFile, 'utf8').includes('return ta'), '区块外的 return ta 逐字节保留')
  ok(wBlock.backup !== '', '区块写入也产生备份')

  const beforeManual = readFileSync(skillFile, 'utf8')
  const wManual = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_a.lua', idPrefix: 'test_', writeMode: 'manual', code: beforeManual.replace('v4', 'v5') })
  ok(wManual.ok && !wManual.wrote && typeof wManual.code === 'string' && wManual.code.includes('v5'), 'manual 模式返回组装后的 code 但不落盘')
  ok(readFileSync(skillFile, 'utf8') === beforeManual, 'manual 模式确实没写文件')

  const wNew = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/nope.lua', blocks: [{ kind: 'skill', id: 'nope', code: 'x' }] })
  ok(!wNew.ok && /全文模式/.test(wNew.errors[0].message), '区块模式用于不存在的文件 → 提示改用全文模式')

  const rdList = await readExtension(fakeGame, 'test_pkg', { listBlocks: true })
  ok(rdList.blocks.blocks.map((b) => b.key).sort().join(',') === 'skill:test_a,translate:test_a', 'readExtension:listBlocks 聚合全包目录')
  ok(rdList.blocks.blocks.every((b) => b.file === 'skills/test_a.lua'), 'listBlocks 每块带 file 归属')
  const rdBlock = await readExtension(fakeGame, 'test_pkg', { block: 'skill:test_a' })
  ok(typeof rdBlock.code === 'string' && rdBlock.code.includes('desc = "v4"') && rdBlock.block.id === 'test_a', 'readExtension:按块读取(走 skills/<id>.lua 快速路径)')
  const rdMiss = await readExtension(fakeGame, 'test_pkg', { block: 'skill:不存在' })
  ok(rdMiss.code === undefined && typeof rdMiss.error === 'string', 'readExtension:找不到的块返回 error')

  const anchorTarget = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_b.lua', code: 'local tb = fk.CreateSkill {\n  name = "test_b",\n}\n\nreturn tb\n', idPrefix: 'test_' })
  ok(anchorTarget.ok && anchorTarget.wrote, '写入待迁移文件')
  const mg = await migrateAnchors(fakeGame, 'test_pkg', 'skills/test_b.lua')
  ok(mg.ok && mg.inserted === 2 && mg.blocks === 1 && mg.backup !== '', 'migrateAnchors:插 2 行锚点、留备份')
  const anchoredFile = readFileSync(join(fakeGame, 'packages', 'test_pkg', 'skills', 'test_b.lua'), 'utf8')
  ok(blocks.scanBlocks(anchoredFile).anchored === true, 'migrateAnchors 后文件变成锚点文件')
  ok(blocks.stripAnchors(anchoredFile).includes('name = "test_b"'), 'migrateAnchors 不改动正文')
  const wAnchored = await writeExtension(fakeGame, {
    folder: 'test_pkg', file: 'skills/test_b.lua', idPrefix: 'test_',
    blocks: [{ kind: 'skill', id: 'test_b', code: 'local tb = fk.CreateSkill {\n  name = "test_b",\n  desc = "anchored",\n}\n' }],
  })
  ok(wAnchored.ok && wAnchored.wrote && readFileSync(join(fakeGame, 'packages', 'test_pkg', 'skills', 'test_b.lua'), 'utf8').includes('desc = "anchored"'), '锚点文件也能走区块模式写入')

  // ── 删除区块:kind:id 与裸 id 两种写法,裸 id 命中多块必须报歧义 ──
  const wDelKind = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_a.lua', idPrefix: 'test_', deletes: ['translate:test_a'] })
  ok(wDelKind.ok && wDelKind.wrote && !readFileSync(skillFile, 'utf8').includes('"技A"'), '删除区块:kind:id 形式生效')
  const wReAdd = await writeExtension(fakeGame, {
    folder: 'test_pkg', file: 'skills/test_a.lua', idPrefix: 'test_',
    blocks: [{ kind: 'translate', id: 'test_a', code: '  ["test_a"] = "技A2",\n' }],
  })
  ok(wReAdd.ok && wReAdd.wrote && readFileSync(skillFile, 'utf8').includes('技A2'), '重新加回翻译区块')
  const wAmbiguous = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_a.lua', idPrefix: 'test_', deletes: ['test_a'] })
  ok(!wAmbiguous.ok && /不唯一/.test(wAmbiguous.errors[0].message), '裸 id 同时命中技能块与翻译块 → 报歧义而不是乱删')
  const wExtra = await writeExtension(fakeGame, {
    folder: 'test_pkg', file: 'skills/test_c.lua', idPrefix: 'test_',
    code: 'local tc = fk.CreateSkill {\n  name = "test_c",\n}\n\nFk:loadTranslationTable{\n  ["test_c_extra"] = "额外",\n}\n\nreturn tc\n',
  })
  ok(wExtra.ok && wExtra.wrote, '写入带额外翻译块的 test_c.lua')
  const testCFile = join(fakeGame, 'packages', 'test_pkg', 'skills', 'test_c.lua')
  const wDelBare = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_c.lua', idPrefix: 'test_', deletes: ['test_c_extra'] })
  ok(wDelBare.ok && wDelBare.wrote && !readFileSync(testCFile, 'utf8').includes('额外'), '删除区块:裸 id 唯一命中时生效')
  const wDelMiss = await writeExtension(fakeGame, { folder: 'test_pkg', file: 'skills/test_a.lua', idPrefix: 'test_', deletes: ['translate:不存在'] })
  ok(!wDelMiss.ok && /不存在/.test(wDelMiss.errors[0].message), '删不存在的区块 → 报错并列出可用区块')

  // ═══════════════════ 12) 路径约定 / 常量 ═══════════════════
  console.log('\n[12] 路径约定与常量')

  ok(blocks.ENTRY_FILE === 'init.lua', 'ENTRY_FILE = init.lua(不是 extension.js)')
  ok(blocks.CONTENT_KINDS.join(',') === 'skill,card,character', 'CONTENT_KINDS 三种内容块')
  ok(blocks.ALL_KINDS.join(',') === 'skill,card,character,translate,package', 'ALL_KINDS 含 translate/package')
  ok(blocks.isSkillFile('test/skills/test_rende.lua') && blocks.isSkillFile('skills/a.lua'), 'isSkillFile:skills/<id>.lua 命中')
  ok(!blocks.isSkillFile('init.lua') && !blocks.isSkillFile('pkg/x.lua'), 'isSkillFile:其他路径不命中')
  ok(blocks.skillIdFromFile('test/skills/test_rende.lua') === 'test_rende', 'skillIdFromFile 取技能 id')
  ok(blocks.skillIdFromFile('init.lua') === '', 'skillIdFromFile:非技能文件返回空串')

  // ═══════════════════ 13) 真实包全量回归(词法在 8000+ 真实 Lua 上跑)═══════════════════
  console.log('\n[13] 真实包全量结构检查')
  if (HAS_REAL) {
    const files = walkLua(PKG_DIR)
    const bad = []
    let nonEmpty = 0
    for (const f of files) {
      const code = readFileSync(f, 'utf8')
      if (!code.trim()) continue // 空文件本就该被拒(代码为空)
      nonEmpty++
      const v = blocks.luaSyntaxCheck(code)
      if (!v.ok) bad.push(f.slice(PKG_DIR.length) + ' :: ' + v.message)
    }
    if (bad.length) console.log('    失败明细:\n      ' + bad.slice(0, 10).join('\n      '))
    ok(files.length > 1000 && bad.length === 0, '全部真实 .lua 通过 Lua 结构检查(' + files.length + ' 个文件,其中非空 ' + nonEmpty + ' 个,失败 ' + bad.length + ')')
  } else {
    skip('真实包全量扫描(游戏目录不可用)')
  }

  console.log('\n全部通过:' + passed + ' 项' + (skippedCount ? '(SKIP ' + skippedCount + ' 项)' : ''))
} finally {
  rmSync(tmpRoot, { recursive: true, force: true })
}
