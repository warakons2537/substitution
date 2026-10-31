// ตัวช่วยทะเบียนการลา: ปีงบประมาณ · นับวันลา · ยอดใช้ไป/คงเหลือ  (กติกานับวันต้องตรงกับ public.sub_leave_days ใน schema.sql)
import { sb, q } from './db.js';
import { LEAVE_TYPES } from './config.js';
import { has } from './perm.js';
import { parseISO, dateRange, dowIndex } from './util.js';

/** ปีงบประมาณ (พ.ศ.): 1 ต.ค. – 30 ก.ย. */
export const fiscalYear = (s) => { const d = parseISO(s); return d.getFullYear() + 543 + (d.getMonth() >= 9 ? 1 : 0); };
export const fiscalRange = (fy) => ({ from: `${fy - 544}-10-01`, to: `${fy - 543}-09-30` });
export const fyOf = fiscalYear;

/** โหลดประเภทการลา + วันหยุด (ถ้าตารางยังไม่มี ใช้ชุดตั้งต้น) */
export async function loadRules() {
  let types = []; let holidays = [];
  try { types = await q(sb.from('sub_leave_types').select('*').order('sort_order')); } catch { /* ยังไม่ได้รัน SQL ใหม่ */ }
  try { holidays = await q(sb.from('sub_holidays').select('*').order('day')); } catch { /* */ }
  if (!types.length) types = LEAVE_TYPES.map((t, i) => ({ leave_type: t, quota_days: null, calendar_days: t === 'ลาคลอด', sort_order: i, active: true }));
  return { types, holidays, hset: new Set(holidays.map((h) => String(h.day).slice(0, 10))),
    byType: Object.fromEntries(types.map((t) => [t.leave_type, t])) };
}

/** จำนวนวันลา — เหมือน sub_leave_days ในฐานข้อมูล */
export function countDays(rules, from, to, type, half = '') {
  if (!from || !to || to < from) return 0;
  if (half) return 0.5;
  const cal = !!rules.byType[type]?.calendar_days;
  return dateRange(from, to).filter((d) => cal || (dowIndex(d) >= 0 && !rules.hset.has(d))).length;
}

const counts = (l) => ['pending', 'approved'].includes(l.status);
/** ยอดใช้ไปต่อประเภทในปีงบประมาณ: { type: { used, count } } */
export function usage(leaves, fy) {
  const out = {};
  for (const l of leaves) {
    if (!counts(l) || fiscalYear(l.date_from) !== fy) continue;
    const u = (out[l.leave_type] ||= { used: 0, count: 0 });
    u.used += Number(l.days); u.count += 1;
  }
  return out;
}
export const fmtDays = (n) => (Number.isInteger(+n) ? String(+n) : (+n).toFixed(1));
export const leaveDateText = (l) => (l.date_from === l.date_to ? l.date_from : `${l.date_from} – ${l.date_to}`);

/** ข้อมูลการลาตามช่วงวันที่: งานบุคคล/ผอ. อ่านตารางจริง (มีเหตุผล) · คนอื่นอ่านผ่านฟังก์ชันที่ไม่ส่งเหตุผล/ที่ติดต่อ/ใบรับรองแพทย์ */
export async function leavesRange(me, from, to) {
  try {
    if (has(me, 'hr') || has(me, 'director')) {
      return await q(sb.from('sub_leaves').select('*').neq('status', 'cancelled').gte('date_from', from).lte('date_from', to).order('date_from').limit(2000));
    }
    return await q(sb.rpc('sub_leave_public', { p_from: from, p_to: to }));
  } catch { return []; }
}
