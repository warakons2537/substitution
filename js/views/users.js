// ผู้ดูแลระบบ: กำหนดสิทธิ์และผูกบัญชีกับชื่อครู
import { $$, esc, opts, toast } from '../util.js';
import { sb, q } from '../db.js';
import { ROLES } from '../config.js';
import { realTeachers } from '../timetable.js';

export async function render(el, ctx) {
  const users = await q(sb.rpc('sub_list_users'));
  const teachers = ctx.tt ? realTeachers(ctx.tt.data) : [];
  el.innerHTML = `<h2>ผู้ใช้และสิทธิ์</h2>
    <div class="card"><p class="muted small">รายชื่อบัญชีมาจากระบบ Login ร่วมกับ WL Admin · ผู้ขอลาต้องผูกกับชื่อครูในตารางสอน</p>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>ชื่อ / อีเมล</th><th>สิทธิ์</th><th>ชื่อครู</th><th></th></tr></thead><tbody>
    ${users.map((u) => `<tr data-u="${u.user_id}"><td>${esc(u.full_name || '-')}<div class="muted small">${esc(u.email)}</div></td>
      <td><select name="role"><option value="">ไม่มีสิทธิ์</option>${opts(Object.entries(ROLES), u.role || '')}</select></td>
      <td><select name="teacher"><option value="">—</option>${opts([...new Set([...(u.teacher_name ? [u.teacher_name] : []), ...teachers])], u.teacher_name || '')}</select></td>
      <td><button class="btn btn-sm btn-primary" data-save>บันทึก</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
  $$('[data-save]', el).forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr'); const id = tr.dataset.u;
    const role = tr.querySelector('[name=role]').value; const teacher = tr.querySelector('[name=teacher]').value;
    if (role === 'requester' && !teacher) { toast('ผู้ขอลาต้องเลือกชื่อครู', 'err'); return; }
    if (id === ctx.me.id && role !== 'admin' && !confirm('กำลังลดสิทธิ์ของตัวเอง ยืนยัน?')) return;
    try {
      if (!role) await q(sb.from('sub_users').delete().eq('user_id', id));
      else await q(sb.from('sub_users').upsert({ user_id: id, role, teacher_name: teacher }));
      toast('บันทึกแล้ว');
    } catch (e) { toast(e.message, 'err'); }
  }));
}
