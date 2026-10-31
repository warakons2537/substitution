// node tests/perm.test.mjs — ตรวจว่าแต่ละหน้าที่เห็นเมนู/ระบบ (โมดูล) ถูกต้อง
import assert from 'node:assert/strict';
const { has, roleOf, pagesFor, modulesFor, landing } = await import('../js/perm.js');
const me = (duties, teacher = 'ครูทดสอบ') => ({ duties, teacher });
const hashes = (m, mod) => pagesFor(m).filter((p) => !mod || p[2] === mod).map((p) => p[0]);
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('✓', name); };

t('ครูทั่วไป: ยื่นลา/ดูของตัวเอง/สอนแทนของฉัน — ไม่เห็นหน้าจัดการ', () => {
  const h = hashes(me([]));
  for (const x of ['home', 'request', 'mine', 'leaves', 'mysubs', 'summary', 'profile']) assert.ok(h.includes(x), x);
  for (const x of ['approvals', 'leave-settings', 'assist', 'requests', 'records', 'import', 'reports', 'users', 'settings', 'audit']) assert.ok(!h.includes(x), x);
  assert.deepEqual(modulesFor(me([])), ['leave', 'sub']);
});
t('ฝ่ายวิชาการ: จัดสอนแทนได้ แต่ไม่เห็นตรวจ/อนุญาตและตั้งค่าการลา', () => {
  const h = hashes(me(['academic']));
  for (const x of ['assist', 'requests', 'records', 'import', 'reports']) assert.ok(h.includes(x), x);
  for (const x of ['approvals', 'leave-settings', 'users']) assert.ok(!h.includes(x), x);
  assert.equal(landing(me(['academic']), 'sub'), 'requests');
});
t('งานบุคคล: ตรวจใบลา/ตั้งค่าการลา/รายงาน — ไม่จัดสอนแทน', () => {
  const h = hashes(me(['hr']));
  for (const x of ['approvals', 'leaves', 'leave-settings', 'reports']) assert.ok(h.includes(x), x);
  for (const x of ['assist', 'requests', 'records', 'import', 'users']) assert.ok(!h.includes(x), x);
  assert.equal(landing(me(['hr']), 'leave'), 'approvals');
});
t('ผู้อำนวยการ: อนุญาตใบลาได้ แต่ไม่แก้ตั้งค่า', () => {
  const h = hashes(me(['director']));
  assert.ok(h.includes('approvals')); assert.ok(h.includes('reports')); assert.ok(!h.includes('leave-settings')); assert.ok(!h.includes('assist'));
});
t('ผู้ดูแลระบบ: เห็นทุกหน้า ทุกระบบ', () => {
  const m = me(['admin']);
  assert.deepEqual(modulesFor(m), ['leave', 'sub', 'admin']);
  for (const x of ['approvals', 'leave-settings', 'assist', 'users', 'settings', 'audit']) assert.ok(hashes(m).includes(x), x);
  assert.ok(has(m, 'hr') && has(m, 'director') && has(m, 'academic'));
});
t('หลายหน้าที่ในคนเดียว (วิชาการ + งานบุคคล)', () => {
  const m = me(['academic', 'hr']);
  assert.ok(has(m, 'academic') && has(m, 'hr') && !has(m, 'director') && !has(m, 'admin'));
  for (const x of ['assist', 'approvals', 'leave-settings']) assert.ok(hashes(m).includes(x), x);
});
t('ผู้ใช้ที่ไม่ได้ผูกชื่อครู ไม่เห็นหน้ายื่นลา/สอนแทนของฉัน', () => {
  const h = hashes(me(['hr'], ''));
  assert.ok(!h.includes('request') && !h.includes('mysubs')); assert.ok(h.includes('approvals'));
});
t('roleOf: คำนวณบทบาทเดิมจากหน้าที่', () => {
  assert.equal(roleOf(['hr', 'admin']), 'admin'); assert.equal(roleOf(['academic', 'hr']), 'academic'); assert.equal(roleOf(['hr']), 'requester'); assert.equal(roleOf([]), 'requester');
});
console.log(`\nผ่านทั้งหมด ${n} รายการ`);
