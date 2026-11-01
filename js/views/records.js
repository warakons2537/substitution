// ฝ่ายวิชาการ: บันทึกการสอนแทนด้วยมือ + รายการที่บันทึกแล้ว (แก้ไข/ลบ)
import { $, $$, esc, opts, toast, todayISO, thDate, thDay, dowIndex , confirmBox } from '../util.js';
import { sb, q } from '../db.js';
import { LEAVE_TYPES } from '../config.js';
import { realTeachers, gradeLabel } from '../timetable.js';
import { hero, bulkBar, pill } from '../gui.js';

const SRC = { assist: 'ช่วยจัด', manual: 'บันทึกเอง', request: 'คำขอ' };

export async function render(el, ctx) {
  const { tt } = ctx;
  const admin = ctx.me.role === 'admin';
  const month = sessionStorage.getItem('wlsub-month') || todayISO().slice(0, 7);
  const teachers = realTeachers(tt.data);
  const per = Array.from({ length: tt.data.periods }, (_, i) => i + 1);
  const [yy, mm] = month.split('-').map(Number);
  const next = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  const list = await q(sb.from('sub_records').select('*').eq('status', 'confirmed')
    .gte('sub_date', `${month}-01`).lt('sub_date', next).order('sub_date').order('period'));

  const hasAck = list.length > 0 && 'ack_at' in list[0];   // ฐานข้อมูลรอบ 5 ติดตั้งแล้ว
  el.innerHTML = `<div class="wl-g">${hero('บันทึกการสอนแทน', 'บันทึกด้วยมือและรายการที่บันทึกแล้ว')}
    <section class="g-card"><div class="g-card-h"><h3 id="m-title">บันทึกด้วยมือ</h3></div><form id="m-form" class="g-form">
      <input type="hidden" name="id">
      <label>วันที่<input type="date" name="sub_date" value="${todayISO()}" required></label>
      <label>คาบ<select name="period">${opts(per)}</select></label>
      <label>ครูที่ลา<select name="absent_teacher" required><option value="">— เลือก —</option>${opts(teachers)}</select></label>
      <label>ประเภทการลา<select name="leave_type">${opts(LEAVE_TYPES, 'ไม่ระบุ')}</select></label>
      <label>ชั้น<input name="grade" list="m-grades"></label>
      <label>วิชา<input name="subject"></label>
      <label>ครูสอนแทน<select name="substitute_teacher"><option value="">ไม่ต้องสอนแทน</option>${opts(teachers)}</select></label>
      <label>หมายเหตุ<input name="note" maxlength="200"></label>
      <datalist id="m-grades">${opts(tt.data.grades)}</datalist>
      <div class="g-actions"><button type="button" class="g-btn g-btn-line" id="m-clear">ล้างฟอร์ม</button>
        <button class="g-btn" type="submit">บันทึก</button></div>
    </form></section>
    <section class="g-card"><div class="g-card-h"><h3>รายการเดือน</h3>
      <input class="g-input" type="month" id="m-month" value="${month}" aria-label="เดือน"></div>
      ${list.length ? `<div class="g-scroll"><table class="g-tbl"><thead><tr>${admin ? '<th><input class="g-chk" type="checkbox" id="m-all" aria-label="เลือกทั้งหมด"></th>' : ''}<th>วันที่</th><th>คาบ</th><th>ครูที่ลา</th><th>ประเภท</th><th>ชั้น</th><th>วิชา</th><th>ครูสอนแทน</th>${hasAck ? '<th>รับทราบ</th>' : ''}<th>ที่มา</th><th></th></tr></thead><tbody>
        ${list.map((r) => `<tr>${admin ? `<td><input class="g-chk m-pick" type="checkbox" value="${r.id}" aria-label="เลือกรายการ"></td>` : ''}<td>${esc(thDay(r.sub_date))} ${esc(thDate(r.sub_date))}</td><td class="c">${r.period}</td>
          <td>${esc(r.absent_teacher)}</td><td>${esc(r.leave_type)}</td><td>${esc(r.grade)}</td><td>${esc(r.subject)}</td>
          <td>${r.substitute_teacher ? esc(r.substitute_teacher) : '<span class="g-sub">ไม่ต้องสอนแทน</span>'}</td>
          ${hasAck ? `<td>${r.substitute_teacher ? (r.ack_at ? pill('approved', 'รับทราบแล้ว') : pill('pending', 'รอรับทราบ')) : ''}</td>` : ''}
          <td class="g-sub">${SRC[r.source] || ''}</td>
          <td class="nowrap"><button class="g-btn g-btn-line g-btn-sm" type="button" data-edit="${r.id}">แก้ไข</button>
            ${admin ? `<button class="g-btn g-btn-line g-btn-sm g-danger" type="button" data-del="${r.id}">ลบ</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div><div class="g-card-h g-foot"><span class="g-sub">รวม ${list.length} คาบ</span>
      </div>` : '<p class="g-empty">ยังไม่มีรายการในเดือนนี้</p>'}</section>
    ${admin && list.length ? bulkBar('mb', '<button class="g-btn g-btn-line g-danger" type="button" id="m-del-sel">ลบรายการที่เลือก</button>') : ''}</div>`;

  const f = $('#m-form', el);
  const set = (n, v) => { f.elements[n].value = v ?? ''; };
  // เลือกวัน/คาบ/ครู แล้วเติมชั้น-วิชาจากตารางสอนให้
  ['sub_date', 'period', 'absent_teacher'].forEach((n) => f.elements[n].addEventListener('change', () => {
    const d = dowIndex(f.elements.sub_date.value);
    const s = tt.data.slots.find((x) => x.d === d && x.p === +f.elements.period.value && x.teachers.includes(f.elements.absent_teacher.value));
    if (s) { set('grade', gradeLabel(s)); set('subject', s.subject); }
  }));
  $('#m-clear', el).addEventListener('click', () => { f.reset(); set('id', ''); $('#m-title', el).textContent = 'บันทึกด้วยมือ'; });
  $('#m-month', el).addEventListener('change', (e) => { sessionStorage.setItem('wlsub-month', e.target.value || todayISO().slice(0, 7)); render(el, ctx); });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f).entries());
    const row = { sub_date: v.sub_date, period: +v.period, absent_teacher: v.absent_teacher, leave_type: v.leave_type,
      grade: v.grade, subject: v.subject, substitute_teacher: v.substitute_teacher, note: v.note };
    if (row.substitute_teacher && row.substitute_teacher === row.absent_teacher) { toast('ครูสอนแทนต้องไม่ใช่ครูที่ลา', 'err'); return; }
    try {
      if (v.id) await q(sb.from('sub_records').update(row).eq('id', v.id));
      else await q(sb.from('sub_records').insert({ ...row, academic_year: tt.academic_year, term: tt.term, status: 'confirmed', source: 'manual' }));
      toast('บันทึกแล้ว'); render(el, ctx);
    } catch (err) { toast(err.message, 'err'); }
  });
  $$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => {
    const r = list.find((x) => x.id === b.dataset.edit);
    ['id', 'sub_date', 'period', 'absent_teacher', 'leave_type', 'grade', 'subject', 'substitute_teacher', 'note'].forEach((n) => set(n, r[n]));
    $('#m-title', el).textContent = 'แก้ไขรายการ';
    f.scrollIntoView({ behavior: 'smooth' });
  }));
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('ลบรายการนี้?')) ) return;
    try { await q(sb.from('sub_records').delete().eq('id', b.dataset.del)); toast('ลบแล้ว'); render(el, ctx); } catch (err) { toast(err.message, 'err'); }
  }));
  // ผู้ดูแลระบบ: เลือกหลายรายการแล้วลบ (รายการที่ลบไม่ถูกนับในสถิติอีก)
  const picks = () => $$('.m-pick:checked', el).map((c) => c.value);
  const sync = () => { const bar = $('#mb-bulk', el); if (bar) { const n = picks().length; bar.hidden = !n; $('#mb-n', el).textContent = n; } };
  $('#mb-clear', el)?.addEventListener('click', () => { $$('.m-pick, #m-all', el).forEach((c) => { c.checked = false; }); sync(); });
  $('#m-all', el)?.addEventListener('change', (e) => { $$('.m-pick', el).forEach((c) => { c.checked = e.target.checked; }); sync(); });
  $$('.m-pick', el).forEach((c) => c.addEventListener('change', sync));
  $('#m-del-sel', el)?.addEventListener('click', async () => {
    const ids = picks();
    if (!ids.length || !(await confirmBox(`ลบ ${ids.length} รายการที่เลือก?`))) return;
    try { await q(sb.from('sub_records').delete().in('id', ids)); toast(`ลบแล้ว ${ids.length} รายการ`); render(el, ctx); } catch (err) { toast(err.message, 'err'); }
  });
}
