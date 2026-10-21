# dsh-xinyue-kit

新月杀(FreeKill)扩展开发工坊,一个 DeepSeek Harness 插件。
基于https://github.com/qtaik/dsh-noname-kit修改

让 AI 按规范写新月杀(FreeKill)的 Lua 扩展(武将技能、卡牌与玩法):规范注入、官方源码搜索、
静态校验、任务管理都有插件兜底;游戏扩展目录只认专用写入通道,AI 抄错或删错
代码会被工具层拦下,覆盖前自动备份。

![工坊:任务表单与任务列表](https://cdn.jsdelivr.net/npm/dsh-xinyue-kit/docs/screenshots/workshop.png)

![历史页:扩展总览、备份回滚与注意点清单](https://cdn.jsdelivr.net/npm/dsh-xinyue-kit/docs/screenshots/history.png)

## 安装

需要 DeepSeek Harness 和 pnpm。

```sh
dsh plugin --profile web add dsh-xinyue-kit
```

装完**重启 dsh**。重启后点输入框左边的「🛠 工坊」→ 进「⚙ 设置」页 → 点一下「♻️ 重装 preset」,AI 的「新月杀开发模式」人格与规范就装好了。**不用开终端。**

> 提示:**DSH 0.1.7 起(含桌面版)不需要点这个**——preset 随插件自动就位,重启后直接可用;这个按钮只在 0.1.6 及以下的环境出现。

想用命令行也行(脚本在插件目录里,路径是 `C:\Users\<你的用户名>\.dsh\profiles\web\node_modules\dsh-xinyue-kit`):

```sh
node scripts/install-preset.mjs
```

从 GitHub 装(与 npm 等价):

```sh
dsh plugin --profile web add https://github.com/ykwingking/dsh-xinyue-kit.git
```

### 桌面版(DeepSeek Harness 桌面应用)

桌面版有自己独立的环境,安装方式不同:打开桌面版,左侧「插件」面板 →
「添加插件」→ 输入 `dsh-xinyue-kit` → 安装 → 重启桌面版。需要 1.8.1 或更高
版本(桌面版会拒载旧版)。也可以用桌面版自带的命令行:

```sh
E:\dsh\resources\runtime\cli\bin\dsh.cmd plugin add dsh-xinyue-kit@<版本号>
```

注意:这条命令**不要加 `--profile web`**——桌面版的 dsh 命令默认指向它自己的
环境,带了反而会装进 Web 环境,桌面版看不见。装完新建会话选「新月杀开发
模式」即可(preset 随插件自动就位,无需重装),再到工坊「⚙ 设置」配一次游戏
目录。升级:在插件面板卸载后重装新版本(桌面版面板暂不支持自动更新)。

## 配置

重启 `dsh web` 后打开 Web UI。工坊页里没配游戏目录会先出初始化向导:填新月杀
(FreeKill)本体目录(**同时含 `packages/` 与 `lua/` 的那层**,例如
`D:\games\FreeKill-release`),或者点「自动扫描」。配置保存在
`~/.dsh/xinyue-kit.json`,之后随时可以在工坊「⚙ 设置」页改。

不配置也能用:写入方式选「手动复制」,AI 只生成代码不落盘。

## 使用

新建会话时建议选「新月杀开发模式」preset:十一个新月杀工具在该模式下常驻可用(xinyue_doc_index / xinyue_api_lookup / xinyue_match_assets 也已常驻),
开发规范(确认协议、区块化读写、检索纪律)也随之注入。普通会话默认没有这些
工具——技术上可以通过 dev_tool_search 按需解锁,但规范不会跟着来,所以还是
建议挂对模式。

「新月杀工坊」页签里建任务:选类型(武将/卡牌/🎲 新玩法自定义模式)、写法(老版
game.import / 新版 ES Module;🎲 新玩法固定新版)、填技能描述或玩法描述。🎲 新玩法
交付的是一个可用游戏主菜单进入的独立模式:填一句话核心玩法 + 自由描述玩法细节,
AI 会先探测引擎版本、把描述逐条拆成规则再给确认单。提交后 AI 会先给需求理解确认,
有歧义会先提问;收到明确的「确认」回复后才会动笔——写完自动校验、写入,并提醒进游戏测试。

游戏里发现问题就在任务列表点「🔁 反馈」,把现象或报错发给 AI;每轮反馈自动
累计轮次。新建任务在逐技能(🎲 新玩法为逐条规则)确认无误、图片也就位后自动归档
(任务里登记了配音的,还要等配音复制进包;🎲 新玩法无立绘/卡图,不强制补图);
编辑已有条目的任务不强制补图,技能全部确认后即归档。

配音支持:表单技能行可填本地 mp3,武将还能填阵亡语音;AI 写技能时带音频字段,
并把文件复制进扩展包 audio/skill/、audio/death/ 目录——配音文件只进扩展包,
绝不写游戏本体目录。阵亡语音是零代码的,文件放对就生效。

选素材不用再手抄路径:图片、阵亡语音、技能配音、任务卡的「📷 补图 / 🎵 补配音」
都接同一个文件选择器——常用位置(桌面/下载/图片/文档/盘符)+ 路径栏 + 文件名过滤,
点着挑;配音可多选并当场改包内文件名(技能配音还要选归属技能)。选择器只读、只列
一层目录,不递归、不写入。

武将元信息:新建武将时可填称号 / 设计(designer) / 配音(cv) / 画师(illustrator),
默认「官方」——按字面写进翻译表的 `["#<武将ID>"]`、`["designer:<武将ID>"]`、
`["cv:<武将ID>"]`、`["illustrator:<武将ID>"]` 四个键。编辑已有武将时这四栏默认留空,
留空即不改原值。

已有的扩展包不用从零开始:任务模式选「📂 编辑已有扩展包」,选中扩展包后照常
走确认协议。老文件可以先点「🔨 建立区块索引」,给条目所在的 Lua 文件插入锚点
注释(只加注释行、自动备份;多文件包会对每个含条目的文件逐一处理),之后 AI
按区块读写,不必每次翻整个文件。

编辑已有武将/卡牌时,选中目标就会列出它关联的技能:勾选要修改的技能、在旁边
写清改成什么,每个勾选的技能都是一个独立的任务节点,可以单独确认和反馈;
「改动描述」留给武将本身的变化(体力、护甲、名称等)。编辑任务不强制补图,
技能全部确认后任务即自动完成。编辑 🎲 新玩法包则没有条目下拉:直接用「模式骨架
改动」+「新增或调整的规则」描述想要的变化,AI 读完整个包的现状后逐条给确认单。

### 十四个 AI 工具

| 工具 | 作用 |
|---|---|
| xinyue_search_reference | 在本地游戏源码里搜官方相似实现(纯读) |
| xinyue_api_lookup | 查引擎符号:事件名/方法签名/枚举常量/状态技字段 + 官方用例(带拼写建议) |
| xinyue_validate | 语法编译检查 + 静态规则校验 + 语义校验(引擎里查不到的符号/参数键/字段以警告列出) |
| xinyue_read_package | 读扩展包当前代码(先读后改) |
| xinyue_write_package | 唯一写入通道:先校验,error 拒写,覆盖前自动备份,写后给改动摘要与回滚路径;区块模式增删改都行(`deletes` 用 `kind:id` 精确指,写裸 id 而命中多个块时报歧义) |
| xinyue_delete_file | 删扩展包内的单个文件(.lua/.md/.txt/.json),删前先备份,可回滚 |
| xinyue_match_assets | 素材文案与目录里实际文件名做模糊匹配(全角/半角、标点、笔误),列出未匹配与未被认领的文件 |
| xinyue_kingdom_assets | 生成自定义势力的五张图(徽记 75×75 / 体力晶石 22×27 / 双将左右 13×20 / 卡背 175×233),尺寸按引擎实际绘制口径 |
| xinyue_skills_written | 标记技能「已写入待测试」,全部确认后自动收口(新建任务还需图片/配音就位) |
| xinyue_record_change | 记一条「自由修改」流水(素材、跨包调整、临时修复等装不进武将任务的工作),写进包内 history |
| xinyue_copy_images | 把本地图片复制进扩展包 image/generals、image/card、image/anim、image/kingdom、image/mark 目录 |
| xinyue_copy_audio | 把本地配音 mp3 复制进扩展包 audio/skill、audio/death 目录(不碰本体) |
| xinyue_read_doc | 读《新月杀之书》官方文档的指定章节(rST 原文) |
| xinyue_doc_index | 《新月杀之书》章节地图(八大部分 × 章节 × 关键词 + 按任务找章节),读文档前先查它 |

### 代码结构

| 位置 | 职责 |
|---|---|
| `index.js` | 只做装配:读配置 → 拼常驻规范 → `registerTools()` → 注册守卫 → `createApiHandler()` |
| `src/tools.js` | 14 个 AI 工具的定义(参数 schema、输出 schema、渲染器) |
| `src/api.js` | 工坊 HTTP API(`/xinyue-kit-api/*`,26 条路由 + Origin/CSRF 校验) |
| `src/guard.js` | `packages/` 写保护(路径归一化、bash 命令分析) |
| `src/write.js` `src/blocks.js` | 锚点区块读写、备份与回滚 |
| `src/reference.js` | 官方源码/文档检索 + `docOutline()`(章节地图) |
| `knowledge/fkbook/` | 随插件附带的《新月之书》+ `OUTLINE.md` 归纳 + `outline.json` 章节表 |
| `client.js` | 工坊界面(React,经 `window.__ModuleLoader__` 注册) |

改工具去 `src/tools.js`,改接口去 `src/api.js`,改界面去 `client.js`——`index.js` 不实现业务。
`active` / `xinyueDir` 以 **getter** 注入工具与 API,工坊里改完游戏目录后当前进程立即生效。

备份不再写进扩展包:**<DSH_HOME>/xinyue-kit/backups/<包>/<子目录>/<文件>.<时间戳>.lua**
(以前写在包内 `<包>/backup/`,会让联机时的 git 工作区变脏)。

普通 write/edit/bash 对游戏 packages/ 目录的写入会被守卫拒绝,不用担心
AI 绕过校验直接改文件(读、搜、看目录完全不受限)。

### 随插件自动安装的 skill

写技能有另一份**按需加载**的速查卡(标记可见性 `@` / `@@`、常用 room API 的
`文件:行` 出处、写入通道的坑):正文随插件发布,插件每次加载时按内容差异覆盖到
`<dsh home>/skills/freekill-skill-authoring/SKILL.md`(user 级 skills 根,任何
工作区的会话都能用)。它不进 system prompt——常驻会白吃每个会话的上下文,所以
规范里只放一行指针,需要时再 `skill` 加载。升级插件即升级这份速查卡。

## 「新月杀开发模式」preset

presets/xinyue-dev 是一个 Zero-Anchored 架构的 agent preset(参考
xiaobright/dsh-anchored-standard,MIT):首轮不开放任何工具,之后常驻集只保留
shell、编辑器和上述工具,web 等重工具按需解锁;完整开发规范走 skill 按需
加载,不占 system prompt。

## 更新

工坊「⚙ 设置」页顶部是「版本与一致性」,两块各管一件事:

- **插件**:显示当前版本,有新版本时给出升级命令(只提示,不自动更新)。升级命令是
  `dsh plugin --profile web add dsh-xinyue-kit@<版本号>`(指名版本可自动通过 pnpm 的
  发布冷却期;不带版本的 update 会被冷却期静默挡住)。link 方式加载的插件不参与
  版本检测(加载的就是源码目录本身)。DSH 0.2.0(桌面版)起也可以在官方「插件」
  面板里卸载后重装来升级。
- **开发模式 preset**:preset 是插件行为的第二份副本(人格、常驻工具名单、技能文档),
  插件更新后不重装它会拿到自相矛盾的指令,而且不报错——所以单独盯一行。发现不一致
  点「♻️ 重装 preset」即可(覆盖前自动备份成 `xinyue-dev.bak-<时间戳>`);装完对
  新建会话生效。

任一项有问题时,输入条上的 🛠 按钮会带一个小红点。版本信息从 npm registry 和
GitHub tag 取,查不通只显示一行「检查失败」,不影响使用;「启动时自动检查」可以在
设置页关掉,改成手动点。

## 已知限制

- 新建会话发第一条消息前,顶部页签栏不显示——这是 DSH 空白会话的官方设计,
  发一条消息就出来了。
- 插件的 HTTP API 随 Web 服务暴露,只建议本机使用。
- 运行期错误(逻辑对不对)插件管不了,仍要进游戏验证后走「问题反馈」。
- 立绘/卡图按 FreeKill 约定放包内 `image/generals/`、`image/card/` 子目录,
  武将/卡牌定义里要显式写图片字段,工坊的任务流程和规范文本里都有说明。
- 技能配音放包内 `audio/skill/`、阵亡语音放 `audio/death/`(注意是 death 不是
  die);音频只进扩展包,绝不写游戏本体 audio/ 目录,工坊的复制工具会自动落到
  这两个子目录。
- 新月杀是 Lua、一个技能一个文件(包内 `init.lua` + `skills/<技能id>.lua`)已支持
  区块化编辑:按 Lua 语句划分区块、无锚文件也能虚拟划分,读写按文件进行。仍不支持
  完全动态拼出来的 id(`name = 变量`且变量不是字面量,条目没有可锚的文本)。

## 测试

```sh
node scripts/test-api.mjs         # 工坊 HTTP 路由(状态码 / CSRF / 404),7 项
node scripts/test-tools.mjs       # 14 个工具注册完整性 + 离线可执行工具,10 项
node scripts/test-tasks.mjs       # 任务状态机(含配音门禁、备份往返)
node scripts/test-audio.mjs       # 配音复制与目标校验,15 项
node scripts/test-blocks.mjs      # Lua 锚点区块读写,114 项
node scripts/test-engine-api.mjs  # 引擎符号索引,29 项
node scripts/test-fkbook.mjs      # 《新月之书》索引与原文读取,24 项
node scripts/test-guard.mjs       # packages 与扩展包目录写保护,63 项
node scripts/test-preset.mjs      # preset 自检与安装,97 项
node scripts/test-update.mjs      # 版本比较与更新检查,132 项
node scripts/test-detect.mjs      # 游戏目录探测,10 项
node scripts/test-kingdom.mjs     # 势力图生成,12 项
node scripts/test-match-assets.mjs # 素材模糊匹配,19 项
node scripts/test-fs-browse.mjs   # 文件选择器的目录浏览,30 项
node scripts/test-history.mjs     # 历史记录与备份,7 项
node scripts/test-ui-calls.mjs    # 界面调用形态静态扫描,6 项
```
`scripts/` 下 16 个脚本合计 500+ 项断言,全绿;`test-tools.mjs` 依赖一个本地
`@deepseek-ai/dsh-tools` 恒等桩(仅开发副本,不进安装包),真实 `defineTool` 由宿主提供。

## 反馈

插件有问题欢迎提 [issue](https://github.com/ykwingking/dsh-xinyue-kit/issues),附上复现步骤和报错更好。


## 卸载

```sh
dsh plugin --profile web remove dsh-xinyue-kit
```

MIT License
