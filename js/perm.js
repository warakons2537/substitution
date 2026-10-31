// สิทธิ์ตามหน้าที่: ทุกคนที่เข้าระบบได้เป็น "ครู" · หน้าที่เสริม: admin / academic / hr / director (admin มีทุกหน้าที่)
export const DUTIES = { admin: 'ผู้ดูแลระบบ', academic: 'ฝ่ายวิชาการ', hr: 'งานบุคคล', director: 'ผู้อำนวยการ' };
export const has = (me, d) => !!me && (me.duties.includes('admin') || me.duties.includes(d));
export const dutyText = (me) => (me.duties.length ? me.duties.map((d) => DUTIES[d]).filter(Boolean).join(' · ') : 'ครู');

/** บทบาท (เดิม) จากหน้าที่ — เก็บเข้าตาราง sub_users.role */
export const roleOf = (duties) => (duties.includes('admin') ? 'admin' : duties.includes('academic') ? 'academic' : 'requester');

// ระบบ (โมดูล) ที่แสดงบนแถบสลับ
export const MODULES = {
  leave: { name: 'ระบบลา', sub: 'งานบุคคล' },
  sub: { name: 'ระบบสอนแทน', sub: 'งานวิชาการ' },
  admin: { name: 'ผู้ดูแลระบบ', sub: '' },
};

/**
 * หน้าทั้งหมด: [hash, ชื่อสั้น (เมนู), โมดูล, เงื่อนไขการเห็น(me), ต้องมีตารางสอน]
 * ครูที่ผูกชื่อกับตารางสอนแล้ว (me.teacher) ยื่นลา/ดูของตัวเองได้
 */
export const PAGES = [
  ['home', 'หน้าแรก', 'common', () => true, false],
  // ----- ระบบลา (งานบุคคล) -----
  ['request', 'ยื่นใบลา', 'leave', (me) => !!me.teacher, true],
  ['mine', 'คำขอของฉัน', 'leave', (me) => !!me.teacher, false],
  ['approvals', 'ตรวจ/อนุญาต', 'leave', (me) => has(me, 'hr') || has(me, 'director'), false],
  ['leaves', 'ทะเบียนลา', 'leave', () => true, false],
  ['leave-settings', 'ตั้งค่าการลา', 'leave', (me) => has(me, 'hr'), false],
  // ----- ระบบสอนแทน (งานวิชาการ) -----
  ['mysubs', 'สอนแทนของฉัน', 'sub', (me) => !!me.teacher, true],
  ['assist', 'จัดสอนแทน', 'sub', (me) => has(me, 'academic'), true],
  ['requests', 'คิวสอนแทน', 'sub', (me) => has(me, 'academic'), true],
  ['records', 'บันทึก', 'sub', (me) => has(me, 'academic'), true],
  ['summary', 'สรุปรายครู', 'sub', () => true, false],
  ['reports', 'รายงาน', 'sub', (me) => has(me, 'academic') || has(me, 'hr') || has(me, 'director'), true],
  ['import', 'ตารางสอน', 'sub', (me) => has(me, 'academic'), false],
  // ----- ผู้ดูแลระบบ -----
  ['users', 'ผู้ใช้', 'admin', (me) => has(me, 'admin'), false],
  ['settings', 'ตั้งค่าแบบพิมพ์', 'admin', (me) => has(me, 'admin'), false],
  ['audit', 'ประวัติใช้งาน', 'admin', (me) => has(me, 'admin'), false],
  // ----- ส่วนตัว -----
  ['profile', 'ข้อมูลฉัน', 'common', () => true, false],
];

export const pagesFor = (me) => PAGES.filter(([, , , ok]) => ok(me));
export const modulesFor = (me) => ['leave', 'sub', 'admin'].filter((m) => pagesFor(me).some((p) => p[2] === m));
/** หน้าแรกของแต่ละโมดูล (หน้าแรกที่ผู้ใช้เห็นก่อน) */
export function landing(me, mod) {
  const ok = pagesFor(me).map((p) => p[0]);
  const pick = mod === 'leave' ? [has(me, 'hr') || has(me, 'director') ? 'approvals' : 'request', 'leaves']
    : mod === 'sub' ? [has(me, 'academic') ? 'requests' : 'mysubs', 'summary'] : ['users'];
  return pick.find((h) => ok.includes(h)) || (pagesFor(me).find((p) => p[2] === mod) || [])[0] || 'home';
}
