#!/usr/bin/env node
/**
 * xinyue-kit 单测:配音复制(copyAudios)。
 * 运行:node scripts/test-audio.mjs
 * 全程隔离在系统临时目录(假游戏目录 + 假 mp3 源文件),跑完即删。
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const home = mkdtempSync(join(tmpdir(), 'xinyue-kit-audio-test-'))
const xinyueDir = join(home, 'fake-game')
let passed = 0
function ok(cond, label) {
  assert.ok(cond, label)
  passed++
  console.log('  ✓ ' + label)
}

try {
  const { copyAudios, audioTargetKind } = await import('../src/audio.js')

  // 假源 mp3(内容无所谓,只验证复制)
  const srcDir = join(home, 'src-mp3')
  mkdirSync(srcDir, { recursive: true })
  for (const n of ['a1.mp3', 'a2.mp3', 'a3.mp3', 'bad.txt']) {
    writeFileSync(join(srcDir, n), 'fake-' + n)
  }

  // ── 1) 多文件复制:一个技能三句,落 audio/skill/ ──
  const multi = await copyAudios(xinyueDir, {
    folder: '测试包',
    audios: [
      { source: join(srcDir, 'a1.mp3'), target: 'skill/tf1.mp3' },
      { source: join(srcDir, 'a2.mp3'), target: 'skill/tf2.mp3' },
      { source: join(srcDir, 'a3.mp3'), target: 'skill/tf3.mp3' },
    ],
  })
  ok(multi.ok && multi.copied.length === 3, '一次复制三条技能配音')
  const skillDir = join(xinyueDir, 'packages', '测试包', 'audio', 'skill')
  ok((await readdir(skillDir)).sort().join(',') === 'tf1.mp3,tf2.mp3,tf3.mp3', '文件落进扩展包 audio/skill/(游戏本体目录零改动)')

  // ── 2) 阵亡语音:新月杀用 death/(旧写法 die/ 归一为 death) ──
  const death = await copyAudios(xinyueDir, { folder: '测试包', audios: [{ source: join(srcDir, 'a1.mp3'), target: 'death/wj.mp3' }] })
  ok(death.ok, '阵亡语音复制进 audio/death/')
  ok((await readdir(join(xinyueDir, 'packages', '测试包', 'audio', 'death'))).join(',') === 'wj.mp3', 'death 目录文件就位')
  const dieAlias = await copyAudios(xinyueDir, { folder: '测试包', audios: [{ source: join(srcDir, 'a2.mp3'), target: 'die/wj2.mp3' }] })
  ok(dieAlias.ok && dieAlias.copied[0] === 'death/wj2.mp3', '旧写法 die/ 兼容并统一落到 death/')

  // ── 3) 非法目标:子目录越权/逃逸/扩展名 ──
  const badDir = await copyAudios(xinyueDir, { folder: '测试包', audios: [{ source: join(srcDir, 'a1.mp3'), target: 'card/x.mp3' }] })
  ok(!badDir.ok && /不合法/.test(badDir.errors[0].error), 'skill/death 之外的子目录被拒')
  const escape = await copyAudios(xinyueDir, { folder: '测试包', audios: [{ source: join(srcDir, 'a1.mp3'), target: 'skill/../../x.mp3' }] })
  ok(!escape.ok, '含 .. 的目标被拒')
  const notMp3 = await copyAudios(xinyueDir, { folder: '测试包', audios: [{ source: join(srcDir, 'bad.txt'), target: 'skill/x.txt' }] })
  ok(!notMp3.ok, '非 mp3 目标被拒')
  const deep = await copyAudios(xinyueDir, { folder: '测试包', audios: [{ source: join(srcDir, 'a1.mp3'), target: 'skill/sub/x.mp3' }] })
  ok(!deep.ok, '多级子目录被拒(目标只能是一层 skill/ 或 death/)')

  // ── 4) 源不存在 / 空清单 / 坏包名 ──
  const noSrc = await copyAudios(xinyueDir, { folder: '测试包', audios: [{ source: join(srcDir, 'nope.mp3'), target: 'skill/x.mp3' }] })
  ok(!noSrc.ok, '源文件不存在被拒')
  const empty = await copyAudios(xinyueDir, { folder: '测试包', audios: [] })
  ok(!empty.ok, '空清单被拒')
  const badFolder = await copyAudios(xinyueDir, { folder: '../逃逸', audios: [{ source: join(srcDir, 'a1.mp3'), target: 'skill/x.mp3' }] })
  ok(!badFolder.ok, '非法包名被拒')

  // ── 5) 目标归属判定 ──
  ok(audioTargetKind('skill/x.mp3') === 'skill', 'audioTargetKind 识别 skill/')
  ok(audioTargetKind('death\\y.mp3') === 'death' && audioTargetKind('die\\y.mp3') === 'death', 'audioTargetKind 识别 death/(含反斜杠与旧名 die 的归一)')
  ok(audioTargetKind('card/x.mp3') === null && audioTargetKind('') === null, '非配音目标返回 null')

  console.log('\n全部通过:' + passed + ' 项')
} finally {
  rmSync(home, { recursive: true, force: true })
}
