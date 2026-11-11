// ฝ่ายวิชาการ/ผู้ดูแล: ตั้งเวลาแจ้งเตือนครูสอนแทน (เย็นวันก่อน · เช้าวันสอน · ก่อนเริ่มคาบ) + เวลาเริ่มคาบ
import { $, toast } from '../util.js';
import { sb, q, settings, clearSettings } from '../db.js';
import { hero } from '../gui.js';
import { icon } from '../icons.js';
import { deviceState, enableDevice, showDevice, pop, DEVICE_TEXT, pushSupported, pushState, syncPush } from '../notify.js';

const hhmm = (v) => String(v || '').slice(0, 5);
const BEFORE = [5, 10, 15, 20, 30];

export async function render(el, ctx) {
  const s = await settings();
  if (!('remind_on' in s)) {
    el.innerHTML = `<div class="wl-g">${hero('เวลาแจ้งเตือน', 'เตือนครูสอนแทนตามเวลาที่กำหนด')}
      <div class="g-note" role="status">${icon('alert')}<span>ฐานข้อมูลยังไม่มีส่วนแจ้งเตือนตามเวลา — ให้ผู้ดูแลระบบรัน <b>supabase/schema.sql</b> ซ้ำอีกครั้ง (รอบ 7) แล้วกลับมาหน้านี้</span></div></div>`;
    return;
  }
  const st = await q(sb.rpc('sub_remind_status')).catch(() => null);
  const nP = Math.max(ctx.tt?.data?.periods || 8, (s.period_times || []).length);
  const times = Array.from({ length: nP }, (_, i) => hhmm((s.period_times || [])[i]));
  const filled = times.filter(Boolean).length;
  const dev = deviceState();
  const ps = await q(sb.rpc('sub_push_status')).catch(() => null);   // null = ยังไม่รัน SQL รอบ 8
  const pushMsg = !pushSupported() ? ['alert', 'แจ้งเตือนเมื่อปิดแอป (Web Push): ยังไม่ได้ใส่กุญแจในแอป หรือเบราว์เซอร์นี้ไม่รองรับ']
    : !ps ? ['alert', 'แจ้งเตือนเมื่อปิดแอป (Web Push): ฐานข้อมูลยังไม่มีส่วนนี้ — รัน schema.sql ซ้ำ (รอบ 8)']
    : !ps.configured || !ps.net ? ['alert', `แจ้งเตือนเมื่อปิดแอป (Web Push): ผู้ดูแลระบบยังตั้งค่าไม่ครบ${ps.net ? '' : ' (ยังไม่เปิด pg_net)'}${ps.configured ? '' : ' (ยังไม่ได้ตั้งปลายทาง sub_push_setup)'} — ดูขั้นตอนใน README`]
    : pushState() === 'on' ? ['check', 'แจ้งเตือนเมื่อปิดแอป (Web Push): เครื่องนี้พร้อมรับแล้ว']
    : ['alert', 'แจ้งเตือนเมื่อปิดแอป (Web Push): ระบบพร้อม — กด "เปิดแจ้งเตือนบนเครื่องนี้" เพื่อเริ่มรับ'];
  el.innerHTML = `<div class="wl-g">${hero('เวลาแจ้งเตือน', 'เตือนครูที่ได้รับมอบหมายให้สอนแทน ตามเวลาที่โรงเรียนกำหนด')}
    <div class="g-note ${st?.cron ? 'g-note-ok' : ''}" role="status">${icon(st?.cron ? 'check' : 'alert')}<span>${st?.cron
      ? 'ระบบเตือนอัตโนมัติทำงานอยู่ (ฐานข้อมูลตรวจทุก 5 นาที แม้ไม่มีใครเปิดแอป)'
      : 'ยังไม่ได้เปิดตัวตั้งเวลาอัตโนมัติของฐานข้อมูล (pg_cron) — ตอนนี้การเตือนจะถูกสร้างเมื่อมีผู้ใช้คนใดคนหนึ่งเปิดแอปอยู่ · เปิดได้ที่ Supabase → Database → Extensions → pg_cron แล้วรัน schema.sql ซ้ำ'}</span></div>
    <form id="rm-form" class="g-stack">
    <section class="g-card"><div class="g-card-h"><h3>เตือนเมื่อไร</h3>
        <label class="g-check"><input class="g-chk" type="checkbox" name="on" ${s.remind_on ? 'checked' : ''}> เปิดใช้การเตือน</label></div>
      <div class="g-pad"><div class="g-form">
        <label>เย็นวันก่อนสอนแทน<input type="time" name="eve" value="${hhmm(s.remind_eve)}"><small class="g-hint">เช่น 16:00 · เว้นว่าง = ไม่เตือน</small></label>
        <label>เช้าวันที่สอนแทน<input type="time" name="morning" value="${hhmm(s.remind_morning)}"><small class="g-hint">เช่น 07:00 · เว้นว่าง = ไม่เตือน</small></label>
        <label>ก่อนเริ่มคาบสอนแทน<select name="before"><option value="">ไม่เตือน</option>${BEFORE.map((m) => `<option value="${m}" ${+s.remind_before === m ? 'selected' : ''}>${m} นาที</option>`).join('')}</select>
          <small class="g-hint">ใช้ได้เมื่อกรอกเวลาเริ่มคาบด้านล่าง</small></label></div>
        <p class="muted small">ข้อความเตือนมีเฉพาะ วัน คาบ ชั้น/วิชา และชื่อครูที่สอนแทนให้ — ไม่มีเหตุผลการลา · ฝ่ายวิชาการได้สรุป "วันนี้มีสอนแทนกี่คาบ / ยังไม่รับทราบกี่คาบ" พร้อมการเตือนตอนเช้า</p></div></section>
    <section class="g-card"><div class="g-card-h"><h3>เวลาเริ่มคาบ</h3><span class="g-tag">กรอกแล้ว ${filled}/${nP} คาบ</span></div>
      <div class="g-pad"><p class="muted small">กรอกตามตารางเวลาเรียนของโรงเรียน (ระบบไม่ได้ใส่ให้เอง) · ใช้เตือนก่อนเริ่มคาบ และแสดงเวลาในหน้า "สอนแทนของฉัน"</p>
        <div class="g-times">${times.map((t, i) => `<label>คาบ ${i + 1}<input type="time" name="p${i}" value="${t}"></label>`).join('')}</div>
        <div class="g-actions"><button class="g-btn" type="submit">บันทึก</button></div></div></section></form>
    <section class="g-card"><div class="g-card-h"><h3>อุปกรณ์เครื่องนี้</h3></div>
      <div class="g-pad"><p class="rm-dev">${icon('phone')}<span>${DEVICE_TEXT[dev]}</span></p>
        <p class="rm-dev">${icon(pushMsg[0])}<span>${pushMsg[1]}</span></p>
        <p class="muted small">ครูแต่ละคนต้องกด "เปิดแจ้งเตือน" บนเครื่องของตัวเอง 1 ครั้ง (ที่กระดิ่งมุมขวาบน) · เมื่อแอปเปิดอยู่หรือพักอยู่เบื้องหลัง จะมีแจ้งเตือนเด้งที่เครื่อง · เมื่อ Web Push พร้อม จะเด้งแม้ปิดแอปอยู่ · ออกจากระบบ = เลิกรับบนเครื่องนั้น</p>
        <div class="g-actions">${dev === 'default' ? '<button class="g-btn g-btn-line" type="button" id="rm-allow">เปิดแจ้งเตือนบนเครื่องนี้</button>' : ''}
          <button class="g-btn g-btn-line" type="button" id="rm-test">ทดสอบการแจ้งเตือน</button></div></div></section></div>`;

  $('#rm-form', el).addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    const list = times.map((_, i) => f[`p${i}`].value);
    while (list.length && !list[list.length - 1]) list.pop();
    const gap = list.findIndex((t, i) => t && i > 0 && list[i - 1] && t <= list[i - 1]);
    if (gap > 0) { toast(`เวลาเริ่มคาบ ${gap + 1} ต้องช้ากว่าคาบ ${gap}`, 'err'); return; }
    if (f.before.value && !list.some(Boolean)) { toast('กรอกเวลาเริ่มคาบก่อน จึงจะเตือนก่อนเริ่มคาบได้', 'err'); return; }
    try {
      await q(sb.rpc('sub_remind_save', { p_on: f.on.checked, p_eve: f.eve.value, p_morning: f.morning.value, p_before: f.before.value ? +f.before.value : null, p_times: list }));
      clearSettings(); toast('บันทึกเวลาแจ้งเตือนแล้ว'); render(el, ctx);
    } catch (err) { toast(err.message, 'err'); }
  });
  $('#rm-allow', el)?.addEventListener('click', async () => { if ((await enableDevice()) === 'granted') await syncPush(); render(el, ctx); });
  $('#rm-test', el).addEventListener('click', async () => {
    const x = { kind: 'sub_remind_soon', title: 'ตัวอย่าง: อีกไม่เกิน 10 นาที สอนแทนคาบ 3', body: `เริ่ม ${times[2] || '10:30'} น. · แทน ครูตัวอย่าง · ป.4/1 คณิตศาสตร์`, link: 'mysubs' };
    pop(x);
    if (deviceState() === 'granted') { setTimeout(() => showDevice(x.title, x.body, x.link, 'wlsub-test'), 400); toast('ส่งแจ้งเตือนทดสอบไปที่เครื่องนี้แล้ว'); }
  });
}
