/**
 * 工具注册层冒烟测试:用桩 ctx 跑 src/tools.js,不启动 dsh、不碰游戏目录。
 * 目的:拆出 800 行工具注册后,任何一个工具漏注册 / schema 结构坏掉都能立刻发现。
 * 用法:node scripts/test-tools.mjs
 */
import { registerTools } from '../src/tools.js'

const registered = []
const ctx = { tools: { register: (tool) => registered.push(tool) } }
registerTools(ctx, {
  get active() { return false },
  get xinyueDir() { return '' },
  dshHomeDir: 'D:/fake-dsh',
})

let failed = 0
function check(name, ok, extra = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`)
}

const expected = [
  'xinyue_search_reference', 'xinyue_api_lookup', 'xinyue_validate', 'xinyue_read_package',
  'xinyue_write_package', 'xinyue_match_assets', 'xinyue_copy_images', 'xinyue_copy_audio',
  'xinyue_skills_written', 'xinyue_read_doc', 'xinyue_doc_index', 'xinyue_delete_file',
  'xinyue_record_change', 'xinyue_kingdom_assets', 'xinyue_copy_images_legacy',
]

const names = registered.map((tool) => tool.name)
check(`注册 ${registered.length} 个工具`, registered.length >= 14, JSON.stringify(names))
check('无重复工具名', new Set(names).size === names.length)
check('名称以 xinyue_ 开头', names.every((name) => String(name).startsWith('xinyue_')), JSON.stringify(names.filter((n) => !String(n).startsWith('xinyue_'))))
check('每个工具都有 description', registered.every((tool) => typeof tool.description === 'string' && tool.description.length > 20))
check('每个工具都有 execute', registered.every((tool) => typeof tool.execute === 'function'))
check('每个工具都有参数 schema', registered.every((tool) => tool.parameters && typeof tool.parameters === 'object'))
check('关键工具在列', ['xinyue_write_package', 'xinyue_validate', 'xinyue_read_doc', 'xinyue_doc_index'].every((name) => names.includes(name)), JSON.stringify(names))

// 离线可执行的工具:校验一段最小技能文件(不读游戏目录)
const validate = registered.find((tool) => tool.name === 'xinyue_validate')
if (validate) {
  const result = await validate.execute({
    filePath: 'skills/t_demo.lua',
    code: "local skill = fk.CreateSkill { name = 't_demo' }\n\nskill:addEffect(fk.GameStart, {\n  on_refresh = function (self, event, target, player, data) end,\n})\n\nreturn skill\n",
  })
  check('xinyue_validate 可离线执行', result && typeof result.ok === 'boolean', JSON.stringify(result).slice(0, 160))
}

const outline = registered.find((tool) => tool.name === 'xinyue_doc_index')
if (outline) {
  const result = await outline.execute({})
  check('xinyue_doc_index 读到章节表', result.ok === true && result.parts.length === 8, JSON.stringify({ ok: result.ok, parts: result.parts && result.parts.length }))
  if (result.ok) {
    const tree = outline.output.render({}, result)
    check('章节表渲染器输出文本', Array.isArray(tree) && tree[0].type === 'text' && tree[0].text.includes('《新月之书》章节地图'))
  }
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过')
process.exit(failed ? 1 : 0)
