// ฝ่ายวิชาการ: บันทึกการสอนแทนด้วยมือ + รายการที่บันทึกแล้ว (แก้ไข/ลบ)
import { $, $$, esc, opts, toast, todayISO, thDate, thDay, dowIndex , confirmBox } from '../util.js';
import { sb, q, rankData } from '../db.js';
import { loadRules } from '../leaves.js';
import { realTeachers, gradeLabel, slotsOf } from '../timetable.js';
import { SWAP } from '../planner.js';
import { hero, bulkBar, pill } from '../gui.js';

const SRC = { assist: 'ช่วยจัด', manual: 'บันทึกเอง', request: 'คำขอ' };
const WINFO = 'ครูคนที่ 2 ไปสอนคาบของครูคนที่ 1 และครูคนที่ 1 ไปสอนคาบของครูคนที่ 2 · ไม่นับเป็นการลา/สอนแทนในสถิติ';

// ลบแล้วต้องมีแถวหายจริง (ถ้าสิทธิ์ฐานข้อมูลไม่อนุญาต Supabase ไม่ฟ้อง error แต่ลบ 0 แถว)
async function delRows(query, n) {
  const gone = await q(query.select('id'));
  if (gone.length < n) throw new Error('ลบไม่สำเร็จ — ยังไม่ได้รัน SQL รอบ 9 (supabase/schema.sql) หรือไม่มีสิทธิ์ลบ');
}

export async function render(el, ctx) {
  const { tt } = ctx;
  const admin = true;   // หน้านี้เข้าได้เฉพาะฝ่ายวิชาการ/ผู้ดูแลระบบ — ลบรายการได้ทั้งคู่ (SQL รอบ 9)
  const month = sessionStorage.getItem('wlsub-month') || todayISO().slice(0, 7);
  const teachers = realTeachers(tt.data);
  const per = Array.from({ length: tt.data.periods }, (_, i) => i + 1);
  const [yy, mm] = month.split('-').map(Number);
  const next = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
  const [list, rules, rank] = await Promise.all([
    q(sb.from('sub_records').select('*').eq('status', 'confirmed').gte('sub_date', `${month}-01`).lt('sub_date', next).order('sub_date').order('period')),
    loadRules(), rankData(),
  ]);
  // ประเภทการลาจากตาราง sub_leave_types (ที่เดียวกับทะเบียนการลา) + ไม่ระบุ
  const types = [...new Set([...rules.types.filter((t) => t.active !== false).map((t) => t.leave_type), 'ไม่ระบุ'])];
  const slotAt = (n, date, p) => slotsOf(tt.data, n, dowIndex(date)).find((x) => x.p === p);
  const swappedOut = (n, date, p, except = []) => rank.records.some((r) => r.lt === SWAP && r.st === 'confirmed' && r.a === n && r.d === date && r.p === p && !except.includes(r.i));
  /** ตรวจว่าครู n ไปสอนคาบ date/p ได้ไหม: hard = ห้ามบันทึก · warn = เตือนก่อนบันทึก */
  //   ครูว่างที่สอนแทนคาบนี้อยู่แล้ว 1 ห้อง รับเพิ่มได้อีก 1 ห้อง (คาบคู่ · dualWith = ห้องเดิม) · เกิน 2 ห้องไม่ได้
  const check = (n, date, p, except = [], allowDual = false) => {
    const hard = []; const warn = []; let dualWith = '';
    const subs = rank.records.filter((r) => r.st === 'confirmed' && r.s === n && r.d === date && r.p === p && !except.includes(r.i));
    const own = slotAt(n, date, p);
    const teach = own && !swappedOut(n, date, p, except);
    if (subs.length && (!allowDual || teach || subs.length >= 2 || subs[0].lt === SWAP)) hard.push(`${n} มีรายการสอนแทน/แลกคาบในคาบนี้อยู่แล้ว`);
    else if (subs.length) {
      const s = slotAt(subs[0].a, date, p);
      dualWith = `${s ? `${gradeLabel(s)} ${s.subject} ` : ''}(สอนแทน ${subs[0].a})`;
      warn.push(`${n} สอนแทน ${dualWith} คาบนี้อยู่แล้ว — จะบันทึกเป็นคาบคู่ (สอน 2 ห้องพร้อมกัน ใช้กับห้องนักเรียนน้อย)`);
    }
    if (teach) warn.push(`${n} มีสอน ${gradeLabel(own)} ${own.subject} คาบนี้ตามตาราง`);
    if (rank.records.some((r) => r.st === 'confirmed' && r.a === n && r.d === date && r.p === p && r.lt !== SWAP && !except.includes(r.i))
      || rank.requests.some((x) => x.t === n && x.from <= date && date <= x.to && (!x.periods?.length || x.periods.includes(p)))
      || rank.leaves.some((x) => x.t === n && x.from <= date && date <= x.to)) warn.push(`${n} ลา/ไม่อยู่ในวัน/คาบนี้`);
    return { hard, warn, dualWith };
  };
  const ask = (warn) => confirmBox(`โปรดตรวจสอบ: ${warn.join(' · ')} — บันทึกต่อหรือไม่?`, 'บันทึกต่อ');

  const hasAck = list.length > 0 && 'ack_at' in list[0];   // ฐานข้อมูลรอบ 5 ติดตั้งแล้ว
  el.innerHTML = `<div class="wl-g">${hero('บันทึกการสอนแทน', 'บันทึกด้วยมือและรายการที่บันทึกแล้ว')}
    <section class="g-card"><div class="g-card-h"><h3 id="m-title">บันทึกด้วยมือ</h3></div><form id="m-form" class="g-form">
      <input type="hidden" name="id">
      <label>วันที่<input type="date" name="sub_date" value="${todayISO()}" required></label>
      <label>คาบ<select name="period">${opts(per)}</select></label>
      <label>ครูที่ลา<select name="absent_teacher" required><option value="">— เลือก —</option>${opts(teachers)}</select></label>
      <label>ประเภทการลา<select name="leave_type">${opts([...types, SWAP], 'ไม่ระบุ')}</select></label>
      <label>ชั้น<input name="grade" list="m-grades"></label>
      <label>วิชา<input name="subject"></label>
      <label>ครูสอนแทน<select name="substitute_teacher"><option value="">ไม่ต้องสอนแทน</option>${opts(teachers)}</select></label>
      <label>หมายเหตุ<input name="note" maxlength="200"></label>
      <datalist id="m-grades">${opts(tt.data.grades)}</datalist>
      <div class="g-actions"><button type="button" class="g-btn g-btn-line" id="m-clear">ล้างฟอร์ม</button>
        <button class="g-btn" type="submit">บันทึก</button></div>
    </form></section>
    <section class="g-card"><div class="g-card-h"><h3>แลกคาบ</h3></div><form id="w-form" class="g-form">
      <label>ครูคนที่ 1<select name="a" required><option value="">— เลือก —</option>${opts(teachers)}</select></label>
      <label>วันที่ (คาบของครูคนที่ 1)<input type="date" name="da" value="${todayISO()}" required></label>
      <label>คาบ<select name="pa">${opts(per)}</select></label>
      <label>ครูคนที่ 2<select name="b" required><option value="">— เลือก —</option>${opts(teachers)}</select></label>
      <label>วันที่ (คาบของครูคนที่ 2)<input type="date" name="db" value="${todayISO()}" required></label>
      <label>คาบ<select name="pb">${opts(per)}</select></label>
      <p class="g-sub span-all" id="w-info">${WINFO}</p>
      <div class="g-actions"><button class="g-btn" type="submit">บันทึกการแลกคาบ</button></div>
    </form></section>
    <section class="g-card"><div class="g-card-h"><h3>รายการเดือน</h3>
      <input class="g-input" type="month" id="m-month" value="${month}" aria-label="เดือน"></div>
      ${list.length ? `<div class="g-scroll"><table class="g-tbl"><thead><tr>${admin ? '<th><input class="g-chk" type="checkbox" id="m-all" aria-label="เลือกทั้งหมด"></th>' : ''}<th>วันที่</th><th>คาบ</th><th>ครูที่ลา</th><th>ประเภท</th><th>ชั้น</th><th>วิชา</th><th>ครูสอนแทน</th>${hasAck ? '<th>รับทราบ</th>' : ''}<th>ที่มา</th><th></th></tr></thead><tbody>
        ${list.map((r) => `<tr>${admin ? `<td><input class="g-chk m-pick" type="checkbox" value="${r.id}" aria-label="เลือกรายการ"></td>` : ''}<td>${esc(thDay(r.sub_date))} ${esc(thDate(r.sub_date))}</td><td class="c">${r.period}</td>
          <td>${esc(r.absent_teacher)}</td><td>${esc(r.leave_type)}</td><td>${esc(r.grade)}</td><td>${esc(r.subject)}</td>
          <td>${r.substitute_teacher ? esc(r.substitute_teacher) : '<span class="g-sub">ไม่ต้องสอนแทน</span>'}</td>
          ${hasAck ? `<td>${r.substitute_teacher ? (r.ack_at ? pill('approved', 'รับทราบแล้ว') : pill('pending', 'รอรับทราบ')) : ''}</td>` : ''}
          <td class="g-sub">${SRC[r.source] || ''}</td>
          <td class="nowrap"><button class="g-btn g-btn-line g-btn-sm" type="button" data-edit="${r.id}">แก้ไข</button>
            ${admin ? `<button class="g-btn g-btn-line g-btn-sm g-danger" type="button" data-del="${r.id}">ลบ</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div><div class="g-card-h g-foot"><span class="g-sub">รวม ${list.length} คาบ</span>
      </div>` : '<p class="g-empty">ยังไม่มีรายการในเดือนนี้</p>'}</section>
    ${admin && list.length ? bulkBar('mb', '<button class="g-btn g-btn-line g-danger" type="button" id="m-del-sel">ลบรายการที่เลือก</button>') : ''}</div>`;

  const f = $('#m-form', el);
  const set = (n, v) => { f.elements[n].value = v ?? ''; };
  // เลือกวัน/คาบ/ครู แล้วเติมชั้น-วิชาจากตารางสอนให้
  ['sub_date', 'period', 'absent_teacher'].forEach((n) => f.elements[n].addEventListener('change', () => {
    const d = dowIndex(f.elements.sub_date.value);
    const s = tt.data.slots.find((x) => x.d === d && x.p === +f.elements.period.value && x.teachers.includes(f.elements.absent_teacher.value));
    if (s) { set('grade', gradeLabel(s)); set('subject', s.subject); }
  }));
  $('#m-clear', el).addEventListener('click', () => { f.reset(); set('id', ''); $('#m-title', el).textContent = 'บันทึกด้วยมือ'; });
  $('#m-month', el).addEventListener('change', (e) => { sessionStorage.setItem('wlsub-month', e.target.value || todayISO().slice(0, 7)); render(el, ctx); });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f).entries());
    const row = { sub_date: v.sub_date, period: +v.period, absent_teacher: v.absent_teacher, leave_type: v.leave_type,
      grade: v.grade, subject: v.subject, substitute_teacher: v.substitute_teacher, note: v.note };
    if (row.substitute_teacher && row.substitute_teacher === row.absent_teacher) { toast('ครูสอนแทนต้องไม่ใช่ครูที่ลา', 'err'); return; }
    // ตรวจแบบเดียวกับตัวช่วยจัด: ติดสอน · ลา · สอนแทนซ้ำ
    const warn = [];
    if (!slotAt(row.absent_teacher, row.sub_date, row.period)) warn.push(`${row.absent_teacher} ไม่มีสอนคาบนี้ตามตารางสอน`);
    if (row.substitute_teacher) {
      const c = check(row.substitute_teacher, row.sub_date, row.period, v.id ? [v.id] : [], row.leave_type !== SWAP);
      if (c.hard.length) { toast(c.hard.join(' · '), 'err'); return; }
      warn.push(...c.warn);
      if (c.dualWith && !row.note.startsWith('คาบคู่')) row.note = `คาบคู่ (สอน ${c.dualWith} อยู่)${row.note ? ` · ${row.note}` : ''}`;
    }
    if (warn.length && !(await ask(warn))) return;
    try {
      if (v.id) await q(sb.from('sub_records').update(row).eq('id', v.id));
      else await q(sb.from('sub_records').insert({ ...row, academic_year: tt.academic_year, term: tt.term, status: 'confirmed', source: 'manual' }));
      toast('บันทึกแล้ว'); render(el, ctx);
    } catch (err) { toast(err.message, 'err'); }
  });
  // แลกคาบ: บันทึก 2 รายการ (ประเภท "แลกคาบ") ในคำสั่งเดียว
  const w = $('#w-form', el);
  const what = (s) => (s ? `${gradeLabel(s)} ${s.subject}` : '(ไม่มีคาบตามตาราง)');
  w.addEventListener('change', () => {
    const x = Object.fromEntries(new FormData(w).entries());
    $('#w-info', el).textContent = x.a && x.b
      ? `${x.b} ไปสอน ${what(slotAt(x.a, x.da, +x.pa))} แทน ${x.a} · ${x.a} ไปสอน ${what(slotAt(x.b, x.db, +x.pb))} แทน ${x.b}` : WINFO;
  });
  w.addEventListener('submit', async (e) => {
    e.preventDefault();
    const x = Object.fromEntries(new FormData(w).entries()); const pa = +x.pa; const pb = +x.pb;
    if (x.a === x.b) { toast('เลือกครู 2 คนที่ต่างกัน', 'err'); return; }
    const sa = slotAt(x.a, x.da, pa); const sb2 = slotAt(x.b, x.db, pb);
    if (!sa || !sb2) { toast(`${!sa ? x.a : x.b} ไม่มีสอนคาบที่เลือกตามตารางสอน`, 'err'); return; }
    const c1 = check(x.b, x.da, pa); const c2 = check(x.a, x.db, pb);
    const hard = [...c1.hard, ...c2.hard];
    if (hard.length) { toast(hard.join(' · '), 'err'); return; }
    const warn = [...c1.warn, ...c2.warn];
    if (warn.length && !(await ask(warn))) return;
    const base = { academic_year: tt.academic_year, term: tt.term, status: 'confirmed', source: 'manual', leave_type: SWAP };
    try {
      await q(sb.from('sub_records').insert([
        { ...base, sub_date: x.da, period: pa, absent_teacher: x.a, substitute_teacher: x.b, grade: gradeLabel(sa), subject: sa.subject,
          note: `แลกกับคาบ ${pb} ${thDate(x.db)} ของ ${x.b}` },
        { ...base, sub_date: x.db, period: pb, absent_teacher: x.b, substitute_teacher: x.a, grade: gradeLabel(sb2), subject: sb2.subject,
          note: `แลกกับคาบ ${pa} ${thDate(x.da)} ของ ${x.a}` },
      ]));
      toast('บันทึกการแลกคาบแล้ว'); render(el, ctx);
    } catch (err) { toast(err.message, 'err'); }
  });

  $$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => {
    const r = list.find((x) => x.id === b.dataset.edit);
    ['id', 'sub_date', 'period', 'absent_teacher', 'leave_type', 'grade', 'subject', 'substitute_teacher', 'note'].forEach((n) => set(n, r[n]));
    $('#m-title', el).textContent = 'แก้ไขรายการ';
    f.scrollIntoView({ behavior: 'smooth' });
  }));
  $$('[data-del]', el).forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmBox('ลบรายการนี้?')) ) return;
    try { await delRows(sb.from('sub_records').delete().eq('id', b.dataset.del), 1); toast('ลบแล้ว'); render(el, ctx); } catch (err) { toast(err.message, 'err'); }
  }));
  // ผู้ดูแลระบบ: เลือกหลายรายการแล้วลบ (รายการที่ลบไม่ถูกนับในสถิติอีก)
  const picks = () => $$('.m-pick:checked', el).map((c) => c.value);
  const sync = () => { const bar = $('#mb-bulk', el); if (bar) { const n = picks().length; bar.hidden = !n; $('#mb-n', el).textContent = n; } };
  $('#mb-clear', el)?.addEventListener('click', () => { $$('.m-pick, #m-all', el).forEach((c) => { c.checked = false; }); sync(); });
  $('#m-all', el)?.addEventListener('change', (e) => { $$('.m-pick', el).forEach((c) => { c.checked = e.target.checked; }); sync(); });
  $$('.m-pick', el).forEach((c) => c.addEventListener('change', sync));
  $('#m-del-sel', el)?.addEventListener('click', async () => {
    const ids = picks();
    if (!ids.length || !(await confirmBox(`ลบ ${ids.length} รายการที่เลือก?`))) return;
    try { await delRows(sb.from('sub_records').delete().in('id', ids), ids.length); toast(`ลบแล้ว ${ids.length} รายการ`); render(el, ctx); } catch (err) { toast(err.message, 'err'); }
  });
}
