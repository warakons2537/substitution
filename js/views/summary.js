// สรุปรายครู: ลากี่วัน · ถูกสอนแทนกี่คาบ · สอนแทนผู้อื่นกี่คาบ (ครูทั่วไปเห็นเฉพาะของตัวเอง)
import { $, esc, toast, todayISO, thDate } from '../util.js';
import { sb, q, rankData } from '../db.js';
import { fiscalYear, fiscalRange, fmtDays } from '../leaves.js';

const KEY = 'wlsub-sum';
const monthOf = (m) => { const [y, mm] = m.split('-').map(Number); return { from: `${m}-01`, to: `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}` }; };

/** รวมตัวเลขรายครูจากทะเบียนการลา + รายการสอนแทน (status confirmed) ในช่วงวันที่ */
export function summarize(leaves, recs, from, to) {
  const m = new Map();
  const row = (n) => { if (!m.has(n)) m.set(n, { name: n, leaves: 0, days: 0, covered: 0, gave: 0 }); return m.get(n); };
  for (const l of leaves) {
    if (!['pending', 'approved'].includes(l.status) || l.date_from < from || l.date_from > to) continue;
    const r = row(l.teacher_name); r.leaves += 1; r.days += Number(l.days);
  }
  for (const x of recs) {
    if (x.st !== 'confirmed' || x.d < from || x.d > to) continue;
    if (x.a) row(x.a).covered += x.s ? 1 : 0;      // คาบของครูที่ลา ที่มีคนสอนแทน
    if (x.s) row(x.s).gave += 1;                    // คาบที่ครูคนนี้สอนแทนผู้อื่น
  }
  return [...m.values()].sort((a, b) => b.gave - a.gave || b.days - a.days || a.name.localeCompare(b.name, 'th'));
}

export async function render(el, ctx) {
  const { me } = ctx; const staff = me.role !== 'requester';
  const f = JSON.parse(sessionStorage.getItem(KEY) || 'null') || monthOf(todayISO().slice(0, 7));
  const [rank, leaves] = await Promise.all([rankData(),
    q(sb.from('sub_leaves').select('teacher_name,leave_type,date_from,days,status').gte('date_from', f.from).lte('date_from', f.to).limit(2000)).catch(() => [])]);
  let rows = summarize(leaves, rank.records, f.from, f.to);
  if (!staff) rows = rows.filter((r) => r.name === me.teacher);
  const fy = fiscalYear(todayISO()); const fr = fiscalRange(fy);
  const tot = rows.reduce((a, r) => ({ days: a.days + r.days, covered: a.covered + r.covered, gave: a.gave + r.gave }), { days: 0, covered: 0, gave: 0 });

  el.innerHTML = `<h2>สรุปรายครู</h2>
    <div class="card"><form id="sm-form" class="form-grid">
      <label>ตั้งแต่<input type="date" name="from" value="${f.from}" required></label>
      <label>ถึง<input type="date" name="to" value="${f.to}" required></label>
      <div class="actions" style="align-self:end"><button class="btn btn-primary" type="submit">แสดง</button>
        <button class="btn" type="button" id="sm-month">เดือนนี้</button><button class="btn" type="button" id="sm-fy">ปีงบประมาณ ${fy}</button></div></form>
      <p class="muted small">${esc(thDate(f.from))} – ${esc(thDate(f.to))} · "สอนแทนให้ผู้อื่น" นับจากคาบที่ยืนยันแล้ว · ${staff ? 'ใช้ดูความเป็นธรรมของการสอนแทน' : 'แสดงเฉพาะของคุณ'}</p></div>
    <div class="card">${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>ครู</th><th class="c">ลา (ครั้ง)</th><th class="c">ลา (วัน)</th>
      <th class="c">ถูกสอนแทน (คาบ)</th><th class="c">สอนแทนให้ผู้อื่น (คาบ)</th><th class="c">สอนแทน − ถูกแทน</th></tr></thead><tbody>
      ${rows.map((r) => { const d = r.gave - r.covered; return `<tr><td>${esc(r.name)}</td><td class="c">${r.leaves || '-'}</td><td class="c">${r.days ? fmtDays(r.days) : '-'}</td>
        <td class="c">${r.covered || '-'}</td><td class="c">${r.gave || '-'}</td><td class="c">${d > 0 ? '+' : ''}${d}</td></tr>`; }).join('')}
      </tbody>${staff ? `<tfoot><tr><th>รวม</th><th></th><th class="c">${fmtDays(tot.days)}</th><th class="c">${tot.covered}</th><th class="c">${tot.gave}</th><th></th></tr></tfoot>` : ''}</table></div>`
      : '<p class="muted">ไม่มีข้อมูลในช่วงนี้</p>'}</div>`;
  const go = (v) => { sessionStorage.setItem(KEY, JSON.stringify(v)); render(el, ctx); };
  $('#sm-form', el).addEventListener('submit', (e) => {
    e.preventDefault(); const v = Object.fromEntries(new FormData(e.target).entries());
    if (v.to < v.from) { toast('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม', 'err'); return; }
    go({ from: v.from, to: v.to });
  });
  $('#sm-month', el).addEventListener('click', () => go(monthOf(todayISO().slice(0, 7))));
  $('#sm-fy', el).addEventListener('click', () => go(fr));
}
