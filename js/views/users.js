// ผู้ดูแลระบบ: กำหนดสิทธิ์และผูกบัญชีกับชื่อครู
import { $, $$, esc, opts, toast , confirmBox } from '../util.js';
import { sb, q } from '../db.js';
import { DUTIES, roleOf } from '../perm.js';
import { realTeachers } from '../timetable.js';

export async function render(el, ctx) {
  const users = await q(sb.rpc('sub_list_users'));
  // ตารางบุคลากรกลาง (WL Academic) — ถ้ายังไม่ได้ติดตั้งจะไม่แสดงคอลัมน์นี้
  let staffList = [];
  try { staffList = (await q(sb.from('staff').select('id,prefix,first_name,last_name,position,active').eq('active', true).order('sort_order'))) || []; } catch { /* */ }
  // โปรไฟล์ที่ยังไม่มีบัญชีเข้าสู่ระบบ (ไม่มีใน auth.users) กำหนดสิทธิ์ไม่ได้ — ต้องให้เจ้าของสมัคร/เข้าสู่ระบบก่อน
  const noAcc = (u) => (u.has_account === false ? 'disabled' : '');
  const staffName = (t) => `${t.prefix || ''}${t.first_name}${t.last_name ? ` ${t.last_name}` : ''}`;
  const guess = (teacher) => {   // เดาจากชื่อครูในตารางสอน: ต้องมีชื่อ (และนามสกุลถ้ามี) อยู่ในข้อความ และเจอคนเดียวเท่านั้น
    if (!teacher) return '';
    const hit = staffList.filter((t) => teacher.includes(t.first_name) && (!t.last_name || teacher.includes(t.last_name)));
    return hit.length === 1 ? hit[0].id : '';
  };
  const teachers = ctx.tt ? realTeachers(ctx.tt.data) : [];
  el.innerHTML = `<h2>ผู้ใช้และสิทธิ์</h2>
    <div class="card"><p class="muted small">รายชื่อบัญชีมาจากระบบ Login ร่วมกับ WL Admin · ผู้ขอลาต้องผูกกับชื่อครูในตารางสอน</p>
    <div class="form-grid"><label>ค้นหา<input id="u-q" placeholder="ชื่อ อีเมล หรือชื่อครู"></label>
      <label>สิทธิ์<select id="u-r"><option value="*">ทั้งหมด</option><option value="">ไม่มีสิทธิ์</option><option value="teacher">ครู (ไม่มีหน้าที่เสริม)</option>${opts(Object.entries(DUTIES))}</select></label></div>
    <p class="muted small" id="u-n"></p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>ชื่อ / อีเมล</th><th>สิทธิ์</th><th>ชื่อครู</th>${staffList.length ? '<th>บุคลากร (WL Academic)</th>' : ''}<th>ข้อมูลแบบพิมพ์</th><th></th></tr></thead><tbody>
    ${users.map((u) => `<tr data-u="${u.user_id}" data-role="${esc(u.role ? (u.duties?.length ? u.duties.join(' ') : 'teacher') : '')}" data-s="${esc(`${u.full_name} ${u.email} ${u.teacher_name || ''} ${u.print_name || ''}`.toLowerCase())}"><td>${esc(u.full_name || '-')}<div class="muted small">${esc(u.email)}</div>${u.has_account === false ? '<span class="chip chip-warn">ยังไม่มีบัญชีเข้าสู่ระบบ</span>' : ''}</td>
      <td><label class="chk"><input type="checkbox" name="member" ${noAcc(u)} ${u.role ? 'checked' : ''}> ใช้งานระบบ (ครู)</label>
        ${Object.entries(DUTIES).map(([k, t]) => `<label class="chk"><input type="checkbox" name="duty" value="${k}" ${noAcc(u)} ${(u.duties || []).includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</td>
      <td><select name="teacher" ${noAcc(u)}><option value="">—</option>${opts([...new Set([...(u.teacher_name ? [u.teacher_name] : []), ...teachers])], u.teacher_name || '')}</select></td>
      ${staffList.length ? `<td><select name="staff" ${noAcc(u)}><option value="">—</option>${opts(staffList.map((t) => [t.id, staffName(t)]), u.staff_id || (u.role ? guess(u.teacher_name) : ''))}</select></td>` : ''}
      <td>${!u.role ? '' : u.print_name && u.position && u.phone ? '<span class="badge approved">ครบ</span>'
        : `<span class="badge pending">ยังไม่กรอก ${esc([!u.print_name && 'ชื่อ-สกุล', !u.position && 'ตำแหน่ง', !u.phone && 'เบอร์โทร'].filter(Boolean).join(' '))}</span>`}</td>
      <td><button class="btn btn-sm btn-primary" data-save ${noAcc(u)}>บันทึก</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  const filter = () => {
    const t = $('#u-q', el).value.trim().toLowerCase(); const r = $('#u-r', el).value; let n = 0;
    $$('tr[data-u]', el).forEach((tr) => {
      const show = (!t || tr.dataset.s.includes(t)) && (r === '*' || (r === '' ? tr.dataset.role === '' : tr.dataset.role.split(' ').includes(r)));
      tr.hidden = !show; n += show;
    });
    $('#u-n', el).textContent = `แสดง ${n} จาก ${users.length} บัญชี`;
  };
  $('#u-q', el).addEventListener('input', filter);
  $('#u-r', el).addEventListener('change', filter);
  filter();
  $$('[data-save]', el).forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr'); const id = tr.dataset.u;
    const teacher = tr.querySelector('[name=teacher]').value;
    const duties = [...tr.querySelectorAll('[name=duty]:checked')].map((c) => c.value);
    const member = tr.querySelector('[name=member]').checked || duties.length > 0;
    if (id === ctx.me.id && !duties.includes('admin') && !(await confirmBox('กำลังลดสิทธิ์ผู้ดูแลระบบของตัวเอง ยืนยัน?')) ) return;
    try {
      if (!member) await q(sb.from('sub_users').delete().eq('user_id', id));
      else await q(sb.from('sub_users').upsert({ user_id: id, role: roleOf(duties), duties, teacher_name: teacher, staff_id: tr.querySelector('[name=staff]')?.value || null }));
      tr.dataset.role = member ? (duties.length ? duties.join(' ') : 'teacher') : '';
      toast('บันทึกแล้ว');
    } catch (e) { toast(e.message, 'err'); }
  }));
}
