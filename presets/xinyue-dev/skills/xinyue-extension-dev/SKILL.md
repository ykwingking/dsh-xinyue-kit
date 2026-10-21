---
name: xinyue-extension-dev
description: 新月杀(FreeKill)扩展开发完整规范:Lua 包结构、Package/General 写法、技能文件骨架、翻译表、素材目录约定、常见错误清单与工作流。写扩展代码前加载本技能。
whenToUse: 需要编写、修改或审查新月杀(FreeKill)扩展包代码(武将技能/卡牌/玩法)时加载。
---

# 新月杀(FreeKill)扩展开发规范

你在为「新月杀」(基于开源桌游引擎 FreeKill)编写扩展包。严格遵守以下规范与工作流。

> 重要:本规范里凡标注 【待补充:…】 的段落**都还没核实过**。碰到这类问题时,不要凭
> 无名杀(JS)或其它引擎的经验猜测——先去读游戏目录里的官方实现作参考,或直接告诉用户
> "这条规范还没补,请提供资料"。猜错比说不知道代价大得多。
>
> 本文件与常驻知识文本 `src/knowledge.js` 的 `KNOWLEDGE_TEXT` 是**同一份规范的两个副本**,
> 改一处必须同步改另一处(工坊设置页有自检会告警)。

## 任务粒度(重要)
**一个任务 = 一个完整武将(含其全部技能)、一张卡牌,或一个完整的自定义玩法模块。**
- 武将任务的确认与实现都覆盖该武将的全部技能:逐技能列出理解、逐技能实现、逐技能校验,全部完成后一次性写入并调用 `xinyue_skills_written` 收口。
- 收到反馈时:先读当前代码,修复对应技能;每轮反馈自动累加轮次。

## 工作流(不可跳步)
1. **需求理解确认(硬门禁)**:动手前必须先输出【需求理解确认】,逐技能复述——技能名/类型、触发时机、发动频率、目标选取规则、数值效果、明确不做什么、与其它技能的交互。**输出后停下,等待用户明确回复确认。**有歧义先用 ask_user_question 问清;禁止猜测。**未获确认前禁止生成代码、禁止调用 `xinyue_write_package`。**
2. **ID 前缀约定**:技能/武将/卡牌的内部 ID 是全局命名空间。任务消息若带「内部 ID 前缀」,所有新增 ID 必须 = 前缀 + 拼音或英文;中文显示名写入翻译表。
3. **找官方参考**:用 `xinyue_search_reference` 搜 FreeKill 官方实现(中文名/ID/效果关键词)。确认前的只读调研不受确认门限制——先搜再写确认单。
4. **生成代码**:扩展包按「文件级锚点区块」管理(注释 `--#xinyue-kit-begin` / `--#xinyue-kit-end` 包裹)。改已有条目先读该文件原文,再用 `xinyue_write_package` 提交完整文件;零星小改动用 edits 精确补丁。
5. **必须校验**:保存前必须调用 `xinyue_validate`。有 error 必须修复后重新校验。
6. **落盘前自查**:对照【需求理解确认】逐条自查(触发/频率/目标/数值/边界/不做什么),能逐条在代码里指出来。
7. **写入**:自查通过后调用 `xinyue_write_package`(普通写文件工具会被守卫拦截)。
8. **收口**:全部技能完成后调用 `xinyue_skills_written` 原样带回任务ID,然后提示用户进游戏测试。

## 新月杀(FreeKill)扩展包的文件结构
一个扩展包 = `<游戏根>/packages/<包目录名>/` 下的一个目录:

```
packages/<包目录名>/
├── init.lua                     包入口:声明 Package、General、翻译表
├── skills/<技能ID>.lua          每个技能一个文件
├── image/generals/<武将ID>.jpg  武将立绘
├── image/card/<卡牌ID>.png      卡牌图(需要时)
├── audio/skill/<技能ID>.mp3     技能语音
└── audio/death/<武将ID>.mp3     阵亡语音
```

注意与无名杀的关键差异:
- 语言是 **Lua**,不是 JavaScript;
- **一技能一文件**(`skills/*.lua`),不是把条目塞进一个大文件;
- 图片按用途分子目录(`image/generals`、`image/card`),不是平铺;
- 阵亡语音目录是 **`death`**,不是 `die`;
- 官方包不做"一句语音一个文件"的序号拆分,是 `<ID>.mp3`。

## Package 入口写法(已实测核实)

```lua
-- packages/<包目录名>/init.lua
local extension = Package:new("包ID")          -- 也有不带 :new 的写法 Package("包ID")
extension.extensionName = "包目录名"            -- 与 packages/ 下目录名一致
extension:loadSkillSkelsByPath("./packages/<包目录名>/skills")

local general = General(extension, "武将ID", "wei", 4, 4, General.Female)
-- 参数依次:所属包, 武将ID, 势力(wei/shu/wu/qun/jin/...), 体力上限, 当前体力, 性别
-- 性别可省略;General.Female / General.Male
general:addSkills { "技能ID1", "技能ID2" }

Fk:loadTranslationTable{
  ["包ID"]      = "显示名",
  ["武将ID"]    = "武将名",
  ["#武将ID"]   = "称号",
  ["~武将ID"]   = "阵亡台词",
  ["技能ID"]    = "技能名",
  [":技能ID"]   = "技能描述",     -- 冒号前缀 = 技能描述
}
return extension
```

## 技能文件写法(已实测核实)

```lua
-- packages/<包目录名>/skills/<技能ID>.lua
local skill = fk.CreateSkill { name = "技能ID" }

skill:addEffect(fk.触发事件, {
  priority    = -1,
  can_refresh = function (self, event, target, player, data) return true end,
  on_refresh  = function (self, event, target, player, data)
    -- 技能效果写在这里
  end,
})

return skill
```

### 触发时机 `fk.*` 事件(全量 108 个;清单来自引擎 `ltk/core/events/*.lua` 的 `---@class fk.XXX`)

下面一律省略 `fk.` 前缀,写代码时要带:
- 回合/阶段:`GameStart` `RoundStart` `RoundEnd` `PreTurnStart` `BeforeTurnStart` `TurnStart` `TurnEnd`
  `EventTurnChanging` `EventPhaseStart` `EventPhaseProceeding` `EventPhaseEnd` `EventPhaseChanging`
  `EventPhaseSkipping` `EventPhaseSkipped` `BeforePlayCard` `StartPlayCard` `DrawNCards` `AfterDrawNCards`
  `DrawInitialCards` `AfterDrawInitialCards` `GamePrepared` `GameFinished`
- 用牌/响应:`PreCardUse` `AfterCardUseDeclared` `AfterCardTargetDeclared` `CardUsing` `TargetSpecifying`
  `TargetConfirming` `TargetSpecified` `TargetConfirmed` `BeforeCardUseEffect` `CardUseFinished`
  `PreCardEffect` `BeforeCardEffect` `CardEffecting` `CardEffectFinished` `CardEffectCancelledOut`
  `PreCardRespond` `CardResponding` `CardRespondFinished`(逐个语义见文档 `rule/06-use-response.rst`)
- 体力/伤害:`BeforeHpChanged` `HpChanged` `PreHpLost` `HpLost` `PreHpRecover` `HpRecover`
  `BeforeMaxHpChanged` `MaxHpChanged` `BeforeShieldChanged` `ShieldChanged` `PreDamage` `DamageCaused`
  `DetermineDamageCaused` `DamageInflicted` `DetermineDamageInflicted` `Damage` `Damaged` `DamageFinished`
  (`rule/07-hp.rst`:`Damage` = 造成伤害后,承担者是伤害来源;`Damaged` = 受到伤害后,承担者是受伤者)
- 移牌/判定/拼点/死亡:`BeforeCardsMove` `AfterCardsMove` `BeforeDrawCard` `StartJudge` `AskForRetrial`
  `FinishRetrial` `FinishJudge` `StartPindian` `PindianCardsDisplaying` `PindianCardsDisplayed`
  `PindianResultConfirmed` `PindianFinished` `EnterDying` `AskForPeaches` `AskForPeachesDone` `AfterDying`
  `Death` `BeforeGameOverJudge` `GameOverJudge` `Deathed` `BuryVictim` `AfterPlayerRevived`
- 技能/通用:`SkillEffect` `AfterSkillEffect` `EventAcquireSkill` `EventLoseSkill` `BeforeTriggerSkillUse`
  `PreparingGeneral` `GeneralShown` `GeneralRevealed` `GeneralHidden` `BeforePropertyChange` `PropertyChange`
  `AfterPropertyChange` `BeforeTurnOver` `TurnedOver` `BeforeChainStateChange` `ChainStateChanged`
  `AreaAborted` `AreaResumed` `AfterDrawPileShuffle` `CardShown` `BeforeRequestAsk` `AfterRequestAsk`
  `AskForCardUse` `AskForCardResponse` `HandleAskForPlayCard` `AfterAskForCardUse` `AfterAskForCardResponse`
  `AfterAskForNullification`
- 触发流程:从当前行动者起按逆时针逐人询问,优先级高的先问(武将 1、装备 0.1、规则 0);回调里的
  `target` 是该时机的承担者,`player` 是当前被问的人,两者要分别判(`rule/03-event.rst`)。

### addEffect 的回调键

- 触发技:键直接传 `fk.Xxx`,可写 `can_trigger` / `can_refresh` / `on_refresh` / `on_trigger` / `on_cost` /
  `on_use` / `can_wake` / `trigger_times` / `priority` / `global` / `is_delay_effect` / `late_refresh` /
  `mute` / `anim_type` / `audio_index`。
- **回调签名统一是 `(self, event, target, player, data)`**(引擎 `ltk/core/skill_type/trigger.lua:28`;
  8051 个官方 `.lua` 实测 7903 处 `can_trigger`/`on_use` 全是这个顺序)。PDF 与旧教程写的
  `(self, player, event, target, data)` 是旧版,**照它写会全错**。
- 主动技:键传 `"active"`,可写 `card_filter` / `target_filter` / `feasible` / `can_use` / `on_use` /
  `fix_targets` / `prompt` / `target_num`(或 `min_target_num`、`max_target_num`、`card_num`)/ `expand_pile`;
  `on_use(self, room, effect)` 里从 `effect.from` / `effect.tos` / `effect.cards` 取信息。
- 视为技 `"viewas"`:`card_filter` / `view_as` / `pattern` / `enabled_at_play` / `enabled_at_response` /
  `before_use` / `after_use`。状态技各一套:`"distance"`(`correct_func`/`fixed_func`)、
  `"prohibit"`(`is_prohibited`/`prohibit_use`/...)、`"maxcards"`、`"atkrange"`、`"targetmod"`、
  `"invalidity"`、`"filter"`、`"visibility"`、`"cardskill"`。
- 第三个参数是修饰:`{ check_effect_limit = true }`(只校验本效果次数)、
  `{ check_skill_limit = true }`(校验整个技能次数)、`{ is_delay_effect = true }`(延迟效果,不再给主技能计数)。
- 完整键表看引擎 `lua/fk_ex.lua` 各 `*Spec` 的 `---@field`(逐条中文解释见文档 `anhe/09-manage-skill.rst`)。

### 发动频率 / 目标选取 / 消耗

- **频率**:写在技能骨架的 `tags`(`Skill.Compulsory` 锁定、`Skill.Limited` 限定、`Skill.Wake` 觉醒、
  `Skill.Switch` 转换、`Skill.Permanent` 持恒…,`ltk/core/skill.lua:29-50`),引擎就是拿 `tags[1]` 当技能
  frequency——**在 addEffect 的表里写 `frequency` 引擎不读**。次数限制用 `max_phase_use_time` /
  `max_turn_use_time` / `max_round_use_time` / `max_game_use_time`(整数或函数),分支限制用
  `max_branches_use_time`;写在技能骨架里是整技能共享,写在某个 effect 表里是本效果,再配
  `check_effect_limit`。检测用 `player:usedSkillTimes(名, scope)` / `skel:withinTimesLimit(player, scope)`。
- **目标选取**:主动技的 `target_filter(self, player, to_select, selected, selected_cards, card, extra_data)`
  决定谁能被选,`target_num` / `min_target_num` / `max_target_num` 定数量;无距离限制、额外目标、
  次数上限这类改动要另加状态技 `addEffect("targetmod", { bypass_distances / bypass_times /
  residue_func / fix_times_func / extra_target_func / fix_target_func })`。
- **消耗**:`on_cost(self, event, target, player, data)` 返回 true 才算完成消耗;消耗内容先用
  `event:setCostData(self, { tos = {...}, cards = {...} })` 存,`on_use` 里 `event:getCostData(self)` 取。
  不写 `on_cost` 时引擎默认询问"是否发动",`tags` 带 `Skill.Compulsory` 则默认直接返回 true。
  (`anhe/04-newskill.rst`、`ltk/core/skill_type/trigger.lua:101-110`)

### 技能文件的变量与返回

- 约定:`local 技能变量 = fk.CreateSkill{...}`,末尾 `return 技能变量`。变量名随意(官方多是去掉包前缀的技能名)。
- `extension:loadSkillSkelsByPath(目录)` 会 require 该目录下每个 `.lua`(跳过 `init.lua`),把**它的返回值**
  当成一个技能骨架收下(`ltk/core/package.lua:106-122`),所以**一个文件只能写一个技能**,返回列表是错的。
- 实测 8051 个官方 `.lua` 里 7375 个技能文件全都只有一次 `fk.CreateSkill` 调用、顶层 `return <标识符>`
  (唯 4 个例外是 `skills/init.lua`)。**没有一个文件在一个文件里写两个技能。**
- 文件名本身无讲究、可以重复,但技能内部 `name` 要求全局唯一,且翻译表按 `name` 取(`anhe/04-newskill.rst`)。

## 武将(General)参数细节
`General(extension, id, country, hp, maxHp, gender)`
- country 取值:核心内置 `wei`=魏 / `shu`=蜀 / `wu`=吴 / `qun`=群(`packages/freekill-core/standard/i18n/zh_CN.lua:5-8`);
  官方扩展包另外提供 `god`=神(`shzl/pkg/god/init.lua:7`)、`jin`=晋(`ol/pkg/wende/init.lua:10`)、
  `n_pigeon`=鸽(`brainhole_new/pkg/brainhole/init.lua:9`)、`wild`=野心家(`hegemony/.../new_hegemony_mode.lua:611`)、
  `unknown`=未知(`standard_cards/i18n/zh_CN.lua:13`)。**可以自造字符串**(官方教程就用 `"testKingdom"`),
  只要在 `Fk:loadTranslationTable{ ["代号"] = "中文" }` 里给译名、势力图放包内 `image/kingdom/`
  (`anhe/16-extension.rst:105-131`)。本机 v0.5.25 全量 3590 处 General 调用实测:
  qun 28 / wei 16 / shu 15 / n_pigeon 13 / wu 6 / god 4 / wild 3 / unknown 2 / n_fanxiu 1,**未见 jin**
  (jin 只出现在 ol 包自己的武将里)。
- hp 与 maxHp:`maxHp` 省略时 = `hp`;`gender` 省略时 = `General.Male`(引擎 `ltk/core/general.lua:63-64`)。
  教程说 `hp` 默认为 4(`anhe/01-hello.rst:305`),但引擎是直接 `self.hp = hp`、没有兜底,
  实测 3590 处官方调用**全部都显式传了 hp**——写武将时 hp 必须给。
- 其它可设字段(实测见过):`shield`、`hidden`、`endnote`、`headnote`
- 翻译键:`#ID` 称号、`~ID` 阵亡台词、`designer:ID` 设计、`illustrator:ID` 画师、`cv:ID` 配音、
  `$ID` 与 `$ID1`/`$ID2` 技能语音台词(`anhe/01-hello.rst:335-341`、`anhe/example/xuexi.lua:53-66`)。
  这几种缺省时显示"官方",`~ID` 缺省则无台词。

## 图片 / 音频约定
- 立绘:`packages/<包>/image/generals/<武将ID>.jpg`
- 卡图:`packages/<包>/image/card/<卡牌ID>.png`(官方规范为 png、93x130;`anhe/16-extension.rst:149`)
- 技能语音:`packages/<包>/audio/skill/<技能ID>.mp3`
- 阵亡语音:`packages/<包>/audio/death/<武将ID>.mp3`
- 素材一律放**扩展包内**,绝不写进游戏本体的 `audio/` 或 `image/` 目录。
- 复制素材只能用 `xinyue_copy_images` / `xinyue_copy_audio`(目标只允许上述白名单子目录)。

## 卡牌(需要时)
卡牌也在包的 `init.lua` 里声明,**不需要单独的 cards 目录**,卡牌技能仍然放 `skills/`(实测核实):

```lua
local extension = Package:new("包ID", Package.CardPack)
extension:loadSkillSkelsByPath("./packages/<包目录名>/skills")
local card1 = fk.CreateCard{ name = "卡牌ID", type = Card.TypeBasic, skill = "卡牌ID_skill" }
extension:loadCardSkels { card1 }
extension:addCardSpec("卡牌ID", Card.Heart, 3)   -- 花色、点数;登记几次牌堆里就有几张
return extension
```

- 花色 `Card.Spade` / `Card.Club` / `Card.Heart` / `Card.Diamond` / `Card.NoSuit`;类型 `Card.TypeBasic` /
  `Card.TypeTrick` / `Card.TypeEquip`;装备副类 `sub_type = Card.SubtypeWeapon/Armor/DefensiveRide/
  OffensiveRide/Treasure`;延时锦囊 `sub_type = Card.SubtypeDelayedTrick`(`ltk/core/card.lua:42-85`)。
- 卡牌技能就是一个普通技能文件,只是用 `skill:addEffect("cardskill", { on_use = function(self, room, effect)
  ... end })` 写效果(官方 `standard_cards/pkg/skills/slash.lua:5`)。牌名以 `&` 开头 = 衍生牌
  (`card.is_derived`,`ltk/core/card.lua:114-117`),默认不进游戏牌堆。
- 牌堆:游戏牌堆由模式的 `buildDrawPile()` 给出(默认=全部卡牌,衍生牌除外);私人牌堆用
  `player:addToPile(名, 牌...)` 塞、`player:getPile(名)` 读,技能骨架写 `derived_piles = "名"` 可在失去技能时
  自动弃掉其中的牌(`ltk/core/package.lua:140-141`、`ltk/core/skill_skeleton.lua:22`)。
- 牌名/牌描述翻译键与技能一致:`"卡牌ID"` / `":卡牌ID"`(`anhe/16-extension.rst:335-342`)。

## 自定义玩法模块(GameMode / 玩法包)
`Package.SpecialPack` + `fk.CreateGameMode`,0.5.25 已实装(官方 gamemode 包就是这么写的):

```lua
local extension = Package:new("模式包ID", Package.SpecialPack)
extension:loadSkillSkelsByPath("./packages/<包>/pkg/模式包/rule_skills")  -- 规则技能目录
extension:addGameMode(require "packages/<包>/pkg/模式包/模式文件")       -- 该文件 return 模式对象
return extension
```

```lua
-- 模式文件里:
local mode = fk.CreateGameMode{
  name = "模式ID", minPlayer = 2, maxPlayer = 8,  -- 或用 playerNums = {2, 4, 6}
  rule = "规则技能名",                            -- 规则技 = 优先级 0 的全局技能,不要给它加 global
  logic = Fk.game_modes["aaa_role_mode"].logic,   -- 多数 DIY 直接复用身份模式的 logic
  main_mode = "aaa_role_mode",                    -- 表明是本模式的衍生
  whitelist = { "包名" }, blacklist = { "包名" },  -- 将池限定
  surrender_func = function(self, playedTime, player) return {} end,
}
Fk:loadTranslationTable{ ["模式ID"] = "模式名", [":模式ID"] = "模式介绍" }
return mode
```

- 全部字段见引擎 `lua/fk_ex.lua:330-351` 的 GameModeSpec。规则技能放 `rule_skills/` 目录,由
  `loadSkillSkelsByPath` 加载(`packages/gamemode/init.lua:3-5`)。
- 要自定义 `logic` 就写 `GameLogic:run()` 那套模块:`prepareGlobalSkills` → `assignRoles` → `adjustSeats` →
  `chooseGenerals` → `buildPlayerCircle` → `broadcastGeneral` → `prepareDrawPile` → `attachSkillToPlayers` →
  `prepareForStart` → `action`,按需覆盖(`packages/freekill-core/ltk/server/gamelogic.lua:42-59`;
  逐段说明见 `anhe/16-extension.rst:440-535`)。

## 工具选用(14 个 `xinyue_*`,别拿普通工具硬顶)

| 场景 | 工具 | 说明 |
| --- | --- | --- |
| 不知道读哪一章 | `xinyue_doc_index` | 《新月杀之书》章节地图(8 大部分 × 章节 × 关键词);先查它,再 `xinyue_read_doc` |
| 读文档整节 | `xinyue_read_doc` | 传章节 id(如 `fkbook/rule/03-event.rst#事件与时机`) |
| 找官方实现 | `xinyue_search_reference` | 中文名 / ID / 效果关键词;`type=doc` 只搜书、`type=code` 只搜源码 |
| 查引擎符号 | `xinyue_api_lookup` | 事件名 / 方法 / 常量 / 状态技字段;书里 `api-reference` 全是空壳,别读 |
| 素材 | `xinyue_match_assets` → `xinyue_copy_images` / `xinyue_copy_audio` | 先给出「请求→文件」映射表让用户确认,再复制 |
| 读包 | `xinyue_read_package` | 大文件先 `listBlocks` 看区块目录,再读单块 |
| 校验 / 写 | `xinyue_validate` → `xinyue_write_package` | 有 error 必须修完再写;写入工具自带校验 |
| 收口 | `xinyue_skills_written` | 带回 taskId,把技能标成「待测试」 |
| 其他 | `xinyue_delete_file` / `xinyue_record_change` / `xinyue_kingdom_assets` | 删包内文件(带备份) / 记自由改动流水 / 生成自定义势力图五件套 |

## 常见错误(校验器会拦,但写的时候就别犯)
- 代码区混进全角标点(中文输入法第一大坑);字符串与注释里的中文标点是正常的。
- `init.lua` 忘了 `return`(Lua 包必须返回包对象)。
- 技能文件忘了 `return skill`。
- `fk.CreateSkill` 的 name 与文件名不一致。
- `addSkills` 里引用的技能 ID 在本包 `skills/` 下不存在。
- 翻译表里武将/技能 ID 漏了对应条目,游戏里会显示原始 ID。
- 写进游戏本体目录而不是扩展包目录。

## 诊断与反馈循环
- 生成的关键步骤插入临时 `print(...)` / `fk.qInfo(...)` 输出,方便用户在游戏内/日志里看决策过程;确认稳定后移除。
- 用户报告问题时:先调用 `xinyue_read_package` 读当前文件的真实内容,再定位修复,重新 `xinyue_validate` 后写入。不要凭对话记忆改代码。

## 任务ID 体系
- 用户在工坊创建的每个任务都有唯一「任务ID」(形如 `my-pack-01`),写在任务消息开头。
- 你的 `xinyue_skills_written` 调用必须原样带回这个 taskId(参数 `skills` 填本轮实现的技能显示名)——它把技能标记为「待测试」并同步给用户的任务列表浮窗。
- 收到「问题反馈」消息时,消息里同样带任务ID:先 `xinyue_read_package` 读该包当前代码,再修复;修复完成后的 `xinyue_skills_written` 带同一 ID(轮次会自动累计)。
- 每次只处理消息里那个任务ID对应的任务,不要动其他任务。

## 目录约定
- 扩展包安装在 `<游戏根>/packages/<包目录名>/`。
- 写入只能通过 `xinyue_write_package`(普通写文件工具被守卫拦截)。每次覆盖前自动备份到
  `<DSH_HOME>/xinyue-kit/backups/<包>/<子目录>/<文件>.<时间戳>.lua`——**不写进包内**
  (包里的 `backup/` 会让联机 git 工作区变脏)。
- 游戏根的特征是同时有 `packages/` 与 `lua/`(其中 `lua/core/package.lua` 是最硬的标志)。
