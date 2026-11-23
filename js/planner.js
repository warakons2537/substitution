// =====================================================================
//  ตัวช่วยจัดครูสอนแทน (ใช้ร่วมกัน: ฝ่ายวิชาการจัดเอง / ผู้ขอลาเสนอ / พิจารณาคำขอ)
//  ลำดับการแนะนำ: ว่างจริง -> ตึกเดียวกับชั้นเรียน (แล้วตึกใกล้) -> สอนแทนน้อยในสัปดาห์นี้ (จ.-อา.)
//                 -> สอนแทนน้อยวันนี้ -> คาบสอนวันนี้น้อย -> สอนแทนน้อยในเดือน -> สะสมน้อย
//  ตึกของครู ณ คาบนั้น: ตึกของคาบที่สอนใกล้ที่สุดในวันนั้น -> ตึกประจำ (ตั้งใน WL Scheduler) -> ตึกของชั้นที่เป็นครูประจำชั้น
// =====================================================================
import { esc, dowIndex, weekStart, addDays, thDate, thDay } from './util.js';
import { slotsOf, realTeachers, gradeLabel } from './timetable.js';

export const NONE = '__none';

// คาบคู่: ห้องที่นักเรียนน้อย (ป.1–ป.4, ม.2, ม.3) ครูที่มีสอนคาบนั้นอยู่แล้วรับสอนแทนพร้อมกันได้
const SMALL_CLASS = /^(ป[1-4]|ม[23])(?![0-9])/;
export const isSmallClass = (grades) => !!grades?.length && grades.every((g) => SMALL_CLASS.test(String(g).replace(/[\s.]/g, '')));
// คำมาตรฐานสำหรับช่องหมายเหตุ (งานที่มอบให้ผู้สอนแทน)
export const NOTE_PRESETS = ['ทำใบงาน', 'ทำแบบฝึกหัด', 'สอนตามแผนการจัดการเรียนรู้', 'ทบทวนบทเรียน',
  'อ่านหนังสือ/ค้นคว้า', 'ทำงานที่ได้รับมอบหมาย', 'ทดสอบย่อย', 'ดูแลความเรียบร้อย'];

/** คาบที่ครู absent ต้องมีคนสอนแทน ในช่วงวันที่ dates (periods ว่าง = ทุกคาบ) */
export function buildItems(data, absent, dates, periods = []) {
  const items = [];
  for (const date of dates) {
    const d = dowIndex(date); if (d < 0) continue;
    for (const s of slotsOf(data, absent, d)) {
      if (periods.length && !periods.includes(s.p)) continue;
      items.push({ date, d, p: s.p, grade: gradeLabel(s), subject: s.subject, building: s.building,
        co: s.teachers.filter((t) => t !== absent), grades: s.grades, sel: '', note: '' });
    }
  }
  return items;
}

function makeRanker(data, rank, absent, excludeRequest) {
  const recs = rank.records.filter((r) => !excludeRequest || r.r !== excludeRequest);
  const reqs = rank.requests.filter((r) => r.id !== excludeRequest);
  const order = data.buildingOrder || [];
  const info = Object.fromEntries(data.teachers.map((t) => [t.name, t]));
  const pool = realTeachers(data).filter((n) => n !== absent);

  const onLeave = (n, date, p) => n === absent
    || recs.some((r) => r.a === n && r.d === date && r.p === p)
    || reqs.some((q) => q.t === n && q.from <= date && date <= q.to && (!q.periods?.length || q.periods.includes(p)));

  const where = (n, d, p) => {
    const ss = slotsOf(data, n, d).sort((a, b) => Math.abs(a.p - p) - Math.abs(b.p - p) || a.p - b.p);
    if (ss.length && ss[0].building) return ss[0].building;
    const t = info[n];
    return t?.building || (t?.homeroom && data.gradeBuildings[t.homeroom]) || '';
  };

  return (item, items) => {
    const mine = items.filter((x) => x !== item && x.sel && x.sel !== NONE).map((x) => ({ n: x.sel, d: x.date, p: x.p }));
    const done = recs.filter((r) => r.s && r.st === 'confirmed').map((r) => ({ n: r.s, d: r.d, p: r.p })).concat(mine);
    const proposed = new Set(recs.filter((r) => r.s && r.st === 'proposed' && r.d === item.date && r.p === item.p).map((r) => r.s));
    const ws = weekStart(item.date); const we = addDays(ws, 6); const mon = item.date.slice(0, 7);
    const bi = order.indexOf(item.building);
    const small = isSmallClass(item.grades);

    return pool.map((n) => {
      const reasons = [];
      // มีสอนคาบนี้อยู่: ห้องเล็กรับสอนแทนพร้อมกันได้ (คาบคู่) · ห้องอื่นถือว่าไม่ว่าง
      const now = slotsOf(data, n, item.d).filter((s) => s.p === item.p);
      const busy = now.length > 0;
      const dual = busy && small;
      const teaching = now.map((s) => `${gradeLabel(s)}${s.subject ? ' ' + s.subject : ''}`).join(', ');
      if (busy && !small) reasons.push(`มีสอนคาบนี้ (${teaching})`);
      if (onLeave(n, item.date, item.p)) reasons.push('ลา/ไม่อยู่');
      if (done.some((x) => x.n === n && x.d === item.date && x.p === item.p)) reasons.push('สอนแทนคาบนี้แล้ว');
      const own = done.filter((x) => x.n === n);
      const week = own.filter((x) => x.d >= ws && x.d <= we).length;
      const day = own.filter((x) => x.d === item.date).length;
      const month = own.filter((x) => x.d.slice(0, 7) === mon).length;
      const b = where(n, item.d, item.p); const ti = order.indexOf(b);
      const dist = bi < 0 || ti < 0 ? 9 : Math.abs(bi - ti);
      return { n, ok: !reasons.length, reasons, dual: dual ? 1 : 0, teaching, soft: proposed.has(n) ? 1 : 0, dist, b, week, day,
        load: slotsOf(data, n, item.d).length + day, month, total: own.length };
    }).sort((a, b) => (b.ok - a.ok) || (a.dual - b.dual) || (a.soft - b.soft) || (a.dist - b.dist) || (a.week - b.week) || (a.day - b.day)
      || (a.load - b.load) || (a.month - b.month) || (a.total - b.total) || a.n.localeCompare(b.n, 'th'));
  };
}

const label = (c) => `${c.n} · ${c.dist === 0 ? 'ตึกเดียวกัน' : (c.b || 'ไม่ทราบตึก')} · สัปดาห์นี้ ${c.week} ครั้ง · วันนี้ ${c.load} คาบ${c.dual ? ` · คาบคู่ (คาบนี้สอน ${c.teaching || '-'} อยู่)` : ''}${c.soft ? ' · มีคำขออื่นเสนอไว้' : ''}`;

/**
 * แสดงตารางคาบที่ต้องสอนแทนพร้อมตัวเลือกครู
 * opts: { data, rank, absent, items, excludeRequest, autoFill, allowEmpty }
 * คืน { items } (ค่า sel: ชื่อครู | NONE = ไม่ต้องสอนแทน | '' = ยังไม่เลือก)
 */
export function mountPlanner(el, { data, rank, absent, items, excludeRequest = null, autoFill = true, allowEmpty = false }) {
  const rankOf = makeRanker(data, rank, absent, excludeRequest);
  // ค่าเริ่มต้น: คาบที่ยังมีครูร่วม = ไม่ต้องสอนแทน, คาบอื่นเลือกคนอันดับ 1 ทีละคาบ
  for (const it of items) {
    if (it.sel) continue;
    if (it.co.length) { it.sel = NONE; continue; }
    if (autoFill) { const best = rankOf(it, items).find((c) => c.ok && !c.dual); if (best) it.sel = best.n; }   // คาบคู่ให้ผู้จัดเลือกเอง
  }

  const draw = () => {
    if (!items.length) { el.innerHTML = '<p class="g-empty">ไม่มีคาบสอนในวัน/คาบที่เลือก (ตามตารางสอนที่ใช้อยู่)</p>'; return; }
    el.innerHTML = `<div class="g-scroll"><table class="g-tbl planner">
      <thead><tr><th>วันที่</th><th>คาบ</th><th>ชั้น</th><th>วิชา</th><th>ครูสอนแทน</th><th>หมายเหตุ</th></tr></thead><tbody>
      ${items.map((it, i) => {
        const list = rankOf(it, items);
        const cur = list.find((c) => c.n === it.sel);
        it.dual = !!(cur && cur.dual);
        it.teaching = it.dual ? cur.teaching : '';
        const warn = cur && !cur.ok ? `<div class="warn small">⚠ ${esc(cur.reasons.join(', '))}</div>`
          : it.dual ? `<div class="g-note small">ⓘ ${esc(cur.n)} คาบนี้สอน ${esc(cur.teaching)} อยู่แล้ว · รับสอนแทนพร้อมกันได้ (นักเรียน ${esc(it.grade)} มีจำนวนน้อย)</div>` : '';
        const coNote = it.co.length ? `<div class="muted small">ครูร่วม: ${esc(it.co.join(', '))}</div>` : '';
        return `<tr><td>${esc(thDay(it.date))} ${esc(thDate(it.date))}</td><td class="c">${it.p}</td>
          <td>${esc(it.grade)}</td><td>${esc(it.subject)}${coNote}</td>
          <td><select data-i="${i}" class="sel-sub">
            <option value="">${allowEmpty ? '— ให้ฝ่ายวิชาการจัด —' : '— เลือกครูสอนแทน —'}</option>
            <option value="${NONE}"${it.sel === NONE ? ' selected' : ''}>ไม่ต้องสอนแทน</option>
            <optgroup label="แนะนำ (เรียงตามลำดับ)">
              ${list.filter((c) => c.ok && !c.dual).map((c) => `<option value="${esc(c.n)}"${c.n === it.sel ? ' selected' : ''}>${esc(label(c))}</option>`).join('')}
            </optgroup>
            ${list.some((c) => c.dual) ? `<optgroup label="คาบคู่ — มีสอนคาบนี้อยู่ แต่รับสอนแทนได้ (ห้องนักเรียนน้อย)">
              ${list.filter((c) => c.dual).map((c) => `<option value="${esc(c.n)}"${c.n === it.sel ? ' selected' : ''}>${esc(label(c))}</option>`).join('')}
            </optgroup>` : ''}
            <optgroup label="ไม่ว่าง">
              ${list.filter((c) => !c.ok).map((c) => `<option value="${esc(c.n)}" ${c.n === it.sel ? 'selected' : 'disabled'}>${esc(c.n)} · ${esc(c.reasons.join(', '))}</option>`).join('')}
            </optgroup></select>${warn}</td>
          <td><input class="note-in" data-i="${i}" list="note-presets" value="${esc(it.note || '')}" placeholder="เช่น ทำใบงาน" maxlength="100"></td></tr>`;
      }).join('')}</tbody></table></div>
      <datalist id="note-presets">${NOTE_PRESETS.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`;
    el.querySelectorAll('.note-in').forEach((x) => x.addEventListener('input', () => { items[+x.dataset.i].note = x.value.trim(); }));
    el.querySelectorAll('.sel-sub').forEach((s) => s.addEventListener('change', () => { items[+s.dataset.i].sel = s.value; draw(); }));
  };
  draw();
  return { items, valid: () => items.every((it) => it.sel) };
}

/** ตัดส่วน "คาบคู่ (สอน … อยู่)" ที่ระบบเติมไว้ออกจากหมายเหตุ เหลือเฉพาะที่ผู้จัดพิมพ์เอง */
export const stripDual = (note = '') => note.replace(/^คาบคู่(\s*\(สอน .*? อยู่\))?( · )?/, '');

/** หมายเหตุที่จะบันทึก */
export const noteOf = (it) => {
  if (it.dual && it.sel !== NONE) {
    const head = `คาบคู่${it.teaching ? ` (สอน ${it.teaching} อยู่)` : ''}`;
    const rest = stripDual(it.note);
    return rest ? `${head} · ${rest}` : head;
  }
  return it.note || (it.sel === NONE ? 'ไม่ต้องสอนแทน' : '');
};
