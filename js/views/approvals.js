// ระบบลา: ตรวจ/อนุญาตใบลา — งานบุคคลตรวจ+ติดตามการเซ็นกระดาษ · ผอ.อนุญาตในระบบ (เมื่อเปิดโหมดอนุญาตในระบบ)
import { $, $$, esc, toast, thDate, modal } from '../util.js';
import { sb, q, settings } from '../db.js';
import { has } from '../perm.js';
import { fmtDays } from '../leaves.js';
import { pill, hero } from '../gui.js';
import { LEAVE_FORM_TYPES } from '../print.js';
import { printLeaveOf } from './leaves.js';

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
  el.innerHTML = `<div class="wl-g">${hero('ตรวจ/อนุญาตใบลา', `โหมดปัจจุบัน: <b>${s.leave_approval === 'director' ? 'ต้องอนุญาตในระบบ (ผอ.)' : 'มีผลทันที (ยืนยันเอกสารที่เซ็นแล้วภายหลัง)'}</b>`)}
    ${s.leave_approval === 'director' && !hr ? '' : `<div class="g-note" role="note"><span>${s.leave_approval === 'director' ? '' : 'ประเภทที่ตั้งให้ใช้การอนุญาตในระบบเป็นรายประเภทจะแสดงในแท็บ "รออนุญาต"'}${hr ? `${s.leave_approval === 'director' ? '' : ' · '}เปลี่ยนโหมดที่เมนู "ตั้งค่าการลา"` : ''}</span></div>`}
    <div class="g-chips" role="group" aria-label="เลือกรายการ"><button type="button" class="g-chip" data-t="wait" aria-pressed="${tab === 'wait'}"><span>รออนุญาต</span><b class="num">${wait.length}</b></button>
      <button type="button" class="g-chip" data-t="sign" aria-pressed="${tab === 'sign'}"><span>ติดตามการเซ็นเอกสาร</span><b class="num">${unsigned.length}</b></button></div>
    <section class="g-card">${list.length ? `<div class="g-scroll"><table class="g-tbl"><thead><tr><th>ครู</th><th>วันที่</th><th>ประเภท</th><th class="c">วัน</th><th>เหตุผล</th><th>เอกสาร</th><th></th></tr></thead><tbody>
      ${list.map((l) => `<tr><td class="nowrap"><b>${esc(l.teacher_name)}</b></td><td class="nowrap">${esc(dt(l))}</td><td>${esc(l.leave_type)}${l.has_cert ? ' ' + pill('approved', 'ใบรับรองแพทย์') : ''}</td>
        <td class="c num">${fmtDays(l.days)}</td><td>${esc(l.reason)}</td>
        <td>${l.signed_at ? pill('approved', 'เซ็นแล้ว') : pill('pending', 'ยังไม่เซ็น')}${l.checked_at ? ' ' + pill('approved', 'ตรวจแล้ว') : ''}</td>
        <td class="nowrap">
          ${LEAVE_FORM_TYPES.includes(l.leave_type) ? `<button class="g-btn g-btn-line g-btn-sm" type="button" data-pform="${l.id}">พิมพ์ใบลา</button> ` : ''}
          ${dir && l.status === 'pending' ? `<button class="g-btn g-btn-sm" type="button" data-ok="${l.id}">อนุญาต</button> <button class="g-btn g-btn-line g-btn-sm g-danger" type="button" data-no="${l.id}">ไม่อนุญาต</button> ` : ''}
          ${hr && !l.checked_at ? `<button class="g-btn g-btn-line g-btn-sm" type="button" data-chk="${l.id}">ตรวจแล้ว</button> ` : ''}
          ${hr ? `<button class="g-btn g-btn-line g-btn-sm" type="button" data-sign="${l.id}" data-v="${l.signed_at ? 0 : 1}">${l.signed_at ? 'ยกเลิกเซ็น' : 'เซ็นแล้ว'}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="g-empty">${tab === 'sign' ? 'ไม่มีใบลาที่ค้างเซ็น' : 'ไม่มีใบลารออนุญาต'}</p>`}</section></div>`;
  $$('[data-t]', el).forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem('wlsub-aptab', b.dataset.t); render(el, ctx); }));
  const run = async (fn, msg) => { try { await q(fn); toast(msg); render(el, ctx); } catch (e) { toast(e.message, 'err'); } };
  $$('[data-ok]', el).forEach((b) => b.addEventListener('click', () => run(sb.rpc('sub_leave_decide', { p_id: b.dataset.ok, p_status: 'approved', p_note: '' }), 'อนุญาตแล้ว')));
  $$('[data-no]', el).forEach((b) => b.addEventListener('click', async () => {
    const r = await modal('ไม่อนุญาต', '<label>เหตุผล/หมายเหตุถึงผู้ลา<input name="note" maxlength="300"></label>', { okText: 'ไม่อนุญาต' });
    if (r) run(sb.rpc('sub_leave_decide', { p_id: b.dataset.no, p_status: 'rejected', p_note: (r.note || '').trim() }), 'บันทึกว่าไม่อนุญาตแล้ว');
  }));
  $$('[data-pform]', el).forEach((b) => b.addEventListener('click', () => printLeaveOf(list.find((l) => l.id === b.dataset.pform), me)));
  $$('[data-chk]', el).forEach((b) => b.addEventListener('click', () => run(sb.rpc('sub_leave_check', { p_id: b.dataset.chk }), 'บันทึกแล้ว')));
  $$('[data-sign]', el).forEach((b) => b.addEventListener('click', () => run(sb.rpc('sub_leave_sign', { p_id: b.dataset.sign, p_signed: b.dataset.v === '1' }), 'บันทึกแล้ว')));
}
