import { validateExtensionCode } from '../src/validate.js'

const bad = `local s = fk.CreateSkill { name = "cfwl_test" }
s:addEffect(fk.Damage, {
  can_trigger = function(self, event, target, player, data) return data.from == player end,
  on_use = function() end,
})
return s
`
const hits = (r) => r.warnings.some((w) => w.message.includes('can_trigger'))

const r1 = validateExtensionCode({ code: bad, kind: 'skill', filePath: 'pkg/xinglinggan/skills/cfwl_test.lua', folder: 'cfwl' })
console.log('缺 hasSkill 警告:', hits(r1) ? '有 OK' : '无 FAIL')

const good = bad.replace('return data.from == player', 'return player:hasSkill(s.name) and data.from == player')
const r2 = validateExtensionCode({ code: good, kind: 'skill', filePath: 'pkg/xinglinggan/skills/cfwl_test.lua', folder: 'cfwl' })
console.log('有 hasSkill 警告:', hits(r2) ? '有 FAIL' : '无 OK')

const sub = `local extension = Package:new("cfwl_xinglinggan")
extension.extensionName = "cfwl"
return extension
`
const r3 = validateExtensionCode({ code: sub, kind: 'package', filePath: 'pkg/xinglinggan/init.lua', folder: 'cfwl' })
console.log('子包包名警告:', r3.warnings.some((w) => w.message.includes('不一致')) ? '有 FAIL' : '无 OK')

const root = `local extension = Package:new("wrong_name")
extension.extensionName = "cfwl"
return extension
`
const r4 = validateExtensionCode({ code: root, kind: 'package', filePath: 'init.lua', folder: 'cfwl' })
console.log('包根包名警告:', r4.warnings.some((w) => w.message.includes('不一致')) ? '有 OK' : '无 FAIL')
