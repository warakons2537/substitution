// ผู้ดูแลระบบ: บันทึกการใช้งาน (ดูอย่างเดียว · มีค่าก่อน/หลัง)
import { $, $$, esc, opts, todayISO, addDays, thDate } from '../util.js';
import { sb, q } from '../db.js';
import { ROLES } from '../config.js';

const TBL = { sub_records: 'รายการสอนแทน', sub_requests: 'คำขอลา/สอนแทน', sub_users: 'ผู้ใช้และสิทธิ์',
  sub_settings: 'ตั้งค่าแบบพิมพ์', sub_timetables: 'ตารางสอน' };
const OP = { INSERT: 'เพิ่ม', UPDATE: 'แก้ไข', DELETE: 'ลบ' };
const OPCLS = { INSERT: 'approved', UPDATE: 'pending', DELETE: 'rejected' };
const F = { sub_date: 'วันที่', period: 'คาบ', absent_teacher: 'ครูที่ลา', leave_type: 'ประเภทการลา', grade: 'ชั้น',
  subject: 'วิชา', substitute_teacher: 'ครูสอนแทน', status: 'สถานะ', source: 'ที่มา', note: 'หมายเหตุ',
  teacher_name: 'ชื่อครู', date_from: 'ตั้งแต่', date_to: 'ถึง', periods: 'คาบ', reason: 'เหตุผล', contact: 'ติดต่อ',
  decision_note: 'หมายเหตุการพิจารณา', role: 'สิทธิ์', full_name: 'ชื่อ-สกุล', position: 'ตำแหน่ง',
  position_short: 'ตำแหน่ง (บันทึก)', phone: 'เบอร์โทร', academic_year: 'ปีการศึกษา', term: 'ภาคเรียน',
  name: 'ชื่อ', is_active: 'ใช้งาน', district: 'อำเภอ', area_office: 'เขตพื้นที่', personnel_name: 'หัวหน้าบุคคล',
  personnel_position: 'ตำแหน่งหัวหน้าบุคคล', academic_name: 'หัวหน้าวิชาการ', academic_position: 'ตำแหน่งหัวหน้าวิชาการ',
  director_name: 'ผู้อำนวยการ', director_position: 'ตำแหน่งผู้อำนวยการ' };
const SKIP = new Set(['id', 'user_id', 'created_at', 'updated_at', 'created_by', 'requested_by', 'decided_by', 'imported_by', 'request_id']);

const val = (k, v) => {
  if (v == null || v === '') return '—';
  if (k === 'role') return ROLES[v] || v;
  if (Array.isArray(v)) return v.length ? v.join(', ') : (k === 'periods' ? 'ทั้งวัน' : '—');
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่';
  return String(v);
};
const dt = (s) => new Date(s).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function summary(r) {
  const d = r.new_data || r.old_data || {};
  if (r.tbl === 'sub_records') return `${thDate(d.sub_date)} คาบ ${d.period} · ${d.absent_teacher} → ${d.substitute_teacher || 'ไม่ต้องสอนแทน'}`;
  if (r.tbl === 'sub_requests') return `${d.teacher_name} · ${thDate(d.date_from)}${d.date_to !== d.date_from ? ` – ${thDate(d.date_to)}` : ''} · ${d.status}`;
  if (r.tbl === 'sub_users') return `${d.full_name || d.teacher_name || d.user_id || ''} · ${ROLES[d.role] || d.role || ''}`;
  if (r.tbl === 'sub_timetables') return `ปีการศึกษา ${d.academic_year} ภาคเรียนที่ ${d.term} · ${d.name || ''}`;
  return '';
}

function diff(r) {
  const o = r.old_data || {}; const n = r.new_data || {};
  const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter((k) => !SKIP.has(k)
    && (r.op !== 'UPDATE' || JSON.stringify(o[k]) !== JSON.stringify(n[k])));
  if (!keys.length) return '<p class="muted small">ไม่มีข้อมูลที่เปลี่ยน</p>';
  return `<table class="tbl"><thead><tr><th>ข้อมูล</th><th>ก่อน</th><th>หลัง</th></tr></thead><tbody>
    ${keys.map((k) => `<tr><td>${esc(F[k] || k)}</td><td>${r.op === 'INSERT' ? '' : esc(val(k, o[k]))}</td>
      <td>${r.op === 'DELETE' ? '' : esc(val(k, n[k]))}</td></tr>`).join('')}</tbody></table>`;
}

export async function render(el) {
  const f = JSON.parse(sessionStorage.getItem('wlsub-audit') || 'null')
    || { from: addDays(todayISO(), -30), to: todayISO(), tbl: '', op: '', who: '' };
  let qy = sb.from('sub_audit').select('*').gte('at', `${f.from}T00:00:00+07:00`).lte('at', `${f.to}T23:59:59+07:00`)
    .order('at', { ascending: false }).limit(500);
  if (f.tbl) qy = qy.eq('tbl', f.tbl);
  if (f.op) qy = qy.eq('op', f.op);
  if (f.who) qy = qy.ilike('email', `%${f.who}%`);
  const list = await q(qy);

  el.innerHTML = `<h2>บันทึกการใช้งาน</h2>
    <div class="card"><form id="a-form" class="form-grid">
      <label>ตั้งแต่<input type="date" name="from" value="${esc(f.from)}" required></label>
      <label>ถึง<input type="date" name="to" value="${esc(f.to)}" required></label>
      <label>ข้อมูล<select name="tbl"><option value="">ทั้งหมด</option>${opts(Object.entries(TBL), f.tbl)}</select></label>
      <label>การกระทำ<select name="op"><option value="">ทั้งหมด</option>${opts(Object.entries(OP), f.op)}</select></label>
      <label>อีเมลผู้ทำ<input name="who" value="${esc(f.who)}" placeholder="บางส่วนของอีเมล"></label>
      <div class="actions"><button class="btn btn-primary" type="submit">ค้นหา</button></div>
    </form>
    <p class="muted small">${list.length} รายการ${list.length === 500 ? ' (แสดงสูงสุด 500 รายการล่าสุด ให้แคบช่วงวันที่ลง)' : ''} · ดูได้อย่างเดียว แก้ไขหรือลบไม่ได้</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>เวลา</th><th>ผู้ทำ</th><th>ข้อมูล</th><th>การกระทำ</th><th>รายละเอียด</th><th></th></tr></thead><tbody>
    ${list.map((r, i) => `<tr><td>${esc(dt(r.at))}</td><td>${esc(r.email || 'ระบบ')}</td><td>${esc(TBL[r.tbl] || r.tbl)}</td>
      <td><span class="badge ${OPCLS[r.op]}">${OP[r.op]}</span></td><td>${esc(summary(r))}</td>
      <td><button class="btn btn-sm" data-i="${i}">ก่อน/หลัง</button></td></tr>
      <tr data-d="${i}" hidden><td colspan="6"></td></tr>`).join('')}
    </tbody></table></div></div>`;

  $('#a-form', el).addEventListener('submit', (e) => {
    e.preventDefault();
    sessionStorage.setItem('wlsub-audit', JSON.stringify(Object.fromEntries(new FormData(e.target).entries())));
    render(el);
  });
  $$('[data-i]', el).forEach((b) => b.addEventListener('click', () => {
    const tr = $(`[data-d="${b.dataset.i}"]`, el);
    if (tr.hidden && !tr.cells[0].innerHTML) tr.cells[0].innerHTML = diff(list[b.dataset.i]);
    tr.hidden = !tr.hidden;
  }));
}
