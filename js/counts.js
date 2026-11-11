// ตัวเลขงานค้างบนเมนูหลัก (ใบลารออนุญาต · คิวรอจัดสอนแทน · คาบที่ฉันยังไม่รับทราบ) — นับแบบเบา ๆ ไม่ดึงรายการ
import { sb } from './db.js';
import { has } from './perm.js';

let C = {};
const count = async (p) => { try { const { count: n, error } = await p; return error ? 0 : (n || 0); } catch { return 0; } };
const rpcInt = async (fn) => { try { const { data, error } = await sb.rpc(fn); return error ? 0 : (+data || 0); } catch { return 0; } };   // ยังไม่รัน SQL รอบ 7 = 0

export const countOf = (g) => C[g] || 0;
export const badgeHtml = (g) => `<i class="nav-n" data-n="${g}"${countOf(g) ? '' : ' hidden'}>${countOf(g) > 99 ? '99+' : countOf(g)}</i>`;
export function paintCounts(root = document) {
  root.querySelectorAll('[data-n]').forEach((el) => { const n = countOf(el.dataset.n); el.hidden = !n; el.textContent = n > 99 ? '99+' : n; });
  root.querySelectorAll('[data-nsum]').forEach((el) => { el.hidden = !el.dataset.nsum.split(',').some((g) => countOf(g)); });
}
export async function loadCounts(me) {
  const [lv, rq, ack] = await Promise.all([
    has(me, 'hr') || has(me, 'director') ? count(sb.from('sub_leaves').select('id', { count: 'exact', head: true }).eq('status', 'pending')) : 0,
    has(me, 'academic') ? count(sb.from('sub_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')) : 0,
    me.teacher ? rpcInt('sub_my_unack') : 0,
  ]);
  C = { 'leave-admin': lv, 'sub-admin': rq, mysubs: ack };
  paintCounts();
}
