// ระบบสอนแทน (ครูทุกคน): คาบที่ฉันได้รับมอบหมายให้สอนแทน (เห็นเฉพาะที่เป็นของฉัน) + กด "รับทราบ"
import { esc, thDate, thDay, todayISO, dowIndex, toast } from '../util.js';
import { sb, q, rankData } from '../db.js';
import { slotsOf, gradeLabel } from '../timetable.js';
import { hero, pill } from '../gui.js';

export async function render(el, ctx) {
  const { me, tt } = ctx;
  const today = todayISO();
  const rank = await rankData();
  const mine = rank.records.filter((r) => r.st === 'confirmed' && r.s === me.teacher && r.d >= today).sort((a, b) => (a.d + a.p < b.d + b.p ? -1 : 1));
  const past = rank.records.filter((r) => r.st === 'confirmed' && r.s === me.teacher && r.d < today).length;
  const canAck = mine.some((r) => 'k' in r);             // ฐานข้อมูลรอบ 5 (รับทราบ) ติดตั้งแล้ว
  const waiting = canAck ? mine.filter((r) => !r.k) : [];
  const info = (r) => { // ชั้น/วิชา จากตารางสอนของครูที่ลา
    const s = slotsOf(tt.data, r.a, dowIndex(r.d)).find((x) => x.p === r.p);
    return s ? `${gradeLabel(s)} ${s.subject}` : '';
  };
  const days = [...new Set(mine.map((r) => r.d))];
  const ackBtn = (ids, label) => `<button class="g-btn g-btn-sm" type="button" data-ack="${ids.join(',')}">${label}</button>`;
  el.innerHTML = `<div class="wl-g">${hero('สอนแทนของฉัน', `คาบที่ฝ่ายวิชาการหรือครูผู้ลาจัดให้คุณสอนแทน ตั้งแต่วันนี้เป็นต้นไป · ที่ผ่านมาแล้ว ${past} คาบ`)}
    ${waiting.length ? `<div class="g-note" role="status"><span>มี <b>${waiting.length}</b> คาบที่ยังไม่ได้กดรับทราบ</span>${ackBtn(waiting.map((r) => r.i), 'รับทราบทั้งหมด')}</div>` : ''}
    ${days.length ? days.map((d) => { const rows = mine.filter((r) => r.d === d); const wait = canAck ? rows.filter((r) => !r.k) : [];
      return `<section class="g-card"><div class="g-card-h"><h3>${esc(thDay(d))} ${esc(thDate(d))}</h3>${wait.length > 1 ? ackBtn(wait.map((r) => r.i), 'รับทราบทั้งวัน') : ''}</div><div class="g-scroll"><table class="g-tbl"><thead><tr><th class="c">คาบ</th><th>สอนแทนครู</th><th>ชั้น/วิชา</th>${canAck ? '<th>รับทราบ</th>' : ''}</tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="c num"><b>${r.p}</b></td><td>${esc(r.a)}</td><td>${esc(info(r))}</td>${canAck ? `<td class="nowrap">${r.k ? pill('approved', 'รับทราบแล้ว') : ackBtn([r.i], 'รับทราบ')}</td>` : ''}</tr>`).join('')}</tbody></table></div></section>`; }).join('')
      : '<section class="g-card"><p class="g-empty">ยังไม่มีคาบสอนแทนที่ได้รับมอบหมาย</p></section>'}</div>`;
  el.querySelectorAll('[data-ack]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { const n = await q(sb.rpc('sub_ack', { p_ids: b.dataset.ack.split(',') })); toast(n ? `รับทราบแล้ว ${n} คาบ` : 'ไม่มีคาบที่ต้องรับทราบเพิ่ม'); render(el, ctx); } catch (e) { toast(e.message, 'err'); b.disabled = false; }
  }));
}
