// =====================================================================
//  รายงาน: สรุปสถิติ + Excel 5 แผ่นงาน + รายงานสรุป A4 + Word (.doc)
// =====================================================================
import { esc, thDate, thDay, parseISO } from './util.js';
import { BRAND, LEAVE_TYPES, LEAVE_STATUS } from './config.js';
import { dmy, MONTHS, printHtml } from './print.js';

const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
const SRC = { assist: 'ช่วยจัด', manual: 'บันทึกเอง', request: 'คำขอ' };
const byTh = (a, b) => a.localeCompare(b, 'th');

/** สรุปจากรายการสอนแทน (status = confirmed) · teachers = ครูทุกคนในตารางสอน (ให้คนที่ยังไม่ได้สอนแทนขึ้น 0) */
export function stats(recs, teachers = []) {
  const subs = new Map(teachers.map((t) => [t, { name: t, n: 0, dates: new Set() }]));
  const abs = new Map(); const subj = new Map(); const daily = new Map();
  for (const r of recs) {
    const has = !!r.substitute_teacher;
    if (has) {
      if (!subs.has(r.substitute_teacher)) subs.set(r.substitute_teacher, { name: r.substitute_teacher, n: 0, dates: new Set() });
      const s = subs.get(r.substitute_teacher); s.n += 1; s.dates.add(r.sub_date);
    }
    if (!abs.has(r.absent_teacher)) abs.set(r.absent_teacher, { name: r.absent_teacher, types: {}, dates: new Set(), covered: 0, none: 0 });
    const a = abs.get(r.absent_teacher);
    (a.types[r.leave_type] ||= new Set()).add(r.sub_date); a.dates.add(r.sub_date); a[has ? 'covered' : 'none'] += 1;
    const k = `${r.subject}|${r.grade}`;
    if (!subj.has(k)) subj.set(k, { subject: r.subject, grade: r.grade, covered: 0, none: 0 });
    subj.get(k)[has ? 'covered' : 'none'] += 1;
    if (!daily.has(r.sub_date)) daily.set(r.sub_date, { date: r.sub_date, absent: new Set(), covered: 0, none: 0 });
    const d = daily.get(r.sub_date); d.absent.add(r.absent_teacher); d[has ? 'covered' : 'none'] += 1;
  }
  return {
    recs,
    subs: [...subs.values()].sort((a, b) => b.n - a.n || byTh(a.name, b.name)),
    absents: [...abs.values()].sort((a, b) => b.dates.size - a.dates.size || byTh(a.name, b.name)),
    subjects: [...subj.values()].sort((a, b) => b.covered + b.none - a.covered - a.none || byTh(a.subject, b.subject)),
    daily: [...daily.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    covered: recs.filter((r) => r.substitute_teacher).length,
    none: recs.filter((r) => !r.substitute_teacher).length,
    absentDays: [...abs.values()].reduce((n, a) => n + a.dates.size, 0),
    // ประเภทการลาที่พบจริงในช่วงนี้ (ไม่แสดงคอลัมน์ว่างทั้งแถว)
    types: [...new Set([...LEAVE_TYPES.filter((t) => [...abs.values()].some((a) => a.types[t])), ...[...abs.values()].flatMap((a) => Object.keys(a.types))])],
  };
}

/** ข้อความช่วงวันที่: ทั้งเดือน -> "ประจำเดือน ตุลาคม พ.ศ. 2569" */
export function rangeText(from, to) {
  const f = parseISO(from); const t = parseISO(to);
  const last = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
  if (f.getDate() === 1 && t.getFullYear() === f.getFullYear() && t.getMonth() === f.getMonth() && t.getDate() === last) {
    return `ประจำเดือน ${MONTHS[f.getMonth()]} พ.ศ. ${f.getFullYear() + 543}`;
  }
  return from === to ? `วันที่ ${dmy(from)}` : `ระหว่างวันที่ ${dmy(from)} ถึงวันที่ ${dmy(to)}`;
}
const fileTag = (from, to) => (from.slice(0, 7) === to.slice(0, 7) && from.endsWith('-01') ? from.slice(0, 7) : `${from}_${to}`);

// ---------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------
export async function downloadExcel(st, from, to, tt, leaves = []) {
  const X = await import(XLSX_URL);
  const head = (title) => [[`${title} · โรงเรียน${BRAND.school}`], [`${rangeText(from, to)}${tt ? ` · ปีการศึกษา ${tt.academic_year} ภาคเรียนที่ ${tt.term}` : ''}`], []];
  const sheet = (title, header, rows, widths) => {
    const ws = X.utils.aoa_to_sheet([...head(title), header, ...rows]);
    ws['!cols'] = widths.map((w) => ({ wch: w }));
    ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + rows.length, c: header.length - 1 } }) };
    return ws;
  };
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, sheet('บันทึกข้อมูลการสอนแทน',
    ['วันที่', 'วัน', 'คาบ', 'ครูที่ลา', 'ประเภทการลา', 'ชั้น', 'วิชา', 'ครูสอนแทน', 'ที่มา', 'หมายเหตุ'],
    st.recs.map((r) => [thDate(r.sub_date), thDay(r.sub_date), r.period, r.absent_teacher, r.leave_type, r.grade, r.subject,
      r.substitute_teacher || 'ไม่ต้องสอนแทน', SRC[r.source] || '', r.note]),
    [12, 6, 6, 22, 12, 10, 24, 22, 10, 30]), 'บันทึกข้อมูล');
  X.utils.book_append_sheet(wb, sheet('สรุปผู้สอนแทน', ['ที่', 'ครูสอนแทน', 'จำนวนคาบ', 'จำนวนวัน'],
    st.subs.map((s, i) => [i + 1, s.name, s.n, s.dates.size]), [6, 26, 12, 12]), 'สรุปผู้สอนแทน');
  X.utils.book_append_sheet(wb, sheet('สรุปคนลา',
    ['ที่', 'ครูที่ลา', ...st.types.map((t) => `${t} (วัน)`), 'รวม (วัน)', 'คาบที่มีผู้สอนแทน', 'คาบที่ไม่ต้องสอนแทน'],
    st.absents.map((a, i) => [i + 1, a.name, ...st.types.map((t) => a.types[t]?.size || 0), a.dates.size, a.covered, a.none]),
    [6, 26, ...st.types.map(() => 12), 10, 16, 18]), 'สรุปคนลา');
  X.utils.book_append_sheet(wb, sheet('สรุปวิชา', ['ที่', 'วิชา', 'ชั้น', 'คาบที่มีผู้สอนแทน', 'คาบที่ไม่ต้องสอนแทน', 'รวม'],
    st.subjects.map((s, i) => [i + 1, s.subject, s.grade, s.covered, s.none, s.covered + s.none]), [6, 30, 12, 16, 18, 8]), 'สรุปวิชา');
  X.utils.book_append_sheet(wb, sheet('สรุปรายวัน',
    ['วันที่', 'วัน', 'จำนวนครูที่ลา', 'ครูที่ลา', 'คาบที่มีผู้สอนแทน', 'คาบที่ไม่ต้องสอนแทน'],
    st.daily.map((d) => [thDate(d.date), thDay(d.date), d.absent.size, [...d.absent].sort(byTh).join(', '), d.covered, d.none]),
    [12, 6, 14, 50, 16, 18]), 'สรุปรายวัน');
  if (leaves.length) {
    X.utils.book_append_sheet(wb, sheet('ทะเบียนการลาของครู',
      ['ตั้งแต่วันที่', 'ถึงวันที่', 'ครู', 'ประเภทการลา', 'ช่วงเวลา', 'จำนวนวัน', 'เหตุผล', 'ใบรับรองแพทย์', 'สถานะ', 'หมายเหตุ'],
      leaves.map((l) => [thDate(l.date_from), thDate(l.date_to), l.teacher_name, l.leave_type, l.half === 'am' ? 'ครึ่งวันเช้า' : l.half === 'pm' ? 'ครึ่งวันบ่าย' : 'เต็มวัน',
        Number(l.days), l.reason, l.has_cert ? 'มี' : '', LEAVE_STATUS[l.status] || l.status, l.note]),
      [14, 14, 24, 26, 12, 10, 30, 12, 12, 30]), 'ทะเบียนการลา');
  }
  X.writeFile(wb, `รายงานสอนแทน_${fileTag(from, to)}.xlsx`);
}

// ---------------------------------------------------------------------
// รายงานสรุป A4 (พิมพ์) / Word
// ---------------------------------------------------------------------
function body(st, from, to, tt, s, logoSrc) {
  const half = Math.ceil(st.subs.length / 2);
  const subTable = (list, start) => `<table class="pgrid prep"><tr><th>ที่</th><th>ชื่อ</th><th>คาบ</th><th>วัน</th></tr>
    ${list.map((x, i) => `<tr><td class="pc">${start + i + 1}</td><td>${esc(x.name)}</td><td class="pc">${x.n}</td><td class="pc">${x.dates.size}</td></tr>`).join('')}</table>`;
  return `<div class="pc"><img src="${logoSrc}" class="plogo" alt="" width="90"></div>
    <h1 class="pc">รายงานสรุปการสอนแทน</h1>
    <p class="pc">โรงเรียน${esc(BRAND.school)}</p>
    <p class="pc">${esc(rangeText(from, to))}${tt ? ` · ปีการศึกษา ${tt.academic_year} ภาคเรียนที่ ${tt.term}` : ''}</p>
    <p class="pi">ในช่วงเวลาดังกล่าว มีครูลาหรือไปราชการ ${st.absents.length} คน รวม ${st.absentDays} วัน
      มีคาบสอนที่ต้องดูแล ${st.recs.length} คาบ จัดครูสอนแทนแล้ว ${st.covered} คาบ และไม่ต้องสอนแทน ${st.none} คาบ</p>
    <p><b>1. สรุปการลา</b></p>
    <table class="pgrid prep"><tr><th>ที่</th><th>ชื่อ</th>${st.types.map((t) => `<th>${esc(t)}</th>`).join('')}<th>รวม (วัน)</th><th>คาบที่มีผู้สอนแทน</th></tr>
      ${st.absents.length ? st.absents.map((a, i) => `<tr><td class="pc">${i + 1}</td><td>${esc(a.name)}</td>
        ${st.types.map((t) => `<td class="pc">${a.types[t]?.size || '-'}</td>`).join('')}<td class="pc">${a.dates.size}</td><td class="pc">${a.covered}</td></tr>`).join('')
        : `<tr><td colspan="${st.types.length + 4}" class="pc">ไม่มีการลา</td></tr>`}</table>
    <p style="margin-top:8pt"><b>2. สรุปการสอนแทน</b> (จำนวนคาบ / จำนวนวันที่สอนแทน)</p>
    <table class="pwrap"><tr><td>${subTable(st.subs.slice(0, half), 0)}</td><td>${subTable(st.subs.slice(half), half)}</td></tr></table>
    <table class="pwrap psigns"><tr>
      <td><div>ลงชื่อ${'.'.repeat(40)}ผู้รายงาน</div><div>(${esc(s.academic_name || '.'.repeat(35))})</div><div>${esc(s.academic_position || '')}</div></td>
      <td><div>ทราบ</div><div>ลงชื่อ${'.'.repeat(40)}</div><div>(${esc(s.director_name || '.'.repeat(35))})</div><div>${esc(s.director_position || '')}</div></td>
    </tr></table>`;
}

export function printReport(st, from, to, tt, s) {
  return printHtml(`<section class="a4">${body(st, from, to, tt, s, 'img/school-logo.png')}</section>`);
}

export function downloadWord(st, from, to, tt, s) {
  const logo = new URL('img/school-logo.png', location.href).href;
  const css = `@page Section1 { size: 21cm 29.7cm; margin: 1.5cm 2cm 1.2cm 2.5cm; } div.Section1 { page: Section1; }
    body { font-family: 'TH SarabunPSK'; font-size: 16pt; } h1 { font-size: 18pt; margin: 0; } p { margin: 0 0 2pt; }
    .pc { text-align: center; } .pi { text-indent: 2.5em; }
    .pgrid { width: 100%; border-collapse: collapse; } .pgrid th, .pgrid td { border: 1px solid #000; padding: 1pt 4pt; font-size: 14pt; }
    .pwrap { width: 100%; border-collapse: collapse; } .pwrap > tbody > tr > td, .pwrap > tr > td { vertical-align: top; width: 50%; padding: 0 4pt; }
    .psigns td { text-align: center; padding-top: 22pt; }`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>รายงานสรุปการสอนแทน</title><style>${css}</style></head>
    <body><div class="Section1">${body(st, from, to, tt, s, logo)}</div></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
  a.download = `รายงานสรุปการสอนแทน_${fileTag(from, to)}.doc`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
