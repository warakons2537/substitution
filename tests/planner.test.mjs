// node tests/planner.test.mjs — ตัวช่วยจัดครูสอนแทน: วันหยุด · กติกาคาบคู่ · แลกคาบ · หมายเหตุคาบคู่
import assert from 'node:assert/strict';
globalThis.window = { supabase: { createClient: () => ({}) } };
const { buildItems, makeRanker, isSmallClass, dualRules, DUAL_DEFAULT, skippedHolidays, noteOf, stripDual, NONE } = await import('../js/planner.js');

let n = 0; const t = (name, fn) => { fn(); n += 1; console.log('✓', name); };

// ตารางสอนจำลอง: วันจันทร์ (d=0) คาบ 1
//  ครูก สอน ป.2/1 (ตึกA) · ครูข สอน ป.3/1 (ตึกA) · ครูค สอน ม.1/1 (ตึกA) · ครูง สอน ป.4/1 (ตึกC) · ครูจ ว่าง (ตึกA)
const data = {
  buildingOrder: ['ตึกA', 'ตึกB', 'ตึกC'], gradeBuildings: {},
  teachers: ['ครูก', 'ครูข', 'ครูค', 'ครูง', 'ครูจ'].map((name) => ({ name, building: name === 'ครูง' ? 'ตึกC' : 'ตึกA', active: true, pseudo: false })),
  slots: [
    { d: 0, p: 1, grades: ['ป.2/1'], subject: 'คณิต', teachers: ['ครูก'], building: 'ตึกA' },
    { d: 0, p: 1, grades: ['ป.3/1'], subject: 'ไทย', teachers: ['ครูข'], building: 'ตึกA' },
    { d: 0, p: 1, grades: ['ม.1/1'], subject: 'วิทย์', teachers: ['ครูค'], building: 'ตึกA' },
    { d: 0, p: 1, grades: ['ป.4/1'], subject: 'อังกฤษ', teachers: ['ครูง'], building: 'ตึกC' },
    { d: 0, p: 2, grades: ['ป.2/1'], subject: 'คณิต', teachers: ['ครูก'], building: 'ตึกA' },
  ],
};
const MON = '2026-11-23'; const MON2 = '2026-11-30';
const empty = { records: [], requests: [] };
const byName = (list) => Object.fromEntries(list.map((c) => [c.n, c]));
const item = (date = MON, p = 1) => buildItems(data, 'ครูก', [date], [p])[0];

t('ห้องเล็ก: ป.2/1 ใช่ · ป.12 ไม่ใช่ · ม.1 ไม่ใช่ · ทุกชั้นต้องเล็ก', () => {
  assert.equal(isSmallClass(['ป.2/1']), true);
  assert.equal(isSmallClass(['ป12']), false);
  assert.equal(isSmallClass(['ม.1/1']), false);
  assert.equal(isSmallClass(['ป.2/1', 'ม.1/1']), false);
  assert.equal(isSmallClass([]), false);
  assert.equal(isSmallClass(['ม.1/1'], ['ม1']), true);
});

t('กติกาจากตั้งค่า: ยังไม่รัน SQL = ค่าตั้งต้น · ค่าว่าง = ไม่จำกัด', () => {
  assert.deepEqual(dualRules({}), DUAL_DEFAULT);
  const r = dualRules({ dual_grades: 'ป.1, ป2,ม3', dual_both_small: false, dual_max_dist: 0, dual_max_day: null });
  assert.deepEqual(r, { grades: ['ป1', 'ป2', 'ม3'], bothSmall: false, maxDist: 0, maxDay: null });
});

t('ข้ามวันหยุด และบอกวันที่ข้าม', () => {
  const hol = new Map([[MON, 'วันหยุดทดสอบ']]);
  assert.equal(buildItems(data, 'ครูก', [MON, MON2], [], hol).length, 2);   // เหลือเฉพาะ MON2 (2 คาบ)
  assert.equal(buildItems(data, 'ครูก', [MON, MON2], []).length, 4);
  assert.deepEqual(skippedHolidays([MON, MON2, '2026-11-28'], hol), [[MON, 'วันหยุดทดสอบ']]);
});

t('คาบคู่: ห้องที่สอนอยู่ต้องเล็กด้วย (ค่าตั้งต้น) · ห้องใหญ่ไม่ได้', () => {
  const it = item();
  const c = byName(makeRanker(data, empty, 'ครูก', null)(it, [it]));
  assert.equal(c['ครูข'].dual, 1); assert.equal(c['ครูข'].ok, true);
  assert.equal(c['ครูค'].ok, false); assert.match(c['ครูค'].reasons[0], /ไม่ใช่ห้องเล็ก/);
  assert.equal(c['ครูจ'].ok, true); assert.equal(c['ครูจ'].dual, 0);
  // ปิดเงื่อนไข "ต้องเล็กทั้งคู่" -> ครูค เป็นคาบคู่ได้
  const c2 = byName(makeRanker(data, empty, 'ครูก', null, { ...DUAL_DEFAULT, bothSmall: false })(it, [it]));
  assert.equal(c2['ครูค'].dual, 1);
});

t('คาบคู่: จำกัดระยะตึก', () => {
  const it = item();
  const c = byName(makeRanker(data, empty, 'ครูก', null, { ...DUAL_DEFAULT, maxDist: 0 })(it, [it]));
  assert.equal(c['ครูข'].dual, 1);
  assert.equal(c['ครูง'].ok, false); assert.match(c['ครูง'].reasons[0], /คนละตึก/);
});

t('คาบคู่: ไม่เกินกี่คาบต่อวัน (นับรายการเดิม + ที่เลือกในหน้านี้)', () => {
  const rank = { records: [{ d: MON, p: 3, a: 'ครูอื่น', s: 'ครูข', st: 'confirmed', du: true }], requests: [] };
  const it = item();
  const c = byName(makeRanker(data, rank, 'ครูก', null, { ...DUAL_DEFAULT, maxDay: 1 })(it, [it]));
  assert.equal(c['ครูข'].ok, false); assert.match(c['ครูข'].reasons[0], /ครบ 1 คาบ/);
  const c2 = byName(makeRanker(data, rank, 'ครูก', null, { ...DUAL_DEFAULT, maxDay: 2 })(it, [it]));
  assert.equal(c2['ครูข'].dual, 1);
});

t('แลกคาบ: ไม่นับในความเป็นธรรม · ครูที่แลกคาบออกไปถือว่าว่าง ไม่ใช่ลา', () => {
  const rank = { records: [
    { d: MON, p: 1, a: 'ครูค', s: 'ครูจ', st: 'confirmed', lt: 'แลกคาบ' },      // ครูค แลกคาบ 1 ออกไป
    { d: MON, p: 2, a: 'ครูอื่น', s: 'ครูจ', st: 'confirmed', lt: 'ลาป่วย' },
  ], requests: [] };
  const it = item();
  const c = byName(makeRanker(data, rank, 'ครูก', null)(it, [it]));
  assert.equal(c['ครูค'].ok, true); assert.equal(c['ครูค'].dual, 0);   // ว่างเพราะแลกออกไปแล้ว
  assert.equal(c['ครูจ'].ok, false); assert.match(c['ครูจ'].reasons.join(), /แลกคาบมาสอน/);
  assert.equal(c['ครูจ'].week, 1);                                      // นับเฉพาะคาบที่ไม่ใช่แลกคาบ
});

t('ครูที่ลา (คำขอ/ทะเบียนการลา) ไม่อยู่ในกลุ่มคาบคู่ แม้มีสอนห้องเล็กคาบนั้น', () => {
  const it = item();
  // ครูข ลาจากคำขอ
  let c = byName(makeRanker(data, { records: [], requests: [{ id: 'x', t: 'ครูข', from: MON, to: MON, periods: [] }] }, 'ครูก', null)(it, [it]));
  assert.equal(c['ครูข'].ok, false); assert.equal(c['ครูข'].dual, 0);
  // ครูข ลาจากทะเบียนการลา (ไม่มีคำขอ) · ครึ่งวัน
  c = byName(makeRanker(data, { records: [], requests: [], leaves: [{ t: 'ครูข', from: MON, to: MON, h: 'am' }] }, 'ครูก', null)(it, [it]));
  assert.equal(c['ครูข'].ok, false); assert.equal(c['ครูข'].dual, 0); assert.match(c['ครูข'].reasons.join(), /ลาครึ่งวันเช้า/);
  // ครูจ (ว่าง) ลาในทะเบียน -> ไม่อยู่ในรายชื่อแนะนำ
  c = byName(makeRanker(data, { records: [], requests: [], leaves: [{ t: 'ครูจ', from: '2026-11-20', to: '2026-11-25', h: '' }] }, 'ครูก', null)(it, [it]));
  assert.equal(c['ครูจ'].ok, false); assert.match(c['ครูจ'].reasons.join(), /ลา\/ไม่อยู่/);
});

t('ครูว่างสอนแทนห้องเล็กได้ทีละ 2 ห้อง (2 ครูที่ลา) · ห้องใหญ่ไม่ได้ · เกิน 2 ห้องไม่ได้', () => {
  const it = item();
  const rec = (a, s = 'ครูจ', extra = {}) => ({ d: MON, p: 1, a, s, st: 'confirmed', ...extra });
  // ครูจ สอนแทนครูข (ป.3/1 ห้องเล็ก) อยู่แล้ว -> รับ ป.2/1 ของครูก เพิ่มได้เป็นคาบคู่
  let c = byName(makeRanker(data, { records: [rec('ครูข')], requests: [] }, 'ครูก', null)(it, [it]));
  assert.equal(c['ครูจ'].ok, true); assert.equal(c['ครูจ'].dual, 1); assert.match(c['ครูจ'].teaching, /ป\.3\/1 ไทย \(สอนแทน ครูข\)/);
  // ห้องที่สอนแทนอยู่เป็นห้องใหญ่ (ม.1/1) -> ไม่ได้ แม้ปิด "ต้องเล็กทั้งคู่"
  c = byName(makeRanker(data, { records: [rec('ครูค')], requests: [] }, 'ครูก', null, { ...DUAL_DEFAULT, bothSmall: false })(it, [it]));
  assert.equal(c['ครูจ'].ok, false); assert.match(c['ครูจ'].reasons[0], /สอนแทนคาบนี้แล้ว.*ไม่ใช่ห้องเล็ก/);
  // ครบ 2 ห้องแล้ว
  c = byName(makeRanker(data, { records: [rec('ครูข'), rec('ครูง', 'ครูจ', { du: true })], requests: [] }, 'ครูก', null)(it, [it]));
  assert.equal(c['ครูจ'].ok, false); assert.match(c['ครูจ'].reasons[0], /ครบ 2 ห้อง/);
  // ครูที่มีสอนห้องตัวเอง + สอนแทนอีก 1 ห้องแล้ว = เต็ม
  c = byName(makeRanker(data, { records: [rec('ครูค', 'ครูข', { du: true })], requests: [] }, 'ครูก', null, { ...DUAL_DEFAULT, bothSmall: false })(it, [it]));
  assert.equal(c['ครูข'].ok, false); assert.match(c['ครูข'].reasons[0], /ครบ 2 ห้อง/);
  // ตัวช่วยจัดเลือกอัตโนมัติไม่เลือกคาบคู่ (ครูว่างจริงมาก่อน)
  c = makeRanker(data, { records: [rec('ครูข')], requests: [] }, 'ครูก', null)(it, [it]);
  assert.equal(c.find((x) => x.ok && !x.dual)?.n !== 'ครูจ', true);
});

t('หมายเหตุคาบคู่: ใส่ชั้น/วิชา และตัดออกตอนแก้', () => {
  const it = { dual: true, sel: 'ครูข', teaching: 'ป.3/1 ไทย (เพิ่มเติม)', note: 'ทำใบงาน' };
  assert.equal(noteOf(it), 'คาบคู่ (สอน ป.3/1 ไทย (เพิ่มเติม) อยู่) · ทำใบงาน');
  assert.equal(stripDual(noteOf(it)), 'ทำใบงาน');
  assert.equal(noteOf({ ...it, sel: NONE, dual: false, note: '' }), 'ไม่ต้องสอนแทน');
});

console.log(`ผ่าน ${n} ข้อ`);
