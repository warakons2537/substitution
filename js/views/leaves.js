// ทะเบียนการลา: ฝ่ายวิชาการ/ผู้ดูแลเห็นทุกคน · ครูเห็นของตัวเอง
import { $, $$, esc, opts, toast, todayISO, thDate, modal, confirmBox } from '../util.js';
import { sb, q, settings } from '../db.js';
import { has } from '../perm.js';
import { realTeachers } from '../timetable.js';
import { loadRules, countDays, usage, fiscalYear, fiscalRange, fmtDays, roundUsage, nonLeaveSet } from '../leaves.js';
import { EVAL_LIMIT } from '../config.js';
import { printLeaveForm, LEAVE_FORM_TYPES } from '../print.js';

const NAME_KEY = 'wlsub-leave-filter';

export async function render(el, ctx) {
  const { me } = ctx;
  const staff = has(me, 'hr') || has(me, 'director');   // เห็นทะเบียนทุกคน (ฝ่ายวิชาการเห็นเฉพาะของตัวเอง)
  const hr = has(me, 'hr'); const admin = has(me, 'admin');
  const [rules, cfg] = await Promise.all([loadRules(), settings()]);
  const LEAVE_STATUS = { pending: 'รออนุญาต', approved: cfg.leave_approval === 'director' ? 'อนุญาตแล้ว' : 'บันทึกแล้ว', rejected: 'ไม่อนุญาต', cancelled: 'ยกเลิก' };
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

  const off = nonLeaveSet(rules);   // เช่น ไปราชการ: ไม่นับเป็นวันลา
  const sumOne = (name) => usage(all.filter((l) => l.teacher_name === name), fy);
  let summary;
  if (teacherF || !staff) {
    const u = sumOne(teacherF);
    summary = `<div class="g-scroll"><table class="g-tbl"><thead><tr><th>ประเภท</th><th class="c">ครั้ง</th><th class="c">วันที่ลา</th><th class="c">โควตา</th><th class="c">คงเหลือ</th></tr></thead><tbody>
      ${types.map((t) => { const x = u[t.leave_type] || { used: 0, count: 0 }; const left = t.quota_days == null ? null : t.quota_days - x.used;
        return `<tr><td>${esc(t.leave_type)}${off.has(t.leave_type) ? ' <span class="g-tag">ไม่นับเป็นวันลา</span>' : ''}</td><td class="c">${x.count}</td><td class="c">${fmtDays(x.used)}</td>
          <td class="c">${t.quota_days == null ? '<span class="muted">ไม่จำกัด</span>' : fmtDays(t.quota_days)}</td>
          <td class="c">${left == null ? '' : `<span class="${left < 0 ? 'g-over' : ''}">${fmtDays(left)}</span>`}</td></tr>`; }).join('')}
      </tbody></table></div>`;
  } else {
    const who = [...new Set(all.map((l) => l.teacher_name))].sort((a, b) => a.localeCompare(b, 'th'));
    const used = types.filter((t) => all.some((l) => l.leave_type === t.leave_type));
    summary = who.length ? `<div class="g-scroll"><table class="g-tbl"><thead><tr><th>ครู</th>${used.map((t) => `<th class="c">${esc(t.leave_type)}</th>`).join('')}<th class="c">รวมวันลา${used.some((t) => off.has(t.leave_type)) ? ' (ไม่รวมไปราชการ)' : ''}</th></tr></thead><tbody>
      ${who.map((n) => { const u = sumOne(n); let tot = 0;
        return `<tr><td>${esc(n)}</td>${used.map((t) => { const x = u[t.leave_type]; if (!off.has(t.leave_type)) tot += x?.used || 0;
          const over = x && t.quota_days != null && x.used > t.quota_days;
          return `<td class="c ${over ? 'g-over' : ''}">${x ? fmtDays(x.used) : '<span class="muted">-</span>'}</td>`; }).join('')}<td class="c"><b>${fmtDays(tot)}</b></td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="g-empty">ยังไม่มีข้อมูลการลาในปีงบประมาณนี้</p>';
  }

  const ICON = {
    pending: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.6"/></svg>',
    approved: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
    rejected: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    cancelled: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3.5 8h9"/></svg>' };
  const pill = (st) => `<span class="g-pill g-${st}">${ICON[st] || ''}<span>${LEAVE_STATUS[st]}</span></span>`;
  const gpill = (st, t) => `<span class="g-pill g-${st}">${ICON[st] || ''}<span>${t}</span></span>`;
  const chips = [['', 'ทั้งหมด', all.length], ...types.map((t) => [t.leave_type, t.leave_type, all.filter((l) => l.leave_type === t.leave_type).length])];
  el.innerHTML = `<div class="wl-g">
    <header class="g-hero g-hero-sm"><div class="g-hero-text">
      <h1>ทะเบียนการลา</h1><p>ปีงบประมาณ ${fy} · ${esc(thDate(from))} – ${esc(thDate(to))}</p></div>
      ${hr || me.teacher ? '<button class="g-btn" id="lv-add" type="button">+ บันทึกการลา</button>' : ''}</header>
    <div class="g-filters">
      <label>ปีงบประมาณ (พ.ศ.)<select id="lv-fy">${opts(years, fy)}</select></label>
      ${staff ? `<label>ครู<select id="lv-t"><option value="">ทั้งหมด</option>${opts(names, teacherF)}</select></label>` : ''}</div>
    <div class="g-chips" role="group" aria-label="กรองตามประเภทการลา">${chips.map(([v, t, n]) => `<button type="button" class="g-chip" data-ty="${esc(v)}" aria-pressed="${v === typeF}"><span>${esc(t)}</span><b class="num">${n}</b></button>`).join('')}</div>
    <p class="g-sub">นับวันทำการ จันทร์–ศุกร์ ไม่รวมวันหยุดที่ตั้งไว้ · ยอดรวมการลาที่ "รอตรวจ" และ "บันทึกแล้ว"</p>
    <section class="g-card"><div class="g-card-h"><h3>${teacherF || !staff ? `สรุปการลา${teacherF ? ` · ${esc(teacherF)}` : ''}` : 'สรุปการลารายครู (วัน)'}</h3></div>${summary}</section>
    ${teacherF || !staff ? `<section class="g-card"><div class="g-card-h"><h3>รอบการประเมิน · ${esc(EVAL_LIMIT.types.join(' + '))}</h3></div><div class="g-pad">
      ${roundUsage(all, teacherF || me.teacher, fy).map((r) => `<div class="g-round"><div class="g-round-h"><b>${esc(r.label)}</b>
        ${gpill(r.level === 'over' ? 'rejected' : r.level === 'near' ? 'pending' : 'approved', r.level === 'over' ? 'เกินเกณฑ์อ้างอิง' : r.level === 'near' ? 'ใกล้ถึงเกณฑ์' : 'ยังอยู่ในเกณฑ์')}</div>
        <div class="g-meter" role="img" aria-label="${fmtDays(r.used)} จาก ${r.limit} วัน"><i class="${r.level}" style="width:${Math.min(100, Math.round(r.used / r.limit * 100))}%"></i></div>
        <div class="g-sub"><b class="num">${fmtDays(r.used)}</b> / ${r.limit} วันทำการ</div></div>`).join('')}
      <p class="g-sub">เกณฑ์ ${EVAL_LIMIT.days} วันทำการต่อรอบเป็นค่าอ้างอิงเบื้องต้น (ลาป่วย+ลากิจ) ไม่ใช่ข้อสรุปทางกฎหมาย กรุณาตรวจสอบกับระเบียบ/ต้นสังกัด · นับตามวันที่เริ่มลา</p></div></section>` : ''}
    <section class="g-card"><div class="g-card-h"><h3>รายการ (${rows.length})</h3></div>${rows.length ? `<div class="g-scroll"><table class="g-tbl"><thead><tr><th>วันที่</th>${staff ? '<th>ครู</th>' : ''}<th>ประเภท</th><th class="c">วัน</th><th>เหตุผล</th><th>สถานะ</th><th></th></tr></thead><tbody>
      ${rows.map((l) => { const canDel = admin || (!staff && l.status === 'pending' && !l.request_id); const canEdit = hr || (!l.request_id && ['pending', 'approved'].includes(l.status) && l.teacher_name === me.teacher);
        return `<tr><td class="nowrap">${esc(l.date_from === l.date_to ? thDate(l.date_from) : `${thDate(l.date_from)} – ${thDate(l.date_to)}`)}${l.half ? ` <span class="g-sub">(${l.half === 'am' ? 'เช้า' : 'บ่าย'})</span>` : ''}</td>
          ${staff ? `<td>${esc(l.teacher_name)}</td>` : ''}<td>${esc(l.leave_type)}${l.has_cert ? ' <span class="g-pill g-approved" title="มีใบรับรองแพทย์">' + ICON.approved + '<span>ใบรับรองแพทย์</span></span>' : ''}</td>
          <td class="c num">${fmtDays(l.days)}</td><td>${esc(l.reason)}${l.request_id ? ' <span class="g-tag">จากคำขอ</span>' : ''}</td>
          <td>${pill(l.status)}${staff && l.signed_at ? ' <span class="g-pill g-approved" title="เซ็นเอกสารแล้ว">' + ICON.approved + '<span>เซ็นแล้ว</span></span>' : ''}</td>
          <td class="nowrap">${LEAVE_FORM_TYPES.includes(l.leave_type) && ['pending', 'approved'].includes(l.status) ? `<button class="g-btn g-btn-line g-btn-sm" type="button" data-pform="${l.id}">พิมพ์ใบลา</button> ` : ''}${canEdit ? `<button class="g-btn g-btn-line g-btn-sm" type="button" data-edit="${l.id}">แก้ไข</button> ` : ''}${canDel ? `<button class="g-btn g-btn-line g-btn-sm g-danger" type="button" data-del="${l.id}">ลบ</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="g-empty">ไม่มีรายการ</p>'}</section></div>`;

  const keep = () => sessionStorage.setItem(NAME_KEY, JSON.stringify({ fy: +$('#lv-fy', el).value, teacher: $('#lv-t', el)?.value || '', type: $('.g-chip[aria-pressed="true"]', el)?.dataset.ty || '' }));
  ['#lv-fy', '#lv-t'].forEach((s) => $(s, el)?.addEventListener('change', () => { keep(); render(el, ctx); }));
  $$('.g-chip', el).forEach((b) => b.addEventListener('click', () => { $$('.g-chip', el).forEach((x) => x.setAttribute('aria-pressed', x === b)); keep(); render(el, ctx); }));
  $('#lv-add', el)?.addEventListener('click', () => edit(null));
  $$('[data-pform]', el).forEach((b) => b.addEventListener('click', () => printLeaveOf(all.find((l) => l.id === b.dataset.pform), me)));
  $$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => edit(all.find((l) => l.id === b.dataset.edit))));
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('ลบรายการลานี้?'))) return;
    try { await q(sb.from('sub_leaves').delete().eq('id', b.dataset.del)); toast('ลบแล้ว'); render(el, ctx); } catch (e) { toast(e.message, 'err'); }
  }));

  async function edit(l) {
    const v = l || { teacher_name: teacherF || me.teacher || '', leave_type: 'ลากิจ', date_from: todayISO(), date_to: todayISO(), half: '', status: 'approved' };
    const p = modal(l ? 'แก้ไขการลา' : 'บันทึกการลา', `
      <label>ครู${hr ? `<select name="teacher_name" required><option value="">— เลือก —</option>${opts(names, v.teacher_name)}</select>` : `<input value="${esc(me.teacher)}" disabled>`}</label>
      <label>ประเภทการลา<select name="leave_type">${opts(types.filter((t) => t.active || t.leave_type === v.leave_type).map((t) => t.leave_type), v.leave_type)}</select></label>
      <div class="form-grid"><label>ตั้งแต่วันที่<input type="date" name="date_from" value="${v.date_from}" required></label>
        <label>ถึงวันที่<input type="date" name="date_to" value="${v.date_to}" required></label>
        <label>ช่วงเวลา<select name="half">${opts([['', 'เต็มวัน'], ['am', 'ครึ่งวันเช้า'], ['pm', 'ครึ่งวันบ่าย']], v.half)}</select></label></div>
      <label>เหตุผล<input name="reason" maxlength="300" value="${esc(v.reason || '')}"></label>
      <label>ระหว่างลาติดต่อได้ที่<input name="contact" maxlength="200" value="${esc(v.contact || '')}"></label>
      <label class="chk"><input type="checkbox" name="has_cert" ${v.has_cert ? 'checked' : ''}> มีใบรับรองแพทย์</label>
      <label>หมายเหตุ<input name="note" maxlength="300" value="${esc(v.note || '')}"></label>
      ${hr ? `<label>สถานะ<select name="status">${opts(Object.entries(LEAVE_STATUS), v.status)}</select></label>` : ''}
      <p class="note" id="lv-prev" style="display:block"></p>`, { okText: 'บันทึก' });
    setTimeout(() => {
      const f = $('.modal-wrap form'); if (!f) return;
      const fx = (n) => f.elements[n];
      const upd = () => {
        if (fx('half').value) fx('date_to').value = fx('date_from').value;
        if (fx('date_to').value < fx('date_from').value) fx('date_to').value = fx('date_from').value;
        const name = hr ? fx('teacher_name').value : me.teacher; const type = fx('leave_type').value;
        const d = countDays(rules, fx('date_from').value, fx('date_to').value, type, fx('half').value);
        const t = rules.byType[type]; const u = usage(all.filter((x) => x.teacher_name === name && x.id !== l?.id), fiscalYear(fx('date_from').value))[type]?.used || 0;
        const left = t?.quota_days == null ? null : t.quota_days - u - d;
        $('#lv-prev').innerHTML = `จำนวนวันลา <b>${fmtDays(d)}</b> วัน${left == null ? '' : ` · โควตา${esc(type)}คงเหลือหลังลา <b class="${left < 0 ? 'warn' : ''}">${fmtDays(left)}</b> วัน${left < 0 ? ' (เกินโควตา)' : ''}`}`;
      };
      f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
    }, 0);
    const r = await p; if (!r) return;
    const row = { teacher_name: hr ? r.teacher_name : me.teacher, leave_type: r.leave_type, date_from: r.date_from, date_to: r.half ? r.date_from : r.date_to,
      half: r.half, reason: (r.reason || '').trim(), contact: (r.contact || '').trim(), has_cert: r.has_cert === 'on', note: (r.note || '').trim() };
    if (hr && r.status) row.status = r.status;
    try {
      if (l) await q(sb.from('sub_leaves').update(row).eq('id', l.id));
      else await q(sb.from('sub_leaves').insert({ ...row, status: 'approved' }));   // ครูบันทึกเอง: ฐานข้อมูลกำหนดสถานะตามโหมดการอนุญาต
      toast('บันทึกแล้ว'); render(el, ctx);
    } catch (e) { toast(e.message, 'err'); }
  }
}

/** พิมพ์ใบลาจากรายการในทะเบียน · ของตัวเองใช้ข้อมูลของฉัน · ของครูอื่น (งานบุคคล/ผอ.) ใช้ข้อมูลจากบัญชีของครูคนนั้น */
export async function printLeaveOf(l, me) {
  try {
    const own = l.teacher_name === me.teacher;
    const [history, profs] = await Promise.all([
      q(sb.from('sub_leaves').select('*').eq('teacher_name', l.teacher_name)),
      own ? [] : q(sb.rpc('sub_teacher_profiles')).catch(() => []),
    ]);
    const prof = own ? me : (profs.find((p) => p.teacher_name === l.teacher_name) || {});
    await printLeaveForm(history.find((x) => x.id === l.id) || l, prof, history);
  } catch (e) { toast(e.message, 'err'); }
}
