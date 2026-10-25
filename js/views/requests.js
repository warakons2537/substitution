// ฝ่ายวิชาการ: พิจารณาคำขอลา/ขอสอนแทน
import { $, $$, esc, toast, dateRange } from '../util.js';
import { sb, q, rankData } from '../db.js';
import { buildItems, mountPlanner, NONE, noteOf } from '../planner.js';
import { STATUS, periodText, dateText } from './request.js';

export async function render(el, ctx) {
  const show = sessionStorage.getItem('wlsub-reqfilter') || 'pending';
  let qy = sb.from('sub_requests').select('*').order('date_from', { ascending: show === 'pending' }).limit(200);
  if (show === 'pending') qy = qy.eq('status', 'pending');
  const list = await q(qy);
  el.innerHTML = `<h2>คำขอสอนแทน</h2>
    <div class="card"><div class="row-between"><div class="tabs">
      <button data-f="pending" class="${show === 'pending' ? 'on' : ''}">รอพิจารณา</button>
      <button data-f="all" class="${show === 'all' ? 'on' : ''}">ทั้งหมด</button></div></div>
    ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>ครูที่ลา</th><th>วันที่ลา</th><th>คาบ</th><th>ประเภท</th><th>เหตุผล</th><th>สถานะ</th><th></th></tr></thead><tbody>
      ${list.map((r) => `<tr><td>${esc(r.teacher_name)}</td><td>${esc(dateText(r))}</td><td>${esc(periodText(r))}</td>
        <td>${esc(r.leave_type)}</td><td>${esc(r.reason)}</td><td><span class="badge ${r.status}">${STATUS[r.status]}</span></td>
        <td>${r.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-open="${r.id}">พิจารณา</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">ไม่มีคำขอ</p>'}</div>
    <div id="rq-detail"></div>`;
  $$('[data-f]', el).forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem('wlsub-reqfilter', b.dataset.f); render(el, ctx); }));
  $$('[data-open]', el).forEach((b) => b.addEventListener('click', () => openReq(el, ctx, list.find((r) => r.id === b.dataset.open))));
}

async function openReq(el, ctx, req) {
  const { tt } = ctx;
  const box = $('#rq-detail', el);
  const [rank, proposals] = await Promise.all([
    rankData(), q(sb.from('sub_records').select('*').eq('request_id', req.id)),
  ]);
  const items = buildItems(tt.data, req.teacher_name, dateRange(req.date_from, req.date_to), req.periods || []);
  for (const it of items) {
    const p = proposals.find((x) => x.sub_date === it.date && x.period === it.p);
    if (p) { it.sel = p.substitute_teacher || NONE; it.note = p.note === 'ไม่ต้องสอนแทน' ? '' : p.note; }
  }
  box.innerHTML = `<div class="card"><h3>${esc(req.teacher_name)} · ${esc(dateText(req))} · ${esc(periodText(req))} · ${esc(req.leave_type)}</h3>
    ${req.reason ? `<p>เหตุผล: ${esc(req.reason)}</p>` : ''}
    <p class="muted small">ค่าที่เลือกไว้ = ที่ผู้ขอลาเลือกแล้ว (คาบที่ให้ฝ่ายวิชาการจัด ระบบเลือกให้) เปลี่ยนได้ก่อนอนุมัติ</p>
    <div id="rq-plan"></div>
    <label>หมายเหตุถึงผู้ขอลา<input id="rq-note" maxlength="300"></label>
    <div class="actions"><button class="btn" id="rq-reject">ไม่อนุมัติ</button>
      <button class="btn btn-primary" id="rq-ok">อนุมัติและบันทึกการสอนแทน</button></div></div>`;
  const plan = mountPlanner($('#rq-plan', box), { data: tt.data, rank, absent: req.teacher_name, items, excludeRequest: req.id });
  box.scrollIntoView({ behavior: 'smooth' });

  const decide = async (status) => {
    const note = $('#rq-note', box).value;
    if (status === 'approved' && !plan.valid()) { toast('กรุณาเลือกครูสอนแทน (หรือ "ไม่ต้องสอนแทน") ให้ครบทุกคาบ', 'err'); return; }
    try {
      // ลบรายการเดิมของคำขอ แล้วบันทึกใหม่ (ถ้าบันทึกไม่สำเร็จ คืนรายการเดิม)
      await q(sb.from('sub_records').delete().eq('request_id', req.id));
      if (status === 'approved' && plan.items.length) {
        await q(sb.from('sub_records').insert(plan.items.map((it) => ({
          request_id: req.id, sub_date: it.date, academic_year: tt.academic_year, term: tt.term, period: it.p,
          absent_teacher: req.teacher_name, leave_type: req.leave_type, grade: it.grade, subject: it.subject,
          substitute_teacher: it.sel === NONE ? '' : it.sel, note: noteOf(it),
          status: 'confirmed', source: 'request',
        })))).catch(async (err) => {
          const old = proposals.map(({ id, created_at, updated_at, ...r }) => r);
          if (old.length) await sb.from('sub_records').insert(old);
          throw err;
        });
      }
      await q(sb.from('sub_requests').update({
        status, decision_note: note, decided_by: ctx.me.id, decided_at: new Date().toISOString(),
      }).eq('id', req.id));
      toast(status === 'approved' ? 'อนุมัติและบันทึกแล้ว' : 'บันทึกว่าไม่อนุมัติแล้ว');
      render(el, ctx);
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#rq-ok', box).addEventListener('click', () => decide('approved'));
  $('#rq-reject', box).addEventListener('click', () => decide('rejected'));
}
