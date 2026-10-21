# 《新月之书》归纳与索引(给模型与人的地图)

> 本文件是**归纳**,不是原文。原文在 `knowledge/fkbook/**.rst`,用
> `xinyue_search_reference(type='doc')` 检索、`xinyue_read_doc` 读整节。
> 机器可读的章节表在同目录 `outline.json`(工具 `xinyue_doc_index` 直接返回它)。

全书:**72 个文本文件 / 290,253 字节**(`for-creators` 分册),8 个部分。
`.rst` 保持原格式未转 markdown;图片音频未收。

---

## 一、按任务找章节(先看这张表)

| 我要做的事 | 先读 | 再查 |
| --- | --- | --- |
| 建一个能加载的扩展包 | `anhe/01-hello.rst` | `anhe/16-extension.rst`(规范) |
| 写第一个自有技能 | `anhe/04-newskill.rst` | `rule/01-skill.rst` + `rule/03-event.rst` |
| 加次数限制/开关/觉醒/转换技 | `anhe/09-manage-skill.rst` | `rule/02-skel.rst` |
| 改距离/攻击范围 | `anhe/08-distance.rst` | `anhe/09-manage-skill.rst` |
| 用牌、响应、目标指定 | `rule/06-use-response.rst` | `rule/03-event.rst` |
| 伤害、回血、体力上限 | `rule/07-hp.rst` | `anhe/10-change-hp.rst` |
| 濒死、救援、死亡 | `rule/08-death.rst` | `rule/07-hp.rst` |
| 判定、拼点 | `rule/09-judge.rst` | — |
| 移牌/弃牌/获得牌 | `rule/04-movecard.rst` | — |
| 翻面/横置/标记等状态 | `rule/10-property.rst` + `misc/mark-banner.rst` | `anhe/12-arrange.rst` |
| 改回合/阶段/游戏进程 | `rule/05-gameflow.rst` | `anhe/11-change-game-process.rst` |
| 加提示信息/日志 | `anhe/07-comment-log.rst` | `anhe/13-debug.rst` |
| 立绘、语音、皮肤 | `anhe/03-makeimage.rst` / `anhe/05-audio.rst` / `misc/skin-package.rst` | `anhe/16-extension.rst` |
| 自定义玩法(模式) | `anhe/16-extension.rst` | `misc/mode-config.rst` |
| 发布 / 更新扩展包 | `anhe/06-git.rst` | `create-resource-pak.rst` |
| 出 bug 要调试 | `anhe/13-debug.rst` | `anhe/14-eventstack.rst` |
| 不会 Lua | `new-to-lua/15~21` | `anhe/example/*.lua` |
| 查某个 API 的签名 | **不要读 api-reference**(全是 autodoc 占位) | 用 `xinyue_api_lookup` 或读 `lua/` 源码 |

---

## 二、入门(5 篇)

- **`index.rst` 写给拓展主** — 全书目录与阅读路径。`terminology.rst` 收录"牌堆/武将牌/技能骨架/时机"等术语的官方叫法,对不上词时先查它。
- **`anhe/00-prepare.rst` 开发环境准备** — 引擎怎么找扩展包、`packages/` 的加载机制(**联机时客户端会自动 git 同步服务器上的扩展包**)、本机开发目录怎么摆。
- **`anhe/01-hello.rst` 创建拓展包与新武将** — 一个能跑的最小扩展包:`init.lua` 里 `Package:new` + `General(...)` + `Fk:loadTranslationTable`;素材目录名与 ID 的对应关系。**动手前必读**。
- **`create-fk-mod.rst` / `create-resource-pak.rst`** — 拓展与资源包的创建入口(短篇)。
- **`anhe/16-extension.rst` 拓展规范文档(19KB,最该通读的一篇)** — 目录结构、立绘/卡图/音频规格、`extensionName` 必须等于目录名、子包(Package)与武将分类、自定义势力需要的五件套图、模式包与 `GameLogic` 覆盖点。

## 三、技能(9 篇)

- **`anhe/02-addskill.rst` 添加技能** — 把已有技能挂到武将上(`addSkills`)、技能名与翻译键。
- **`anhe/04-newskill.rst` 创建一个新技能** — `fk.CreateSkill` + `addEffect(fk.事件, {...})` 的最小骨架;主动技与触发技的差别。
- **`anhe/09-manage-skill.rst` 技能管理(23KB,技能篇的核心)** — 次数限制(`max_*_use_time`、`max_branches_use_time`)、限定/觉醒/转换/持恒等 `tags`、技能的动态增删、`check_effect_limit` 与 `check_skill_limit` 的区别、延迟效果。
- **`rule/01-skill.rst` 技能及其生效事件** — 技能在什么时机被触发、`can_trigger/on_use` 的职责划分。
- **`rule/02-skel.rst` 技能的次数限制** — 次数记在哪、在哪个时机清零(回合档在 `TurnEnd` 前重置;`withinTimesLimit`/`usedSkillTimes` 的用法)。
- **`anhe/08-distance.rst` 修改距离** — 状态技 `distance` 的 `correct_func`/`fixed_func`;距离与攻击范围是两件事。
- **`anhe/12-arrange.rst` 标记/技能名格式整理** — 命名与显示格式约定,避免同包重名。
- **`anhe/15-exppattern.rst` Exppattern** — 技能/卡牌的"表达式模式"语法(`^(3,5)` 这类),扫描牌、限定牌型时用。
- **`anhe/07-comment-log.rst` 添加提示信息** — `fk.qInfo` 等日志/提示的正确写法(别用 `print` 刷屏)。

## 四、规则与结算(11 篇,引擎的"法律")

- **`rule/03-event.rst` 事件与时机** — 事件栈怎么走、`priority` 高低、`global` 与承担者 `target`、当前询问者 `player` 的区别。**写任何触发技前必读**。
- **`rule/06-use-response.rst` 使用与打出** — `PreCardUse → TargetSpecified → PreCardEffect → CardUseFinished` 的全链路;响应(`PreCardRespond`)与"打出"的差别。
- **`rule/07-hp.rst` 体力值相关事件** — `PreHpLost/HpLost`、`Damage`(承担者是来源)vs `Damaged`(承担者是受伤者)、`DetermineDamage*` 才是改伤害数值的地方。
- **`rule/08-death.rst` 濒死与死亡** — `EnterDying → AskForPeaches → AfterDying → Death`,救人与死亡结算顺序。
- **`rule/09-judge.rst` 判定与拼点** — `StartJudge/AskForRetrial/FinishJudge`、`StartPindian/PindianFinished`。
- **`rule/04-movecard.rst` 移动牌** — `BeforeCardsMove/AfterCardsMove`、`moveReason` 必填、`cancelMove` 只在 `BeforeCardsMove` 有效。
- **`rule/10-property.rst` 特殊状态改变** — 翻面、横置(链)、标记类状态的改法。
- **`rule/05-gameflow.rst` 游戏流程相关** — 回合/阶段的开始结束事件、跳过阶段、额外回合(`BeforeTurnStart` 返回 true 可跳回合)。
- **`rule/faq.rst` 常见村规结算一览** — 有争议的结算官方口径,写技能拿不准时先看。
- **`anhe/10-change-hp.rst` 体力变更** — 改体力/体力上限在哪个事件里做才安全。
- **`anhe/11-change-game-process.rst` 游戏进程** — 改流程、加阶段、接管胜负判定。
- **`anhe/14-eventstack.rst` 事件栈解析** — 一张图看懂事件是怎么一层层套起来的(与 `rule/03` 配套)。

## 五、美术 / 音频 / 界面(5 篇)

- **`anhe/03-makeimage.rst` 武将美化** — 立绘目录与规格、缺图时的表现。
- **`anhe/05-audio.rst` 添加音效** — 技能语音、阵亡语音、用牌语音的目录与命名。
- **`misc/skin-package.rst` 皮肤拓展** — 皮肤包结构。
- **`misc/mark-banner.rst` 标记与 banner** — 标记角标、横幅提示(`@!` 前缀等)。
- **`misc/lua-and-qml.rst` Lua 与 QML 联动** — 想加自定义界面/特效时才需要。

## 六、模式 / 配置 / AI(4 篇)

- **`misc/mode-config.rst` 游戏与子模式自定义 config** — 模式可选参数(人数、将池、开关)怎么声明与读取。
- **`misc/task.rst` 关于 Task** — 异步任务的排队与取消。
- **`misc/ai-remake.rst` AI 方案设计** — AI 决策层怎么接。
- **（模式包骨架另见）** `anhe/16-extension.rst` 的 GameMode 一节:`SpecialPack` + `fk.CreateGameMode` + 规则技 + `logic` 复用。

## 七、发布与调试(2 篇)

- **`anhe/06-git.rst` 发布与更新自己的拓展** — 扩展包做成 git 仓库,联机时靠它同步;核心包被改动会让联机报 `Workspace is dirty`。
- **`anhe/13-debug.rst` 调试代码** — 日志、断点、常见报错的定位顺序。

## 八、Lua 入门(7 篇,零基础才读)

`new-to-lua/15-hello-lua` → `16-var-and-type` → `17-if` → `18-list` → `19-loop` → `20-table` → `21-func`。
配套脚本 `new-to-lua/studylua/*.lua`。有其它语言基础的话,只看 `20-table`(Lua 的表=数组+字典)和 `21-func` 即可。

## 九、API 参考(21 个文件,但**都是空壳**)

`api-reference/core/*.rst` 与 `api-reference/server/*.rst` 每个只有 100 字节左右,内容是
`.. lua:autoobject:: Card` 这类 autodoc 指令 —— **打包时没带展开后的正文**。
所以:查签名/字段不要读这里,用 **`xinyue_api_lookup`**(索引了 `lua/` 源码,给签名+定义行+官方用例),
或直接读游戏目录 `lua/` 下对应文件。

---

## 十、已核实的"书外知识"(书里没写或写得含糊,实测得出)

1. **回调签名统一是 `(self, event, target, player, data)`** —— 不是旧教程里的 `(self, player, event, ...)`。出处:`lua/core/skill_type/trigger.lua:28`。
2. **发动频率写在技能骨架 `tags` 里**(`Skill.Compulsory/Limited/Wake/Switch/Permanent`),引擎取 `tags[1]`;**写在 `addEffect` 表里的 `frequency` 不会被读**。
3. **语音是一句一个文件**:`audio/skill/<技能ID><序号>.mp3`,序号从 1 起,与 `$<技能ID><n>` 台词键对应;`audio_index` 为 0 = 不播、缺省 = 随机(`lua/core/skill.lua:21`;`Fk/Base/SkinBank.qml:233-246` 先试 `<名>.mp3` 再试 `<名>1.mp3`)。
4. **事件清单以引擎为准**:`fk.*` 共 108 个,定义在 `lua/core/events/*.lua` 的 `---@class fk.XXX`;书里的列表可能滞后。
5. **`Damage` 与 `Damaged` 的承担者相反**(来源 vs 受伤者);改伤害数值只能写 `DetermineDamageCaused` / `DetermineDamageInflicted`。
6. **移牌的 `moveReason` 必填**;`cancelMove` 只允许在 `BeforeCardsMove` 调用。
7. **`is_delay_effect` 的效果默认自动发动**(不给主技能次数计数)。
8. **武将分类的单位是 Package(子包)**,不是武将标签;`General` 没有 category/tag 字段。
9. **`extension.extensionName` 必须等于 `packages/` 下的目录名**,否则立绘/语音/势力图路径全错。
10. **自定义势力的图有硬尺寸**:`<代号>.png` 75×75、`-magatama.png` 22×27、`-back.png` 175×233,缺图就不显示。

---

## 十一、工具分工(别用错)

| 需求 | 工具 |
| --- | --- |
| 这章讲什么 / 该读哪章 | `xinyue_doc_index`(本文件的结构化版) |
| 关键词找文档段落 | `xinyue_search_reference(type='doc')` |
| 读整节原文 | `xinyue_read_doc(id / file+section)` |
| 查引擎符号签名、枚举、状态技字段 | `xinyue_api_lookup` |
| 找官方技能/武将实现 | `xinyue_search_reference(type='skill' / 'general')` |
| 读某个已装扩展包 | `xinyue_read_package` |
