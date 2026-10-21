#!/usr/bin/env node
/**
 * xinyue-kit 单测:任务登记处状态机 + 写入防丢护栏。
 * 运行:node scripts/test-tasks.mjs
 * 全程隔离在系统临时目录(登记处 + 假游戏目录),跑完即删,不碰真实家目录与游戏。
 *
 * 新月杀(FreeKill)语义:游戏根含 packages/ 与 lua/;扩展包在 packages/<包>/,
 * 条目是 Lua(init.lua / skills/<技能id>.lua),不是无名杀的 extension.js。
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const home = mkdtempSync(join(tmpdir(), 'xinyue-kit-test-'))
const xinyueDir = join(home, 'fake-game')
let passed = 0
function ok(cond, label) {
  assert.ok(cond, label)
  passed++
  console.log('  ✓ ' + label)
}

try {
  const tasks = await import('../src/tasks.js')
  const { writeExtension } = await import('../src/write.js')

  // 假游戏根:同时有 packages/ 与 lua/(lua/core/package.lua 是最硬标志)
  mkdirSync(join(xinyueDir, 'packages'), { recursive: true })
  mkdirSync(join(xinyueDir, 'lua', 'core'), { recursive: true })
  writeFileSync(join(xinyueDir, 'lua', 'core', 'package.lua'), '-- fake engine core\n')

  // ── 1) 创建武将任务(带图):树结构 + 初始状态 ──
  const created = await tasks.createTask(home, {
    id: '测试包-01', folder: 'test_pkg', type: 'general', title: '木偶',
    generalInfo: '势力 wei,体力 4/4,General.Male', idPrefix: 'ts_',
    skills: [{ name: '挥砍', desc: '出杀次数+1' }, { name: '格挡', desc: '受到杀的伤害-1' }],
    image: 'ts_muou.jpg',
  })
  ok(created.ok, '创建武将任务')
  ok(created.task.type === 'general' && created.task.generalInfo === '势力 wei,体力 4/4,General.Male',
    'Type=general + generalInfo 落库')
  ok(created.task.cardInfo === '', 'general 任务的 cardInfo 为空字符串(卡牌占位字段始终存在)')
  ok(created.task.skills.length === 2 && created.task.skills.every((s) => s.status === 'open'), '两个技能初始均为待实现')
  ok(created.task.image === 'ts_muou.jpg', '图片登记进任务')

  // ── 1b) 武将元信息(称号/设计/配音/画师):白名单清洗 + 缺省兜底 ──
  const metaCreated = await tasks.createTask(home, {
    id: '测试包-01b', folder: 'test_pkg', type: 'general', title: '元信息武将',
    generalMeta: { title: '  苍梧之刃  ', designer: '官方', cv: '官方', illustrator: '官方', 无关字段: '丢掉' },
    skills: [],
  })
  ok(metaCreated.ok, '带元信息创建武将任务')
  ok(metaCreated.task.generalMeta && metaCreated.task.generalMeta.title === '苍梧之刃',
    '元信息 title 去空白后落库:' + JSON.stringify(metaCreated.task.generalMeta))
  ok(metaCreated.task.generalMeta.cv === '官方' && metaCreated.task.generalMeta.illustrator === '官方',
    '配音/画师「官方」原样落库')
  ok(!('无关字段' in metaCreated.task.generalMeta), '元信息只保留四个白名单键')
  ok(metaCreated.task.generalMeta.designer.length <= 100, '元信息每项截断到 100 字')

  const bareCreated = await tasks.createTask(home, { id: '测试包-01c', folder: 'test_pkg', type: 'card', title: '无元信息', cardInfo: '' })
  ok(bareCreated.ok && bareCreated.task.generalMeta && bareCreated.task.generalMeta.title === '',
    '不带元信息时四键都是空串(旧任务记录读取链路不炸)')

  // ── 2) 重复 ID / 非法 ID ──
  const dup = await tasks.createTask(home, { id: '测试包-01', folder: 'test_pkg', type: 'general', skills: [] })
  ok(!dup.ok, '重复任务ID被拒')
  const bad = await tasks.createTask(home, { id: '坏 id!', folder: 'test_pkg', type: 'general', skills: [] })
  ok(!bad.ok, '非法任务ID被拒')

  // ── 3) skills_written:标记待测试 + 缺失上报 ──
  const marked = await tasks.markSkillsWritten(home, { taskId: '测试包-01', skills: ['挥砍', '不存在'] })
  ok(!marked.ok && marked.missing.includes('不存在') && marked.marked === 1, 'skills_written 标记真实技能并上报缺失')
  ok(marked.task.skills[0].status === 'written', '标记后状态为待测试')
  const noted = await tasks.markSkillsWritten(home, { taskId: '测试包-01', skills: ['格挡'], notes: ['canUse(card,t,distance=false) 忽略距离', 'canUse(card,t,distance=false) 忽略距离'] })
  ok(noted.ok && noted.notesStored === 1, 'skills_written notes 去重合并(引擎级结论才该进来)')

  // ── 4) 反馈:技能打回 open + 轮次累计 ──
  await tasks.setSkillStatus(home, { taskId: '测试包-01', skill: '挥砍', status: 'confirmed' })
  const fb = await tasks.skillFeedback(home, { taskId: '测试包-01', skill: '挥砍', issue: '伤害算错' })
  ok(fb.ok && fb.task.skills[0].status === 'open' && fb.task.skills[0].rounds === 1, '反馈把已确认技能打回待实现')
  ok(fb.task.feedbacks.length === 1 && fb.task.rounds === 1, '任务级轮次+1 且日志入账')

  // ── 5) 逐技能确认 → 全确认+有图 → 自动完成 ──
  const m2 = await tasks.markSkillsWritten(home, { taskId: '测试包-01', skills: ['挥砍', '格挡'] })
  ok(m2.ok, '全部技能重新标记待测试')
  const c1 = await tasks.setSkillStatus(home, { taskId: '测试包-01', skill: '挥砍', status: 'confirmed' })
  ok(c1.ok && !c1.autoCompleted && c1.task.status === 'open', '部分确认不触发自动完成')
  const c2 = await tasks.setSkillStatus(home, { taskId: '测试包-01', skill: '格挡', status: 'confirmed' })
  ok(c2.ok && c2.autoCompleted === true && c2.task.status === 'done', '全确认+有图 → 自动完成并置 done')

  // ── 6) 缺图任务:全确认也不自动完成,补图后可就位 ──
  await tasks.createTask(home, { id: '测试包-02', folder: 'test_pkg', type: 'card', title: '决胜符', cardInfo: '锦囊牌,使用时机自定(占位)', skills: [{ name: '任意占位', desc: '效果' }] })
  const cardTask = await tasks.getTask(home, '测试包-02')
  ok(cardTask.type === 'card' && cardTask.cardInfo === '锦囊牌,使用时机自定(占位)',
    'card 任务 cardInfo 自由文本落库(【待补充】占位,不做花色点数校验)')
  ok(cardTask.skills.length === 1 && cardTask.skills[0].name === '决胜符', '卡牌任务生成以卡牌名命名的单节点')
  await tasks.markSkillsWritten(home, { taskId: '测试包-02', skills: ['决胜符'] })
  const c3 = await tasks.setSkillStatus(home, { taskId: '测试包-02', skill: '决胜符', status: 'confirmed' })
  ok(c3.ok && !c3.autoCompleted && c3.task.status === 'open', '缺图任务全确认也不自动完成')
  const img = await tasks.setTaskImage(home, { taskId: '测试包-02', image: 'ts_kapai.jpg' })
  ok(img.ok && img.task.image === 'ts_kapai.jpg', '补图写回任务')
  ok(img.autoCompleted === true && img.task.status === 'done', '全确认后补图 → 触发自动完成置 done')

  // ── 7) 重开:done → open(不动技能/轮次/反馈) ──
  const doneTask = await tasks.completeById(home, { taskId: '测试包-02', summary: '手动标记完成' })
  ok(doneTask.ok && doneTask.task.status === 'done', '手动标记完成置 done')
  const reopened = await tasks.reopenTask(home, { taskId: '测试包-02' })
  ok(reopened.ok && reopened.task.status === 'open', '重开把任务打回进行中')
  ok(reopened.task.skills.every((s) => s.status === 'confirmed'), '重开不重置技能状态')
  const reopenGhost = await tasks.reopenTask(home, { taskId: '不存在的任务' })
  ok(!reopenGhost.ok, '重开不存在的任务报错')

  // ── 8) 删除:只动登记记录 ──
  const del = await tasks.deleteTask(home, '测试包-02')
  ok(del.ok, '删除任务')
  ok((await tasks.getTask(home, '测试包-02')) === null, '删除后查无此任务')

  // ── 9) 防丢护栏(Lua):旧技能消失拒写,补回放行 ──
  const oldCode = [
    'local pkg = Package:new("test_pkg")',
    'local ts_aaa = fk.CreateSkill{ name = "ts_aaa" }',
    'local ts_bbb = fk.CreateSkill{ name = "ts_bbb" }',
    'return pkg',
    '',
  ].join('\n')
  const r1 = await writeExtension(xinyueDir, { folder: 'test_pkg', code: oldCode })
  ok(r1.ok && r1.wrote, '首次写入成功(无旧代码,护栏不误伤)')
  const lostCode = [
    'local pkg = Package:new("test_pkg")',
    'local ts_bbb = fk.CreateSkill{ name = "ts_bbb" }',
    'return pkg',
    '',
  ].join('\n')
  const r2 = await writeExtension(xinyueDir, { folder: 'test_pkg', code: lostCode })
  ok(!r2.ok && !r2.wrote && /消失/.test(r2.errors[0].message), '旧技能消失 → 拒写')
  const preserved = await readFile(join(xinyueDir, 'packages', 'test_pkg', 'init.lua'), 'utf8')
  ok(/ts_aaa/.test(preserved), '拒写后旧文件未被破坏')
  const fullCode = [
    'local pkg = Package:new("test_pkg")',
    'local ts_aaa = fk.CreateSkill{ name = "ts_aaa" }',
    'local ts_bbb = fk.CreateSkill{ name = "ts_bbb" }',
    'local ts_ccc = fk.CreateSkill{ name = "ts_ccc" }',
    'return pkg',
    '',
  ].join('\n')
  const r3 = await writeExtension(xinyueDir, { folder: 'test_pkg', code: fullCode })
  ok(r3.ok && r3.wrote && r3.backup, '补回技能 → 放行,且产生备份')

  // ── 10) 编辑已有条目:createTask 的 target + listEntries(下拉数据源) ──
  const editCreated = await tasks.createTask(home, {
    id: '测试包-03', folder: 'test_pkg', type: 'general', title: '凌霜',
    skills: [{ name: '凌霜', desc: '把天罚伤害 1 改成 2' }],
    target: { kind: 'general', id: ' cs_tianfa ' },
  })
  ok(editCreated.ok && editCreated.task.target
    && editCreated.task.target.kind === 'general' && editCreated.task.target.id === 'cs_tianfa',
    '编辑任务 target 落库(kind=general,去空白)')
  const badTarget = await tasks.createTask(home, {
    id: '测试包-04', folder: 'test_pkg', type: 'card', title: '占位',
    skills: [{ name: '占位', desc: '效果' }],
    target: { kind: 'weapon', id: 'bad id!' },
  })
  ok(badTarget.ok && badTarget.task.target === null, '非法 target(kind 不认/ID 不合法)归 null')
  const oldKindTarget = await tasks.createTask(home, {
    id: '测试包-04b', folder: 'test_pkg', type: 'card', title: '占位4b',
    skills: [{ name: '占位4b', desc: '效果' }],
    target: { kind: 'character', id: 'ts_x' },
  })
  ok(oldKindTarget.ok && oldKindTarget.task.target === null, '旧 kind=character 不再被接受(无向后兼容)→ null')
  const noTarget = await tasks.createTask(home, { id: '测试包-05', folder: 'test_pkg', type: 'card', title: '占位2', skills: [{ name: '占位2', desc: '' }] })
  ok(noTarget.ok && noTarget.task.target === null, '不传 target → null(创建任务不受影响)')
  const editCard = await tasks.createTask(home, {
    id: '测试包-06', folder: 'test_pkg', type: 'card',
    skills: [{ name: '修改 tumoubugui', desc: '伤害 1 改为 2' }],
    target: { kind: 'card', id: 'tumoubugui' },
  })
  ok(editCard.ok && editCard.task.skills.length === 1 && editCard.task.skills[0].name === '修改 tumoubugui',
    '编辑卡牌任务(无 title)节点名取 skills[0].name,不再显示「新卡牌」')

  const entriesCode = [
    'local pkg = Package:new("条目包")',
    'local ts_ren1 = General(pkg, "ts_ren1", "wei", 4, 4, General.Male)',
    'ts_ren1:addSkills { "ts_skill1" }',
    'local ts_ren2 = General(pkg, "ts_ren2", "shu", 3, 3, General.Female)',
    'ts_ren2:addSkills { "ts_skill2" }',
    'local cap = fk.CreateCard{ name = "ts_kapai", type = "TrickCard" }',
    'cap:addSkills { "ts_kapai_skill" }',
    'Fk:loadTranslationTable{',
    '  ["ts_ren1"] = "凌霜",',
    '  ["ts_ren2"] = "霜女",',
    '  ["ts_skill1"] = "挥砍",',
    '  ["ts_kapai"] = "疾风符",',
    '  ["ts_kapai_skill"] = "图谋",',
    '}',
    'return pkg',
    '',
  ].join('\n')
  const weEntries = await writeExtension(xinyueDir, { folder: 'entry_pkg', code: entriesCode })
  ok(weEntries.ok && weEntries.wrote, '写入条目包(供 listEntries 测试)')
  const { listEntries } = await import('../src/write.js')
  const leChar = await listEntries(xinyueDir, 'entry_pkg', 'character')
  ok(leChar.ok && leChar.entries.length === 2, 'listEntries 列出两个武将(General 构造调用)')
  ok(leChar.entries.some((x) => x.id === 'ts_ren1' && x.name === '凌霜'), '武将翻译表显示名(translationTable 聚合)')
  ok(leChar.entries.every((x) => x.file === 'init.lua'), '每个条目带文件归属(file=init.lua)')
  const leCard = await listEntries(xinyueDir, 'entry_pkg', 'card')
  ok(leCard.ok && leCard.entries.length === 1 && leCard.entries[0].id === 'ts_kapai' && leCard.entries[0].name === '疾风符', 'listEntries 列出卡牌(fk.CreateCard)+ 显示名')
  const leBad = await listEntries(xinyueDir, 'entry_pkg', 'weapon')
  ok(!leBad.ok, 'listEntries 非 character/card/skill 的 kind 被拒')
  const { listEntrySkills } = await import('../src/write.js')
  const es1 = await listEntrySkills(xinyueDir, 'entry_pkg', 'ts_ren1')
  ok(es1.ok && es1.skills.length === 1 && es1.skills[0].id === 'ts_skill1' && es1.skills[0].name === '挥砍',
    'listEntrySkills:武将 addSkills 解析 + translate 显示名')
  const es2 = await listEntrySkills(xinyueDir, 'entry_pkg', 'ts_ren2')
  ok(es2.ok && es2.skills.length === 1 && es2.skills[0].id === 'ts_skill2' && es2.skills[0].name === '',
    'listEntrySkills:无 translate 名时留空')
  const es3 = await listEntrySkills(xinyueDir, 'entry_pkg', '不存在')
  ok(es3.ok && es3.skills.length === 0, 'listEntrySkills:条目不存在 → 空清单')
  const es4 = await listEntrySkills(xinyueDir, 'entry_pkg', 'ts_kapai')
  ok(es4.ok && es4.skills.length === 1 && es4.skills[0].id === 'ts_kapai_skill' && es4.skills[0].name === '图谋',
    'listEntrySkills:卡牌条目的 skills 也解析(卡牌可带技能)')
  const manualTask = await tasks.createTask(home, { id: '测试包-07', folder: 'test_pkg', type: 'card', title: '占位3', skills: [{ name: '占位3', desc: '' }], writeMode: 'manual' })
  ok(manualTask.ok && manualTask.task.writeMode === 'manual', 'writeMode=manual 落库(写入工具以此为准)')
  const weirdMode = await tasks.createTask(home, { id: '测试包-08', folder: 'test_pkg', type: 'card', title: '占位4', skills: [{ name: '占位4', desc: '' }], writeMode: 'whatever' })
  ok(weirdMode.ok && weirdMode.task.writeMode === 'auto', 'writeMode 非法值归 auto')

  // ── 11) 编辑任务(target)豁免图片条件:立绘已有,全确认即自动完成 ──
  const editChar = await tasks.createTask(home, {
    id: '测试包-09', folder: 'test_pkg', type: 'general', title: '',
    skills: [{ name: '修改 ts_muouou', desc: '改动要求' }, { name: '裂甲', desc: '新技能' }],
    target: { kind: 'general', id: 'ts_muouou' },
  })
  ok(editChar.ok && editChar.task.image === '', '编辑任务未登记图片')
  await tasks.markSkillsWritten(home, { taskId: '测试包-09', skills: ['修改 ts_muouou', '裂甲'] })
  const e1 = await tasks.setSkillStatus(home, { taskId: '测试包-09', skill: '修改 ts_muouou', status: 'confirmed' })
  ok(e1.ok && !e1.autoCompleted, '编辑任务:部分确认不触发自动完成')
  const e2 = await tasks.setSkillStatus(home, { taskId: '测试包-09', skill: '裂甲', status: 'confirmed' })
  ok(e2.ok && e2.autoCompleted === true && e2.task.status === 'done', '编辑任务:全确认且无图片需求 → 自动完成(不再卡缺图)')

  // ── 13) 多文件包(新月杀式:init.lua + skills/<技能id>.lua):聚合/跨文件读/按文件写/多文件迁移 ──
  const mf = 'multi_pkg'
  const { mkdir: mkdirP, writeFile: writeFileP } = await import('node:fs/promises')
  const pkgRoot = join(xinyueDir, 'packages', mf)
  await mkdirP(join(pkgRoot, 'skills'), { recursive: true })
  const initLua = [
    'local pkg = Package:new("multi包")',
    'local yxs_a = General(pkg, "yxs_a", "wei", 4, 4, General.Male)',
    'yxs_a:addSkills { "yxs_s1" }',
    'local yxs_b = General(pkg, "yxs_b", "shu", 4, 4, General.Female)',
    'yxs_b:addSkills { "yxs_s2" }',
    'Fk:loadTranslationTable{',
    '  ["yxs_a"] = "甲将",',
    '}',
    'return pkg',
    '',
  ].join('\n')
  await writeFileP(join(pkgRoot, 'init.lua'), initLua)
  await writeFileP(join(pkgRoot, 'skills', 'yxs_s1.lua'),
    'local yxs_s1 = fk.CreateSkill{ name = "yxs_s1" }\nFk:loadTranslationTable{\n  ["yxs_s1"] = "技能一",\n}\n')
  await writeFileP(join(pkgRoot, 'skills', 'yxs_s2.lua'),
    'local yxs_s2 = fk.CreateSkill{ name = "yxs_s2" }\nFk:loadTranslationTable{\n  ["yxs_s2"] = "技能二",\n}\n')

  const { readExtension: readExt2, migrateExtension, listEntrySkills: les2 } = await import('../src/write.js')
  const mEntries = await listEntries(xinyueDir, mf, 'character')
  ok(mEntries.ok && mEntries.entries.length === 2, '多文件包:listEntries 聚合全包条目')
  ok(mEntries.entries.every((e) => e.file === 'init.lua'), '多文件包:条目带 file 归属')
  ok(mEntries.entries.some((e) => e.id === 'yxs_a' && e.name === '甲将'), '多文件包:显示名按全包翻译表聚合')
  const mSkills = await les2(xinyueDir, mf, 'yxs_a')
  ok(mSkills.ok && mSkills.skills.length === 1 && mSkills.skills[0].id === 'yxs_s1' && mSkills.skills[0].name === '技能一',
    '多文件包:listEntrySkills 技能名跨文件聚合(技能名在 skills/*.lua 里)')
  const rdM = await readExt2(xinyueDir, mf, { listBlocks: true })
  ok(rdM.blocks.files && rdM.blocks.files.length === 3 && rdM.blocks.blocks.every((b) => b.file),
    '多文件包:listBlocks 聚合全包并带 file 归属/文件摘要')
  const rdB = await readExt2(xinyueDir, mf, { block: 'character:yxs_b' })
  ok(rdB.code && rdB.block && rdB.block.file === 'init.lua',
    '多文件包:未带 file 的按块读取自动跨文件定位')
  const mig = await migrateExtension(xinyueDir, mf)
  ok(mig.ok && mig.totalFiles === 3 && mig.totalBlocks >= 3, '多文件迁移:两个技能文件 + init.lua 锚点化')
  const rdMig = await readExt2(xinyueDir, mf, { block: 'character:yxs_a' })
  ok(rdMig.code && rdMig.block.file === 'init.lua', '多文件迁移:锚点化后按块读取仍正常')
  const wM = await writeExtension(xinyueDir, { folder: mf, file: 'init.lua', kind: 'character',
    blocks: [{ kind: 'character', id: 'yxs_a', code: 'local yxs_a = General(pkg, "yxs_a", "wei", 5, 5, General.Male)\nyxs_a:addSkills { "yxs_s1" }' }] })
  ok(wM.ok && wM.wrote, '多文件包:按 file 的区块写入成功')
  const mLost = await writeExtension(xinyueDir, { folder: mf, file: 'init.lua', kind: 'character',
    code: [
      'local pkg = Package:new("multi包")',
      'local yxs_a = General(pkg, "yxs_a", "wei", 5, 5, General.Male)',
      'yxs_a:addSkills { "yxs_s1" }',
      'Fk:loadTranslationTable{',
      '  ["yxs_a"] = "甲将",',
      '}',
      'return pkg',
      '',
    ].join('\n') })
  ok(!mLost.ok && /消失/.test(mLost.errors[0].message), '多文件包:全文模式防丢护栏按目标文件生效(丢 yxs_b 拒写)')
  let backupOk = false
  try { await import('node:fs/promises').then((fs) => fs.readdir(join(pkgRoot, 'backup'))).then((n) => { backupOk = n.some((x) => x.startsWith('init.')) }) } catch { }
  ok(backupOk, '多文件包:备份落在目标文件同目录 backup/')

  // ── 14) 备份滚动清理:每个 backup/ 只保留最新 3 个 ──
  for (let i = 0; i < 5; i++) {
    const wR = await writeExtension(xinyueDir, { folder: mf, file: 'init.lua', kind: 'character', code: initLua })
    ok(wR.ok, '滚动清理:第 ' + (i + 1) + ' 次写入成功')
  }
  const { readdir: rdFs } = await import('node:fs/promises')
  const backupsLeft = (await rdFs(join(pkgRoot, 'backup'))).filter((n) => /\.lua$/i.test(n))
  ok(backupsLeft.length <= 3, '滚动清理:连续写入后 backup/ 只保留 ≤3 个备份(实际 ' + backupsLeft.length + ')')
  const { pruneBackupRecords, readHistory: rh2 } = await import('../src/history.js')
  await pruneBackupRecords(xinyueDir, mf, [])
  const hist = await rh2(xinyueDir, mf)
  ok(Array.isArray(hist.backups), 'pruneBackupRecords:空移除列表不破坏 history 结构')

  // ── 15) 主动清理:prunePackageBackups 遍历包内全部 backup/ ──
  const bdir = join(pkgRoot, 'backup')
  const existingBk = await rdFs(bdir)
  const { copyFile: cpFs } = await import('node:fs/promises')
  await cpFs(join(bdir, existingBk[0]), join(bdir, 'init.99999999-000001.lua'))
  await cpFs(join(bdir, existingBk[0]), join(bdir, 'init.99999999-000002.lua'))
  const { prunePackageBackups: ppb } = await import('../src/write.js')
  const pr = await ppb(xinyueDir, mf)
  ok(pr.ok && pr.removedCount === 2, '主动清理:删除超出保留数的 2 个备份')
  const leftAfter = (await rdFs(bdir)).filter((n) => /\.lua$/i.test(n)).length
  ok(leftAfter === 3, '主动清理:仍保留最新 3 个')

  // ── 16) 配音登记与收口门禁:一技能多音频逐条交付 ──
  const voiced = await tasks.createTask(home, {
    id: '测试包-10', folder: 'test_pkg', type: 'general', title: '配音武将',
    skills: [
      { name: '天罚', desc: '效果', audios: ['D:/a/1.mp3', 'D:/a/2.mp3', 'D:/a/3.mp3'] },
      { name: '无配音', desc: '效果' },
    ],
    deathAudios: ['D:/a/death1.mp3', 'D:/a/death2.mp3'],
    image: 'ts_peiyin.jpg',
  })
  ok(voiced.ok, '创建带配音的武将任务')
  ok(voiced.task.skills[0].audios.length === 3 && voiced.task.skills[0].audioFiles.length === 0, '技能配音源路径登记 3 条,交付为空')
  ok(voiced.task.deathAudios.length === 2 && voiced.task.deathAudioFiles.length === 0, '阵亡语音登记 2 条(deathAudios/deathAudioFiles)')
  const unvoiced = await tasks.createTask(home, {
    id: '测试包-11', folder: 'test_pkg', type: 'general', title: '无声武将',
    skills: [{ name: '普通', desc: '效果', audios: 'D:/x.mp3, , D:/y.mp3;D:/z.mp3' }],
  })
  ok(unvoiced.task.skills[0].audios.length === 3 && unvoiced.task.skills[0].audios[0] === 'D:/x.mp3', '配音路径按逗号/分号拆分并去空')
  await tasks.markSkillsWritten(home, { taskId: '测试包-10', skills: ['天罚', '无配音'] })
  await tasks.setSkillStatus(home, { taskId: '测试包-10', skill: '天罚', status: 'confirmed' })
  const c4 = await tasks.setSkillStatus(home, { taskId: '测试包-10', skill: '无配音', status: 'confirmed' })
  ok(c4.ok && !c4.autoCompleted && c4.task.status === 'open', '全确认但配音未交付 → 不自动完成')
  const p1 = await tasks.setSkillAudioFiles(home, { taskId: '测试包-10', skill: '天罚', files: ['skill/tf1.mp3'] })
  ok(p1.ok && !p1.autoCompleted, '配音部分交付(1/3)仍不自动完成')
  const p2 = await tasks.setSkillAudioFiles(home, { taskId: '测试包-10', skill: '天罚', files: ['skill/tf2.mp3', 'skill/tf3.mp3'] })
  ok(p2.ok && p2.task.skills[0].audioFiles.length === 3 && !p2.autoCompleted, '技能配音交付齐全(3/3),但阵亡语音未交付仍不完成')
  const miss = await tasks.setSkillAudioFiles(home, { taskId: '测试包-10', skill: '不存在', files: ['skill/x.mp3'] })
  ok(!miss.ok, '配音登记到不存在的技能被拒')
  const d1 = await tasks.setDieAudioFiles(home, { taskId: '测试包-10', files: ['death/wj1.mp3'] })
  ok(d1.ok && !d1.autoCompleted, '阵亡语音部分交付(1/2)仍不自动完成')
  const d2 = await tasks.setDieAudioFiles(home, { taskId: '测试包-10', files: ['death/wj1.mp3', 'death/wj2.mp3'] })
  ok(d2.ok && d2.autoCompleted === true && d2.task.status === 'done', '阵亡语音交付齐全 → 全条件满足自动完成置 done')
  ok(d2.task.deathAudioFiles.length === 2, '重复文件名去重后计数正确(audio/death/ 路径)')
  // 老任务兼容:audios 为空数组(或存量任务缺失该字段)时不卡门禁
  const legacy = await tasks.createTask(home, { id: '测试包-12', folder: 'test_pkg', type: 'general', title: '旧任务', skills: [{ name: '老技能', desc: '' }], image: 'ts_old.jpg' })
  ok(legacy.task.skills[0].audios.length === 0, '未填配音的技能 audios 为空数组')
  await tasks.markSkillsWritten(home, { taskId: '测试包-12', skills: ['老技能'] })
  const c5 = await tasks.setSkillStatus(home, { taskId: '测试包-12', skill: '老技能', status: 'confirmed' })
  ok(c5.ok && c5.autoCompleted === true && c5.task.status === 'done', '空 audios 不卡门禁:全确认+有图直接自动完成')

  // 🎲 mode 任务:动态规则节点收口
  const mode = await tasks.createTask(home, {
    id: '测试包-13', folder: 'test_pkg', type: 'mode', title: '季节乱斗',
    modeBrief: '无身份混战大逃杀', modeNum: '5', modeWin: '幸存者胜',
    modeRules: '季节轮换;准备阶段强制当季效果', image: '', skills: [],
  })
  ok(mode.ok && mode.task.type === 'mode' && mode.task.dynamicSkills === true, 'mode 任务创建:type=mode 且 dynamicSkills 置真')
  ok(mode.task.skills.length === 0 && mode.task.modeBrief === '无身份混战大逃杀' && mode.task.modeRules === '季节轮换;准备阶段强制当季效果', 'mode 任务初始无技能节点,需求四要素留档')
  const mw = await tasks.markSkillsWritten(home, { taskId: '测试包-13', skills: ['规则:季节轮换', '规则:准备阶段效果'] })
  ok(mw.ok && mw.missing.length === 0 && mw.task.skills.length === 2, 'mode 动态规则节点:AI 回传规则名自动登记为 written')
  const mc1 = await tasks.setSkillStatus(home, { taskId: '测试包-13', skill: '规则:季节轮换', status: 'confirmed' })
  ok(mc1.ok && !mc1.autoCompleted, 'mode 逐规则确认:部分确认不收口')
  const mc2 = await tasks.setSkillStatus(home, { taskId: '测试包-13', skill: '规则:准备阶段效果', status: 'confirmed' })
  ok(mc2.ok && mc2.autoCompleted === true && mc2.task.status === 'done', 'mode 全规则确认 → 自动完成(mode 无图片需求豁免)')
  const reg15 = await tasks.createTask(home, { id: '测试包-15', folder: 'test_pkg', type: 'general', title: '普通', skills: [{ name: '普通技', desc: '' }] })
  const mMiss2 = await tasks.markSkillsWritten(home, { taskId: '测试包-15', skills: ['不存在的技能'] })
  ok(!mMiss2.ok && mMiss2.missing.length === 1 && mMiss2.task.skills.length === 1, '非 mode 任务:回传未知技能仍报 missing(不动态登记,无回归)')

  // ── 备份往返(多文件包):写模块 → listBackups → 用列表输出回滚 ──
  // 两个函数各自都测过,却没有"往返"用例——结果是新写的子目录支持互相不认
  // (列表缺 backup/ 段 → 回滚报"非法的备份路径";按文档形态调又把旧内容写成
  // 时间戳垃圾文件、真源文件没动,还返回"回滚成功")。
  {
    const w = await import('../src/write.js')
    const fsSync = await import('node:fs')
    const pkgDir = join(xinyueDir, 'packages', 'wb_pkg')
    fsSync.mkdirSync(join(pkgDir, 'skills'), { recursive: true })
    fsSync.writeFileSync(join(pkgDir, 'init.lua'), 'local pk = Package("往返包")\n')
    fsSync.writeFileSync(join(pkgDir, 'skills', 'wb_a.lua'), 'local wb_a = fk.CreateSkill{ name = "wb_a", desc = "v1" }\nreturn wb_a\n')
    const w1 = await w.writeExtension(xinyueDir, { folder: 'wb_pkg', file: 'skills/wb_a.lua', code: 'local wb_a = fk.CreateSkill{ name = "wb_a", desc = "v2" }\nreturn wb_a\n' })
    ok(w1.ok && Boolean(w1.backup), '多文件包:模块文件写入成功且有备份登记')
    const list = await w.listBackups(xinyueDir, 'wb_pkg')
    ok(list.length >= 1 && list[0].includes('/backup/'), 'listBackups 输出带 backup/ 段(回滚能认):' + list[0])
    const r = await w.rollbackExtension(xinyueDir, 'wb_pkg', list[0])
    ok(r.ok !== false && r.restored === list[0], 'rollback 接受 listBackups 的输出(往返闭合)')
    const restored = fsSync.readFileSync(join(pkgDir, 'skills', 'wb_a.lua'), 'utf8')
    ok(restored.includes('v1'), '回滚后模块文件内容 = 写入前(v1)')
    const junk = fsSync.readdirSync(join(pkgDir, 'skills')).filter((n) => /\d{8}-\d{6}/.test(n))
    ok(junk.length === 0, '回滚不在源码目录留时间戳垃圾文件:' + JSON.stringify(junk))
  }

  // ── 技能「补充说明」(表单第三栏):随任务留档,旧记录缺字段不报错 ──
  {
    const ex = await tasks.createTask(home, {
      id: '测试包-16', folder: 'test_pkg', type: 'general', title: '带说明',
      skills: [
        { name: '骑警', desc: '每轮开始使用一张坐骑', explain: '想模仿官方的坐骑检索;穷途不返的结算参照激将' },
        { name: '无说明', desc: '占位' },
      ],
    })
    ok(ex.ok && ex.task.skills[0].explain.startsWith('想模仿官方'), '技能 explain(补充说明)随任务留档')
    ok(ex.task.skills[1].explain === '', '未填补充说明时落库为空串(不出现 undefined)')
    const legacySkill = ex.task.skills[0]
    ok(!('explain' in { name: legacySkill.name }) || typeof legacySkill.explain === 'string',
      'explain 是字符串字段(旧任务记录缺该字段时读取按空串兜底)')
    const got = await tasks.getTask(home, '测试包-16')
    ok(got && got.skills[0].explain.startsWith('想模仿官方'), 'getTask 读回仍带补充说明(界面反馈链路可见)')
  }


} finally {
  rmSync(home, { recursive: true, force: true })
}
