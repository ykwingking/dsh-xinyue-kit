# knowledge/fkbook —— 新月杀官方文档《新月之书》(for-creators)

这是 **插件自带的官方文档数据**,供 `xinyue_search_reference(type='doc')` 与
`xinyue_read_doc` 检索/读取。**它不是游戏源码**,也不是玩家写的扩展包。

## 来源

| 项 | 值 |
| --- | --- |
| 文档名 | 新月之书 / FreeKill Book(`fkbook-all-in-one`) |
| 来源仓库 | https://gitee.com/Qsgs-Fans/fkbook-all-in-one |
| 在线阅读 | https://fkbook-all-in-one.readthedocs.io/ |
| 收进来的子目录 | `for-creators/`(**写给拓展主**那一册;仓库其余目录 about / develop / for-devs / for-players / for-server-hosts / for-boardgame-creators / freekill-core 一律没收) |
| 快照时间 | 2026-05-19 04:31:56(解压出来的压缩包内时间戳,全部文件一致,无法据此判断上游 commit) |
| 上游 commit | 未知 —— 拿到的是打包好的 `fkbook-all-in-one-master.zip`,不带 `.git`,因此无法记录 commit;需要精确追溯请重新从上面的仓库 clone |
| 落库时间 | 2026-10-12,由 `scripts/build-fkbook.mjs` 复制 |

## 覆盖范围(实测)

- **72 个文本文件 / 290,253 字节**(`.rst` 66 个 + `.lua` 6 个)
- 目录结构原样保留:`anhe/`(安河教程 17 篇)、`rule/`(结算规则)、`new-to-lua/`(Lua 语言基础)、
  `misc/`(AI 重制 / lua-and-qml / 模式配置 / 皮肤包 / 任务 / 标记横幅)、`api-reference/`、
  根目录 4 篇(`create-fk-mod.rst`、`create-resource-pak.rst`、`index.rst`、`terminology.rst`)
- **图片与音频一律没收**:`.jpg` 63 个、`.png` 10 个、`.mp3` 2 个(以及 `pic/`、`anhe/pic/`、
  `new-to-lua/pic/` 三个纯图片目录)全部跳过
- `.lua` 只有 6 个:`anhe/example/{init,xuexi}.lua`(一份能跑的示例扩展包)与
  `new-to-lua/studylua/{hello,if,loop,func}.lua`(教学脚本)

## 格式

`.rst` **保持原格式,没有转 markdown**。rST 的 `===` / `---` / `~~~` 标题、`::` 代码块、
`.. note::` 等标记对模型来说可读性足够,而转换(尤其表格、列表、指令)只会丢内容。

## index.json

`index.json` 是**分节索引**,由 `scripts/build-fkbook.mjs` 解析每个 `.rst` 的标题层级生成:

```json
{
  "id": "fkbook/rule/03-event.rst#事件与时机",
  "file": "fkbook/rule/03-event.rst",
  "line": 1,
  "endLine": 103,
  "level": 1,
  "title": "事件与时机",
  "path": [],
  "chars": 1578
}
```

- `id` —— 稳定且唯一:`<相对插件根的文件路径>#<小节标题>`;同文件内标题重名时追加 `-2`、`-3`。
  可以用 `xinyue_read_doc(id='fkbook/rule/03-event.rst#事件与时机')` 直接读回该节全文。
- `file` —— **相对插件根**(`fkbook/...`),不泄露本机绝对路径。
- `line` / `endLine` —— 1-based,`line` 是标题行,`endLine` 是独占结束行。
- `level` —— 标题层级,按**该标点在本文件内首次出现的顺序**判定
  (rST 标准做法;实测各文件用 `+` / `^` 表示第几层并不统一,写死字符表会错位)。
- `path` —— **祖先章节路径**(不含自身;顶层为 `[]`)。
- `chars` —— 该节正文字符数。

当前规模:**72 个文件 / 299 个小节**(level 1:73、2:136、3:83、4:7)。
注意 level 1 有 73 条而文件只有 72 个:`new-to-lua/17-if.rst` 等文件在同一文件里
出现两个顶层标题属于文档本身的写法,不是解析错误。

## 怎么重新生成

```sh
# 文档已经在库里,只重建 index.json
node scripts/build-fkbook.mjs

# 从新解压的 for-creators 重新同步文档 + 重建索引
node scripts/build-fkbook.mjs /path/to/fkbook-all-in-one-master/for-creators
```

脚本全程用 node 的 fs 以 UTF-8 读写;`.rst` 是二进制级原样复制。
**不要**用 PowerShell `Get-Content` / `Set-Content` 处理这些文件(PS 5.1 按 GBK 解码会毁掉中文)。
