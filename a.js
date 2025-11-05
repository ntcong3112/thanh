// replace-images-inplace.js
// Usage: node replace-images-inplace.js [path/to/index.html]
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.resolve(process.cwd(), 'index.html');
if (!fs.existsSync(inputPath)) {
  console.error('Không tìm thấy file:', inputPath);
  process.exit(1);
}

// pool 30 ảnh ./images/1.jpg ... ./images/30.jpg
const POOL = Array.from({ length: 30 }, (_, i) => `./images/${i + 1}.jpg`);
const isImgUrl = (u) => /\.(jpe?g|png)(\?[^#]*)?(#.*)?$/i.test(u || '');

const seen = new Map(); // giữ mapping ổn định: URL gốc -> ảnh thay
let idx = 0;
const nextImg = () => (idx < POOL.length ? POOL[idx++] : POOL[Math.floor(Math.random() * POOL.length)]);
const replaceValue = (u) => {
  if (!seen.has(u)) seen.set(u, nextImg());
  return seen.get(u);
};

// đọc & backup
const html = fs.readFileSync(inputPath, 'utf8');
const backupPath = inputPath + '.bak';
fs.writeFileSync(backupPath, html, 'utf8'); // backup

let out = html;

// 1) <img ... src="...">
out = out.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi, (m, p1, quote, url) => {
  if (!isImgUrl(url)) return m;
  const rep = replaceValue(url);
  return `${p1}${quote}${rep}${quote}`;
});

// 2) bất kỳ thẻ có srcset="..."
out = out.replace(/(<\w+\b[^>]*\bsrcset\s*=\s*)(["'])([^"']+)\2/gi, (m, p1, quote, srcsetVal) => {
  // lấy candidate đầu tiên trong srcset
  const first = (srcsetVal.split(',')[0] || '').trim().split(/\s+/)[0];
  if (!isImgUrl(first)) return m;
  const rep = replaceValue(first);
  return `${p1}${quote}${rep} 1x${quote}`;
});

// 3) <a ... href="..."> (trỏ tới ảnh)
out = out.replace(/(<a\b[^>]*\bhref\s*=\s*)(["'])([^"']+)\2/gi, (m, p1, quote, href) => {
  if (!isImgUrl(href)) return m;
  const rep = replaceValue(href);
  return `${p1}${quote}${rep}${quote}`;
});

// 4) inline CSS background-image: url(...)
out = out.replace(/background-image\s*:\s*url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (m, q, url) => {
  if (!isImgUrl(url)) return m;
  const rep = replaceValue(url);
  return `background-image: url("${rep}")`;
});

// (Tuỳ chọn) thay url(...) trong thuộc tính style nói chung (khi không có 'background-image:' rõ ràng)
out = out.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (m, q, url) => {
  // chỉ thay nếu xung quanh có style=... và là ảnh
  if (!isImgUrl(url)) return m;
  const rep = replaceValue(url);
  return `url("${rep}")`;
});

fs.writeFileSync(inputPath, out, 'utf8');

console.log(`Đã sửa: ${inputPath}`);
console.log(`Backup: ${backupPath}`);
console.log(`Số URL ảnh gốc đã map: ${seen.size}`);
console.log('Ví dụ mapping 5 cái đầu:');
[...seen.entries()].slice(0, 5).forEach(([k, v]) => console.log(' -', k, '=>', v));
