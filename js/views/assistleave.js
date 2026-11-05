// งานบุคคล: ช่วยจัดวันลา — เลือกครู/ประเภท/ช่วงวันที่ ระบบคำนวณวันลา เช็กวันหยุด โควตา รอบประเมิน และวันที่ซ้อนกับที่ลาไว้แล้ว ก่อนบันทึก
import { $, $$, esc, opts, toast, todayISO, thDate, thDay, dateRange, dowIndex } from '../util.js';
import { sb, q } from '../db.js';
import { realTeachers } from '../timetable.js';
import { loadRules, countDays, usage, fiscalYear, fmtDays, roundUsage, nonLeaveSet, roundNo } from '../leaves.js';
import { EVAL_LIMIT } from '../config.js';
import { hero, pill } from '../gui.js';
import { has } from '../perm.js';
import { printSubNotes } from '../print.js';

export async function render(el, ctx) {
  const rules = await loadRules();
  const off = nonLeaveSet(rules);
  const types = rules.types.filter((t) => t.active);
  const known = await q(sb.from('sub_leaves').select('teacher_name').neq('status', 'cancelled').limit(2000)).catch(() => []);
  const names = [...new Set([...(ctx.tt ? realTeachers(ctx.tt.data) : []), ...known.map((l) => l.teacher_name)])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'th'));
  const today = todayISO();

  el.innerHTML = `<div class="wl-g">${hero('ช่วยจัดวันลา', 'เลือกครู ประเภท และช่วงวันที่ ระบบคำนวณวันลา ตรวจวันหยุด โควตา และวันที่ซ้อนกัน ให้ก่อนบันทึก')}
    <section class="g-card"><div class="g-pad"><div class="g-form">
      <label>ครู<select name="teacher"><option value="">— เลือก —</option>${opts(names)}</select></label>
      <label>ประเภทการลา<select name="leave_type">${opts(types.map((t) => t.leave_type), 'ลากิจ')}</select></label>
      <label>ตั้งแต่วันที่<input type="date" name="from" value="${today}"></label>
      <label>ถึงวันที่<input type="date" name="to" value="${today}"></label>
      <label>ช่วงเวลา<select name="half">${opts([['', 'เต็มวัน'], ['am', 'ครึ่งวันเช้า'], ['pm', 'ครึ่งวันบ่าย']])}</select></label>
      <label>ระหว่างลาติดต่อได้ที่<input name="contact" maxlength="200"></label>
      <label class="span2">เหตุผล/รายละเอียด<input name="reason" maxlength="300"></label>
      <label class="span2">หมายเหตุ<input name="note" maxlength="300"></label>
    </div>
    <div class="g-checks"><label class="g-check"><input class="g-chk" type="checkbox" name="has_cert"> มีใบรับรองแพทย์</label>
      <label class="g-check"><input class="g-chk" type="checkbox" name="signed"> เซ็นเอกสารแล้ว</label></div></div></section>
    <section class="g-card"><div class="g-pad"><div id="al-prev"><p class="muted">เลือกครูและวันที่</p></div>
      <div class="g-actions"><button class="g-btn" type="button" id="al-save" disabled>บันทึกการลา</button></div></div></section>
    <section class="g-card"><div class="g-card-h"><h3>การสอนแทนของช่วงนี้</h3></div><div class="g-pad" id="al-subs"><p class="muted">เลือกครูและวันที่</p></div></section></div>`;

  const f = (n) => $(`[name="${n}"]`, el);
  let mine = []; let mineFor = '';
  const loadMine = async (name) => {
    if (name === mineFor) return;
    mineFor = name;
    mine = name ? await q(sb.from('sub_leaves').select('id,teacher_name,leave_type,date_from,date_to,half,days,status').eq('teacher_name', name).neq('status', 'cancelled').order('date_from', { ascending: false }).limit(500)).catch(() => []) : [];
  };

  const dayRow = (d, type, half) => {
    const cal = !!rules.byType[type]?.calendar_days;
    if (!cal && dowIndex(d) < 0) return [d, 'เสาร์-อาทิตย์', false];
    if (!cal && rules.hset.has(d)) return [d, rules.holidays.find((h) => String(h.day).slice(0, 10) === d)?.name || 'วันหยุด', false];
    return [d, half ? (half === 'am' ? 'ครึ่งวันเช้า' : 'ครึ่งวันบ่าย') : 'นับเป็นวันลา', true];
  };

  let profiles = null;
  async function showSubs(teacher, from, to) {
    const box = $('#al-subs', el);
    if (!teacher || !from) { box.innerHTML = '<p class="muted">เลือกครูและวันที่</p>'; return; }
    const recs = await q(sb.from('sub_records').select('*').eq('status', 'confirmed').eq('absent_teacher', teacher).gte('sub_date', from).lte('sub_date', to).order('sub_date').order('period')).catch(() => []);
    if (f('teacher').value !== teacher) return;
    const groups = [];
    for (const r of recs) {
      let g = groups.find((x) => x.date === r.sub_date);
      if (!g) { g = { date: r.sub_date, name: teacher, leave_type: r.leave_type, recs: [] }; groups.push(g); }
      g.recs.push(r);
    }
    const link = has(ctx.me, 'academic')
      ? `<a class="g-btn g-btn-line" href="#assist?teacher=${encodeURIComponent(teacher)}&from=${from}&to=${to}&type=${encodeURIComponent(f('leave_type').value)}">จัดสอนแทนต่อ</a>`
      : '<span class="g-sub">การจัดสอนแทนทำโดยฝ่ายวิชาการ (เมนู "จัดสอนแทน")</span>';
    box.innerHTML = groups.length
      ? `<div class="g-scroll"><table class="g-tbl"><thead><tr><th>วันที่</th><th>คาบ</th><th>ครูสอนแทน</th></tr></thead><tbody>
        ${groups.map((g) => `<tr><td class="nowrap">${esc(thDay(g.date))} ${esc(thDate(g.date))}</td><td>${g.recs.map((r) => r.period).join(', ')}</td>
          <td>${g.recs.map((r) => `${r.period}: ${r.substitute_teacher ? esc(r.substitute_teacher) : '<span class="muted">ไม่ต้องสอนแทน</span>'}`).join(' · ')}</td></tr>`).join('')}</tbody></table></div>
        <div class="g-actions"><button class="g-btn" type="button" id="al-print">พิมพ์บันทึกการสอนแทน (${groups.length} แผ่น)</button>${link}</div>`
      : `<p class="g-empty">ยังไม่มีการจัดสอนแทนของ ${esc(teacher)} ในช่วงนี้</p><div class="g-actions">${link}</div>`;
    $('#al-print', el)?.addEventListener('click', async () => {
      try {
        profiles ||= await q(sb.rpc('sub_teacher_profiles'));
        const pr = profiles.find((p) => p.teacher_name === teacher);
        await printSubNotes(groups.map((g) => ({ ...g, teacher: { full_name: pr?.full_name || teacher, position_short: pr?.position_short || '' } })));
      } catch (e) { toast(e.message, 'err'); }
    });
  }

  async function refresh() {
    const teacher = f('teacher').value; const type = f('leave_type').value;
    const from = f('from').value; let to = f('to').value || from; const half = f('half').value;
    if (half || to < from) { to = from; f('to').value = from; }
    const box = $('#al-prev', el); const save = $('#al-save', el);
    save.disabled = true;
    if (!teacher || !from) { box.innerHTML = '<p class="muted">เลือกครูและวันที่</p>'; showSubs('', ''); return; }
    await loadMine(teacher);
    if (f('teacher').value !== teacher) return;
    const dates = dateRange(from, to);
    const rows = dates.map((d) => dayRow(d, type, half));
    const days = countDays(rules, from, to, type, half);
    const clash = mine.filter((l) => l.date_from <= to && l.date_to >= from);
    const fy = fiscalYear(from);
    const u = usage(mine, fy)[type]?.used || 0; const t = rules.byType[type];
    const left = t?.quota_days == null ? null : t.quota_days - u - days;
    const fake = { teacher_name: teacher, leave_type: type, date_from: from, date_to: to, days, status: 'approved' };
    const rd = EVAL_LIMIT.types.includes(type) ? roundUsage([...mine, fake], teacher, fy).find((r) => r.n === roundNo(from)) : null;
    const warns = [];
    if (!days) warns.push('ช่วงนี้ไม่มีวันทำการที่นับเป็นวันลา');
    if (clash.length) warns.push(`ซ้อนกับการลาที่บันทึกไว้แล้ว ${clash.length} รายการ`);
    if (left != null && left < 0) warns.push(`เกินโควตา${type} ${fmtDays(-left)} วัน`);
    if (rd && rd.level === 'over') warns.push(`เกินเกณฑ์อ้างอิงรอบประเมิน (${fmtDays(rd.used)}/${rd.limit} วัน)`);
    box.innerHTML = `<div class="g-round"><div class="g-round-h"><b>${esc(teacher)} · ${esc(type)}${off.has(type) ? ' <span class="g-tag">ไม่นับเป็นวันลา</span>' : ''}</b>
        ${pill(warns.length ? 'pending' : 'approved', warns.length ? 'ตรวจสอบก่อนบันทึก' : 'พร้อมบันทึก')}</div>
      <div class="g-sub">จำนวนวันลา <b class="num">${fmtDays(days)}</b> วัน${left == null ? '' : ` · โควตาคงเหลือหลังลา <b class="num ${left < 0 ? 'g-over' : ''}">${fmtDays(left)}</b> วัน`}
        ${rd ? ` · ${esc(rd.label)}: <b class="num ${rd.level === 'over' ? 'g-over' : ''}">${fmtDays(rd.used)}</b> / ${rd.limit} วัน` : ''}</div>
      ${warns.map((w) => `<p class="warn small">⚠ ${esc(w)}</p>`).join('')}</div>
      ${clash.length ? `<p class="g-sub">ที่ลาไว้แล้ว: ${clash.map((l) => `${esc(l.leave_type)} ${esc(thDate(l.date_from))}${l.date_to !== l.date_from ? ' – ' + esc(thDate(l.date_to)) : ''}`).join(' · ')}</p>` : ''}
      <div class="g-scroll"><table class="g-tbl"><thead><tr><th>วันที่</th><th>วัน</th><th>การนับ</th></tr></thead><tbody>
      ${rows.map(([d, txt, ok]) => `<tr><td class="nowrap">${esc(thDate(d))}</td><td>${esc(thDay(d))}</td><td>${ok ? esc(txt) : `<span class="muted">ไม่นับ — ${esc(txt)}</span>`}</td></tr>`).join('')}
      </tbody></table></div>`;
    save.disabled = !days || !!clash.length;
    save.dataset.days = days;
    showSubs(teacher, from, to);
  }

  $$('.g-form input, .g-form select', el).forEach((x) => x.addEventListener('change', () => refresh()));
  $('#al-save', el).addEventListener('click', async () => {
    const btn = $('#al-save', el);
    const row = { teacher_name: f('teacher').value, leave_type: f('leave_type').value, date_from: f('from').value, date_to: f('half').value ? f('from').value : (f('to').value || f('from').value),
      half: f('half').value, reason: f('reason').value.trim(), contact: f('contact').value.trim(), has_cert: f('has_cert').checked, note: f('note').value.trim(), status: 'approved' };
    if (f('signed').checked) row.signed_at = new Date().toISOString();
    try {
      btn.disabled = true;
      await q(sb.from('sub_leaves').insert(row));
      toast(`บันทึกการลา ${row.teacher_name} แล้ว (${fmtDays(btn.dataset.days)} วัน)`);
      mineFor = ''; f('reason').value = ''; f('note').value = ''; f('has_cert').checked = false; f('signed').checked = false;
      await refresh();
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
  });
  refresh();
}
