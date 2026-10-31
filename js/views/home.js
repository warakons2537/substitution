// หน้าแรก: สรุปตามหน้าที่ของผู้ใช้ (ครูเห็นของตัวเอง · งานบุคคล/ผอ. เห็นใบลา · ฝ่ายวิชาการเห็นคิวสอนแทน)
import { esc, thDate, thDay, todayISO, addDays } from '../util.js';
import { sb, q, rankData, REQ_COLS } from '../db.js';
import { has, dutyText } from '../perm.js';
import { leavesRange } from '../leaves.js';
import { periodText, dateText } from './request.js';

export async function render(el, ctx) {
  const { me } = ctx;
  const hr = has(me, 'hr'); const dir = has(me, 'director'); const ac = has(me, 'academic');
  const today = todayISO(); const tomorrow = addDays(today, 1);
  const name = me.full_name || me.teacher || me.email;
  const safe = (p) => p.catch(() => []);

  const [rank, pendingReq, myReq, absent, waitLeaves, unsigned] = await Promise.all([
    rankData(),
    ac ? safe(q(sb.from('sub_requests').select(REQ_COLS).eq('status', 'pending').order('date_from').limit(50))) : [],
    me.teacher ? safe(q(sb.from('sub_requests').select(REQ_COLS).eq('requested_by', me.id).eq('status', 'pending'))) : [],
    (ac || hr || dir) ? leavesRange(me, today, today) : [],
    (hr || dir) ? safe(q(sb.from('sub_leaves').select('id', { count: 'exact', head: false }).eq('status', 'pending'))) : [],
    hr ? safe(q(sb.from('sub_leaves').select('id').in('status', ['approved', 'pending']).is('signed_at', null))) : [],
  ]);
  const recs = rank.records.filter((r) => r.st === 'confirmed');
  const todayRecs = recs.filter((r) => r.d === today && (ac || hr || dir || r.s === me.teacher || r.a === me.teacher)).sort((a, b) => a.p - b.p);
  const mineUp = recs.filter((r) => r.s === me.teacher && r.d >= today).length;
  const urgent = pendingReq.filter((r) => r.date_from <= tomorrow);
  const todayAbsent = absent.filter((l) => l.status !== 'cancelled' && l.status !== 'rejected' && l.date_from <= today && l.date_to >= today);

  const stats = [];
  if (hr || dir) stats.push([waitLeaves.length, 'ใบลารออนุญาต', 'approvals']);
  if (hr) stats.push([unsigned.length, 'ใบลาที่ยังไม่เซ็น', 'approvals']);
  if (hr || dir || ac) stats.push([todayAbsent.length, 'ครูลาวันนี้', 'leaves']);
  if (ac) { stats.push([pendingReq.length, 'คิวรอจัดสอนแทน', 'requests']); stats.push([todayRecs.length, 'คาบสอนแทนวันนี้', 'records']); }
  if (me.teacher) { stats.push([myReq.length, 'คำขอของฉันที่ยังจัดไม่ครบ', 'mine']); stats.push([mineUp, 'คาบที่ฉันต้องสอนแทน', 'mysubs']); }

  const cta = ac ? ['assist', 'ช่วยจัดครูสอนแทน'] : (hr || dir) ? ['approvals', 'ตรวจ/อนุญาตใบลา'] : me.teacher ? ['request', 'ยื่นใบลา'] : null;
  el.innerHTML = `<div class="welcome"><span class="av" aria-hidden="true">${esc((name.replace(/^(ครู|นาย|นางสาว|นาง)\s*/, '').replace(/^[เแโใไ]/, '')[0]) || '?')}</span>
      <div><h1>สวัสดี ${esc(name)}</h1><p>${esc(thDay(today))} ${esc(thDate(today, { day: 'numeric', month: 'long', year: 'numeric' }))} · ${esc(dutyText(me))}</p></div>
      ${cta ? `<a class="btn btn-gold" href="#${cta[0]}">${cta[1]}</a>` : ''}</div>
    ${urgent.length ? `<div class="note">มี ${urgent.length} คิวสอนแทนที่ต้องจัดภายในวันนี้-พรุ่งนี้ · <a href="#requests">ไปจัดเลย</a></div>` : ''}
    <div class="stats">${stats.map(([n, t, h]) => `<a class="card stat" href="#${h}" style="text-decoration:none;color:inherit"><b>${n}</b><span>${t}</span></a>`).join('')}</div>
    ${(hr || dir || ac) ? `<div class="card"><h3>ครูลาวันนี้</h3>${todayAbsent.length ? `<div class="list">${todayAbsent.map((l) => `<div><span><b>${esc(l.teacher_name)}</b></span>
      <span class="muted small">${esc(l.leave_type)}${l.half ? ` (${l.half === 'am' ? 'เช้า' : 'บ่าย'})` : ''}</span></div>`).join('')}</div>` : '<p class="muted">ไม่มีครูลาวันนี้</p>'}</div>` : ''}
    <div class="card"><h3>สอนแทนวันนี้</h3>${todayRecs.length ? `<div class="list">${todayRecs.map((r) => `<div>
      <span><b>คาบ ${r.p}</b></span><span>${esc(r.a)} → ${r.s ? `<b>${esc(r.s)}</b>` : '<span class="muted">ไม่ต้องสอนแทน</span>'}</span></div>`).join('')}</div>`
      : '<p class="muted">วันนี้ไม่มีรายการสอนแทน</p>'}</div>
    ${ac && pendingReq.length ? `<div class="card"><div class="row-between"><h3>คิวรอจัดครูสอนแทน</h3><a class="btn btn-sm" href="#requests">ดูทั้งหมด</a></div>
      <div class="list">${pendingReq.slice(0, 6).map((r) => `<div><span><b>${esc(r.teacher_name)}</b> · ${esc(r.leave_type)}</span>
        <span class="muted small">${esc(dateText(r))} · ${esc(periodText(r))}</span></div>`).join('')}</div></div>` : ''}`;
}
