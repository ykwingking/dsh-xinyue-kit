#!/usr/bin/env node
/*
 * test-guard.mjs —— 守卫(packages 扩展包目录写保护)回归用例。
 *
 * 背景:早期守卫是纯字符串包含比对,实测四类写法全部绕过(正斜杠 / git-bash
 * 盘符 / cd 后相对写 / 进程 cwd 与会话 cwd 不同时的相对路径)。本测试把
 * 「必须拦」与「必须放行」两类形态都钉死,防止以后再退化。
 *
 * 运行: node scripts/test-guard.mjs
 */
import { bashGuardReason, pathHitsProtected, isProtectedPath, msysToNative, normalizePath, guardMessage } from '../src/guard.js'

// 用不存在的盘符做测试根:路径判定纯字符串运算,不需要真实文件
const GAME = 'D:\\games\\freekill\\resources\\app'
const ROOT = GAME + '\\packages'
const bases = [GAME, 'D:\\games', 'C:\\work']

let pass = 0
const fails = []
function check(name, ok, detail) {
  if (ok) { console.log('  ✓ ' + name); pass++ } else { console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); fails.push(name) }
}

console.log('路径归一化')
check('msys 盘符转原生', msysToNative('/d/games/x') === 'D:\\games\\x')
check('反斜杠归一化小写', normalizePath('D:/Games/FreeKill/') === 'd:\\games\\freekill')
check('.. 折叠', normalizePath('D:/games/freekill/../other') === 'd:\\games\\other')
check('保护根内的子路径命中', isProtectedPath(ROOT + '\\pk\\init.lua', ROOT))
check('保护根本身命中', isProtectedPath(ROOT, ROOT))
check('同前缀不同目录不命中', !isProtectedPath(GAME + '\\packages-backup\\x.lua', ROOT))
check('游戏本体不命中', !isProtectedPath(GAME + '\\lua\\x.lua', ROOT))

console.log('\nbash:必须拦')
const mustBlock = [
  ['反斜杠原样写', `echo x > D:\\games\\freekill\\resources\\app\\packages\\pk\\init.lua`],
  ['正斜杠写', 'echo x > D:/games/freekill/resources/app/packages/pk/init.lua'],
  ['git-bash 盘符写', 'echo x > /d/games/freekill/resources/app/packages/pk/init.lua'],
  ['cd 后相对写', 'cd "D:/games/freekill/resources/app/packages/pk" && echo x > init.lua'],
  ['rm -rf 正斜杠', 'rm -rf "D:/games/freekill/resources/app/packages/pk"'],
  ['sed -i 就地改', 'sed -i "s/a/b/" /d/games/freekill/resources/app/packages/pk/init.lua'],
  ['cp 进扩展包目录', 'cp /tmp/x.lua "D:\\games\\freekill\\resources\\app\\packages\\pk\\x.lua"'],
  ['相对写(基准=游戏目录)', 'echo x > packages/pk/init.lua'],
  ['无空格重定向', 'echo x>D:/games/freekill/resources/app/packages/pk/init.lua'],
  ['sudo 前缀', 'sudo rm -rf D:/games/freekill/resources/app/packages/pk'],
  ['xargs 管道', 'ls /tmp | xargs rm -rf D:/games/freekill/resources/app/packages/pk'],
  ['子壳 sh -c', 'sh -c "rm -rf D:/games/freekill/resources/app/packages/pk"'],
  ['子壳里 cd 后相对写', 'bash -c "cd D:/games/freekill/resources/app/packages/pk && echo x > init.lua"'],
  ['find -delete', 'find D:/games/freekill/resources/app/packages -name "*.lua" -delete'],
  ['node -e 写文件', `node -e "require('fs').writeFileSync('D:/games/freekill/resources/app/packages/pk/x.lua','x')"`],
  ['python -c 写文件', `python -c "open(r'D:/games/freekill/resources/app/packages/pk/x.lua','w').write('x')"`],
  ['perl -i 就地改', 'perl -pi -e "s/a/b/" D:/games/freekill/resources/app/packages/pk/init.lua'],
  ['git checkout 还原', 'cd D:/games/freekill/resources/app/packages/pk && git checkout -- init.lua'],
  ['touch 新建', 'touch D:/games/freekill/resources/app/packages/pk/new.lua'],
  ['mkdir 建目录', 'mkdir -p D:/games/freekill/resources/app/packages/pk/sub'],
  ['无空格重定向(cd 后)', 'cd D:/games/freekill/resources/app/packages/pk && echo x>init.lua'],
]
for (const [name, cmd] of mustBlock) {
  const reason = bashGuardReason(cmd, ROOT, bases)
  check(name, Boolean(reason), '竟然放行了:' + cmd)
  if (reason) check('  ↳ 提示含出路', guardMessage(reason).includes('xinyue_write_package'))
}

/* 已知取舍:守卫对「改文件命令」只看命令里有没有保护路径,不看源/目标方向——
 * `cp -r <扩展包> /tmp/bak`(拷出去)也会被拦。刻意如此:守卫是安全边界,
 * 多拦一次用户确认即可,漏拦一次就是无备份直改扩展。取证式读取用不带写动作的
 * 纯读命令(见下),不受影响。 */
console.log('\nbash:必须放行')
const mustAllow = [
  ['纯读 grep', 'grep -n "foo" /d/games/freekill/resources/app/packages/pk/init.lua'],
  ['纯读 cd 进目录 + ls/cat', 'cd "D:/games/freekill/resources/app/packages/pk" && ls -la && cat init.lua'],
  ['纯读 find', 'find /d/games/freekill/resources/app/packages -name "*.lua"'],
  ['写游戏本体 lua/', 'echo x > D:/games/freekill/resources/app/lua/test.lua'],
  ['写临时目录', 'echo x > /tmp/t.lua'],
  ['写用户目录', 'echo x > ~/.dsh/xinyue-kit.json'],
  ['写扩展包备份目录', 'echo x > D:/games/freekill/resources/app/packages-backup/x.lua'],
  ['cd 进扩展包目录后把输出写去 /tmp(取证式读取,应放行)', 'cd D:/games/freekill/resources/app/packages/pk && grep -n "audio" init.lua > /tmp/audio.txt'],
]
for (const [name, cmd] of mustAllow) {
  const reason = bashGuardReason(cmd, ROOT, bases)
  check(name, reason === null, '误拦:' + (reason || ''))
}

console.log('\nwrite/edit 路径参数')
const pathCases = [
  ['绝对路径进扩展包', ROOT + '\\pk\\init.lua', GAME, true],
  ['正斜杠绝对路径', 'D:/games/freekill/resources/app/packages/pk/init.lua', GAME, true],
  ['会话 cwd 下的相对扩展包路径', 'packages/pk/init.lua', GAME, true],
  ['同前缀不同目录', GAME + '\\packages-backup\\x.lua', GAME, false],
  ['家目录', 'C:\\Users\\x\\.dsh\\xinyue-kit.json', GAME, false],
  ['会话 cwd 下的普通相对路径', 'src/foo.js', GAME, false],
]
for (const [name, p, cwd, want] of pathCases) {
  check(name, pathHitsProtected(p, ROOT, [cwd]) === want)
}

console.log('\n' + (fails.length === 0 ? '全部通过:' + pass + ' 项' : '失败 ' + fails.length + ' 项:' + fails.join('、')))
if (fails.length) process.exit(1)
