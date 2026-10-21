/**
 * 把 src/client/ 的「模板 + 真实 CSS」打包成浏览器直接加载的 client.js。
 *
 * 为什么需要这一步:客户端插件产物必须是一个整文件(经 window.__ModuleLoader__ 注册),
 * 而 26 KB 样式塞在 JS 数组里既没法高亮、也没法用 CSS 工具检查。
 * 所以源码拆成:
 *   · src/client/styles.css         —— 真 CSS(可格式化、可 diff、可被 IDE 校验)
 *   · src/client/client.template.js —— 组件代码,样式位置留 /*__STYLES__*\/ 标记
 * 本脚本把 CSS 以 JSON 字符串字面量内联回模板 → client.js。
 *
 * 改样式:直接改 styles.css 后 `node scripts/build-client.mjs`;
 * 改逻辑:改 client.template.js 后同样跑一次。client.js 是产物,不要手改。
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const templatePath = new URL('src/client/client.template.js', root)
const stylesPath = new URL('src/client/styles.css', root)
const outPath = new URL('client.js', root)
const MARK = '/*__STYLES__*/'

const template = fs.readFileSync(templatePath, 'utf8')
const css = fs.readFileSync(stylesPath, 'utf8')

if (!template.includes(MARK)) {
  console.error(`✗ 模板里找不到 ${MARK} 标记,拒绝生成(否则样式会静默丢失)`)
  process.exit(1)
}
if (!css.trim()) {
  console.error('✗ styles.css 是空的,拒绝生成')
  process.exit(1)
}

const banner = '// ⚠ 本文件由 scripts/build-client.mjs 生成:改 src/client/client.template.js 或 src/client/styles.css 后重新构建,不要手改这里。\n'
const out = banner + template.replace(MARK, JSON.stringify(css))
fs.writeFileSync(outPath, out)

const rules = (css.match(/\}/g) || []).length
console.log(`✓ client.js 已生成:${(Buffer.byteLength(out) / 1024).toFixed(1)} KB,样式 ${rules} 条 / ${(Buffer.byteLength(css) / 1024).toFixed(1)} KB`)
