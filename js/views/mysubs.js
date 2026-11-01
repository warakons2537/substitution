// ระบบสอนแทน (ครูทุกคน): คาบที่ฉันได้รับมอบหมายให้สอนแทน (เห็นเฉพาะที่เป็นของฉัน)
import { esc, thDate, thDay, todayISO, dowIndex } from '../util.js';
import { rankData } from '../db.js';
import { slotsOf, gradeLabel } from '../timetable.js';
import { hero } from '../gui.js';

export async function render(el, { me, tt }) {
  const today = todayISO();
  const rank = await rankData();
  const mine = rank.records.filter((r) => r.st === 'confirmed' && r.s === me.teacher && r.d >= today).sort((a, b) => (a.d + a.p < b.d + b.p ? -1 : 1));
  const past = rank.records.filter((r) => r.st === 'confirmed' && r.s === me.teacher && r.d < today).length;
  const info = (r) => { // ชั้น/วิชา จากตารางสอนของครูที่ลา
    const s = slotsOf(tt.data, r.a, dowIndex(r.d)).find((x) => x.p === r.p);
    return s ? `${gradeLabel(s)} ${s.subject}` : '';
  };
  const days = [...new Set(mine.map((r) => r.d))];
  el.innerHTML = `<div class="wl-g">${hero('สอนแทนของฉัน', `คาบที่ฝ่ายวิชาการหรือครูผู้ลาจัดให้คุณสอนแทน ตั้งแต่วันนี้เป็นต้นไป · ที่ผ่านมาแล้ว ${past} คาบ`)}
    ${days.length ? days.map((d) => `<section class="g-card"><div class="g-card-h"><h3>${esc(thDay(d))} ${esc(thDate(d))}</h3></div><div class="g-scroll"><table class="g-tbl"><thead><tr><th class="c">คาบ</th><th>สอนแทนครู</th><th>ชั้น/วิชา</th></tr></thead><tbody>
      ${mine.filter((r) => r.d === d).map((r) => `<tr><td class="c num"><b>${r.p}</b></td><td>${esc(r.a)}</td><td>${esc(info(r))}</td></tr>`).join('')}</tbody></table></div></section>`).join('')
      : '<section class="g-card"><p class="g-empty">ยังไม่มีคาบสอนแทนที่ได้รับมอบหมาย</p></section>'}</div>`;
}
