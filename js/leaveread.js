// =====================================================================
//  อ่านใบลาจากไฟล์ .docx / .pdf (เฉพาะไฟล์ที่มีข้อความ — PDF สแกนอ่านไม่ได้)
//  แล้วดึง: ชื่อครู ประเภทการลา วันที่ลา เหตุผล ที่ติดต่อ
// =====================================================================
const MAMMOTH = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build';

const loadScript = (src) => new Promise((ok, bad) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok;
  s.onerror = () => bad(new Error('โหลดตัวอ่านไฟล์ไม่ได้ ตรวจสอบอินเทอร์เน็ต')); document.head.appendChild(s);
});

/** อ่านข้อความทั้งหมดจากไฟล์ */
export async function readLeaveText(file) {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith('.docx')) {
    if (!window.mammoth) await loadScript(MAMMOTH);
    return (await window.mammoth.extractRawText({ arrayBuffer: buf })).value;
  }
  if (name.endsWith('.pdf')) {
    const pdfjs = await import(`${PDFJS}/pdf.min.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
    const doc = await pdfjs.getDocument({ data: buf, cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/', cMapPacked: true }).promise;
    let text = '';
    for (let i = 1; i <= Math.min(doc.numPages, 5); i += 1) {
      const c = await (await doc.getPage(i)).getTextContent();
      text += `${c.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('')}\n`;
    }
    return text;
  }
  if (name.endsWith('.doc')) throw new Error('ไฟล์ .doc แบบเก่าอ่านไม่ได้ กรุณาบันทึกเป็น .docx หรือ PDF');
  throw new Error('รองรับเฉพาะไฟล์ .docx และ .pdf');
}

// ---------------------------------------------------------------------
// แยกข้อมูลจากข้อความ
// ---------------------------------------------------------------------
const TH_DIGIT = (s) => s.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0E50));
const MONTHS = [
  ['มกราคม', 'ม.ค.'], ['กุมภาพันธ์', 'ก.พ.'], ['มีนาคม', 'มี.ค.'], ['เมษายน', 'เม.ย.'], ['พฤษภาคม', 'พ.ค.'], ['มิถุนายน', 'มิ.ย.'],
  ['กรกฎาคม', 'ก.ค.'], ['สิงหาคม', 'ส.ค.'], ['กันยายน', 'ก.ย.'], ['ตุลาคม', 'ต.ค.'], ['พฤศจิกายน', 'พ.ย.'], ['ธันวาคม', 'ธ.ค.'],
];
const MON_RE = MONTHS.flat().sort((a, b) => b.length - a.length).map((m) => m.replace(/\./g, '\\.\\s*')).join('|');
const monthOf = (m) => MONTHS.findIndex((x) => x.some((y) => y.replace(/\s/g, '') === m.replace(/\s/g, '')));
const DATE_RE = new RegExp(`(\\d{1,2})(?:\\s*[-–]\\s*(\\d{1,2}))?\\s*(?:เดือน)?\\s*(${MON_RE})\\s*(?:พ\\.\\s*ศ\\.|ค\\.\\s*ศ\\.)?\\s*(\\d{4}|\\d{2})?`, 'g');
const pad = (n) => String(n).padStart(2, '0');
const toYear = (y, fallback) => {
  if (!y) return fallback;
  let n = Number(y);
  if (y.length === 2) n += 2500;
  return n > 2400 ? n - 543 : n;
};

function datesIn(s, fallbackYear) {
  const out = []; let year = fallbackYear;
  for (const m of s.matchAll(DATE_RE)) {
    const mon = monthOf(m[3]); if (mon < 0) continue;
    year = toYear(m[4], year);
    out.push(`${year}-${pad(mon + 1)}-${pad(m[1])}`);
    if (m[2]) out.push(`${year}-${pad(mon + 1)}-${pad(m[2])}`);
  }
  return out;
}

// ตัดคำนำหน้าแล้วเทียบชื่อ-สกุล
const PREFIX = /^(ว่าที่\s*ร(?:้อย)?\.?\s*ต(?:รี)?\.?(?:หญิง)?|นางสาว|นาง|นาย|น\.ส\.|ครู|ดร\.)\s*/;
const norm = (n) => { let s = String(n || '').trim(); let p; do { p = s; s = s.replace(PREFIX, ''); } while (s !== p); return s.replace(/\s+/g, ''); };

export function matchTeacher(name, teachers) {
  const n = norm(name); if (!n) return '';
  const exact = teachers.find((t) => norm(t) === n);
  if (exact) return exact;
  // ชื่อต้นตรงกัน (เผื่อสกุลในตารางสอนเขียนต่างกัน) — ต้องตรงคนเดียว
  const first = String(name).trim().replace(PREFIX, '').split(/\s+/)[0];
  const hits = teachers.filter((t) => norm(t).startsWith(norm(first)));
  return hits.length === 1 ? hits[0] : '';
}

const grab = (s, re) => { const m = s.match(re); return m ? m[1].replace(/\s+/g, ' ').replace(/[.\s…]+$/, '').trim() : ''; };

/**
 * แยกข้อมูลใบลา · teachers = ชื่อครูในตารางสอน
 * คืน { name, teacher, leave_type, from, to, reason, contact, found: [ชื่อช่องที่อ่านได้] }
 */
export function parseLeave(raw, teachers = []) {
  const s = TH_DIGIT(raw).replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
  const flat = s.replace(/\s*\n\s*/g, ' ');
  const r = { name: '', teacher: '', leave_type: '', from: '', to: '', reason: '', contact: '' };

  // ประเภทการลา: ดูจาก "เรื่อง" ก่อน แล้วค่อยดูทั้งเอกสาร
  const subject = grab(s, /เรื่อง\s*([^\n]{0,60}?)\s*(?:เรียน|ข้าพเจ้า|\n|$)/);
  const typeOf = (t) => (/ไปราชการ|อบรม|ประชุม|สัมมนา/.test(t) ? 'ไปราชการ' : /คลอด/.test(t) ? 'ลาคลอด'
    : /ป่วย/.test(t) ? 'ลาป่วย' : /ลากิจ|กิจส่วนตัว/.test(t) ? 'ลากิจ' : '');
  r.leave_type = typeOf(subject) || (/ขออนุญาตไปราชการ/.test(flat) ? 'ไปราชการ' : '')
    || typeOf(grab(flat, /(ขอลา\s*(?:ป่วย|กิจ|คลอด))/));

  r.name = grab(flat, /ข้าพเจ้า\s*(.{2,60}?)\s*ตำแหน่ง/);
  r.teacher = matchTeacher(r.name, teachers);

  r.reason = grab(flat, /เนื่องจาก\s*(.{1,200}?)\s*(?:ตั้งแต่|ในวันที่|ระหว่างวันที่|มีกำหนด|$)/);
  r.contact = grab(flat, /ติดต่อ(?:ข้าพเจ้า)?ได้ที่\s*(.{1,150}?)\s*(?:ขอแสดงความนับถือ|ลงชื่อ|จึงเรียนมา|$)/);

  // วันที่ลา: ช่วงหลัง "ตั้งแต่/ระหว่างวันที่/ในวันที่" ถึง "มีกำหนด"
  const created = datesIn(flat.slice(0, 200), new Date().getFullYear())[0];
  const fy = created ? Number(created.slice(0, 4)) : new Date().getFullYear();
  const seg = flat.match(/(?:ตั้งแต่|ระหว่างวันที่|ในวันที่)(.{0,220}?)(?:มีกำหนด|ข้าพเจ้าได้ลา|ในระหว่างลา|จึงเรียน|$)/);
  const ds = seg ? datesIn(seg[1], fy) : [];
  if (ds.length) { [r.from] = ds; r.to = ds[ds.length - 1] < r.from ? r.from : ds[ds.length - 1]; }

  r.found = [r.teacher && 'ชื่อครู', r.leave_type && 'ประเภทการลา', r.from && 'วันที่', r.reason && 'เหตุผล', r.contact && 'ที่ติดต่อ'].filter(Boolean);
  return r;
}
