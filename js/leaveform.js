// แบบฟอร์มการลา (ใช้ร่วม: ฝ่ายวิชาการจัดสอนแทน / ผู้ขอลาแจ้ง)
import { $, $$, esc, opts, todayISO, dowIndex, dateRange } from './util.js';
import { LEAVE_TYPES } from './config.js';
import { slotsOf, realTeachers } from './timetable.js';
import { readLeaveText, parseLeave } from './leaveread.js';

/**
 * fixedTeacher: ชื่อครู (ผู้ขอลา) หรือ null = เลือกได้
 * onChange(v) เรียกเมื่อค่าเปลี่ยน: v = { teacher, from, to, dates, periods, leave_type, reason }
 * onParsed(p) เรียกหลังอ่านใบลาจากไฟล์ (เช่น เอาที่ติดต่อไปใส่)
 */
export function mountLeaveForm(el, { data, fixedTeacher = null, withReason = false, onChange, onParsed }) {
  const teachers = realTeachers(data);
  el.innerHTML = `<label>อ่านจากไฟล์ใบลา (.docx / .pdf ที่มีข้อความ — ไม่รองรับไฟล์สแกน)
    <input type="file" name="lf-file" accept=".docx,.pdf"></label><p class="small" id="lf-msg"></p>
  <div class="form-grid">
    <label>ครูที่ลา${fixedTeacher ? `<input value="${esc(fixedTeacher)}" disabled>`
      : `<select name="teacher"><option value="">— เลือก —</option>${opts(teachers)}</select>`}</label>
    <label>ตั้งแต่วันที่<input type="date" name="from" value="${todayISO()}"></label>
    <label>ถึงวันที่<input type="date" name="to" value="${todayISO()}"></label>
    <label>ประเภทการลา<select name="leave_type">${opts(LEAVE_TYPES, 'ไม่ระบุ')}</select></label>
    ${withReason ? '<label class="span2">เหตุผล/รายละเอียด<input name="reason" maxlength="300"></label>' : ''}
  </div>
  <div class="periods" id="lf-periods"></div>`;

  const val = (n) => $(`[name="${n}"]`, el)?.value || '';
  const read = () => {
    const teacher = fixedTeacher || val('teacher');
    const from = val('from'); let to = val('to') || from;
    if (to < from) to = from;
    const dates = from ? dateRange(from, to) : [];
    const single = dates.length === 1;
    const boxes = single ? $$('#lf-periods input', el) : [];
    const checked = boxes.filter((c) => c.checked).map((c) => +c.value);
    // ติ๊กครบทุกคาบ = ลาทั้งวัน (periods ว่าง)
    const periods = checked.length === boxes.length ? [] : checked;
    const noneChecked = boxes.length > 0 && checked.length === 0;
    return { teacher, from, to, dates, periods, single, noneChecked, leave_type: val('leave_type'), reason: val('reason') };
  };
  const drawPeriods = () => {
    const v = read(); const box = $('#lf-periods', el);
    if (!v.teacher || !v.from) { box.innerHTML = ''; return; }
    if (!v.single) { box.innerHTML = '<p class="muted small">ลาหลายวัน = ลาทั้งวันทุกวัน (ไม่นับเสาร์-อาทิตย์)</p>'; return; }
    const d = dowIndex(v.from);
    const ss = d < 0 ? [] : slotsOf(data, v.teacher, d);
    box.innerHTML = ss.length
      ? `<span class="muted small">คาบที่ลา (ติ๊กออกถ้าไม่ได้ลาทั้งวัน):</span> ${ss.map((s) =>
          `<label class="chk"><input type="checkbox" value="${s.p}" checked> คาบ ${s.p}</label>`).join('')}`
      : '<p class="muted small">วันนี้ไม่มีคาบสอนตามตารางสอน</p>';
    $$('input', box).forEach((c) => c.addEventListener('change', () => onChange(read())));
  };
  $('[name="lf-file"]', el).addEventListener('change', async (e) => {
    const file = e.target.files[0]; const msg = $('#lf-msg', el);
    if (!file) return;
    msg.className = 'small muted'; msg.textContent = 'กำลังอ่านไฟล์…';
    try {
      const text = await readLeaveText(file);
      if (text.replace(/\s/g, '').length < 20) throw new Error('ไม่พบข้อความในไฟล์ (อาจเป็นไฟล์สแกน) กรุณากรอกเอง');
      const p = parseLeave(text, teachers);
      const set = (n, v) => { const f = $(`[name="${n}"]`, el); if (f && v) f.value = v; };
      if (!fixedTeacher) set('teacher', p.teacher);
      set('from', p.from); set('to', p.to); set('leave_type', p.leave_type); set('reason', p.reason);
      drawPeriods(); onChange(read()); onParsed?.(p);
      const miss = ['ชื่อครู', 'ประเภทการลา', 'วันที่', 'เหตุผล'].filter((k) => !p.found.includes(k));
      const other = fixedTeacher && p.teacher && p.teacher !== fixedTeacher ? ` · ชื่อในใบลา (${p.name}) ไม่ตรงกับบัญชีนี้` : '';
      const noName = !p.teacher && p.name ? ` · ไม่พบ "${p.name}" ในตารางสอน` : '';
      msg.className = `small ${miss.length || other || noName ? 'warn' : 'muted'}`;
      msg.textContent = `อ่านได้: ${p.found.join(', ') || '-'}${miss.length ? ` · ไม่พบ: ${miss.join(', ')}` : ''}${noName}${other} — ตรวจสอบก่อนบันทึก`;
    } catch (err) { msg.className = 'small warn'; msg.textContent = err.message; }
    e.target.value = '';
  });
  $$('.form-grid input, .form-grid select', el).forEach((x) => x.addEventListener('change', () => {
    if (x.name === 'from' && val('to') < val('from')) $('[name="to"]', el).value = val('from');
    if (['teacher', 'from', 'to'].includes(x.name)) drawPeriods();
    onChange(read());
  }));
  drawPeriods();
  return { read };
}
