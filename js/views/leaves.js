// ทะเบียนการลา: ฝ่ายวิชาการ/ผู้ดูแลเห็นทุกคน · ครูเห็นของตัวเอง
import { $, $$, esc, opts, toast, todayISO, thDate, modal, confirmBox } from '../util.js';
import { sb, q } from '../db.js';
import { LEAVE_STATUS } from '../config.js';
import { realTeachers } from '../timetable.js';
import { loadRules, countDays, usage, fiscalYear, fiscalRange, fmtDays } from '../leaves.js';

const NAME_KEY = 'wlsub-leave-filter';

export async function render(el, ctx) {
  const { me } = ctx;
  const staff = me.role !== 'requester';
  const admin = me.role === 'admin';
  const rules = await loadRules();
  const saved = JSON.parse(sessionStorage.getItem(NAME_KEY) || '{}');
  const fy = saved.fy || fiscalYear(todayISO());
  const teacherF = staff ? (saved.teacher || '') : me.teacher;
  const typeF = saved.type || '';
  const { from, to } = fiscalRange(fy);

  // ยอดสะสมคิดทั้งปีงบประมาณ · ตารางรายการใช้ตัวกรองด้วย
  let qy = sb.from('sub_leaves').select('*').gte('date_from', from).lte('date_from', to).order('date_from', { ascending: false }).limit(1000);
  if (!staff) qy = qy.eq('teacher_name', me.teacher);
  const all = await q(qy);
  const names = [...new Set([...(ctx.tt ? realTeachers(ctx.tt.data) : []), ...all.map((l) => l.teacher_name)])].sort((a, b) => a.localeCompare(b, 'th'));
  const rows = all.filter((l) => (!teacherF || l.teacher_name === teacherF) && (!typeF || l.leave_type === typeF));
  const types = rules.types.filter((t) => t.active || all.some((l) => l.leave_type === t.leave_type));
  const years = [...new Set([fiscalYear(todayISO()), fy, fiscalYear(todayISO()) - 1])].sort((a, b) => b - a);

  const sumOne = (name) => usage(all.filter((l) => l.teacher_name === name), fy);
  let summary;
  if (teacherF || !staff) {
    const u = sumOne(teacherF);
    summary = `<div class="table-wrap"><table class="tbl"><thead><tr><th>ประเภท</th><th class="c">ครั้ง</th><th class="c">วันที่ลา</th><th class="c">โควตา</th><th class="c">คงเหลือ</th></tr></thead><tbody>
      ${types.map((t) => { const x = u[t.leave_type] || { used: 0, count: 0 }; const left = t.quota_days == null ? null : t.quota_days - x.used;
        return `<tr><td>${esc(t.leave_type)}</td><td class="c">${x.count}</td><td class="c">${fmtDays(x.used)}</td>
          <td class="c">${t.quota_days == null ? '<span class="muted">ไม่จำกัด</span>' : fmtDays(t.quota_days)}</td>
          <td class="c">${left == null ? '' : `<span class="${left < 0 ? 'warn' : ''}">${fmtDays(left)}</span>`}</td></tr>`; }).join('')}
      </tbody></table></div>`;
  } else {
    const who = [...new Set(all.map((l) => l.teacher_name))].sort((a, b) => a.localeCompare(b, 'th'));
    const used = types.filter((t) => all.some((l) => l.leave_type === t.leave_type));
    summary = who.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>ครู</th>${used.map((t) => `<th class="c">${esc(t.leave_type)}</th>`).join('')}<th class="c">รวม (วัน)</th></tr></thead><tbody>
      ${who.map((n) => { const u = sumOne(n); let tot = 0;
        return `<tr><td>${esc(n)}</td>${used.map((t) => { const x = u[t.leave_type]; tot += x?.used || 0;
          const over = x && t.quota_days != null && x.used > t.quota_days;
          return `<td class="c ${over ? 'warn' : ''}">${x ? fmtDays(x.used) : '<span class="muted">-</span>'}</td>`; }).join('')}<td class="c"><b>${fmtDays(tot)}</b></td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="muted">ยังไม่มีข้อมูลการลาในปีงบประมาณนี้</p>';
  }

  el.innerHTML = `<h2>ทะเบียนการลา</h2>
    <div class="card"><div class="row-between"><div class="form-grid" style="flex:1">
      <label>ปีงบประมาณ (พ.ศ.)<select id="lv-fy">${opts(years, fy)}</select></label>
      ${staff ? `<label>ครู<select id="lv-t"><option value="">ทั้งหมด</option>${opts(names, teacherF)}</select></label>` : ''}
      <label>ประเภท<select id="lv-ty"><option value="">ทั้งหมด</option>${opts(types.map((t) => t.leave_type), typeF)}</select></label></div>
      <button class="btn btn-primary" id="lv-add">+ บันทึกการลา</button></div>
      <p class="muted small">ปีงบประมาณ ${fy}: ${esc(thDate(from))} – ${esc(thDate(to))} · นับวันทำการ จันทร์–ศุกร์ ไม่รวมวันหยุดที่ตั้งไว้ · ยอดรวมการลาที่ "รอตรวจ" และ "บันทึกแล้ว"</p></div>
    <div class="card"><h3>${teacherF || !staff ? `สรุปการลา${teacherF ? ` · ${esc(teacherF)}` : ''}` : 'สรุปการลารายครู (วัน)'}</h3>${summary}</div>
    <div class="card"><h3>รายการ (${rows.length})</h3>${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่</th>${staff ? '<th>ครู</th>' : ''}<th>ประเภท</th><th class="c">วัน</th><th>เหตุผล</th><th>สถานะ</th><th></th></tr></thead><tbody>
      ${rows.map((l) => { const canDel = admin || (!staff && l.status === 'pending' && !l.request_id); const canEdit = staff || (l.status === 'pending' && !l.request_id);
        return `<tr><td class="nowrap">${esc(l.date_from === l.date_to ? thDate(l.date_from) : `${thDate(l.date_from)} – ${thDate(l.date_to)}`)}${l.half ? ` <span class="small muted">(${l.half === 'am' ? 'เช้า' : 'บ่าย'})</span>` : ''}</td>
          ${staff ? `<td>${esc(l.teacher_name)}</td>` : ''}<td>${esc(l.leave_type)}${l.has_cert ? ' <span class="chip chip-ok" title="มีใบรับรองแพทย์">ใบรับรองแพทย์</span>' : ''}</td>
          <td class="c">${fmtDays(l.days)}</td><td>${esc(l.reason)}${l.request_id ? ' <span class="chip chip-info">จากคำขอ</span>' : ''}</td>
          <td><span class="badge ${l.status}">${LEAVE_STATUS[l.status]}</span></td>
          <td class="nowrap">${staff && l.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-ok="${l.id}">บันทึกแล้ว</button> ` : ''}
            ${canEdit ? `<button class="btn btn-sm" data-edit="${l.id}">แก้ไข</button> ` : ''}${canDel ? `<button class="btn btn-sm btn-danger" data-del="${l.id}">ลบ</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="muted">ไม่มีรายการ</p>'}</div>`;

  const keep = () => sessionStorage.setItem(NAME_KEY, JSON.stringify({ fy: +$('#lv-fy', el).value, teacher: $('#lv-t', el)?.value || '', type: $('#lv-ty', el).value }));
  ['#lv-fy', '#lv-t', '#lv-ty'].forEach((s) => $(s, el)?.addEventListener('change', () => { keep(); render(el, ctx); }));
  $('#lv-add', el).addEventListener('click', () => edit(null));
  $$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => edit(all.find((l) => l.id === b.dataset.edit))));
  $$('[data-ok]', el).forEach((b) => b.addEventListener('click', async () => {
    try { await q(sb.from('sub_leaves').update({ status: 'approved' }).eq('id', b.dataset.ok)); toast('บันทึกแล้ว'); render(el, ctx); } catch (e) { toast(e.message, 'err'); }
  }));
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('ลบรายการลานี้?'))) return;
    try { await q(sb.from('sub_leaves').delete().eq('id', b.dataset.del)); toast('ลบแล้ว'); render(el, ctx); } catch (e) { toast(e.message, 'err'); }
  }));

  async function edit(l) {
    const v = l || { teacher_name: teacherF || me.teacher || '', leave_type: 'ลากิจ', date_from: todayISO(), date_to: todayISO(), half: '', status: staff ? 'approved' : 'pending' };
    const p = modal(l ? 'แก้ไขการลา' : 'บันทึกการลา', `
      <label>ครู${staff ? `<select name="teacher_name" required><option value="">— เลือก —</option>${opts(names, v.teacher_name)}</select>` : `<input value="${esc(me.teacher)}" disabled>`}</label>
      <label>ประเภทการลา<select name="leave_type">${opts(types.filter((t) => t.active || t.leave_type === v.leave_type).map((t) => t.leave_type), v.leave_type)}</select></label>
      <div class="form-grid"><label>ตั้งแต่วันที่<input type="date" name="date_from" value="${v.date_from}" required></label>
        <label>ถึงวันที่<input type="date" name="date_to" value="${v.date_to}" required></label>
        <label>ช่วงเวลา<select name="half">${opts([['', 'เต็มวัน'], ['am', 'ครึ่งวันเช้า'], ['pm', 'ครึ่งวันบ่าย']], v.half)}</select></label></div>
      <label>เหตุผล<input name="reason" maxlength="300" value="${esc(v.reason || '')}"></label>
      <label>ระหว่างลาติดต่อได้ที่<input name="contact" maxlength="200" value="${esc(v.contact || '')}"></label>
      <label class="chk"><input type="checkbox" name="has_cert" ${v.has_cert ? 'checked' : ''}> มีใบรับรองแพทย์</label>
      <label>หมายเหตุ<input name="note" maxlength="300" value="${esc(v.note || '')}"></label>
      ${staff ? `<label>สถานะ<select name="status">${opts(Object.entries(LEAVE_STATUS), v.status)}</select></label>` : ''}
      <p class="note" id="lv-prev" style="display:block"></p>`, { okText: 'บันทึก' });
    setTimeout(() => {
      const f = $('.modal-wrap form'); if (!f) return;
      const fx = (n) => f.elements[n];
      const upd = () => {
        if (fx('half').value) fx('date_to').value = fx('date_from').value;
        if (fx('date_to').value < fx('date_from').value) fx('date_to').value = fx('date_from').value;
        const name = staff ? fx('teacher_name').value : me.teacher; const type = fx('leave_type').value;
        const d = countDays(rules, fx('date_from').value, fx('date_to').value, type, fx('half').value);
        const t = rules.byType[type]; const u = usage(all.filter((x) => x.teacher_name === name && x.id !== l?.id), fiscalYear(fx('date_from').value))[type]?.used || 0;
        const left = t?.quota_days == null ? null : t.quota_days - u - d;
        $('#lv-prev').innerHTML = `จำนวนวันลา <b>${fmtDays(d)}</b> วัน${left == null ? '' : ` · โควตา${esc(type)}คงเหลือหลังลา <b class="${left < 0 ? 'warn' : ''}">${fmtDays(left)}</b> วัน${left < 0 ? ' (เกินโควตา)' : ''}`}`;
      };
      f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
    }, 0);
    const r = await p; if (!r) return;
    const row = { teacher_name: staff ? r.teacher_name : me.teacher, leave_type: r.leave_type, date_from: r.date_from, date_to: r.half ? r.date_from : r.date_to,
      half: r.half, reason: (r.reason || '').trim(), contact: (r.contact || '').trim(), has_cert: r.has_cert === 'on', note: (r.note || '').trim() };
    if (staff) row.status = r.status;
    try {
      if (l) await q(sb.from('sub_leaves').update(row).eq('id', l.id));
      else await q(sb.from('sub_leaves').insert({ ...row, status: staff ? 'approved' : 'pending' }));
      toast('บันทึกแล้ว'); render(el, ctx);
    } catch (e) { toast(e.message, 'err'); }
  }
}
