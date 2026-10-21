---
name: freekill-skill-authoring
description: 新月杀(FreeKill)写/改一个技能的标准流程与踩坑清单：文件骨架、事件与回调签名、标记可见性、常用 room API、校验与写入通道。要动 packages/<包>/**/skills/*.lua 时先加载它。
whenToUse: 用户要求新增、修改、修复某个 FreeKill 技能或技能里的某个效果时
---

# 写一个新月杀技能

目标：一次写对。下面每条都是踩过坑之后核实的，**不要凭无名杀/JS 经验推断**。

## 0. 门禁

需求有歧义（数值、时机、是否锁定、和已有技能的交互）先问清，别猜。
确认单要逐技能写：技能名/类型、触发时机、频率、目标规则、数值、不做什么。

## 1. 写码前先查（5 分钟省 1 小时）

- `xinyue_api_lookup`：事件名、方法、常量、`addEffect` spec 字段——全都先查签名，别硬 grep。
- `xinyue_search_reference`：找官方同效果实现，照抄骨架最快。
- 先读目标文件的**当前内容**（`read` / `xinyue_read_package`），别凭对话记忆改。

## 2. 骨架

```lua
local sk = fk.CreateSkill {
  name = "包前缀_技能id",              -- 必须等于文件名
  tags = { Skill.Compulsory },        -- 频率在这里，不写 addEffect 的 frequency
}
sk:addEffect(fk.Xxx, {
  anim_type = "offensive",
  can_trigger = function(self, event, target, player, data) ... end,
  on_cost     = function(self, event, target, player, data) ... end,
  on_use      = function(self, event, target, player, data) ... end,
})
return sk
```

- 一技一文件，末尾必须 `return`。
- 回调签名统一 `(self, event, target, player, data)`。
- **触发时机不会自动限制 `target == player`**：范围/归属条件全写进 `can_trigger`。
- 次数限制写技能骨架的 `max_phase_use_time` / `max_turn_use_time` / `max_round_use_time`。
- 主动技在 `on_use(self, room, effect)`，数据取 `effect.from/.tos/.cards`。

## 3. 标记（最容易翻车的地方）

| 写法 | 结果 |
|---|---|
| `sk_mark`（不带 @） | **界面不显示**，只有逻辑层知道 |
| `@sk_mark` | 可见，值会显示成文字（数字会原样露出） |
| `@@sk_mark` | 可见、**不显示值**，只显示名字 —— 状态图标就用这个 |
| `@!!sk_mark` | 同上，另加悬停描述（`:`+标记名的翻译） |
| `sk_mark-turn` / `-round` / `-phase` | 引擎到点**自动清零**（`lua/server/room.lua:4203-4217`） |

- 翻译键 = **完整标记名**（例如 `["@@mrfz_gelani_qiongtubufan_trace"] = "追凶"`）。
- 标记按玩家分别存储，同名标记在不同角色身上互不影响。
- 只有 `@` 开头的标记会被推给界面：`lua/client/clientbase.lua:544-562`；渲染规则 `LunarLtk/LtkLuaUtil.qml:314-418`。
- 清除一律 `room:setPlayerMark(p, mark, 0)`。
- **`player:getMark(x)` 缺省返回 `0`**（不是 `nil`），判"有没有"写 `~= 0`；`room:getBanner` 才是 `nil`
  （`for-creators/misc/mark-banner.rst:26-27`）。

## 4. 常用 API（已核实，直接照用）

- `room:loseHp(player, 1, sk.name)` — `ltk/server/events/hp.lua:385`
- `room:obtainCard(player, cardIds, visible, reason, proposer, sk.name)` — `ltk/server/events/movecard.lua:431`；获得来源的牌用 `fk.ReasonPrey`
- `room:getCardArea(id) == Card.DiscardPile` 判牌在弃牌堆
- `room:askToCards(player, {min_num, max_num, pattern, expand_pile, skill_name, prompt, cancelable})` — `ltk/server/room.lua:904`；**只想从外部牌堆选**用 `pattern = ".|.|.|^hand"`（`^hand` = 排除手牌）
- `room:askToUseCard(player, {...})` — `ltk/server/room.lua:2922`，**能触发转化技/虚拟牌**；拿到返回值后：`use.extraUse = true; room:useCard(use)`。`askToUseRealCard`（:2602）明确不能调转化技，别用错
  - **必须带 `extra_data = { not_passive = true }`**：它内部 `trigger(fk.AskForCardUse)`，`pattern` 一宽（如 `"."`）就会把【八卦阵】这类被动转化技的询问也引出来
    （`standard_cards/pkg/skills/eight_diagram.lua:34-39` + `room.lua:2614` 里 `askToUseRealCard` 默认就带 `not_passive = true`），
    而且会让【闪】【无懈可击】这类被动牌出现在"选择使用一张牌"里；带上它 = 只列主动可用的牌
- `room:askToSkillInvoke(player, {skill_name, prompt})` — `ltk/server/room.lua:2131`
- `room:getBanner("RoundCount")` — 首轮 `== 1`（`lua/core/roombase.lua:76`）
- 状态技 `targetmod`：`bypass_times(self, player, skill, scope, card, to)` 与 `bypass_distances(self, player, skill, card, to)`（`ltk/core/skill_type/target_mod.lua:13/56`）；挂在 `room.status_skills`，**不需要 global**
- `fk.AfterCardsMove` 的 `data` 是数组：每项 `{from, to, toArea, moveInfo = {{cardId, fromArea, ...}}}`；静默记账用 `mute = true` + `on_cost = Util.TrueFunc`
- 提示词占位：服务端 `"#key::" .. player.id`，译文里 `%dest` 会被替换成该玩家名
- `fk.Damaged` 的 `target` 是**受伤者**，`data.from` 才是来源；`fk.TurnEnd` 的 `target` 是回合角色
- 覆盖官方卡图/卡背走**资源包**，不是扩展包：`<游戏根>/resource_pak/<资源包名>/packages/<原包名>/image/card/<牌id>.png`，
  再在 `freekill.client.config.json` 的 `enabledResourcePacks` 里写包名（`Fk/Base/SkinBank.qml:33-66` 的
  `searchPkgResource` 先查这里；不启用时 `resource_pak` 里的图等于不存在）

### 4.1 八类状态技的 spec 字段（`ltk/core/skill_skeleton.lua:366-544`）

每个 effect 会生成一个**独立子技能** `#<技能名>_<序号>_<key>`，`key` 即下面的一级名。

| addEffect key | spec 字段（括号内为回调） |
|---|---|
| `"distance"` | `correct_func(from, to, card)` / `fixed_func` —— **至少给一个，否则 assert 失败** |
| `"prohibit"` | `is_prohibited(from, to, card)` / `prohibit_use(player, card)` / `prohibit_response` / `prohibit_discard` / `prohibit_pindian(from, to)` |
| `"atkrange"` | `correct_func` / `fixed_func` / `final_func` / `within_func` / `without_func` / `virtual_weapon_func` |
| `"maxcards"` | `correct_func(player)` / `fixed_func` / `exclude_from(player, card)` |
| `"targetmod"` | `bypass_times(player, skill, scope, card, to)` / `bypass_distances(player, skill, card, to)` / `residue_func` / `fix_times_func` / `fix_target_func` / `distance_limit_func` / `extra_target_func` / `card_tip_func` / `target_tip_func` / `remove_func` |
| `"filter"` | `card_filter` / `view_as` / `equip_skill_filter` / `handly_cards(player)` / `card_skill_filter` / `skill_filter` / `card_pic_filter` |
| `"invalidity"` | `invalidity_func` / `invalidity_attackrange` / `recheck_invalidity` |
| `"visibility"` | `card_visible` / `role_visible` / `move_visible` |

状态技由引擎直接遍历 `room.status_skills`，**不要写 `global = true`**。

### 4.2 dead 判定（哪个 API 之后必须 `isAlive()`）

调用下面这些 **always 类** API 之后，作用域里此前定义的 `player` 变量都可能已经死亡：

`damage` `loseHp` `changeHp` `recover` `changeMaxHp` `enterDying` `killPlayer` `revivePlayer` `drawCards`
`obtainCard` `throwCard` `moveCardTo` `moveCards` `moveCardIntoEquip` `swapCards` `swapAllCards`
`useCard` `responseCard` `doCardEffect` `judge` `pindian` `useSkill` `handleAddLoseSkills`
`askToUseCard` `askToResponse` `shuffleDrawPile` `turnOver` `setChainState` `addToPile` `clearPiles`
`revealGeneral` `bury` `reset` `gameOver`

**条件类**（带 `skip` 才算）：`askToDiscard(skip != true)` `askToChoice(skip != true)` `askToUseVirtualCard(skipUse != true)` `askForSkillInvoke(skip != true)`。

规则：接续操作前 `if p:isAlive() then ...`；`if p:isAlive() then A else B end` 的 `B` 分支里 `p` 视为已死。
确认无需判定时用 `---@fk-ignore-dead` 标一行（来源：`freekill-helper` 扩展的 `triggeringTable.js`）。

### 4.3 AI 策略

`sk:addAI(spec)`（`ltk/core/skill_skeleton.lua:167`），构造函数在 `ltk/server/ai/strategies/init.lua:58/61/117`：

```lua
sk:addAI(Fk.Ltk.AI.newInvokeStrategy { think = function(self, ai) return true end })
sk:addAI(Fk.Ltk.AI.newActiveStrategy { think = ..., choose_players = ... })
sk:addAI(Fk.Ltk.AI.newCardSkillStrategy { on_effect = function(self, ai, from, to, card, eff) return 0 end })
sk:addAI(Fk.Ltk.AI.reuse('别的技能id', Fk.Ltk.AI.ActiveStrategy))   -- init.lua:39
```

注意：**当前版本 AI 策略加载并不完整**（`心得摘要` 称 `ai/init.lua` 里加载逻辑被注释，未独立核实），
所以别指望 AI 会按你写的策略主动发动自定义技能。

### 4.4 自定义 UI 注册（引擎按 `name` 找 QML）

- `Fk:addMiniGame{ name, qml_path, default_choice, update_func }` — `ltk/core/engine.lua:496`
- `Fk:addPoxiMethod{ name, card_filter, feasible, post_select, default_choice, prompt }` — `:474`
  （`card_filter` 与 `feasible` 是 `assert` 必填）
- `Fk:addQmlMark{ name, qml_path, qml_data, how_to_show }` — `:487`

### 4.5 弃牌堆来源判定 / 玩家标记表（「穷途不返」那轮核实）

- `move.from` 就是 `cardsMoveInfo.from` 原样（`packages/freekill-core/ltk/server/events/movecard.lua:250-279`），
  **不会**按 `fromArea.from` 反推：使用牌的第二段（processing → 弃牌堆）调用方不传 `from`，所以它是 `nil`。
- **先想清楚要「谁的牌」还是「什么时机」**——这两种口径代码完全不同，别混：
  - 「某角色回合内进入弃牌堆的牌」（只管时机，不管谁送的）：直接记 `move.toArea == Card.DiscardPile`
    的**全部** `moveInfo[].cardId`。
  - 「某人**本人**送进弃牌堆的牌」（要归属）：必须双判据——`move.from == 该角色` 直接记（弃牌/改判等都带
    from）；使用/打出的牌要走两段（手牌 →`Card.Processing`，此时 `from` = 所有者；再 processing →弃牌堆，
    此时 `from` = `nil`），所以要在进 `Card.Processing` 时把 cardId 登进「在飞」表，落地进弃牌堆时认领。
    只按 `from == 该角色` 过滤会**漏掉他自己使用的牌**（这段 from 是 nil）。
  - 选错口径会被用户当场抓到：「穷途不返」先按归属写 → 用户以为别人的【决斗】【万箭齐发】也该拿；
    改成记全部 → 用户又要求收紧回「只有他本人送进弃牌堆的牌」。**动笔前直接把口径问清楚。**
- 玩家标记表 API 都在 `packages/freekill-core/ltk/server/room.lua:4050-4094`：
  `setPlayerMark(p, mark, v)` / `addTableMark` / `addTableMarkIfNeed` / `removeTableMark`。
  数组标记重名元素会**重复 insert**，想表达「移到末尾」必须先 `removeTableMark` 再 `add`。
- `setPlayerMark(p, mark, 0)` 对表标记等价于清空（空表会被写回 0）。

### 4.6 语音 / 表达式 / 键名（容易说错的三处）

- **语音是一句一个文件**：`audio/skill/<技能ID><序号>.mp3`，序号从 1 起、与 `$<技能ID><n>` 台词键一一对应
  （官方实测 standard 122/122、mrfz 12/12 全带序号）；引擎 `Fk/Base/SkinBank.qml:233-246 getAudio` 先试
  `<名>.mp3`、再试 `<名>1.mp3`。`audio_index` 是 int 或 int 表（引擎 `room:tableRandomPick` 随机取一），
  **0 = 不播**（`ltk/core/skill.lua:21`，也可在 `cost_data.audio_index` 里按次覆盖 `ltk/server/events/skill.lua:50`）。
  **不写 ≠ 随机**：传下去的是 nil（`ltk/server/events/skill.lua:80-81`），多句台词到底播第几句由 C++ 决定，
  所以想要「多句随机」必须显式写 `audio_index = {1,2,3}`（官方 `leiji.lua:84` 的 `{4,5}` 即此用法，
  经 `fk.readUsableSpecToSkill` → `fk.readCommonSpecToSkill` 拷到效果实例上）。
  → 别再回答"官方包不拆序号、就是 `<ID>.mp3`"，那是错的。
- **文件名不能用台词文案**：工坊插件 `dsh-xinyue-kit/src/audio.js:22` 的白名单正则只允许
  `字母/数字/下划线/连字符/汉字` + `.mp3`，`【】！？…` 一律被拒；更要紧的是引擎只按 **`<技能ID><序号>`** 找文件
  （`Fk/Base/SkinBank.qml:233-246`），拿台词文案命名根本不会被搜到。新增第 4 句 = 存
  `skill/<技能ID>4.mp3` + 加翻译键 `["$<技能ID>4"] = "台词"`。
- **一句话一个触发点、要按「时机」分开配台词**时：一次技能触发只会播一次音
  （`ltk/server/events/skill.lua:76-83`）。① 触发时播哪句 → 在 `on_cost` 里
  `event:setCostData(self, { audio_index = { 1, 2 } })`（表会被 `tableRandomPick` 随机，
  `:47-51` 用 cost_data 覆盖 spec 的 audio_index）；② 同一触发里**后段**（如结算中的第二次使用、
  额外结算）要自己的台词 → 只能在那段代码里手动补一次
  `player:broadcastSkillInvoke(<技能名>, table.random({ 3, 4 }))`
  （`ltk/server/serverplayer.lua:481`；`table.random` 在 `lua/core/util.lua:634`）。
- **`Exppattern` 单条 7 项定序**：`牌名|点数|花色|区域|完整牌名|类型|id`（`anhe/15-exppattern.rst:21`）；
  多项取反必须 `^(3,5)`，写成 `^3,^5` 会被读成"非3或非5"→ 等于全匹配（同文件 :37）。
- **状态技键名只有 `maxcards` / `cardskill`**（`ltk/core/engine.lua:59-71`；旧文档里的 `max_cards`、`cardmod`
  都不存在，写进 `addEffect` 建技能时直接 nil 报错）。同理频率只认骨架 `tags[1]`，spec 里的 `frequency` 引擎不读
  （`ltk/core/skill_skeleton.lua:295`）。

### 4.7 事件栈 / 移牌 / 伤害的硬约束（《新月之书》rule 篇 + 引擎核对）

- 移牌 `data` 是**数组**；`move.from` 在牌堆/弃牌堆/`Card.Processing`/游戏外时是 `nil`，`move.to` 只在
  `toArea` 是玩家区域（手牌/装备/判定/私人牌堆）时非 nil（`ltk/server/events/movecard.lua:495-505`）。
- `moveReason` **必填**，否则 `infoCheck` assert 崩（`ltk/server/system_enum.lua:72-84`：1 JustMove / 2 Draw /
  3 Discard / 4 Give / 5 Put / 6 PutIntoDiscardPile / 7 Prey / 8 Exchange / 9 Use / 10 Response / 11 Judge /
  12 Recast / 13 Pindian）；`toArea = PlayerSpecial` 必须同时给 `specialName`。
- 取消移牌只能用 `room:cancelMove(data, ids, func)`，且**只在 `fk.BeforeCardsMove`**；该时机 `on_use` 返回 true
  = **终止整个移牌事件**（连 `fk.AfterCardsMove` 都不发），不是"只取消这一张"（`movecard.lua:1035-1054`、`:58-59`）。
- 防伤/改伤**只能**写在 `fk.DetermineDamageCaused` / `fk.DetermineDamageInflicted`；写在 `fk.DamageCaused` /
  `fk.Damaged` 里无效。「防止伤害」= 把数值改 0（`rule/07:141-147`）。
- `fk.BeforeTurnStart` 的 `on_use` 返回 true = **跳过整个回合**；`fk.EventPhaseStart` 返回 true = 终止本阶段
  （`rule/05:89-196`）。移牌/洗牌这类时机**没有承担者**，`target` 是 nil。
- 回合档次数（`[Player.HistoryTurn]` / `max_turn_use_time`）在 `fk.TurnEnd` **之前**就已重置（`rule/02:58-79`）
  ——想在 `TurnEnd` 里读"本回合发动过几次"得自己记。
- `is_delay_effect = true` 除了不为主技能计次，还会**默认自动发动**（不自带 `on_cost` 询问，`rule/02:129-155`）。

### 4.8 「使用」≠「打出」，以及几处零散硬事实

- **闪/无懈这类响应也是「使用」**：杀要闪走 `Util.SlashOffsetFunc`、锦囊要无懈走 `Util.TrickOffsetFunc`，
  两者最终都是 `room:askToUseCard` + `room:useCard`，所以会照常发 `fk.CardUseFinished`
  （`packages/freekill-core/lua/core/util.lua:312-352`；`ltk/core/skill_type/cardskill.lua:247-290` 是向谁要闪）。
- 真正的**「打出」**走 `room:askToResponse`（命令 `AskForResponseCard`，触发 `fk.AskForCardResponse` /
  `fk.HandleAskForPlayCard` / `fk.AfterAskForCardResponse`），**不经使用事件链**（`ltk/server/room.lua:3023-3105`）。
  → 写「使用牌后」类技能别把响应漏掉；要求「打出」就别挂使用事件。
- 判「是否出牌阶段内」用 `player.phase == Player.Play`（Play=5，`ltk/core/player.lua:53`）。非当前回合角色的
  `phase` 不是 Play，所以 `from.phase ~= Player.Play` 就等于「回合外使用」。
- 引擎**没有「标记变化」事件**：`room:setPlayerMark` / `addPlayerMark` / `removePlayerMark` 只写值 + 广播
  （`lua/server/roombase.lua:704/719/732`），没有 doSomethingLater。要做「标记到 N 层立刻结算」，可靠写法 =
  **共享函数当唯一入口**（加完就在函数里结算）+ 低优先级事件兜底（防别的技能绕过入口直接写标记）。
  只挂「下次事件再结算」用户会觉得慢一拍（37 的【灵光】就是这么被要求的）。
- `player.next` 是**含死者**的环形链表（`ltk/server/gamelogic.lua:138-146`）；按下家方向取存活角色用
  `player:getNextAlive(nil, n)`（`ltk/server/serverplayer.lua:723-741`，第 2 参 = 第几个存活的下家）。
- 主动技：`max_card_num` 可以是函数 `function(self, player)`（`packages/freekill-core/standard/aux_skills_dir/discard_skill.lua:54`）；
  `include_equip = true` 才能弃装备区（`packages/brainhole_new/pkg/brainhole/skills/chiyao.lua:26`）；
  `target_num = 0` + `min_card_num` = 只选牌不选人（制衡式）。
- 多子包的根 `init.lua`（只 require 子包、`return` 数组，如 `packages/mrfz/init.lua:95-125`）会让
  `xinyue_validate` 报「缺 Package:new」——**这是该版式的误报**，照写，写入工具不拦。
- **主动技的 `max_card_num` / `min_card_num` / `card_filter` 会在客户端被调用**（`ltk/core/skill_type/button.lua:111-120`
  的 `getMaxCardNum` 由 `ltk/core/request_type/active_skill.lua:427` → `UpdateRequestUI` 触发）。客户端
  `Player` 没有 `.room` 字段，写 `player.room.alive_players` 会当场报
  `attempt to index a nil value (field 'room')`。**要全场人数就用 `#Fk:currentRoom().alive_players`**
  （官方同写法：`packages/mobile/pkg/mobile_bingshi/skills/fujiy.lua:28`）。
- **写了 `can_trigger` 就等于接管默认检查：必须自己写 `player:hasSkill(<技能名>)`**。基类
  `TriggerSkill:triggerable`（`ltk/core/skill_type/trigger.lua:48-51`）要求 `target == player` 且
  `target:hasSkill(...)`，而 `skill_skeleton.lua:319` 会用 spec 的 `can_trigger` **整体替换**它
  → 不写 hasSkill 就变成「全场每个玩家都触发这个技能」（37 实测：两个 AI 玩家的卡上也冒出【灵光】，
  因为它们没有技能却被当作持有者执行了 `on_use`）。官方 7812 处 `can_trigger` 全部自带 hasSkill。
  注意 grep 时别只搜 `can_trigger = function` 那一行——hasSkill 通常写在下一行。
- 判「此刻是谁的回合/什么阶段」同理别碰 `player.room`：`player.phase == Player.Play`（Play=5）即可，
  回合结束会把 `current.phase` 置回 `Player.PhaseNone`（`ltk/server/events/gameflow.lua:313`），
  所以别人的 `phase ~= Player.Play` 恒成立 —— 「回合外使用」判定可以直接用。

### 4.9 额外回合 / 全屏特效 / 火焰伤害（可燃点实测）

- **额外回合**：`player:gainAnExtraTurn(delay, skillName, phases, extra_data)`
  （`ltk/server/serverplayer.lua:219`）。`phases` 传阶段表，只给一个元素 = 「这个额外回合只进行这一个额定阶段」，
  官方先例 `packages/shzl/pkg/god/skills/qinyin.lua` 只传 `{Player.Discard}`。阶段常量
  `Player.Start=2 / Judge=3 / Draw=4 / Play=5 / Discard=6 / Finish=7`（`ltk/core/player.lua:50-55`）。
- **「额定回合」必须自己排掉额外回合**：`TurnData.reason` 在普通回合里是 `"game_rule"`、在额外回合里是技能名
  （`ltk/core/events/gameflow.lua` 的 `TurnDataSpec`）。**额外回合自己也发 `fk.TurnEnd`**，
  在 `TurnEnd` 里发额外回合却不判 `data.reason == "game_rule"` 会无限递归。
- **全屏大动画（限定技特效图）**：`room:doSuperLightBox(nil, { media = "packages/<包>/image/anim/x.jpg", pause = 1500 })`
  （`ltk/server/room.lua:553`）。`media` 是**相对游戏根**的路径，QML 拼 `Cpp.path + "/" + mediaSource`
  （`LunarLtk/Components/SuperLightBox.qml:42`）；`pause`/`fade` 从 extra_data 读（同文件 `:111-112`），
  `path == nil` 时默认延迟 `pause + fade*2` 毫秒（`room.lua:565-567`）。限定技自身还会自动播大招动画，二者先后播放、不冲突。
- **火焰伤害**：`fk.FireDamage = 3`（`packages/freekill-core/ltk/core/events/hp.lua:72`），伤害事件里判
  `data.damageType == fk.FireDamage`。**火属性伤害牌**按卡牌 `damage_type` 字段判，不按名字：
  火【杀】= `fire__slash`、火攻 = `fire_attack`（`packages/freekill-core/maneuvering/pkg/init.lua:24-56`）。
  Exppattern 的 name 项按 `trueName` 匹配（`ltk/core/exppattern.lua:182`），所以 `pattern = "slash"`
  同时命中普通【杀】/火杀/雷杀——挑牌就用它，别写死 `fire__slash`。
- **多角色共用的标记要留唯一入口**：引擎没有标记变化事件，写 `Cfwl.addXxx(room, target, n)`：
  加层 → 遍历持有该技能的角色逐个询问；别在技能各处散着写 `addPlayerMark`。
- **「使用次数上限 +N」用 `targetmod` 的 `residue_func`**：`residue_func = function(self, player, skill, scope, card, to)`
  返回**上限增加多少**（`lua/fk_ex.lua:218`「令使用次数上限增加多少」；实现 `ltk/core/skill_type/target_mod.lua:24`
  `getResidueNum`，在 `ltk/core/skill_type/cardskill.lua:137-145` 里 `ret = ret + correct`）。
  要「锁定成某个值」用 `fix_times_func`（`getFixedNum`，多个时先到先得），要「完全无视上限」才用 `bypass_times`。
- **伤害 +1 用 `fk.DamageCaused` + `data:changeDamage(1)`**：`DamageCaused` 的承担者是**伤害来源**（`target == player`
  就是自己打人），官方裸衣就是这么写的（`packages/freekill-core/standard/pkg/skills/luoyi.lua:43-53`，
  `changeDamage` 实现见 `ltk/core/events/hp.lua:97-105`）。文档说「改伤只能写 `Determine*`」在本引擎上不成立，
  但 `DetermineDamageInflicted` 仍适合「确定伤害值/防止伤害」这类需要重写数值的场合。

## 5. 写入（只有一条合法通道）

1. `xinyue_validate`（code + filePath + folder）→ 有 error 必须先修
2. `xinyue_write_package`
   - `file` 是**相对包根**：子包要写全 `pkg/<子包>/skills/<技能id>.lua`，传 `skills/...` 会落到包根的错误位置
   - 新文件走全文模式（`code`）；改已存在的文件用 `blocks` / `edits`
   - 整段重写已有文件：`code` + `editScope`（写带前缀的锚点键：`skill:<id>` / `translate:<id>`）
   - 写坏不用怕，备份在 `<包>/skills/backup/<文件>.<时间戳>.lua`
3. 素材只用 `xinyue_copy_images` / `xinyue_copy_audio`
4. 全部写完再 `xinyue_skills_written(taskId, {技能显示名...})`

## 6. 维护（硬规则，不是建议）

**每次写完技能（`xinyue_write_package` 落盘成功）后，回头更新本文件**，把这一轮新核实的东西补进去：

- **先改正文源，再改安装副本**：本文件由工坊插件自动安装，源在插件包里
  （`dsh-xinyue-kit/knowledge/skills/freekill-skill-authoring/SKILL.md`，本机还需同步到
  `C:\Users\oy\.dsh\profiles\desktop\node_modules\dsh-xinyue-kit\` 下的同名文件）。
  **只改 `~/.dsh/skills/` 那份，重启 dsh 时会被插件按源原样覆盖回去**——白写。
- 新查到的引擎事实 → 补进 §4，必须带 `文件:行`（例：`room:loseHp` → `ltk/server/events/hp.lua:385`），
  没核实到出处的不要写。
- 新踩的坑 → 补进 §3 / §6，写清楚「现象 → 原因 → 正确写法」，一句话能说透就别展开。
- 已有条目被推翻/改名 → 直接改掉原条目，别并列保留两套说法。
- 与工坊插件行为相关（写入通道、校验器、素材工具）→ 一并写进来，下个会话才知道。

判断标准：如果这轮我多花了 10 分钟以上才搞明白某件事，它就值得进本文件。

## 7. 高频错误清单

- 全角标点在代码区（中文引号、`（）`、`，`）——字符串/注释里正常，代码里必炸
- 技能文件忘了 `return`；`fk.CreateSkill` 的 name 和文件名不一致
- `addSkills` 引了本包不存在的技能 id
- 翻译表漏条目 → 游戏里显示原始 id（技能名、描述 `:`、标记名、提示词 `#`）
- 把文件写进游戏本体目录而不是扩展包目录
- 改完不 validate 直接写；或写完不告诉用户重载扩展
- **调用完 §4.2 的 always 类 API 后不判 `isAlive()` 就继续用旧 `player` 变量**（最常见的一类线上崩溃）
- **在 `max_card_num` / `card_filter` / `prompt` 之类「UI 也会调」的回调里用 `player.room`** → 客户端
  `attempt to index a nil value (field 'room')`；改 `Fk:currentRoom()`（§4.8）
- `metadata.lua` **不是必需文件**：引擎零引用它（不信可以 grep `metadata` 全仓），漏了不影响加载；官方包有它只是习惯
- `room:obtainCard(p, cards, visible, reason, proposer, skill_name)` 的**第 4 参是获得原因**，不是技能名
- `General` 没有 `hidden` 字段，隐藏武将是 `total_hidden = true`（`extension:setHiddenGenerals{...}` 那次踩的）
- 引擎有**两套核心并存**：旧的 `lua/`（`lua/client`、`lua/server`、`lua/core`）与新的
  `packages/freekill-core/ltk/{core,server}`。查 API 前先确认在哪套，别在一个文件里混用两套的写法
- 状态技只写 `addEffect("distance", {})` 而不给 `correct_func`/`fixed_func` → 引擎 `assert` 直接报错（`skill_skeleton.lua:370`）
- 移牌漏 `moveReason`、`toArea = PlayerSpecial` 漏 `specialName` → 都是 `assert` 崩，不是静默失败
- `fk.createSkill`（小写）**不存在**，只有 `fk.CreateSkill`（`anhe/02:164` 的例子是笔误，`skill_skeleton.lua:1029`）
- `room:askToCards` 在 `max_num < 1`、或**按 pattern 筛完一张都不剩**时直接返回 `{}`：**不起界面、不提示**
  （`ltk/server/room.lua:904-929`）。所以「上限算出来是 0」的技能看起来就像没反应——先算限再问，
  必要时补一句提示译文，否则用户只会报「技能没询问」（cfwl-02 实际就踩了这个：燃烧 1 层 → `⌊1/2⌋ = 0`）
- 翻译表里英文标点（逗号/分号/冒号）在中文语境要写成全角，否则界面像别名；描述里的人名用 `%src`/`%dest` 占位，不写死

## §8 后台监听要静默，语音可手动补

- 触发技的每个 effect **默认都会询问「是否发动」并播 `audio_index` 对应的语音/动画**。「造成伤害后 +1 伤害」
  「目标濒死就撤销」「回合结束清标记」这种**后台维护**逻辑，不静默就会在每次受伤时弹框、重播技能动画
  （cfwl-02 的「火之于火」就踩了：每次火焰伤害都问一次并重播 1 号语音）。
  写法：`mute = true` + `on_cost = Util.TrueFunc`（两个都要；只写 `mute` 仍会弹框，只写 `on_cost` 仍会播）。
- 想在某个精确时机**自己播某一句**语音，用 `player:broadcastSkillInvoke(skill_name, index)`
  （`packages/freekill-core/ltk/server/serverplayer.lua:481`），序号与 `audio/skill/<技能ID><序号>.mp3` 对应；
  配一个 `-turn` 后缀的标记做「每回合只播一次」。
- 判定「某张牌打到了某人」用 `fk.CardUseFinished`（target = 使用者，`data.card.trueName == "slash"`，
  遍历 `data.tos` 找目标），比 `fk.CardUsing` 稳（伤害已结算完，濒死也已处理）。
- 技能里要「先造成一点伤害再继续」直接 `room:damage{ from=, to=, damage=, damageType=fk.FireDamage, skillName= }`；
  伤害后 `player.hp <= 0` 即濒死，`player.dead` 才是一定死了，两者判断时机不同。
- **想「因某伤害濒死时直接回血、连求桃都不问」**：在 `fk.EnterDying` 里 `room:recover{ who=, num=1-hp, skillName= }`。
  可靠原因：`Dying:main` 先 `logic:trigger(fk.EnterDying, …)`，之后才判 `dyingPlayer.hp < 1` 去逐人询问求桃
  （`packages/freekill-core/ltk/server/events/death.lua:36-40`）。
- **判断「是哪一次伤害导致的濒死」不用自己记状态**：`DyingDataSpec` 自带 `damage`（造成濒死的 DamageData）与 `killer`，
  直接 `data.damage.damageType == fk.FireDamage` 即可（`ltk/core/events/death.lua` 的 DyingDataSpec）。
  比「伤害前打标记」的写法稳，也不怕同一回合多次伤害。
