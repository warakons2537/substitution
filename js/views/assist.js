// ฝ่ายวิชาการ: ช่วยจัดครูสอนแทน
import { $, toast } from '../util.js';
import { sb, q, rankData } from '../db.js';
import { mountLeaveForm } from '../leaveform.js';
import { buildItems, mountPlanner, NONE } from '../planner.js';

export async function render(el, { tt }) {
  el.innerHTML = `<h2>ช่วยจัดครูสอนแทน</h2>
    <div class="card"><div id="a-form"></div></div>
    <div class="card"><div id="a-plan"><p class="muted">เลือกครูที่ลาและวันที่</p></div>
      <div class="actions"><button class="btn btn-primary" id="a-save" disabled>บันทึกการสอนแทน</button></div></div>`;
  let rank = await rankData();
  let plan = null; let cur = null;

  const rebuild = (v) => {
    cur = v; plan = null; $('#a-save').disabled = true;
    if (!v.teacher || !v.dates.length) { $('#a-plan').innerHTML = '<p class="muted">เลือกครูที่ลาและวันที่</p>'; return; }
    let items = v.noneChecked ? [] : buildItems(tt.data, v.teacher, v.dates, v.periods);
    // คาบที่บันทึกไว้แล้วไม่ต้องจัดซ้ำ
    const done = items.filter((it) => rank.records.some((r) => r.a === v.teacher && r.d === it.date && r.p === it.p));
    items = items.filter((it) => !done.includes(it));
    plan = mountPlanner($('#a-plan'), { data: tt.data, rank, absent: v.teacher, items });
    if (done.length) $('#a-plan').insertAdjacentHTML('afterbegin', `<p class="note">ข้าม ${done.length} คาบที่บันทึกไว้แล้ว (แก้ไขได้ที่หน้า "บันทึกการสอนแทน")</p>`);
    $('#a-save').disabled = !items.length;
  };
  mountLeaveForm($('#a-form'), { data: tt.data, onChange: rebuild });

  $('#a-save').addEventListener('click', async () => {
    if (!plan || !plan.valid()) { toast('กรุณาเลือกครูสอนแทน (หรือ "ไม่ต้องสอนแทน") ให้ครบทุกคาบ', 'err'); return; }
    const rows = plan.items.map((it) => ({
      sub_date: it.date, academic_year: tt.academic_year, term: tt.term, period: it.p,
      absent_teacher: cur.teacher, leave_type: cur.leave_type, grade: it.grade, subject: it.subject,
      substitute_teacher: it.sel === NONE ? '' : it.sel, note: it.sel === NONE ? 'ไม่ต้องสอนแทน' : '',
      status: 'confirmed', source: 'assist',
    }));
    try {
      $('#a-save').disabled = true;
      await q(sb.from('sub_records').insert(rows));
      toast(`บันทึกแล้ว ${rows.length} คาบ`);
      rank = await rankData();
      rebuild(cur);
    } catch (e) { toast(e.message, 'err'); $('#a-save').disabled = false; }
  });
}
