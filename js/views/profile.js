// ทุกสิทธิ์: ข้อมูลของฉัน (ใช้ในแบบพิมพ์ใบลา/บันทึกการสอนแทน)
import { $, esc, toast } from '../util.js';
import { sb, q } from '../db.js';
import { hero } from '../gui.js';

export async function render(el, ctx) {
  const { me } = ctx;
  el.innerHTML = `<div class="wl-g">${hero('ข้อมูลของฉัน', `ใช้พิมพ์ในใบลาและบันทึกการสอนแทน${me.teacher ? ` · ชื่อในตารางสอน: ${esc(me.teacher)}` : ''}`)}
    <section class="g-card"><div class="g-pad"><form id="p-form" class="g-form">
      <label class="span2">ชื่อ-สกุล (มีคำนำหน้า)<input name="full_name" value="${esc(me.full_name)}" placeholder="เช่น นายวรากร ตรงต่อกิจ" required></label>
      <label>ตำแหน่ง (ใบลา)<input name="position" value="${esc(me.position)}" placeholder="เช่น ครูชำนาญการ"></label>
      <label>ตำแหน่ง (บันทึกการสอนแทน)<input name="position_short" value="${esc(me.position_short)}" placeholder="เช่น ครู คศ.2"></label>
      <label>เบอร์โทรศัพท์<input name="phone" type="tel" inputmode="tel" value="${esc(me.phone)}" placeholder="เช่น 091-383-1718"></label>
      <div class="g-actions"><button class="g-btn" type="submit">บันทึก</button></div>
    </form></div></section></div>`;
  $('#p-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    try {
      await q(sb.rpc('sub_save_profile', { p_full_name: f.full_name.trim(), p_position: f.position.trim(),
        p_position_short: f.position_short.trim(), p_phone: f.phone.trim() }));
      Object.assign(me, { full_name: f.full_name.trim(), position: f.position.trim(), position_short: f.position_short.trim(), phone: f.phone.trim() });
      toast('บันทึกแล้ว');
    } catch (err) { toast(err.message, 'err'); }
  });
}
