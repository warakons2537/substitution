// ระบบลา: ตรวจ/อนุญาตใบลา — งานบุคคลตรวจ+ติดตามการเซ็นกระดาษ · ผอ.อนุญาตในระบบ (เมื่อเปิดโหมดอนุญาตในระบบ)
import { $, $$, esc, toast, thDate, modal } from '../util.js';
import { sb, q, settings } from '../db.js';
import { has } from '../perm.js';
import { fmtDays } from '../leaves.js';

const COLS = 'id,teacher_name,leave_type,date_from,date_to,half,days,reason,contact,has_cert,note,status,request_id,signed_at,checked_at,decided_at,decision_note,created_at';
const dt = (l) => (l.date_from === l.date_to ? thDate(l.date_from) : `${thDate(l.date_from)} – ${thDate(l.date_to)}`) + (l.half ? ` (${l.half === 'am' ? 'เช้า' : 'บ่าย'})` : '');

export async function render(el, ctx) {
  const { me } = ctx;
  const hr = has(me, 'hr'); const dir = has(me, 'director');
  const tab = sessionStorage.getItem('wlsub-aptab') || (dir && !hr ? 'wait' : 'wait');
  const s = await settings();
  const [wait, unsigned] = await Promise.all([
    q(sb.from('sub_leaves').select(COLS).eq('status', 'pending').order('date_from').limit(200)),
    q(sb.from('sub_leaves').select(COLS).in('status', ['approved', 'pending']).is('signed_at', null).order('date_from', { ascending: false }).limit(200)),
  ]);
  const list = tab === 'sign' ? unsigned : wait;
  el.innerHTML = `<h2>ตรวจ/อนุญาตใบลา</h2>
    <div class="note" style="display:block">โหมดปัจจุบัน: <b>${s.leave_approval === 'director' ? 'ต้องอนุญาตในระบบ (ผอ.)' : 'มีผลทันที (ยืนยันเอกสารที่เซ็นแล้วภายหลัง)'}</b>
      ${s.leave_approval === 'director' ? '' : ' · ประเภทที่ตั้งให้ใช้การอนุญาตในระบบเป็นรายประเภทจะแสดงในแท็บ "รออนุญาต"'}${hr ? ' · เปลี่ยนที่เมนู "ตั้งค่าการลา"' : ''}</div>
    <div class="card"><div class="tabs"><button data-t="wait" class="${tab === 'wait' ? 'on' : ''}">รออนุญาต (${wait.length})</button>
      <button data-t="sign" class="${tab === 'sign' ? 'on' : ''}">ติดตามการเซ็นเอกสาร (${unsigned.length})</button></div>
    ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>ครู</th><th>วันที่</th><th>ประเภท</th><th class="c">วัน</th><th>เหตุผล</th><th>เอกสาร</th><th></th></tr></thead><tbody>
      ${list.map((l) => `<tr><td>${esc(l.teacher_name)}</td><td class="nowrap">${esc(dt(l))}</td><td>${esc(l.leave_type)}${l.has_cert ? ' <span class="chip chip-ok">ใบรับรองแพทย์</span>' : ''}</td>
        <td class="c">${fmtDays(l.days)}</td><td>${esc(l.reason)}</td>
        <td>${l.signed_at ? '<span class="chip chip-ok">เซ็นแล้ว</span>' : '<span class="chip chip-warn">ยังไม่เซ็น</span>'}${l.checked_at ? ' <span class="chip chip-info">ตรวจแล้ว</span>' : ''}</td>
        <td class="nowrap">
          ${dir && l.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-ok="${l.id}">อนุญาต</button> <button class="btn btn-sm btn-danger" data-no="${l.id}">ไม่อนุญาต</button> ` : ''}
          ${hr && !l.checked_at ? `<button class="btn btn-sm" data-chk="${l.id}">ตรวจแล้ว</button> ` : ''}
          ${hr ? `<button class="btn btn-sm" data-sign="${l.id}" data-v="${l.signed_at ? 0 : 1}">${l.signed_at ? 'ยกเลิกเซ็น' : 'เซ็นแล้ว'}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted">${tab === 'sign' ? 'ไม่มีใบลาที่ค้างเซ็น' : 'ไม่มีใบลารออนุญาต'}</p>`}</div>`;
  $$('[data-t]', el).forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem('wlsub-aptab', b.dataset.t); render(el, ctx); }));
  const run = async (fn, msg) => { try { await q(fn); toast(msg); render(el, ctx); } catch (e) { toast(e.message, 'err'); } };
  $$('[data-ok]', el).forEach((b) => b.addEventListener('click', () => run(sb.rpc('sub_leave_decide', { p_id: b.dataset.ok, p_status: 'approved', p_note: '' }), 'อนุญาตแล้ว')));
  $$('[data-no]', el).forEach((b) => b.addEventListener('click', async () => {
    const r = await modal('ไม่อนุญาต', '<label>เหตุผล/หมายเหตุถึงผู้ลา<input name="note" maxlength="300"></label>', { okText: 'ไม่อนุญาต' });
    if (r) run(sb.rpc('sub_leave_decide', { p_id: b.dataset.no, p_status: 'rejected', p_note: (r.note || '').trim() }), 'บันทึกว่าไม่อนุญาตแล้ว');
  }));
  $$('[data-chk]', el).forEach((b) => b.addEventListener('click', () => run(sb.rpc('sub_leave_check', { p_id: b.dataset.chk }), 'บันทึกแล้ว')));
  $$('[data-sign]', el).forEach((b) => b.addEventListener('click', () => run(sb.rpc('sub_leave_sign', { p_id: b.dataset.sign, p_signed: b.dataset.v === '1' }), 'บันทึกแล้ว')));
}
