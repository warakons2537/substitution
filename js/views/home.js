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
  const ackOn = recs.some((r) => 'k' in r);
  if (ackOn && ac) stats.push([recs.filter((r) => r.s && r.d >= today && !r.k).length, 'คาบสอนแทนที่ครูยังไม่รับทราบ', 'records']);
  if (ackOn && me.teacher) { const w = recs.filter((r) => r.s === me.teacher && r.d >= today && !r.k).length; if (w) stats.push([w, 'คาบที่ฉันยังไม่ได้รับทราบ', 'mysubs']); }

  const cta = ac ? ['assist', 'ช่วยจัดครูสอนแทน'] : (hr || dir) ? ['approvals', 'ตรวจ/อนุญาตใบลา'] : me.teacher ? ['request', 'ยื่นใบลา'] : null;
  const clock = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.6"/></svg>';
  const alertI = '<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.4M8 11h.01"/></svg>';
  el.innerHTML = `<div class="wl-g">
    <header class="g-hero"><div class="g-logo"><span class="g-mark" aria-hidden="true"><img src="img/logo-192.png" alt=""></span><span class="g-brand">WL ระบบสอนแทน</span></div><div class="g-hero-text">
      <h1>สวัสดี ${esc(name)}</h1><p>${esc(thDay(today))} ${esc(thDate(today, { day: 'numeric', month: 'long', year: 'numeric' }))} · ${esc(dutyText(me))}</p></div>
      ${cta ? `<a class="g-btn" href="#${cta[0]}">${cta[1]}</a>` : ''}</header>
    ${urgent.length ? `<div class="g-note" role="status">${alertI}<span>มี ${urgent.length} คิวสอนแทนที่ต้องจัดภายในวันนี้-พรุ่งนี้ · <a href="#requests">ไปจัดเลย</a></span></div>` : ''}
    <div class="g-stats">${stats.map(([n, t, h]) => `<a class="g-stat" href="#${h}"><b>${n}</b><span>${t}</span></a>`).join('')}</div>
    ${(hr || dir || ac) ? `<section class="g-card"><div class="g-card-h"><h3>ครูลาวันนี้</h3></div>${todayAbsent.length ? todayAbsent.map((l) => `<div class="g-row"><b>${esc(l.teacher_name)}</b>
      <span class="g-pill">${clock}<span>ลา · ${esc(l.leave_type)}${l.half ? ` (${l.half === 'am' ? 'เช้า' : 'บ่าย'})` : ''}</span></span></div>`).join('') : '<p class="g-empty">ไม่มีครูลาวันนี้</p>'}</section>` : ''}
    <section class="g-card"><div class="g-card-h"><h3>สอนแทนวันนี้</h3></div>${todayRecs.length ? todayRecs.map((r) => `<div class="g-row">
      <b class="num">คาบ ${r.p}</b><span>${esc(r.a)} → ${r.s ? `<b>${esc(r.s)}</b>` : '<span class="g-sub">ไม่ต้องสอนแทน</span>'}</span></div>`).join('')
      : '<p class="g-empty">วันนี้ไม่มีรายการสอนแทน</p>'}</section>
    ${ac && pendingReq.length ? `<section class="g-card"><div class="g-card-h"><h3>คิวรอจัดครูสอนแทน</h3><a class="g-btn g-btn-line" href="#requests">ดูทั้งหมด</a></div>
      ${pendingReq.slice(0, 6).map((r) => `<div class="g-row"><span><b>${esc(r.teacher_name)}</b> · ${esc(r.leave_type)}</span>
        <span class="g-sub">${esc(dateText(r))} · ${esc(periodText(r))}</span></div>`).join('')}</section>` : ''}
  </div>`;
}
