// สิทธิ์ตามหน้าที่: ทุกคนที่เข้าระบบได้เป็น "ครู" · หน้าที่เสริม: admin / academic / hr / director (admin มีทุกหน้าที่)
export const DUTIES = { admin: 'ผู้ดูแลระบบ', academic: 'ฝ่ายวิชาการ', hr: 'งานบุคคล', director: 'ผู้อำนวยการ' };
export const has = (me, d) => !!me && (me.duties.includes('admin') || me.duties.includes(d));
export const dutyText = (me) => (me.duties.length ? me.duties.map((d) => DUTIES[d]).filter(Boolean).join(' · ') : 'ครู');

/** บทบาท (เดิม) จากหน้าที่ — เก็บเข้าตาราง sub_users.role */
export const roleOf = (duties) => (duties.includes('admin') ? 'admin' : duties.includes('academic') ? 'academic' : 'requester');

/**
 * เมนูหลัก (จัดตามงาน ไม่แยกระบบ) — หน้าในกลุ่มเดียวกันแสดงเป็นแท็บด้านบน
 * [key, ชื่อเมนู (​ = จุดตัดบรรทัด), ไอคอน]
 */
export const GROUPS = [
  ['home', 'หน้าแรก', 'home'],
  ['leave', 'ลา', 'request'],
  ['mysubs', 'สอนแทน​ของฉัน', 'mysubs'],
  ['leave-admin', 'จัดการ​ใบลา', 'approvals'],
  ['sub-admin', 'จัด​สอนแทน', 'assist'],
  ['books', 'ทะเบียน​และรายงาน', 'reports'],
  ['setup', 'ตั้งค่า', 'settings'],
];

/**
 * หน้าทั้งหมด: [hash, ชื่อแท็บ, กลุ่มเมนู, เงื่อนไขการเห็น(me), ต้องมีตารางสอน]
 * ครูที่ผูกชื่อกับตารางสอนแล้ว (me.teacher) ยื่นลา/ดูของตัวเองได้ · hash เดิมใช้ได้ทุกตัว (ลิงก์แจ้งเตือนไม่เสีย)
 */
export const PAGES = [
  ['home', 'หน้าแรก', 'home', () => true, false],
  // ----- ลา (ครู) · จัดการใบลา (งานบุคคล/ผอ.) -----
  ['request', 'ยื่นใบลา', 'leave', (me) => !!me.teacher, true],
  ['mine', 'ใบลาของฉัน', 'leave', (me) => !!me.teacher, false],
  ['approvals', 'ตรวจ/อนุญาตใบลา', 'leave-admin', (me) => has(me, 'hr') || has(me, 'director'), false],
  ['assist-leave', 'บันทึกลาแทนครู', 'leave-admin', (me) => has(me, 'hr'), false],
  ['leaves', 'ทะเบียนการลา', 'books', () => true, false],
  ['leave-settings', 'ตั้งค่าการลา', 'setup', (me) => has(me, 'hr'), false],
  // ----- สอนแทน (ครู) · จัดสอนแทน (ฝ่ายวิชาการ) · ทะเบียนและรายงาน · ตั้งค่า -----
  ['mysubs', 'สอนแทนของฉัน', 'mysubs', (me) => !!me.teacher, true],
  ['requests', 'คิวรอจัด', 'sub-admin', (me) => has(me, 'academic'), true],
  ['assist', 'จัดครูสอนแทน', 'sub-admin', (me) => has(me, 'academic'), true],
  ['records', 'บันทึกด้วยมือ/แก้ไข', 'sub-admin', (me) => has(me, 'academic'), true],
  ['summary', 'สรุปรายครู', 'books', () => true, false],
  ['reports', 'รายงาน/พิมพ์', 'books', (me) => has(me, 'academic') || has(me, 'hr') || has(me, 'director'), true],
  ['import', 'นำเข้าตารางสอน', 'setup', (me) => has(me, 'academic'), false],
  ['users', 'ผู้ใช้และสิทธิ์', 'setup', (me) => has(me, 'admin'), false],
  ['settings', 'แบบพิมพ์', 'setup', (me) => has(me, 'admin'), false],
  ['audit', 'ประวัติใช้งาน', 'setup', (me) => has(me, 'admin'), false],
  // ----- ส่วนตัว (อยู่ในเมนูผู้ใช้มุมขวาบน ไม่อยู่ในเมนูหลัก) -----
  ['profile', 'ข้อมูลของฉัน', 'me', () => true, false],
];

export const pagesFor = (me) => PAGES.filter(([, , , ok]) => ok(me));
/** กลุ่มเมนูที่ผู้ใช้เห็น (มีอย่างน้อย 1 หน้า) */
export const groupsFor = (me) => GROUPS.filter(([g]) => pagesFor(me).some((p) => p[2] === g));
/** หน้าในกลุ่มเดียวกันที่ผู้ใช้เห็น (= แท็บ) */
export const tabsOf = (me, g) => pagesFor(me).filter((p) => p[2] === g);
