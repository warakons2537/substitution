// node tools/vapid.mjs — สร้างกุญแจ Web Push (VAPID) + รหัสลับของ Edge Function ครั้งเดียว
// · กุญแจสาธารณะ → เขียนลง js/config.js (VAPID_PUBLIC_KEY) — เปิดเผยได้
// · กุญแจส่วนตัว + รหัสลับ → ไฟล์ .vapid-private.txt (อยู่ใน .gitignore ห้ามอัปโหลด) นำไปใส่ใน Supabase → Edge Functions → Secrets แล้วลบไฟล์ทิ้ง
// รันซ้ำ = กุญแจชุดใหม่ (อุปกรณ์ที่เคยเปิดแจ้งเตือนจะสมัครใหม่เองเมื่อเปิดแอป) ต้องใส่ --force
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const cfg = readFileSync('js/config.js', 'utf8');
if (/VAPID_PUBLIC_KEY = '[^']+'/.test(cfg) && !process.argv.includes('--force')) { console.error('มีกุญแจอยู่แล้วใน js/config.js — ถ้าต้องการสร้างชุดใหม่ให้ใส่ --force'); process.exit(1); }
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const j = privateKey.export({ format: 'jwk' });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(j.x, 'base64url'), Buffer.from(j.y, 'base64url')]).toString('base64url');
const secret = randomBytes(24).toString('base64url');
writeFileSync('js/config.js', /VAPID_PUBLIC_KEY = '[^']*'/.test(cfg) ? cfg.replace(/VAPID_PUBLIC_KEY = '[^']*'/, `VAPID_PUBLIC_KEY = '${pub}'`) : `${cfg}export const VAPID_PUBLIC_KEY = '${pub}';\n`);
writeFileSync('.vapid-private.txt', `# ห้ามอัปโหลด/ส่งต่อไฟล์นี้ — ใส่ค่าใน Supabase → Edge Functions → Secrets แล้วลบไฟล์\nVAPID_PUBLIC_KEY=${pub}\nVAPID_PRIVATE_KEY=${j.d}\nSUB_PUSH_SECRET=${secret}\n`, { mode: 0o600 });
console.log(`สร้างแล้ว · กุญแจสาธารณะอยู่ใน js/config.js · ค่าลับอยู่ในไฟล์ .vapid-private.txt${existsSync('.gitignore') ? '' : ' (อย่าลืมเพิ่มใน .gitignore)'}`);
void publicKey;
