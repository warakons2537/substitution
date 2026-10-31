// หน้าแรก: ภาพรวมวันนี้ / คำขอที่รอ / ทางลัด
import { esc, thDate, thDay, todayISO } from '../util.js';
import { sb, q } from '../db.js';
import { periodText, dateText } from './request.js';

export async function render(el, ctx) {
  const { me } = ctx;
  const staff = me.role !== 'requester';
  const today = todayISO();
  const name = me.full_name || me.teacher || me.email;
  const month = today.slice(0, 7);
  const [yy, mm] = month.split('-').map(Number);
  const next = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  const [pending, todayRecs, monthRecs] = await Promise.all([
    q(sb.from('sub_requests').select('*').eq('status', 'pending').order('date_from').limit(50)),
    q(sb.from('sub_records').select('*').eq('status', 'confirmed').eq('sub_date', today).order('period')),
    staff ? q(sb.from('sub_records').select('id,substitute_teacher').eq('status', 'confirmed').gte('sub_date', `${month}-01`).lt('sub_date', next)) : [],
  ]);
  const mine = staff ? pending : pending.filter((r) => r.teacher_name === me.teacher);
  const stats = staff
    ? [[mine.length, 'คำขอรอพิจารณา'], [todayRecs.length, 'คาบสอนแทนวันนี้'], [monthRecs.length, 'คาบสอนแทนเดือนนี้'],
       [new Set(monthRecs.map((r) => r.substitute_teacher).filter(Boolean)).size, 'ครูที่สอนแทนเดือนนี้']]
    : [[mine.length, 'คำขอที่รอพิจารณา'], [todayRecs.length, 'คาบสอนแทนของฉันวันนี้']];
  el.innerHTML = `<div class="welcome"><span class="av" aria-hidden="true">${esc((name.replace(/^(ครู|นาย|นางสาว|นาง)\s*/, '').replace(/^[เแโใไ]/, '')[0]) || '?')}</span>
      <div><h1>สวัสดี ${esc(name)}</h1><p>${esc(thDay(today))} ${esc(thDate(today, { day: 'numeric', month: 'long', year: 'numeric' }))}</p></div>
      <a class="btn btn-gold" href="#${staff ? 'assist' : 'request'}">${staff ? 'ช่วยจัดครูสอนแทน' : 'แจ้งขอลา/ขอสอนแทน'}</a></div>
    <div class="stats">${stats.map(([n, t]) => `<div class="card stat"><b>${n}</b><span>${t}</span></div>`).join('')}</div>
    <div class="card"><h3>สอนแทนวันนี้</h3>${todayRecs.length ? `<div class="list">${todayRecs.map((r) => `<div>
      <span><b>คาบ ${r.period}</b> · ${esc(r.grade)} ${esc(r.subject)}</span>
      <span>${esc(r.absent_teacher)} → ${r.substitute_teacher ? `<b>${esc(r.substitute_teacher)}</b>` : '<span class="muted">ไม่ต้องสอนแทน</span>'}</span></div>`).join('')}</div>`
      : '<p class="muted">วันนี้ไม่มีรายการสอนแทน</p>'}</div>
    <div class="card"><div class="row-between"><h3>${staff ? 'คำขอที่รอพิจารณา' : 'คำขอของฉันที่รอพิจารณา'}</h3>
      <a class="btn btn-sm" href="#${staff ? 'requests' : 'mine'}">ดูทั้งหมด</a></div>
      ${mine.length ? `<div class="list">${mine.slice(0, 6).map((r) => `<div><span><b>${esc(r.teacher_name)}</b> · ${esc(r.leave_type)}</span>
        <span class="muted small">${esc(dateText(r))} · ${esc(periodText(r))}</span></div>`).join('')}</div>` : '<p class="muted">ไม่มีคำขอค้างอยู่</p>'}</div>`;
}
