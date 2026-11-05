// node tools/bump.mjs 2569.11.05-21 — ตั้งเลขเวอร์ชันใน config.js / index.html (css + import map ของไฟล์ js ทั้งหมด)
// import map ทำให้เบราว์เซอร์โหลด js ชุดใหม่ทันทีเมื่อเลขเปลี่ยน (ไม่ติดแคช 10 นาทีของ GitHub Pages)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const v = process.argv[2];
if (!/^\d{4}\.\d{2}\.\d{2}-\d+$/.test(v || '')) { console.error('ใช้: node tools/bump.mjs 2569.11.05-21'); process.exit(1); }
const files = [];
const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.js') && files.push(`${d}/${e.name}`)));
walk('js');
const map = JSON.stringify({ imports: Object.fromEntries(files.sort().map((f) => [`./${f}`, `./${f}?v=${v}`])) }, null, 1);
let h = readFileSync('index.html', 'utf8');
h = h.replace(/css\/app\.css\?v=[\d.\-]+/, `css/app.css?v=${v}`);
h = h.replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '');
h = h.replace('<script type="module" src="js/app.js"></script>', `<script type="importmap">${map}</script>\n<script type="module" src="js/app.js?v=${v}"></script>`);
writeFileSync('index.html', h);
writeFileSync('js/config.js', readFileSync('js/config.js', 'utf8').replace(/VERSION = '[^']*'/, `VERSION = '${v}'`));
console.log(`เวอร์ชัน ${v} · import map ${files.length} ไฟล์`);
