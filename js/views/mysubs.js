// ระบบสอนแทน (ครูทุกคน): คาบที่ฉันได้รับมอบหมายให้สอนแทน (เห็นเฉพาะที่เป็นของฉัน) + กด "รับทราบ"
import { esc, thDate, thDay, todayISO, dowIndex, toast } from '../util.js';
import { sb, q, rankData, settingsCached, periodTime } from '../db.js';
import { slotsOf, gradeLabel } from '../timetable.js';
import { hero, pill } from '../gui.js';

export async function render(el, ctx) {
  const { me, tt } = ctx;
  const today = todayISO();
  const [rank, set] = await Promise.all([rankData(), settingsCached()]);
  const hasTime = (set.period_times || []).some(Boolean);
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
      return `<section class="g-card"><div class="g-card-h"><h3>${d === today ? 'วันนี้ · ' : ''}${esc(thDay(d))} ${esc(thDate(d))}</h3>${wait.length > 1 ? ackBtn(wait.map((r) => r.i), 'รับทราบทั้งวัน') : ''}</div>
      ${rows.map((r) => `<div class="g-row g-subrow"><span class="g-period"><b class="num">คาบ ${r.p}</b>${hasTime && periodTime(set, r.p) ? `<small class="num">${periodTime(set, r.p)} น.</small>` : ''}</span>
        <span class="g-subinfo"><b>แทน ${esc(r.a)}</b>${info(r) ? `<span class="g-sub">${esc(info(r))}</span>` : ''}</span>
        ${canAck ? (r.k ? pill('approved', 'รับทราบแล้ว') : ackBtn([r.i], 'รับทราบ')) : ''}</div>`).join('')}</section>`; }).join('')
      : '<section class="g-card"><p class="g-empty">ยังไม่มีคาบสอนแทนที่ได้รับมอบหมาย</p></section>'}</div>`;
  el.querySelectorAll('[data-ack]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { const n = await q(sb.rpc('sub_ack', { p_ids: b.dataset.ack.split(',') })); toast(n ? `รับทราบแล้ว ${n} คาบ` : 'ไม่มีคาบที่ต้องรับทราบเพิ่ม'); window.dispatchEvent(new Event('wlsub:counts')); render(el, ctx); } catch (e) { toast(e.message, 'err'); b.disabled = false; }
  }));
}
