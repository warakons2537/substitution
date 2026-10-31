// ฝ่ายวิชาการ/ผู้ดูแล: รายงาน Excel / A4 / Word + พิมพ์บันทึกการสอนแทนแทนครู
import { $, $$, esc, toast, todayISO, thDate, thDay } from '../util.js';
import { sb, q, settings } from '../db.js';
import { realTeachers } from '../timetable.js';
import { stats, rangeText, downloadExcel, printReport, downloadWord } from '../report.js';
import { printSubNotes } from '../print.js';

const monthRange = (m) => {
  const [y, mm] = m.split('-').map(Number);
  return { from: `${m}-01`, to: `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}` };
};

// ดึงทุกแถว (Supabase ส่งได้ครั้งละ 1,000 แถว)
async function fetchRecords(from, to) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const page = await q(sb.from('sub_records').select('*').eq('status', 'confirmed').gte('sub_date', from).lte('sub_date', to)
      .order('sub_date').order('period').order('id').range(i, i + 999));
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

export async function render(el, ctx) {
  const { tt } = ctx;
  const f = JSON.parse(sessionStorage.getItem('wlsub-report') || 'null') || monthRange(todayISO().slice(0, 7));
  const [recs, s, profiles, leaves] = await Promise.all([fetchRecords(f.from, f.to), settings(), q(sb.rpc('sub_teacher_profiles')),
    q(sb.from('sub_leaves').select('*').neq('status', 'cancelled').gte('date_from', f.from).lte('date_from', f.to).order('date_from').limit(1000)).catch(() => [])]);
  const st = stats(recs, realTeachers(tt.data));
  const prof = Object.fromEntries(profiles.map((p) => [p.teacher_name, p]));
  // บันทึกการสอนแทน: 1 แผ่น = ครูที่ลา 1 คน ต่อ 1 วัน
  const groups = [];
  for (const r of recs) {
    let g = groups.find((x) => x.date === r.sub_date && x.name === r.absent_teacher);
    if (!g) { g = { date: r.sub_date, name: r.absent_teacher, leave_type: r.leave_type, recs: [] }; groups.push(g); }
    g.recs.push(r);
  }

  el.innerHTML = `<h2>รายงาน</h2>
    <div class="card"><form id="rp-form" class="form-grid">
      <label>เดือน<input type="month" id="rp-month" value="${f.from.slice(0, 7)}"></label>
      <label>ตั้งแต่<input type="date" name="from" value="${f.from}" required></label>
      <label>ถึง<input type="date" name="to" value="${f.to}" required></label>
      <div class="actions"><button class="btn btn-primary" type="submit">แสดง</button></div>
    </form>
    <p><b>${esc(rangeText(f.from, f.to))}</b> · ครูลา ${st.absents.length} คน ${st.absentDays} วัน · ${recs.length} คาบ
      (สอนแทน ${st.covered} · ไม่ต้องสอนแทน ${st.none})</p>
    <div class="actions"><button class="btn btn-primary" id="rp-xlsx">ดาวน์โหลด Excel (6 แผ่นงาน)</button>
      <button class="btn" id="rp-print">พิมพ์รายงานสรุป A4</button><button class="btn" id="rp-word">ดาวน์โหลด Word</button></div></div>
    <div class="card"><div class="row-between"><h3>พิมพ์บันทึกการสอนแทนแทนครู</h3>
      <button class="btn btn-sm btn-primary" id="rp-sel" disabled>พิมพ์ที่เลือก</button></div>
      <p class="muted small">1 แผ่นต่อครูที่ลา 1 คน 1 วัน · ชื่อและตำแหน่งมาจาก "ข้อมูลของฉัน" ของครูคนนั้น</p>
      ${groups.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th><input type="checkbox" id="rp-all"></th><th>วันที่</th><th>ครูที่ลา</th><th>ประเภท</th><th>คาบ</th><th>ข้อมูลครู</th><th></th></tr></thead><tbody>
        ${groups.map((g, i) => `<tr><td><input type="checkbox" class="rp-pick" value="${i}"></td>
          <td>${esc(thDay(g.date))} ${esc(thDate(g.date))}</td><td>${esc(g.name)}</td><td>${esc(g.leave_type)}</td>
          <td>${g.recs.map((r) => r.period).join(', ')}</td>
          <td>${prof[g.name]?.full_name ? '<span class="badge approved">มี</span>' : '<span class="badge pending">ยังไม่กรอก (ใช้ชื่อในตารางสอน)</span>'}</td>
          <td><button class="btn btn-sm" data-p="${i}">พิมพ์</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">ไม่มีรายการในช่วงนี้</p>'}</div>`;

  const form = $('#rp-form', el);
  $('#rp-month', el).addEventListener('change', (e) => {
    if (!e.target.value) return;
    const r = monthRange(e.target.value); form.elements.from.value = r.from; form.elements.to.value = r.to;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(form).entries());
    if (v.to < v.from) { toast('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม', 'err'); return; }
    sessionStorage.setItem('wlsub-report', JSON.stringify(v)); render(el, ctx);
  });
  $('#rp-xlsx', el).addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await downloadExcel(st, f.from, f.to, tt, leaves); } catch (err) { toast(`สร้าง Excel ไม่ได้: ${err.message}`, 'err'); }
    e.target.disabled = false;
  });
  $('#rp-print', el).addEventListener('click', () => printReport(st, f.from, f.to, tt, s));
  $('#rp-word', el).addEventListener('click', () => downloadWord(st, f.from, f.to, tt, s));

  const job = (idx) => idx.map((i) => { const g = groups[i];
    return { ...g, teacher: { full_name: prof[g.name]?.full_name || g.name, position_short: prof[g.name]?.position_short || '' } }; });
  const picks = () => $$('.rp-pick:checked', el).map((c) => +c.value);
  const sync = () => { const n = picks().length; const b = $('#rp-sel', el); b.disabled = !n; b.textContent = n ? `พิมพ์ที่เลือก (${n})` : 'พิมพ์ที่เลือก'; };
  $('#rp-all', el)?.addEventListener('change', (e) => { $$('.rp-pick', el).forEach((c) => { c.checked = e.target.checked; }); sync(); });
  $$('.rp-pick', el).forEach((c) => c.addEventListener('change', sync));
  $('#rp-sel', el).addEventListener('click', () => printSubNotes(job(picks())));
  $$('[data-p]', el).forEach((b) => b.addEventListener('click', () => printSubNotes(job([+b.dataset.p]))));
}
