// ผู้ดูแลระบบ: กำหนดสิทธิ์และผูกบัญชีกับชื่อครู
import { $, $$, esc, opts, toast , confirmBox } from '../util.js';
import { sb, q } from '../db.js';
import { ROLES } from '../config.js';
import { realTeachers } from '../timetable.js';

export async function render(el, ctx) {
  const users = await q(sb.rpc('sub_list_users'));
  const teachers = ctx.tt ? realTeachers(ctx.tt.data) : [];
  el.innerHTML = `<h2>ผู้ใช้และสิทธิ์</h2>
    <div class="card"><p class="muted small">รายชื่อบัญชีมาจากระบบ Login ร่วมกับ WL Admin · ผู้ขอลาต้องผูกกับชื่อครูในตารางสอน</p>
    <div class="form-grid"><label>ค้นหา<input id="u-q" placeholder="ชื่อ อีเมล หรือชื่อครู"></label>
      <label>สิทธิ์<select id="u-r"><option value="*">ทั้งหมด</option><option value="">ไม่มีสิทธิ์</option>${opts(Object.entries(ROLES))}</select></label></div>
    <p class="muted small" id="u-n"></p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>ชื่อ / อีเมล</th><th>สิทธิ์</th><th>ชื่อครู</th><th>ข้อมูลแบบพิมพ์</th><th></th></tr></thead><tbody>
    ${users.map((u) => `<tr data-u="${u.user_id}" data-role="${esc(u.role || '')}" data-s="${esc(`${u.full_name} ${u.email} ${u.teacher_name || ''} ${u.print_name || ''}`.toLowerCase())}"><td>${esc(u.full_name || '-')}<div class="muted small">${esc(u.email)}</div></td>
      <td><select name="role"><option value="">ไม่มีสิทธิ์</option>${opts(Object.entries(ROLES), u.role || '')}</select></td>
      <td><select name="teacher"><option value="">—</option>${opts([...new Set([...(u.teacher_name ? [u.teacher_name] : []), ...teachers])], u.teacher_name || '')}</select></td>
      <td>${!u.role ? '' : u.print_name && u.position && u.phone ? '<span class="badge approved">ครบ</span>'
        : `<span class="badge pending">ยังไม่กรอก ${esc([!u.print_name && 'ชื่อ-สกุล', !u.position && 'ตำแหน่ง', !u.phone && 'เบอร์โทร'].filter(Boolean).join(' '))}</span>`}</td>
      <td><button class="btn btn-sm btn-primary" data-save>บันทึก</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  const filter = () => {
    const t = $('#u-q', el).value.trim().toLowerCase(); const r = $('#u-r', el).value; let n = 0;
    $$('tr[data-u]', el).forEach((tr) => {
      const show = (!t || tr.dataset.s.includes(t)) && (r === '*' || tr.dataset.role === r);
      tr.hidden = !show; n += show;
    });
    $('#u-n', el).textContent = `แสดง ${n} จาก ${users.length} บัญชี`;
  };
  $('#u-q', el).addEventListener('input', filter);
  $('#u-r', el).addEventListener('change', filter);
  filter();
  $$('[data-save]', el).forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr'); const id = tr.dataset.u;
    const role = tr.querySelector('[name=role]').value; const teacher = tr.querySelector('[name=teacher]').value;
    if (role === 'requester' && !teacher) { toast('ผู้ขอลาต้องเลือกชื่อครู', 'err'); return; }
    if (id === ctx.me.id && role !== 'admin' && !(await confirmBox('กำลังลดสิทธิ์ของตัวเอง ยืนยัน?')) ) return;
    try {
      if (!role) await q(sb.from('sub_users').delete().eq('user_id', id));
      else await q(sb.from('sub_users').upsert({ user_id: id, role, teacher_name: teacher }));
      tr.dataset.role = role;
      toast('บันทึกแล้ว');
    } catch (e) { toast(e.message, 'err'); }
  }));
}
