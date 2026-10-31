// ผู้ดูแลระบบ: ตั้งค่าแบบพิมพ์ (ผู้ลงนาม / สังกัด)
import { $, $$, esc, toast, thDate, confirmBox } from '../util.js';
import { sb, q, settings } from '../db.js';
import { loadRules, fmtDays } from '../leaves.js';

const FIELDS = [
  ['district', 'อำเภอ', 'เช่น ศรีสำโรง'],
  ['area_office', 'สำนักงานเขตพื้นที่การศึกษา', 'เช่น สำนักงานเขตพื้นที่การศึกษาประถมศึกษาสุโขทัย เขต 2'],
  ['personnel_name', 'ชื่อหัวหน้าฝ่ายบุคคล (ผู้ตรวจสอบใบลา)', 'เช่น นางสาวสุรรัตน์ บุญประสิทธิ์'],
  ['personnel_position', 'ตำแหน่งหัวหน้าฝ่ายบุคคล', ''],
  ['academic_name', 'ชื่อหัวหน้าวิชาการ', 'เช่น นางเจษฎ์สุดา ขำพงศ์'],
  ['academic_position', 'ตำแหน่งหัวหน้าวิชาการ', ''],
  ['director_name', 'ชื่อผู้อำนวยการ', 'เช่น นายอัครวีร กระแสร์'],
  ['director_position', 'ตำแหน่งผู้อำนวยการ', ''],
];

export async function render(el, ctx) {
  const tab = sessionStorage.getItem('wlsub-settab') || 'print';
  el.innerHTML = `<h2>ตั้งค่า</h2><div class="tabs">
    ${[['print', 'แบบพิมพ์'], ['types', 'ประเภทและโควตาการลา'], ['holidays', 'วันหยุด']].map(([k, t]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div id="set-body"></div>`;
  $$('[data-t]', el).forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem('wlsub-settab', b.dataset.t); render(el, ctx); }));
  const body = $('#set-body', el);
  if (tab === 'types') await types(body); else if (tab === 'holidays') await holidays(body); else await printForm(body);
}

async function printForm(el) {
  const s = await settings();
  el.innerHTML = `<div class="card"><form id="s-form" class="form-grid">
    ${FIELDS.map(([k, l, ph]) => `<label class="span2">${l}<input name="${k}" value="${esc(s[k] || '')}" placeholder="${esc(ph)}"></label>`).join('')}
    <div class="actions span-all"><button class="btn btn-primary" type="submit">บันทึก</button></div></form></div>`;
  $('#s-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries([...new Map([...new FormData(e.target).entries()].map(([k, x]) => [k, x.trim()])).entries()]);
    try { await q(sb.from('sub_settings').update(v).eq('id', 1)); toast('บันทึกแล้ว'); } catch (err) { toast(err.message, 'err'); }
  });
}

async function types(el) {
  const { types: list } = await loadRules();
  el.innerHTML = `<div class="card"><p class="muted small">โควตาต่อปีงบประมาณ (1 ต.ค. – 30 ก.ย.) · เว้นว่าง = ไม่จำกัด/ไม่ตรวจ · "นับวันปฏิทิน" = นับรวมเสาร์-อาทิตย์และวันหยุด (เช่น ลาคลอด)
    · ค่าตั้งต้นเป็นเพียงตัวอย่าง กรุณาตรวจสอบกับระเบียบ/ประกาศของโรงเรียนและต้นสังกัด</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>ประเภทการลา</th><th>โควตา (วัน)</th><th class="c">นับวันปฏิทิน</th><th class="c">ใช้งาน</th><th></th></tr></thead><tbody>
    ${list.map((t) => `<tr data-ty="${esc(t.leave_type)}"><td>${esc(t.leave_type)}</td>
      <td><input type="number" name="quota" min="0" step="0.5" value="${t.quota_days == null ? '' : fmtDays(t.quota_days)}" style="width:110px"></td>
      <td class="c"><input type="checkbox" name="cal" ${t.calendar_days ? 'checked' : ''}></td>
      <td class="c"><input type="checkbox" name="act" ${t.active ? 'checked' : ''}></td>
      <td><button class="btn btn-sm btn-primary" data-save>บันทึก</button></td></tr>`).join('')}
    </tbody></table></div>
    <form id="ty-add" class="row-between"><input name="name" placeholder="เพิ่มประเภทการลาใหม่" maxlength="60" required><button class="btn btn-sm" type="submit">+ เพิ่มประเภท</button></form></div>`;
  $$('[data-save]', el).forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr'); const qv = tr.querySelector('[name=quota]').value;
    try {
      await q(sb.from('sub_leave_types').update({ quota_days: qv === '' ? null : +qv, calendar_days: tr.querySelector('[name=cal]').checked,
        active: tr.querySelector('[name=act]').checked }).eq('leave_type', tr.dataset.ty));
      toast('บันทึกแล้ว (การลาที่บันทึกไว้แล้วไม่ถูกคำนวณวันใหม่ จนกว่าจะแก้ไขรายการนั้น)');
    } catch (e) { toast(e.message, 'err'); }
  }));
  $('#ty-add', el).addEventListener('submit', async (e) => {
    e.preventDefault(); const name = e.target.name.value.trim();
    try { await q(sb.from('sub_leave_types').insert({ leave_type: name, sort_order: list.length + 1 })); toast('เพิ่มแล้ว'); types(el); } catch (err) { toast(err.message, 'err'); }
  });
}

async function holidays(el) {
  const { holidays: list } = await loadRules();
  el.innerHTML = `<div class="card"><p class="muted small">วันหยุดราชการ/วันหยุดของโรงเรียนที่ไม่นับเป็นวันลา (ใช้กับประเภทที่นับวันทำการ) · ระบบไม่ใส่วันหยุดให้อัตโนมัติ ให้เพิ่มเองตามปฏิทินของโรงเรียน</p>
    <form id="hd-add" class="form-grid"><label>วันที่<input type="date" name="day" required></label>
      <label class="span2">ชื่อวันหยุด<input name="name" maxlength="100" placeholder="เช่น วันเข้าพรรษา"></label>
      <div class="actions" style="align-self:end"><button class="btn btn-primary" type="submit">+ เพิ่ม</button></div></form>
    ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>ชื่อ</th><th></th></tr></thead><tbody>
      ${list.map((h) => `<tr><td>${esc(thDate(String(h.day).slice(0, 10), { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' }))}</td><td>${esc(h.name)}</td>
        <td><button class="btn btn-sm btn-danger" data-del="${String(h.day).slice(0, 10)}">ลบ</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">ยังไม่มีวันหยุด</p>'}</div>`;
  $('#hd-add', el).addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    try { await q(sb.from('sub_holidays').upsert({ day: f.day.value, name: f.name.value.trim() })); toast('เพิ่มแล้ว'); holidays(el); } catch (err) { toast(err.message, 'err'); }
  });
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('ลบวันหยุดนี้?'))) return;
    try { await q(sb.from('sub_holidays').delete().eq('day', b.dataset.del)); toast('ลบแล้ว'); holidays(el); } catch (err) { toast(err.message, 'err'); }
  }));
}
