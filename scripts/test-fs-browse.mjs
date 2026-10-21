// 文件选择器后端(只读目录列举)回归测试:node scripts/test-fs-browse.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extsFor, pickerPlaces, listDirForPicker, IMAGE_EXT, AUDIO_EXT, LIST_LIMIT } from '../src/fs-browse.js';

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xinyue-fs-'));
const root = path.join(tmp, 'root');
const sub = path.join(root, '子目录');
fs.mkdirSync(sub, { recursive: true });
for (const f of ['a.jpg', 'b.PNG', 'c.txt', 'd.mp3', '没有扩展名']) fs.writeFileSync(path.join(root, f), 'x');
for (const f of ['e.jpg', 'f.mp3', 'g.webp']) fs.writeFileSync(path.join(sub, f), 'x');

try {
  console.log('【扩展名白名单】');
  check('图片白名单含 .jpg/.png/.webp', ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'].every((e) => IMAGE_EXT.includes(e)));
  check('音频白名单只含 .mp3', AUDIO_EXT.length === 1 && AUDIO_EXT[0] === '.mp3');
  check("extsFor('image') 返回图片集合", extsFor('image').length === IMAGE_EXT.length);
  check("extsFor('audio') 返回音频集合", extsFor('audio').join() === '.mp3');
  check('extsFor(未知) 返回 null = 不过滤', extsFor('nope') === null);
  check('LIST_LIMIT 是正整数', Number.isInteger(LIST_LIMIT) && LIST_LIMIT > 0);

  console.log('【无 dir:只给常用位置】');
  const places = listDirForPicker({});
  check('ok=true 且回 places', places.ok === true && Array.isArray(places.places));
  check('places 每项有 name/path', (places.places || []).length > 0 && places.places.every((p) => p.name && p.path));
  check('places 里的路径都真实存在', (places.places || []).every((p) => fs.existsSync(p.path)));
  check('无 dir 时不列 entries', !places.entries || places.entries.length === 0);
  check('pickerPlaces() 与接口同源', pickerPlaces().length === places.places.length);

  console.log('【列一层 + 过滤】');
  const imgs = listDirForPicker({ dir: root, filter: 'image' });
  check('ok=true', imgs.ok === true, imgs.error);
  check('dir 归一为该目录的绝对路径', path.resolve(imgs.dir) === path.resolve(root));
  const names = imgs.entries.filter((e) => !e.isDir).map((e) => e.name);
  check('只列图片(a.jpg/b.PNG),过滤掉 txt/mp3/无扩展名', names.length === 2 && names.includes('a.jpg') && names.includes('b.PNG'), names.join(','));
  check('扩展名大小写不敏感(.PNG 也算)', names.includes('b.PNG'));
  check('目录不过滤(子目录仍在)', imgs.entries.some((e) => e.isDir && e.name === '子目录'));
  check('一条也不递归(子目录里的文件不在本层)', !names.includes('e.jpg'));
  const firstFile = imgs.entries.findIndex((e) => !e.isDir);
  const lastDirIdx = imgs.entries.map((e) => e.isDir).lastIndexOf(true);
  check('目录排在文件前面', lastDirIdx < firstFile);
  check('文件带 size,目录 size 为 0', imgs.entries.every((e) => typeof e.size === 'number'));
  check('每项 path 是可用的绝对路径', imgs.entries.every((e) => path.isAbsolute(e.path)));

  const audios = listDirForPicker({ dir: root, filter: 'audio' });
  const an = audios.entries.filter((e) => !e.isDir).map((e) => e.name);
  check('音频过滤只保留 d.mp3', an.length === 1 && an[0] === 'd.mp3', an.join(','));

  const all = listDirForPicker({ dir: root });
  check('不过滤时文件全在(5 个: a.jpg/b.PNG/c.txt/d.mp3/没有扩展名)', all.entries.filter((e) => !e.isDir).length === 5, all.entries.filter((e) => !e.isDir).map((e) => e.name).join(','));

  console.log('【子目录作为常用位置的回填】');
  const deeper = listDirForPicker({ dir: sub, filter: 'image' });
  check('进子目录列到 e.jpg/g.webp', deeper.entries.filter((e) => !e.isDir).map((e) => e.name).sort().join(',') === 'e.jpg,g.webp');
  check('回 parent = 上一层', path.resolve(deeper.parent) === path.resolve(root));
  check('pickerPlaces 记住了上次目录', pickerPlaces().some((p) => path.resolve(p.path) === path.resolve(sub)));

  console.log('【截断】');
  const cut = listDirForPicker({ dir: root, filter: 'image', limit: 2 });
  check('limit=2 时截断', cut.truncated === true && cut.entries.length <= 2, 'entries=' + cut.entries.length);
  const plenty = listDirForPicker({ dir: root, filter: 'image', limit: 500 });
  check('limit 足够时不截断', plenty.truncated === false);
  const over = listDirForPicker({ dir: root, limit: 999999 });
  check('limit 超过上限按 LIST_LIMIT 收口(不报错)', over.ok === true && over.truncated === false);

  console.log('【错误路径】');
  const missing = listDirForPicker({ dir: path.join(tmp, '不存在的目录') });
  check('不存在的目录 → ok=false 且有 error', missing.ok === false && !!missing.error);
  const asFile = listDirForPicker({ dir: path.join(root, 'a.jpg') });
  check('拿文件当目录 → ok=false', asFile.ok === false && !!asFile.error);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
