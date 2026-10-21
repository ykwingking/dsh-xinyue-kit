/**
 * 写技能专用 skill(DSH skill)的自动安装。
 *
 * 正文源随插件发布:`knowledge/skills/freekill-skill-authoring/SKILL.md`。
 * 插件每次加载时按内容差异覆盖到 `<dsh home>/skills/`,这是 **user 级 skills 根**
 * (rank 400),任何 cwd 的会话都能发现,不受工作区 / 项目级 skills 影响。
 *
 * 为什么不把正文塞进 KNOWLEDGE_TEXT(system prompt):那份是每会话常驻的,
 * 而 skill 是按需加载的 —— 正文常驻会白吃每个会话的上下文,且两份正文必然漂移。
 * 指针 + 按需加载才是对的分层:规范讲「做什么」,skill 讲「怎么写才不返工」。
 *
 * 顺带解决两个运维问题:升级插件即升级 skill;本地那份被改坏会在下次加载时被修回。
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SKILL_NAME = 'freekill-skill-authoring'

/** 插件自带的 SKILL.md 绝对路径(打包后仍然成立:src/ 与 knowledge/ 同级)。 */
export function skillSourcePath() {
  return fileURLToPath(new URL('../knowledge/skills/' + SKILL_NAME + '/SKILL.md', import.meta.url))
}

/** 安装/更新到 <dshHome>/skills/<name>/SKILL.md。
 * @returns {{state: 'installed'|'updated'|'unchanged'|'error', path?: string, error?: string}} */
export function installSkillScaffold(dshHome) {
  const src = skillSourcePath()
  const dest = join(dshHome, 'skills', SKILL_NAME, 'SKILL.md')
  try {
    if (!existsSync(src)) return { state: 'error', error: `插件自带正文缺失: ${src}` }
    const body = readFileSync(src)
    if (existsSync(dest)) {
      if (readFileSync(dest).equals(body)) return { state: 'unchanged', path: dest }
      writeFileSync(dest, body)
      return { state: 'updated', path: dest }
    }
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, body)
    return { state: 'installed', path: dest }
  } catch (error) {
    return { state: 'error', error: error.message }
  }
}
