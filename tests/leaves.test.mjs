// node tests/leaves.test.mjs — ทดสอบตรรกะนับวันลา/ปีงบประมาณ/ยอดใช้ไป/สรุปรายครู/สถิติรายงาน (ไม่ต้องติดตั้งอะไร)
import assert from 'node:assert/strict';
globalThis.window = { supabase: { createClient: () => ({}) } };
const { fiscalYear, fiscalRange, countDays, usage, fmtDays } = await import('../js/leaves.js');
const { summarize } = await import('../js/views/summary.js');
const { stats } = await import('../js/report.js');

let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('✓', name); };
const rules = (hol = [], types = {}) => ({ hset: new Set(hol), byType: types });

t('ปีงบประมาณ: ต.ค. เริ่มปีใหม่', () => {
  assert.equal(fiscalYear('2026-09-30'), 2569); assert.equal(fiscalYear('2026-10-01'), 2570); assert.equal(fiscalYear('2027-01-15'), 2570);
  assert.deepEqual(fiscalRange(2570), { from: '2026-10-01', to: '2027-09-30' });
});
t('นับวันทำการ: ข้ามเสาร์-อาทิตย์', () => {
  assert.equal(countDays(rules(), '2026-11-02', '2026-11-06', 'ลากิจ'), 5);   // จ.-ศ.
  assert.equal(countDays(rules(), '2026-11-06', '2026-11-09', 'ลากิจ'), 2);   // ศ.-จ.
  assert.equal(countDays(rules(), '2026-11-07', '2026-11-08', 'ลากิจ'), 0);   // ส.-อา.
});
t('หักวันหยุดที่ตั้งไว้', () => {
  assert.equal(countDays(rules(['2026-11-04']), '2026-11-02', '2026-11-06', 'ลากิจ'), 4);
});
t('ประเภทนับวันปฏิทินนับทุกวัน (ลาคลอด)', () => {
  assert.equal(countDays(rules(['2026-11-04'], { ลาคลอด: { calendar_days: true } }), '2026-11-01', '2026-11-10', 'ลาคลอด'), 10);
});
t('ครึ่งวัน = 0.5 · วันที่กลับด้าน = 0', () => {
  assert.equal(countDays(rules(), '2026-11-02', '2026-11-02', 'ลาป่วย', 'am'), 0.5);
  assert.equal(countDays(rules(), '2026-11-05', '2026-11-02', 'ลาป่วย'), 0);
});
t('ยอดใช้ไป: นับเฉพาะ pending/approved ในปีงบประมาณนั้น', () => {
  const L = [
    { leave_type: 'ลาป่วย', date_from: '2026-10-05', days: 2, status: 'approved' },
    { leave_type: 'ลาป่วย', date_from: '2026-11-05', days: 0.5, status: 'pending' },
    { leave_type: 'ลาป่วย', date_from: '2026-11-06', days: 3, status: 'cancelled' },
    { leave_type: 'ลาป่วย', date_from: '2026-09-01', days: 9, status: 'approved' },   // ปีงบก่อนหน้า
    { leave_type: 'ลากิจ', date_from: '2026-12-01', days: 1, status: 'rejected' },
  ];
  assert.deepEqual(usage(L, 2570), { ลาป่วย: { used: 2.5, count: 2 } });
  assert.equal(fmtDays(2.5), '2.5'); assert.equal(fmtDays(2), '2');
});
t('สรุปรายครู: ลา / ถูกสอนแทน / สอนแทนผู้อื่น', () => {
  const leaves = [{ teacher_name: 'ก', date_from: '2026-11-02', days: 1, status: 'approved' }, { teacher_name: 'ก', date_from: '2026-12-02', days: 1, status: 'approved' }];
  const recs = [
    { d: '2026-11-02', p: 1, a: 'ก', s: 'ข', st: 'confirmed' }, { d: '2026-11-02', p: 2, a: 'ก', s: 'ข', st: 'confirmed' },
    { d: '2026-11-02', p: 3, a: 'ก', s: '', st: 'confirmed' }, { d: '2026-11-02', p: 4, a: 'ก', s: 'ค', st: 'proposed' },
  ];
  const r = Object.fromEntries(summarize(leaves, recs, '2026-11-01', '2026-11-30').map((x) => [x.name, x]));
  assert.equal(r['ก'].leaves, 1); assert.equal(r['ก'].covered, 2); assert.equal(r['ข'].gave, 2); assert.equal(r['ค'], undefined);
});
t('รายงาน: คอลัมน์ประเภทการลาเฉพาะที่พบจริง', () => {
  const st = stats([{ sub_date: '2026-11-02', period: 1, absent_teacher: 'ก', leave_type: 'ลาป่วย', substitute_teacher: 'ข', subject: 'ค', grade: 'ป.1' }]);
  assert.deepEqual(st.types, ['ลาป่วย']);
});
console.log(`\nผ่านทั้งหมด ${n} รายการ`);
