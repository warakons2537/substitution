// =====================================================================
//  แบบพิมพ์ A4: ใบลาป่วย/ลากิจส่วนตัว/ลาคลอดบุตร + บันทึกการสอนแทน (วันละ 1 แผ่น)
//  ตามแบบเอกสารของโรงเรียน · ฟอนต์ TH SarabunPSK 16pt (ฝังในโฟลเดอร์ fonts/)
// =====================================================================
import { esc, toast, parseISO, dateRange, dowIndex } from './util.js';
import { BRAND } from './config.js';
import { sb, q, settings, activeTimetable } from './db.js';

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const dmy = (s) => { const d = parseISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`; };
const fullDay = (s, sp = '') => `วัน${DAYS[parseISO(s).getDay()]}${sp}ที่ ${dmy(s)}`;
const fiscalYear = (s) => { const d = parseISO(s); return d.getFullYear() + 543 + (d.getMonth() >= 9 ? 1 : 0); };

// ประเภทที่มีใบลา: ลาคลอดนับวันปฏิทิน · ป่วย/กิจนับวันทำการ (จ.-ศ. ยังไม่หักวันหยุดนักขัตฤกษ์)
const LEAVE = {
  'ลาป่วย': { key: 'sick', label: 'ป่วย', subject: 'ขอลาป่วย' },
  'ลากิจ': { key: 'personal', label: 'กิจส่วนตัว', subject: 'ขอลากิจ' },
  'ลาคลอด': { key: 'maternity', label: 'คลอดบุตร', subject: 'ขอลาคลอดบุตร' },
};
const dayCount = (r) => {
  if (r.days != null) return Number(r.days);   // จากทะเบียนการลา (หักวันหยุดแล้ว)
  const all = dateRange(r.date_from, r.date_to);
  return r.leave_type === 'ลาคลอด' ? all.length : all.filter((d) => dowIndex(d) >= 0).length;
};
const box = (on) => `<span class="pbox">${on ? '✓' : ''}</span>`;
const dots = (n = 30) => '.'.repeat(n);

function leavePage(req, me, s, history) {
  const L = LEAVE[req.leave_type];
  const cur = history.find((h) => h.request_id === req.id);
  const reqD = cur ? { ...req, days: cur.days } : req;   // จำนวนวันจากทะเบียน (หักวันหยุดแล้ว)
  const school = BRAND.school;
  const fy = fiscalYear(req.date_from);
  const prev = history.filter((h) => h.request_id !== req.id && LEAVE[h.leave_type] && ['pending', 'approved'].includes(h.status)
    && h.date_from < req.date_from);
  const inFy = prev.filter((h) => fiscalYear(h.date_from) === fy);
  const last = prev.sort((a, b) => (a.date_from < b.date_from ? 1 : -1))[0];
  const cell = (list) => (list.length ? `${list.length}(${list.reduce((n, h) => n + dayCount(h), 0)})` : '-');
  const rows = Object.entries(LEAVE).map(([type, t]) => {
    const before = inFy.filter((h) => h.leave_type === type);
    const now = type === req.leave_type ? [reqD] : [];
    return { t, before, now, all: before.concat(now) };
  });
  const total = rows.flatMap((r) => r.all);
  const n = dayCount(reqD);
  const lk = last && LEAVE[last.leave_type].key;
  return `<section class="a4 plv">
    <h1 class="pc">แบบใบลาป่วย ลากิจส่วนตัว ลาคลอดบุตร</h1>
    <p class="pr">เขียนที่ โรงเรียน${esc(school)}</p>
    <p class="pr">วันที่ ${esc(dmy(String(req.created_at || '').slice(0, 10) || req.date_from))}</p>
    <p><b>เรื่อง</b> ${esc(L.subject)}</p>
    <p><b>เรียน</b> ผู้อำนวยการโรงเรียน${esc(school)}</p>
    <p class="pi">ข้าพเจ้า ${esc(me.full_name)} ตำแหน่ง ${esc(me.position)} โรงเรียน${esc(school)}
      สังกัด โรงเรียน${esc(school)} ${s.district ? `อำเภอ${esc(s.district)}` : ''} ${esc(s.area_office || '')}</p>
    <table class="pchoose"><tr><td rowspan="3" class="pwho">ขอลา</td><td>${box(L.key === 'sick')} ป่วย</td>
      <td rowspan="3" class="preason">เนื่องจาก ${esc(req.reason || dots())}</td></tr>
      <tr><td>${box(L.key === 'personal')} กิจส่วนตัว</td></tr><tr><td>${box(L.key === 'maternity')} ลาคลอด</td></tr></table>
    <p class="pi">ตั้งแต่ ${esc(fullDay(req.date_from))} ถึง${esc(fullDay(req.date_to))} มีกำหนด ${n} วัน</p>
    <p class="pi">ข้าพเจ้าได้ลา ${box(lk === 'sick')} ป่วย ${box(lk === 'personal')} กิจส่วนตัว ${box(lk === 'maternity')} คลอดบุตร
      ครั้งสุดท้ายตั้งแต่วันที่ ${last ? esc(dmy(last.date_from)) : dots(25)} ถึงวันที่ ${last ? esc(dmy(last.date_to)) : dots(25)}
      มีกำหนด ${last ? dayCount(last) : dots(8)} วัน</p>
    <p class="pi">ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ ${esc(req.contact || (me.phone ? `หมายเลขโทรศัพท์ ${me.phone}` : `หมายเลขโทรศัพท์ ${dots()}`))}</p>
    <div class="pcols plv-row"><div class="pframe">
        <div>กรณีเป็นเวรประจำวันในวันที่ลา</div><div>แลกเปลี่ยนเวรกับ${dots(40)}</div><div>ครูเวรประจำวัน${dots(42)}</div>
        <div class="pc pgap-s">ลงชื่อ${dots(30)}(ผู้รับแลกเปลี่ยนเวร)</div><div class="pc">(${dots(45)})</div>
      </div><div class="pc">
        <div>ขอแสดงความนับถือ</div><div class="pgap"></div>
        <div>ลงชื่อ${dots(45)}</div><div>(${esc(me.full_name)})</div><div>ตำแหน่ง ${esc(me.position_short || me.position)}</div>
      </div></div>
    <div class="pcols plv-row"><div class="pframe">
        <div><b>เอกสารแนบประกอบการลา</b> (สำหรับผู้ตรวจสอบ)</div>
        <div>${box(false)} บันทึกการสอนแทน</div><div>${box(false)} เอกสารประกอบเหตุผลในการลา</div>
        <div class="pind">${box(false)} ใบรับรองแพทย์</div><div class="pind">${box(false)} ใบนัดจากแพทย์</div>
        <div class="pind">${box(false)} อื่นๆ ระบุ${dots(30)}</div>
      </div><div class="pc">
        <div><b><u>ความเห็นของหัวหน้าฝ่ายบริหารงานบุคคล</u></b></div><div>${dots(60)}</div><div class="pgap"></div>
        <div>ลงชื่อ${dots(40)}(ผู้ตรวจสอบ)</div><div>(${esc(s.personnel_name || dots(35))})</div>
        <div>ตำแหน่ง ${esc(s.personnel_position || '')}</div><div>วันที่ ${dots(6)} เดือน ${dots(16)} พ.ศ. ${dots(8)}</div>
      </div></div>
    <div class="pcols plv-row"><div>
      <p class="pc"><b>สถิติการลาในปีงบประมาณ ${fy}</b></p>
      <table class="pgrid"><tr><th>ประเภทลา</th><th>ลามาแล้ว</th><th>ลาครั้งนี้</th><th>รวมเป็น</th></tr>
        ${rows.map((r) => `<tr><td>${r.t.label}</td><td>${cell(r.before)}</td><td>${cell(r.now)}</td><td>${cell(r.all)}</td></tr>`).join('')}
        <tr><td colspan="3" class="pc">รวม</td><td>${cell(total)}</td></tr></table>
    </div><div class="pc">
      <div><b><u>ความเห็นของผู้บังคับบัญชา</u></b></div>
      <div class="pl">${box(false)} อนุญาต</div><div class="pl">${box(false)} ไม่อนุญาต เนื่องจาก${dots(30)}</div><div class="pgap"></div>
      <div>ลงชื่อ${dots(45)}</div><div>(${esc(s.director_name || dots(35))})</div><div>ตำแหน่ง ${esc(s.director_position || '')}</div>
      <div>วันที่ ${dots(6)} เดือน ${dots(16)} พ.ศ. ${dots(8)}</div>
    </div></div>
    <table class="pnote"><tr><td><b>หมายเหตุ</b></td><td>1. ลากิจและลาป่วยแบบมีใบนัดให้ลาล่วงหน้าก่อน 3 วันทำการ</td></tr>
      <tr><td></td><td>2. จัดเตรียมเอกสารประกอบการลาให้แล้วเสร็จครบถ้วนก่อนส่งใบลามาที่งานบุคคล</td></tr></table>
  </section>`;
}

function subPage(date, recs, req, me, s, periods) {
  const short = (n) => String(n || '').split(/\s+/)[0];
  const t = req.leave_type;
  return `<section class="a4">
    <div class="pc"><img src="img/school-logo.png" class="plogo" alt=""></div>
    <h1 class="pc">บันทึกการสอนแทน</h1><p class="pc">โรงเรียน${esc(BRAND.school)}</p>
    <p class="pc">${esc(fullDay(date, ' '))}</p>
    <p class="pc">ชื่อ ${esc(me.full_name)} ครูประจำวิชา ${dots(20)}</p>
    <p class="ptypes"><span>(${t === 'ลาป่วย' ? '…✓…' : dots(8)}) ลาป่วย</span><span>(${t === 'ลากิจ' ? '…✓…' : dots(8)}) ลากิจ</span>
      <span>(${t === 'ไปราชการ' ? '…✓…' : dots(8)}) ไปราชการ ที่ ${t === 'ไปราชการ' && req.reason ? esc(req.reason) : dots(30)}</span></p>
    <table class="pgrid ptt"><tr><th>ชั่วโมงที่</th><th>วิชา</th><th>ชั้น</th><th>ผู้สอนแทน</th><th>รับทราบ</th><th>หมายเหตุ</th></tr>
      ${periods.map((p) => { const r = recs.find((x) => x.period === p);
        return `<tr><td class="pc">${p}</td><td>${esc(r?.subject || '')}</td><td class="pc">${esc(r?.grade || '')}</td>
          <td>${r ? esc(r.substitute_teacher ? short(r.substitute_teacher) : '-') : ''}</td><td></td><td>${esc(r?.note || '')}</td></tr>`; }).join('')}</table>
    <div class="pcols psigns"><div><div>ลงชื่อ${dots(40)}</div><div>(${esc(me.full_name)})</div><div>${esc(me.position_short || me.position || '')}</div></div>
      <div><div>ลงชื่อ${dots(40)}</div><div>(${esc(s.academic_name || dots(35))})</div><div>${esc(s.academic_position || '')}</div></div></div>
    <div class="psign2 pc"><div>ลงชื่อ${dots(40)}</div><div>(${esc(s.director_name || dots(35))})</div><div>${esc(s.director_position || '')}</div></div>
  </section>`;
}

/** พิมพ์ใบลา (ถ้าเป็นลาป่วย/ลากิจ/ลาคลอด) + บันทึกการสอนแทนทุกวันของคำขอ */
export async function printRequest(req, me) {
  if (!me.full_name) { toast('กรุณากรอก "ข้อมูลของฉัน" ก่อนพิมพ์', 'err'); location.hash = '#profile'; return; }
  try {
    const [s, recs, history, tt] = await Promise.all([
      settings(),
      q(sb.from('sub_records').select('*').eq('request_id', req.id).order('sub_date').order('period')),
      q(sb.from('sub_leaves').select('*').eq('teacher_name', req.teacher_name)),
      activeTimetable(),
    ]);
    const lv = history.find((h) => h.request_id === req.id);
    req = { ...req, reason: lv?.reason || '', contact: lv?.contact || '' };   // เหตุผล/ที่ติดต่ออยู่ในทะเบียนการลา
    const nP = tt?.data?.periods || Math.max(6, ...recs.map((r) => r.period));
    const periods = Array.from({ length: nP }, (_, i) => i + 1);
    const dates = [...new Set(recs.map((r) => r.sub_date))];
    let html = LEAVE[req.leave_type] ? leavePage(req, me, s, history) : '';
    html += dates.map((d) => subPage(d, recs.filter((r) => r.sub_date === d), req, me, s, periods)).join('');
    if (!html) { toast('ไม่มีข้อมูลสำหรับพิมพ์', 'err'); return; }
    await printHtml(html);
  } catch (e) { toast(e.message, 'err'); }
}

/** วาง HTML ลง #print-root รอฟอนต์/รูป แล้วสั่งพิมพ์ */
export async function printHtml(html) {
  let root = document.getElementById('print-root');
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  root.innerHTML = html;
  await Promise.race([
    Promise.all([document.fonts.load("16pt 'WL TH SarabunPSK'"), document.fonts.load("bold 16pt 'WL TH SarabunPSK'"),
      ...[...root.querySelectorAll('img')].map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = r; i.onerror = r; })))]),
    new Promise((r) => setTimeout(r, 6000)),
  ]);
  window.print();
}

/** ฝ่ายวิชาการพิมพ์บันทึกการสอนแทนแทนครู: groups = [{ date, recs, leave_type, teacher: {full_name, position_short} }] */
export async function printSubNotes(groups) {
  try {
    const [s, tt] = await Promise.all([settings(), activeTimetable()]);
    const nP = tt?.data?.periods || Math.max(6, ...groups.flatMap((g) => g.recs.map((r) => r.period)));
    const periods = Array.from({ length: nP }, (_, i) => i + 1);
    await printHtml(groups.map((g) => subPage(g.date, g.recs, { leave_type: g.leave_type }, g.teacher, s, periods)).join(''));
  } catch (e) { toast(e.message, 'err'); }
}

/** งานบุคคลพิมพ์ใบลาแทนครู จากรายการในทะเบียนการลา (ป่วย/กิจ/คลอด) — prof = { full_name, position } ของครูที่ลา */
export async function printLeaveForm(leave, prof, history) {
  if (!LEAVE[leave.leave_type]) { toast('ประเภทนี้ไม่มีแบบใบลา (พิมพ์ได้เฉพาะลาป่วย/ลากิจ/ลาคลอด)', 'err'); return; }
  try {
    const s = await settings();
    const req = { ...leave, id: leave.id };
    const hist = history.map((h) => ({ ...h, request_id: h.id }));   // ใช้ id ของรายการลาแทน request_id
    const me = { full_name: prof.full_name || leave.teacher_name, position: prof.position || prof.position_short || '', position_short: prof.position_short || '', phone: '' };
    await printHtml(leavePage(req, me, s, hist));
  } catch (e) { toast(e.message, 'err'); }
}

/** งานบุคคลพิมพ์สรุปการลารายครู: rows = [{ type, count, used, quota, off }], list = รายการลาในปีงบประมาณ */
export async function printLeaveSummary(teacher, prof, fy, rows, list) {
  try {
    const s = await settings();
    const fmt = (n) => (Number.isInteger(+n) ? String(+n) : (+n).toFixed(1));
    const st = { pending: 'รออนุญาต', approved: 'บันทึกแล้ว', rejected: 'ไม่อนุญาต' };
    await printHtml(`<section class="a4"><div class="pc"><img src="img/school-logo.png" class="plogo" alt=""></div>
      <h1 class="pc">สรุปการลา ปีงบประมาณ ${fy}</h1><p class="pc">โรงเรียน${esc(BRAND.school)}</p>
      <p class="pc">ชื่อ ${esc(prof.full_name || teacher)} ${esc(prof.position_short || '')}</p>
      <table class="pgrid"><tr><th>ประเภทการลา</th><th>ครั้ง</th><th>วันที่ลา</th><th>โควตา</th><th>คงเหลือ</th></tr>
        ${rows.map((r) => `<tr><td>${esc(r.type)}${r.off ? ' (ไม่นับเป็นวันลา)' : ''}</td><td class="pc">${r.count}</td><td class="pc">${fmt(r.used)}</td>
          <td class="pc">${r.quota == null ? 'ไม่จำกัด' : fmt(r.quota)}</td><td class="pc">${r.quota == null ? '-' : fmt(r.quota - r.used)}</td></tr>`).join('')}</table>
      <p style="margin-top:8pt"><b>รายการลา</b></p>
      <table class="pgrid"><tr><th>วันที่</th><th>ประเภท</th><th>วัน</th><th>เหตุผล</th><th>สถานะ</th></tr>
        ${list.map((l) => `<tr><td>${l.date_from === l.date_to ? esc(dmy(l.date_from)) : `${esc(dmy(l.date_from))} – ${esc(dmy(l.date_to))}`}</td><td>${esc(l.leave_type)}</td>
          <td class="pc">${fmt(l.days)}</td><td>${esc(l.reason || '')}</td><td>${esc(st[l.status] || l.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="pc">ไม่มีรายการ</td></tr>'}</table>
      <div class="psign2"><div>ลงชื่อ${dots(40)}</div><div>(${esc(s.personnel_name || dots(35))})</div><div>${esc(s.personnel_position || '')}</div></div></section>`);
  } catch (e) { toast(e.message, 'err'); }
}
