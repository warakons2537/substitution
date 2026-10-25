// ฝ่ายวิชาการ: นำเข้าตารางสอนจากไฟล์สำรอง JSON ของ WL Scheduler
import { $, $$, esc, opts, toast, thDate } from '../util.js';
import { sb, q } from '../db.js';
import { listScenarios, convertScenario } from '../timetable.js';

const guessYearTerm = () => {
  const d = new Date(); const m = d.getMonth() + 1; let y = d.getFullYear() + 543;
  if (m <= 4) y -= 1; // ม.ค.-เม.ย. ยังเป็นปีการศึกษาก่อนหน้า
  return { y, t: m >= 5 && m <= 9 ? 1 : 2 };
};

export async function render(el, ctx) {
  const list = await q(sb.from('sub_timetables').select('id,academic_year,term,name,is_active,imported_at').order('imported_at', { ascending: false }));
  const g = guessYearTerm();
  el.innerHTML = `<h2>นำเข้าตารางสอน</h2>
    <div class="card"><p class="muted small">ใช้ไฟล์สำรอง (.json) จาก WL Scheduler</p>
      <div class="form-grid">
        <label class="span2">ไฟล์ JSON<input type="file" id="i-file" accept=".json,application/json"></label>
        <label>ปีการศึกษา<input type="number" id="i-year" value="${g.y}" min="2560" max="2700"></label>
        <label>ภาคเรียน<select id="i-term">${opts([1, 2, 3], g.t)}</select></label>
        <label class="span-all" id="i-sc-wrap" hidden>แผนตารางสอน<select id="i-sc"></select></label>
      </div><div id="i-preview"></div>
      <div class="actions"><button class="btn btn-primary" id="i-save" disabled>บันทึกและใช้ตารางนี้</button></div></div>
    <div class="card"><h3>ตารางสอนที่นำเข้าแล้ว</h3>
      ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>ปี/ภาค</th><th>แผน</th><th>นำเข้าเมื่อ</th><th></th></tr></thead><tbody>
      ${list.map((t) => `<tr><td>${t.academic_year}/${t.term}</td><td>${esc(t.name)}</td><td>${esc(thDate(t.imported_at.slice(0, 10)))}</td>
        <td class="nowrap">${t.is_active ? '<span class="badge approved">ใช้อยู่</span>'
          : `<button class="btn btn-sm" data-use="${t.id}">ใช้ตารางนี้</button> <button class="btn btn-sm btn-danger" data-del="${t.id}">ลบ</button>`}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">ยังไม่มี</p>'}</div>`;

  let json = null; let conv = null;
  const preview = () => {
    conv = null; $('#i-save', el).disabled = true;
    try {
      conv = convertScenario(json, $('#i-sc', el).value);
      const D = conv.data;
      const count = (n) => D.slots.filter((s) => s.teachers.includes(n)).length;
      $('#i-preview', el).innerHTML = `<p>พบ ${D.slots.length} คาบเรียน · ${D.days.length} วัน × ${D.periods} คาบ · ครู ${D.teachers.length} คน</p>
        ${conv.conflicts.length ? `<p class="warn">⚠ พบครูสอนชนกัน ${conv.conflicts.length} จุด (เช่น ${esc(conv.conflicts.slice(0, 3).join(', '))}) — ตรวจไฟล์ก่อนบันทึก</p>` : ''}
        ${conv.skipped.length ? `<p class="warn small">ข้าม ${conv.skipped.length} รายการที่อ่านไม่ได้</p>` : ''}
        <div class="table-wrap"><table class="tbl"><thead><tr><th>ครู</th><th>ตึกประจำ</th><th>คาบ/สัปดาห์</th><th>แนะนำเป็นผู้สอนแทน</th></tr></thead><tbody>
        ${D.teachers.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.building || '-')}</td><td class="c">${count(t.name)}</td>
          <td>${t.pseudo ? '<span class="muted">ไม่แนะนำ (ไม่ใช่ครูจริง)</span>' : (t.active ? 'แนะนำได้' : '<span class="muted">ไม่ใช้งาน</span>')}</td></tr>`).join('')}
        </tbody></table></div>`;
      $('#i-save', el).disabled = !D.slots.length;
    } catch (e) { $('#i-preview', el).innerHTML = `<p class="warn">${esc(e.message)}</p>`; }
  };

  $('#i-file', el).addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      json = JSON.parse(await file.text());
      const scs = listScenarios(json);
      $('#i-sc', el).innerHTML = opts(scs.map((s) => [s.id, `${s.active ? '★ ' : ''}${s.name}`]), (scs.find((s) => s.active) || scs[0]).id);
      $('#i-sc-wrap', el).hidden = false;
      preview();
    } catch (err) { json = null; $('#i-preview', el).innerHTML = `<p class="warn">อ่านไฟล์ไม่ได้: ${esc(err.message)}</p>`; }
  });
  $('#i-sc', el).addEventListener('change', preview);

  const activate = async (id) => {
    await q(sb.from('sub_timetables').update({ is_active: false }).eq('is_active', true));
    await q(sb.from('sub_timetables').update({ is_active: true }).eq('id', id));
  };
  $('#i-save', el).addEventListener('click', async () => {
    const year = +$('#i-year', el).value; const term = +$('#i-term', el).value;
    if (!year) { toast('กรุณาใส่ปีการศึกษา', 'err'); return; }
    try {
      $('#i-save', el).disabled = true;
      const row = (await q(sb.from('sub_timetables').insert({ academic_year: year, term, name: conv.data.scenario, source: 'json', data: conv.data }).select('id')))[0];
      await activate(row.id);
      toast('นำเข้าและเปิดใช้ตารางสอนแล้ว'); ctx.reload();
    } catch (err) { toast(err.message, 'err'); $('#i-save', el).disabled = false; }
  });
  $$('[data-use]', el).forEach((b) => b.addEventListener('click', async () => {
    try { await activate(b.dataset.use); toast('เปลี่ยนตารางสอนที่ใช้แล้ว'); ctx.reload(); } catch (err) { toast(err.message, 'err'); }
  }));
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('ลบตารางสอนนี้? (รายการสอนแทนที่บันทึกแล้วไม่ถูกลบ)')) return;
    try { await q(sb.from('sub_timetables').delete().eq('id', b.dataset.del)); render(el, ctx); } catch (err) { toast(err.message, 'err'); }
  }));
}
