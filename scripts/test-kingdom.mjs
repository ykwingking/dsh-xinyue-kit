/** 势力图生成器测试：用真实素材生成到临时目录，核对文件数与尺寸前缀。 */
import { mkdtempSync, rmSync, statSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateKingdomAssets } from '../src/kingdom.js'

const SRC = 'D:\\新月杀\\图片\\重返未来\\势力体力'
let pass = 0
let fail = 0
const ok = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓', msg) } else { fail++; console.log('  ✗', msg) }
}

const gameDir = mkdtempSync(join(tmpdir(), 'fk-game-'))
mkdirSync(join(gameDir, 'packages', 'demo', 'image'), { recursive: true })

if (!existsSync(SRC)) {
  console.log('跳过：素材目录不存在', SRC)
  process.exit(0)
}

const result = generateKingdomAssets(gameDir, {
  folder: 'demo',
  kingdoms: [
    {
      code: 'xinglinggan',
      char: '星',
      accent: [116, 158, 191],
      icon: join(SRC, '灵感图标_星_大.webp'),
      crystal: join(SRC, '体力.png'),
    },
    {
      code: 'shoulinggan',
      char: '兽',
      accent: [203, 87, 87],
      icon: join(SRC, '灵感图标_兽_大.webp'),
    },
  ],
})

console.log('生成结果:', JSON.stringify({ ok: result.ok, n: (result.files || []).length, error: result.error }))
ok(result.ok === true, '整体 ok')
const files = result.files || []
ok(files.length === 7, '两个势力共 7 个文件（带晶石 5 + 只有徽记/卡背 2）')
for (const name of ['xinglinggan.png', 'xinglinggan-magatama.png', 'xinglinggan-magatama-l.png',
  'xinglinggan-magatama-r.png', 'xinglinggan-back.png', 'shoulinggan.png', 'shoulinggan-back.png']) {
  ok(files.includes(name), '产出 ' + name)
}
const dir = join(gameDir, 'packages', 'demo', 'image', 'kingdom')
ok(statSync(join(dir, 'xinglinggan-back.png')).size > 1000, '卡背文件有内容')
ok(!existsSync(join(dir, 'shoulinggan-magatama.png')), '没给晶石时不生成 magatama')

// 参数校验
const bad = generateKingdomAssets(gameDir, { folder: 'demo', kingdoms: [{ code: '../逃逸' }] })
ok(bad.ok === false, '非法代号被拒')

rmSync(gameDir, { recursive: true, force: true })
console.log(fail === 0 ? `全部通过（${pass} 项）` : `失败 ${fail} 项 / 通过 ${pass} 项`)
process.exit(fail === 0 ? 0 : 1)
