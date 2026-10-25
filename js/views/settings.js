// ผู้ดูแลระบบ: ตั้งค่าแบบพิมพ์ (ผู้ลงนาม / สังกัด)
import { $, esc, toast } from '../util.js';
import { sb, q, settings } from '../db.js';

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

export async function render(el) {
  const s = await settings();
  el.innerHTML = `<h2>ตั้งค่าแบบพิมพ์</h2><div class="card"><form id="s-form" class="form-grid">
    ${FIELDS.map(([k, l, ph]) => `<label class="span2">${l}<input name="${k}" value="${esc(s[k] || '')}" placeholder="${esc(ph)}"></label>`).join('')}
    <div class="actions span-all"><button class="btn btn-primary" type="submit">บันทึก</button></div></form></div>`;
  $('#s-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries([...new FormData(e.target).entries()].map(([k, x]) => [k, x.trim()]));
    try { await q(sb.from('sub_settings').update(v).eq('id', 1)); toast('บันทึกแล้ว'); } catch (err) { toast(err.message, 'err'); }
  });
}
