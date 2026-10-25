// ผู้ขอลา: แจ้งขอลา/ขอสอนแทน + คำขอของฉัน
import { $, $$, esc, toast, thDate } from '../util.js';
import { sb, q, rankData } from '../db.js';
import { mountLeaveForm } from '../leaveform.js';
import { buildItems, mountPlanner, NONE } from '../planner.js';

export const STATUS = { pending: 'รอพิจารณา', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิกแล้ว' };
export const periodText = (r) => (r.periods?.length ? `คาบ ${r.periods.join(', ')}` : 'ทั้งวัน');
export const dateText = (r) => (r.date_from === r.date_to ? thDate(r.date_from) : `${thDate(r.date_from)} – ${thDate(r.date_to)}`);

export async function render(el, { tt, me }) {
  if (!me.teacher) {
    el.innerHTML = '<h2>แจ้งขอลา/ขอสอนแทน</h2><div class="card"><p>บัญชีนี้ยังไม่ได้ผูกกับชื่อครู กรุณาแจ้งผู้ดูแลระบบ</p></div>';
    return;
  }
  el.innerHTML = `<h2>แจ้งขอลา/ขอสอนแทน</h2>
    <div class="card"><div id="r-form"></div></div>
    <div class="card"><p class="muted small">ระบบเสนอครูสอนแทนให้ เปลี่ยนได้ตามต้องการ — เป็นเพียงข้อเสนอ ฝ่ายวิชาการเป็นผู้ยืนยัน</p>
      <div id="r-plan"></div>
      <div class="actions"><button class="btn btn-primary" id="r-send" disabled>ส่งคำขอ</button></div></div>`;
  const rank = await rankData();
  let plan = null; let cur = null;
  const rebuild = (v) => {
    cur = v; plan = null;
    const items = v.noneChecked ? [] : buildItems(tt.data, me.teacher, v.dates, v.periods);
    plan = mountPlanner($('#r-plan'), { data: tt.data, rank, absent: me.teacher, items, allowEmpty: true });
    $('#r-send').disabled = !v.dates.length || v.noneChecked;
  };
  const form = mountLeaveForm($('#r-form'), { data: tt.data, fixedTeacher: me.teacher, withReason: true, onChange: rebuild });
  rebuild(form.read());

  $('#r-send').addEventListener('click', async () => {
    const v = cur;
    try {
      $('#r-send').disabled = true;
      const req = (await q(sb.from('sub_requests').insert({
        teacher_name: me.teacher, date_from: v.from, date_to: v.to, periods: v.periods,
        leave_type: v.leave_type, reason: v.reason,
      }).select('id')))[0];
      const rows = plan.items.filter((it) => it.sel).map((it) => ({
        request_id: req.id, sub_date: it.date, academic_year: tt.academic_year, term: tt.term, period: it.p,
        absent_teacher: me.teacher, leave_type: v.leave_type, grade: it.grade, subject: it.subject,
        substitute_teacher: it.sel === NONE ? '' : it.sel, note: it.sel === NONE ? 'ไม่ต้องสอนแทน' : '',
        status: 'proposed', source: 'request',
      }));
      if (rows.length) await q(sb.from('sub_records').insert(rows));
      toast('ส่งคำขอแล้ว รอฝ่ายวิชาการพิจารณา');
      location.hash = '#mine';
    } catch (e) { toast(e.message, 'err'); $('#r-send').disabled = false; }
  });
}

export async function renderMine(el, { me }) {
  const list = await q(sb.from('sub_requests').select('*').eq('requested_by', me.id).order('date_from', { ascending: false }).limit(100));
  el.innerHTML = `<h2>คำขอของฉัน</h2><div class="card">${list.length ? `<div class="table-wrap"><table class="tbl">
    <thead><tr><th>วันที่ลา</th><th>คาบ</th><th>ประเภท</th><th>สถานะ</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>
    ${list.map((r) => `<tr><td>${esc(dateText(r))}</td><td>${esc(periodText(r))}</td><td>${esc(r.leave_type)}</td>
      <td><span class="badge ${r.status}">${STATUS[r.status]}</span></td><td>${esc(r.decision_note)}</td>
      <td>${r.status === 'pending' ? `<button class="btn btn-sm" data-cancel="${r.id}">ยกเลิก</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted">ยังไม่มีคำขอ</p>'}</div>`;
  $$('[data-cancel]', el).forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('ยกเลิกคำขอนี้?')) return;
    try {
      await q(sb.from('sub_records').delete().eq('request_id', b.dataset.cancel).eq('status', 'proposed'));
      await q(sb.from('sub_requests').update({ status: 'cancelled' }).eq('id', b.dataset.cancel));
      toast('ยกเลิกแล้ว'); renderMine(el, { me });
    } catch (e) { toast(e.message, 'err'); }
  }));
}
