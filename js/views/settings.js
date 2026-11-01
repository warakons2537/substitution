// ผู้ดูแลระบบ: ตั้งค่าแบบพิมพ์ (ผู้ลงนาม / สังกัด)
import { $, $$, esc, toast, thDate, confirmBox } from '../util.js';
import { sb, q, settings } from '../db.js';
import { loadRules, fmtDays } from '../leaves.js';
import { hero } from '../gui.js';

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

/** ผู้ดูแลระบบ: ตั้งค่าแบบพิมพ์ */
export async function render(el) {
  el.innerHTML = `<div class="wl-g">${hero('ตั้งค่าแบบพิมพ์', 'ผู้ลงนามและสังกัดที่ใช้ในแบบฟอร์มพิมพ์')}<div id="set-body" class="g-stack"></div></div>`;
  await printForm($('#set-body', el));
}

/** งานบุคคล: การอนุญาตใบลา · ประเภท/โควตา · วันหยุด */
export async function renderLeave(el, ctx) {
  const tab = sessionStorage.getItem('wlsub-settab') || 'approval';
  el.innerHTML = `<div class="wl-g">${hero('ตั้งค่าการลา', 'การอนุญาตใบลา ประเภทและโควตา วันหยุด')}
    <div class="g-chips" role="group" aria-label="หมวดตั้งค่า">
    ${[['approval', 'การอนุญาตใบลา'], ['types', 'ประเภทและโควตาการลา'], ['holidays', 'วันหยุด']].map(([k, t]) => `<button type="button" data-t="${k}" class="g-chip" aria-pressed="${tab === k}">${t}</button>`).join('')}</div>
    <div id="set-body" class="g-stack"></div></div>`;
  $$('[data-t]', el).forEach((b) => b.addEventListener('click', () => { sessionStorage.setItem('wlsub-settab', b.dataset.t); renderLeave(el, ctx); }));
  const body = $('#set-body', el);
  if (tab === 'types') await types(body); else if (tab === 'holidays') await holidays(body); else await approval(body);
}

const MODE = { immediate: 'มีผลทันที (ยืนยันเอกสารที่เซ็นแล้วภายหลัง)', director: 'ต้องอนุญาตในระบบ (ผอ. กดอนุญาต)' };
async function approval(el) {
  const s = await settings();
  el.innerHTML = `<section class="g-card"><div class="g-pad"><p class="muted small">กำหนดว่าเมื่อครูยื่นใบลา ใบลาจะ "มีผลทันที" หรือ "รอ ผอ. อนุญาตในระบบ" · ทั้งสองแบบใช้ร่วมกับการเซ็นเอกสารกระดาษได้ (งานบุคคลกด "เซ็นแล้ว" ที่เมนู ตรวจ/อนุญาต)
    · การจัดสอนแทน<b>ไม่ต้องรอ</b>การอนุญาต · กำหนดรายประเภทได้ที่แท็บ "ประเภทและโควตาการลา"</p>
    <form id="ap-form" class="g-form"><label class="span2">โหมดเริ่มต้น (ทุกประเภท)<select name="leave_approval">
      ${Object.entries(MODE).map(([k, t]) => `<option value="${k}" ${s.leave_approval === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <div class="g-actions"><button class="g-btn" type="submit">บันทึก</button></div></form></div></section>`;
  $('#ap-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await q(sb.from('sub_settings').update({ leave_approval: e.target.leave_approval.value }).eq('id', 1)); toast('บันทึกแล้ว'); } catch (err) { toast(err.message, 'err'); }
  });
}

async function printForm(el) {
  const s = await settings();
  el.innerHTML = `<section class="g-card"><div class="g-pad"><form id="s-form" class="g-form">
    ${FIELDS.map(([k, l, ph]) => `<label class="span2">${l}<input name="${k}" value="${esc(s[k] || '')}" placeholder="${esc(ph)}"></label>`).join('')}
    <div class="g-actions"><button class="g-btn" type="submit">บันทึก</button></div></form></div></section>`;
  $('#s-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries([...new Map([...new FormData(e.target).entries()].map(([k, x]) => [k, x.trim()])).entries()]);
    try { await q(sb.from('sub_settings').update(v).eq('id', 1)); toast('บันทึกแล้ว'); } catch (err) { toast(err.message, 'err'); }
  });
}

async function types(el) {
  const { types: list } = await loadRules();
  el.innerHTML = `<section class="g-card"><div class="g-pad"><p class="muted small">โควตาต่อปีงบประมาณ (1 ต.ค. – 30 ก.ย.) · เว้นว่าง = ไม่จำกัด/ไม่ตรวจ · "นับวันปฏิทิน" = นับรวมเสาร์-อาทิตย์และวันหยุด (เช่น ลาคลอด)
    · ค่าตั้งต้นเป็นเพียงตัวอย่าง กรุณาตรวจสอบกับระเบียบ/ประกาศของโรงเรียนและต้นสังกัด</p>
    <form id="ty-add" class="g-addrow"><input class="g-input" name="name" placeholder="เพิ่มประเภทการลาใหม่" maxlength="60" required aria-label="ชื่อประเภทการลาใหม่"><button class="g-btn g-btn-sm" type="submit">+ เพิ่มประเภท</button></form></div></section>
    <div class="g-ucards">
    ${list.map((t) => `<article class="g-ucard" data-ty="${esc(t.leave_type)}"><div class="g-ucard-h"><b>${esc(t.leave_type)}</b></div>
      <div class="g-form"><label>โควตา (วัน)<input type="number" name="quota" min="0" step="0.5" inputmode="decimal" placeholder="ไม่จำกัด" value="${t.quota_days == null ? '' : fmtDays(t.quota_days)}"></label>
        <label>การอนุญาต<select name="appr"><option value="">ตามโหมดเริ่มต้น</option>${Object.entries(MODE).map(([k, x]) => `<option value="${k}" ${t.approval === k ? 'selected' : ''}>${x.split(' (')[0]}</option>`).join('')}</select></label></div>
      <div class="g-checks">${'is_leave' in t ? `<label class="g-check"><input class="g-chk" type="checkbox" name="isl" ${t.is_leave ? 'checked' : ''}> นับเป็นวันลา</label>` : ''}<label class="g-check"><input class="g-chk" type="checkbox" name="cal" ${t.calendar_days ? 'checked' : ''}> นับวันปฏิทิน</label>
        <label class="g-check"><input class="g-chk" type="checkbox" name="act" ${t.active ? 'checked' : ''}> ใช้งาน</label></div>
      <div class="g-actions"><button class="g-btn g-btn-sm" type="button" data-save>บันทึก</button></div></article>`).join('')}
    </div>`;
  $$('[data-save]', el).forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('[data-ty]'); const qv = tr.querySelector('[name=quota]').value;
    try {
      const upd = { quota_days: qv === '' ? null : +qv, calendar_days: tr.querySelector('[name=cal]').checked, approval: tr.querySelector('[name=appr]').value || null,
        active: tr.querySelector('[name=act]').checked };
      const isl = tr.querySelector('[name=isl]'); if (isl) upd.is_leave = isl.checked;   // มีเมื่อรัน SQL รอบ 6 แล้ว
      await q(sb.from('sub_leave_types').update(upd).eq('leave_type', tr.dataset.ty));
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
  el.innerHTML = `<section class="g-card"><div class="g-pad"><p class="muted small">วันหยุดราชการ/วันหยุดของโรงเรียนที่ไม่นับเป็นวันลา (ใช้กับประเภทที่นับวันทำการ) · ระบบไม่ใส่วันหยุดให้อัตโนมัติ ให้เพิ่มเองตามปฏิทินของโรงเรียน</p>
    <form id="hd-add" class="g-form"><label>วันที่<input type="date" name="day" required></label>
      <label class="span2">ชื่อวันหยุด<input name="name" maxlength="100" placeholder="เช่น วันเข้าพรรษา"></label>
      <div class="g-actions"><button class="g-btn" type="submit">+ เพิ่ม</button></div></form></div></section>
    <section class="g-card"><div class="g-card-h"><h3>วันหยุดที่ตั้งไว้ (${list.length})</h3></div>${list.length ? list.map((h) => `<div class="g-row"><span><b>${esc(thDate(String(h.day).slice(0, 10), { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' }))}</b> ${esc(h.name)}</span>
        <button class="g-btn g-btn-line g-btn-sm g-danger" type="button" data-del="${String(h.day).slice(0, 10)}">ลบ</button></div>`).join('') : '<p class="g-empty">ยังไม่มีวันหยุด</p>'}</section>`;
  $('#hd-add', el).addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    try { await q(sb.from('sub_holidays').upsert({ day: f.day.value, name: f.name.value.trim() })); toast('เพิ่มแล้ว'); holidays(el); } catch (err) { toast(err.message, 'err'); }
  });
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('ลบวันหยุดนี้?'))) return;
    try { await q(sb.from('sub_holidays').delete().eq('day', b.dataset.del)); toast('ลบแล้ว'); holidays(el); } catch (err) { toast(err.message, 'err'); }
  }));
}
