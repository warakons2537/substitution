// ฝ่ายวิชาการ: กติกาคาบคู่ (ครูที่มีสอนคาบนั้นอยู่แล้ว รับสอนแทนห้องนักเรียนน้อยพร้อมกันได้)
import { $, esc, toast } from '../util.js';
import { sb, q, settings, clearSettings } from '../db.js';
import { dualRules } from '../planner.js';
import { hero } from '../gui.js';
import { icon } from '../icons.js';

export async function render(el, ctx) {
  const s = await settings();
  const ready = 'dual_grades' in s;
  const r = dualRules(s);
  const grades = [...new Set((ctx.tt?.data?.grades || []).map(String))];
  el.innerHTML = `<div class="wl-g">${hero('กติกาคาบคู่', 'ครูที่มีสอนคาบนั้นอยู่แล้ว รับสอนแทนห้องนักเรียนน้อยพร้อมกันได้เมื่อเข้าเงื่อนไข')}
    ${ready ? '' : `<div class="g-note" role="status">${icon('alert')}<span>ฐานข้อมูลยังไม่มีส่วนนี้ ตอนนี้ใช้ค่าตั้งต้นด้านล่าง — ให้ผู้ดูแลระบบรัน <b>supabase/schema.sql</b> ซ้ำ (รอบ 10) จึงจะบันทึกได้</span></div>`}
    <section class="g-card"><div class="g-pad"><form id="du-form" class="g-form">
      <label class="span-all">ชั้นที่นักเรียนน้อย (คั่นด้วยจุลภาค · ป2 = ป.2 ทุกห้อง)
        <input name="grades" value="${esc(r.grades.join(', '))}" placeholder="เช่น ป1, ป2, ป3, ป4, ม2, ม3">
        ${grades.length ? `<small class="g-sub">ชั้นในตารางสอน: ${esc(grades.join(', '))}</small>` : ''}</label>
      <label class="span-all g-check" style="flex-direction:row;align-items:center;width:fit-content"><input type="checkbox" name="both" ${r.bothSmall ? 'checked' : ''}> ห้องที่ครูกำลังสอนอยู่ต้องเป็นห้องนักเรียนน้อยด้วย</label>
      <label>ห่างกันได้ไม่เกิน (ตึก)<select name="dist">
        ${[['', 'ไม่จำกัด'], ['0', 'ตึกเดียวกันเท่านั้น'], ['1', '1 ตึก (ตึกติดกัน)'], ['2', '2 ตึก']].map(([v, t]) => `<option value="${v}"${String(r.maxDist ?? '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>รับคาบคู่ได้ไม่เกิน (คาบ/คน/วัน)<select name="day">
        ${[['', 'ไม่จำกัด'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']].map(([v, t]) => `<option value="${v}"${String(r.maxDay ?? '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <p class="g-sub span-all">ระยะตึกนับตามลำดับตึกใน WL Scheduler · ครูที่ไม่ทราบตึกถือว่าอยู่ไกล · ครูคาบคู่จะไม่ถูกเลือกให้อัตโนมัติ ผู้จัดต้องเลือกเอง · ครูว่างที่สอนแทนห้องเล็กอยู่แล้ว 1 ห้อง รับห้องเล็กเพิ่มได้อีก 1 ห้อง (รวมไม่เกิน 2 ห้องต่อคาบ · SQL รอบ 11)</p>
      <div class="g-actions"><button class="g-btn" type="submit" ${ready ? '' : 'disabled'}>บันทึก</button></div>
    </form></div></section></div>`;
  $('#du-form', el).addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    const list = f.grades.value.split(/[,\s]+/).map((g) => g.replace(/[\s.]/g, '')).filter(Boolean);
    try {
      await q(sb.rpc('sub_dual_save', { p_grades: list.join(','), p_both: f.both.checked,
        p_dist: f.dist.value === '' ? null : +f.dist.value, p_day: f.day.value === '' ? null : +f.day.value }));
      clearSettings(); toast('บันทึกกติกาคาบคู่แล้ว'); render(el, ctx);
    } catch (err) { toast(err.message, 'err'); }
  });
}
