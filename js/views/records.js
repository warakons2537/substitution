// ฝ่ายวิชาการ: บันทึกการสอนแทนด้วยมือ + รายการที่บันทึกแล้ว (แก้ไข/ลบ)
import { $, $$, esc, opts, toast, todayISO, thDate, thDay, dowIndex } from '../util.js';
import { sb, q } from '../db.js';
import { LEAVE_TYPES } from '../config.js';
import { realTeachers, gradeLabel } from '../timetable.js';

const SRC = { assist: 'ช่วยจัด', manual: 'บันทึกเอง', request: 'คำขอ' };

export async function render(el, ctx) {
  const { tt } = ctx;
  const month = sessionStorage.getItem('wlsub-month') || todayISO().slice(0, 7);
  const teachers = realTeachers(tt.data);
  const per = Array.from({ length: tt.data.periods }, (_, i) => i + 1);
  const [yy, mm] = month.split('-').map(Number);
  const next = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  const list = await q(sb.from('sub_records').select('*').eq('status', 'confirmed')
    .gte('sub_date', `${month}-01`).lt('sub_date', next).order('sub_date').order('period'));

  el.innerHTML = `<h2>บันทึกการสอนแทน</h2>
    <div class="card"><h3 id="m-title">บันทึกด้วยมือ</h3><form id="m-form" class="form-grid">
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
      <div class="actions span-all"><button type="button" class="btn" id="m-clear">ล้างฟอร์ม</button>
        <button class="btn btn-primary" type="submit">บันทึก</button></div>
    </form></div>
    <div class="card"><div class="row-between"><h3>รายการเดือน</h3>
      <input type="month" id="m-month" value="${month}"></div>
      ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>คาบ</th><th>ครูที่ลา</th><th>ประเภท</th><th>ชั้น</th><th>วิชา</th><th>ครูสอนแทน</th><th>ที่มา</th><th></th></tr></thead><tbody>
        ${list.map((r) => `<tr><td>${esc(thDay(r.sub_date))} ${esc(thDate(r.sub_date))}</td><td class="c">${r.period}</td>
          <td>${esc(r.absent_teacher)}</td><td>${esc(r.leave_type)}</td><td>${esc(r.grade)}</td><td>${esc(r.subject)}</td>
          <td>${r.substitute_teacher ? esc(r.substitute_teacher) : '<span class="muted">ไม่ต้องสอนแทน</span>'}</td>
          <td class="small">${SRC[r.source] || ''}</td>
          <td class="nowrap"><button class="btn btn-sm" data-edit="${r.id}">แก้ไข</button>
            <button class="btn btn-sm btn-danger" data-del="${r.id}">ลบ</button></td></tr>`).join('')}
      </tbody></table></div><p class="muted small">รวม ${list.length} คาบ</p>` : '<p class="muted">ยังไม่มีรายการในเดือนนี้</p>'}</div>`;

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
    if (!confirm('ลบรายการนี้?')) return;
    try { await q(sb.from('sub_records').delete().eq('id', b.dataset.del)); toast('ลบแล้ว'); render(el, ctx); } catch (err) { toast(err.message, 'err'); }
  }));
}
