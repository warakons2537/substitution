// =====================================================================
//  ตัวช่วยจัดครูสอนแทน (ใช้ร่วมกัน: ฝ่ายวิชาการจัดเอง / ผู้ขอลาเสนอ / พิจารณาคำขอ)
//  ลำดับการแนะนำ: ว่างจริง -> ตึกเดียวกับชั้นเรียน (แล้วตึกใกล้) -> สอนแทนน้อยในสัปดาห์นี้ (จ.-อา.)
//                 -> สอนแทนน้อยวันนี้ -> คาบสอนวันนี้น้อย -> สอนแทนน้อยในเดือน -> สะสมน้อย
//  ตึกของครู ณ คาบนั้น: ตึกของคาบที่สอนใกล้ที่สุดในวันนั้น -> ตึกประจำ (ตั้งใน WL Scheduler) -> ตึกของชั้นที่เป็นครูประจำชั้น
// =====================================================================
import { esc, dowIndex, weekStart, addDays, thDate, thDay } from './util.js';
import { slotsOf, realTeachers, gradeLabel } from './timetable.js';
import { rankData, settingsCached, holidaySet } from './db.js';

export const NONE = '__none';

// คาบคู่: ห้องที่นักเรียนน้อย ครูที่มีสอน/สอนแทนคาบนั้นอยู่แล้ว 1 ห้องรับสอนแทนอีกห้องพร้อมกันได้ (รวมไม่เกิน 2 ห้อง) · กติกาตั้งได้ที่เมนู "กติกาคาบคู่" (sub_settings.dual_*)
export const DUAL_DEFAULT = { grades: ['ป1', 'ป2', 'ป3', 'ป4', 'ม2', 'ม3'], bothSmall: true, maxDist: null, maxDay: 2 };
/** กติกาคาบคู่จากตั้งค่า (ยังไม่รัน SQL รอบ 10 = ค่าตั้งต้น) */
export const dualRules = (set = {}) => ({
  grades: 'dual_grades' in set ? String(set.dual_grades || '').split(/[,\s]+/).map(normGrade).filter(Boolean) : DUAL_DEFAULT.grades,
  bothSmall: 'dual_both_small' in set ? set.dual_both_small !== false : DUAL_DEFAULT.bothSmall,
  maxDist: 'dual_max_dist' in set ? (set.dual_max_dist ?? null) : DUAL_DEFAULT.maxDist,
  maxDay: 'dual_max_day' in set ? (set.dual_max_day ?? null) : DUAL_DEFAULT.maxDay,
});
const normGrade = (g) => String(g).replace(/[\s.]/g, '');
/** ทุกชั้นในคาบเป็นห้องนักเรียนน้อย (ป.2/1 ตรงกับ ป2 · ป.12 ไม่ตรงกับ ป1) */
export const isSmallClass = (grades, list = DUAL_DEFAULT.grades) => !!grades?.length && grades.every((g) => {
  const x = normGrade(g);
  return list.some((k) => x.startsWith(k) && !/[0-9]/.test(x[k.length] || ''));
});
export const SWAP = 'แลกคาบ';   // ประเภทรายการ "แลกคาบ" ไม่นับเป็นการลา/สอนแทนในสถิติความเป็นธรรม
// คำมาตรฐานสำหรับช่องหมายเหตุ (งานที่มอบให้ผู้สอนแทน)
export const NOTE_PRESETS = ['ทำใบงาน', 'ทำแบบฝึกหัด', 'สอนตามแผนการจัดการเรียนรู้', 'ทบทวนบทเรียน',
  'อ่านหนังสือ/ค้นคว้า', 'ทำงานที่ได้รับมอบหมาย', 'ทดสอบย่อย', 'ดูแลความเรียบร้อย'];

/** คาบที่ครู absent ต้องมีคนสอนแทน ในช่วงวันที่ dates (periods ว่าง = ทุกคาบ) · ข้ามเสาร์-อาทิตย์และวันหยุด (holidays: Map/Set ของวันที่) */
export function buildItems(data, absent, dates, periods = [], holidays = null) {
  const items = [];
  for (const date of dates) {
    const d = dowIndex(date); if (d < 0 || holidays?.has(date)) continue;
    for (const s of slotsOf(data, absent, d)) {
      if (periods.length && !periods.includes(s.p)) continue;
      items.push({ date, d, p: s.p, grade: gradeLabel(s), subject: s.subject, building: s.building,
        co: s.teachers.filter((t) => t !== absent), grades: s.grades, sel: '', note: '' });
    }
  }
  return items;
}

/** ข้อมูลที่ตัวช่วยจัดต้องใช้: { rank, dual, holidays } */
export async function loadPlanCtx() {
  const [rank, set, holidays] = await Promise.all([rankData(), settingsCached(), holidaySet().catch(() => new Map())]);
  return { rank, dual: dualRules(set), holidays };
}

/** วันหยุดในช่วง dates ที่ buildItems ข้ามไป: [[วันที่, ชื่อวันหยุด]] */
export const skippedHolidays = (dates, holidays) => dates.filter((d) => dowIndex(d) >= 0 && holidays?.has(d))
  .map((d) => [d, holidays.get?.(d) || 'วันหยุด']);

export function makeRanker(data, rank, absent, excludeRequest, dual = DUAL_DEFAULT) {
  const recs = rank.records.filter((r) => !excludeRequest || r.r !== excludeRequest);
  const swappedOut = (n, date, p) => recs.some((r) => r.lt === SWAP && r.st === 'confirmed' && r.a === n && r.d === date && r.p === p);
  const reqs = rank.requests.filter((r) => r.id !== excludeRequest);
  const order = data.buildingOrder || [];
  const info = Object.fromEntries(data.teachers.map((t) => [t.name, t]));
  const pool = realTeachers(data).filter((n) => n !== absent);

  // ลา/ไม่อยู่: คำขอลา · รายการสอนแทนที่ครูคนนี้เป็นผู้ลา · ทะเบียนการลา (รวมที่งานบุคคล/ครูบันทึกเองโดยไม่มีคำขอ)
  //   ลาครึ่งวันในทะเบียน: ถือว่าไม่อยู่ทั้งวัน (ระบบไม่รู้ว่าคาบไหนเป็นเช้า/บ่าย) — ผู้จัดบันทึกด้วยมือได้ถ้าจำเป็น
  const leaves = rank.leaves || [];
  const onLeave = (n, date, p) => {
    if (n === absent) return 'ลา/ไม่อยู่';
    if (recs.some((r) => r.a === n && r.d === date && r.p === p && r.lt !== SWAP)
      || reqs.some((q) => q.t === n && q.from <= date && date <= q.to && (!q.periods?.length || q.periods.includes(p)))) return 'ลา/ไม่อยู่';
    const l = leaves.find((x) => x.t === n && x.from <= date && date <= x.to);
    return l ? (l.h ? `ลาครึ่งวัน${l.h === 'am' ? 'เช้า' : 'บ่าย'}` : 'ลา/ไม่อยู่') : '';
  };

  // ห้องของคาบที่ครู a ลา (หาจากตารางสอน เพราะข้อมูลจัดอันดับไม่มีชั้นเรียน)
  const roomOf = (a, d, p) => {
    const s = slotsOf(data, a, d).find((x) => x.p === p);
    return s ? { grades: s.grades, building: s.building, label: `${gradeLabel(s)}${s.subject ? ' ' + s.subject : ''}` } : { grades: [], building: '', label: '' };
  };

  const where = (n, d, p) => {
    const ss = slotsOf(data, n, d).sort((a, b) => Math.abs(a.p - p) - Math.abs(b.p - p) || a.p - b.p);
    if (ss.length && ss[0].building) return ss[0].building;
    const t = info[n];
    return t?.building || (t?.homeroom && data.gradeBuildings[t.homeroom]) || '';
  };

  return (item, items) => {
    const mine = items.filter((x) => x !== item && x.sel && x.sel !== NONE)
      .map((x) => ({ n: x.sel, d: x.date, p: x.p, du: !!x.dual, a: absent, room: { grades: x.grades, building: x.building, label: `${x.grade}${x.subject ? ' ' + x.subject : ''}` } }));
    const done = recs.filter((r) => r.s && r.st === 'confirmed').map((r) => ({ n: r.s, d: r.d, p: r.p, du: !!r.du, sw: r.lt === SWAP, a: r.a })).concat(mine);
    const proposed = new Set(recs.filter((r) => r.s && r.st === 'proposed' && r.d === item.date && r.p === item.p).map((r) => r.s));
    const ws = weekStart(item.date); const we = addDays(ws, 6); const mon = item.date.slice(0, 7);
    const bi = order.indexOf(item.building);
    const small = isSmallClass(item.grades, dual.grades);

    return pool.map((n) => {
      const reasons = [];
      const b = where(n, item.d, item.p); const ti = order.indexOf(b);
      const dist = bi < 0 || ti < 0 ? 9 : Math.abs(bi - ti);
      // ห้องที่ครูคนนี้ต้องอยู่คาบนี้แล้ว: คาบสอนของตัวเอง (ยกเว้นแลกคาบออกไป) + ห้องที่รับสอนแทน/แลกคาบมาแล้ว
      //   ว่าง = แนะนำปกติ · 1 ห้อง = รับห้องนี้พร้อมกันได้ถ้าเป็นห้องนักเรียนน้อยตามกติกา (คาบคู่) · 2 ห้อง = เต็ม
      const own = done.filter((x) => x.n === n);
      const subs = own.filter((x) => x.d === item.date && x.p === item.p);
      const rooms = (swappedOut(n, item.date, item.p) ? [] : slotsOf(data, n, item.d).filter((s) => s.p === item.p)
        .map((s) => ({ grades: s.grades, building: s.building, label: `${gradeLabel(s)}${s.subject ? ' ' + s.subject : ''}` })))
        .concat(subs.map((x) => {
          const r = x.room || roomOf(x.a, item.d, item.p);
          return { ...r, sub: true, sw: x.sw, label: `${r.label || '?'} (${x.sw ? 'แลกคาบ' : 'สอนแทน'}${x.a ? ' ' + x.a : ''})` };
        }));
      const teaching = rooms.map((r) => r.label).join(', ');
      let isDual = false;
      if (rooms.length >= 2) reasons.push(`สอนคาบนี้ครบ 2 ห้องแล้ว (${teaching})`);
      else if (rooms.length === 1) {
        const r = rooms[0]; const ri = order.indexOf(r.building);
        const rd = r.sub ? (bi < 0 || ri < 0 ? 9 : Math.abs(bi - ri)) : dist;
        const why = !small ? '' : r.sw ? 'แลกคาบมาสอนคาบนี้แล้ว'
          : (r.sub || dual.bothSmall) && !isSmallClass(r.grades, dual.grades) ? 'ห้องที่สอนอยู่ไม่ใช่ห้องเล็ก'
          : dual.maxDist != null && rd > dual.maxDist ? 'อยู่คนละตึก'
          : dual.maxDay != null && own.filter((x) => x.d === item.date && x.du).length >= dual.maxDay ? `รับคาบคู่ครบ ${dual.maxDay} คาบแล้ววันนี้` : 'ok';
        if (why === 'ok') isDual = true;
        else reasons.push(`${r.sub ? 'สอนแทนคาบนี้แล้ว' : 'มีสอนคาบนี้'} (${teaching})${why ? ' · ' + why : ''}`);
      }
      const away = onLeave(n, item.date, item.p);
      if (away) reasons.push(away);
      const fair = own.filter((x) => !x.sw);   // แลกคาบไม่นับในความเป็นธรรม
      const week = fair.filter((x) => x.d >= ws && x.d <= we).length;
      const day = fair.filter((x) => x.d === item.date).length;
      const month = fair.filter((x) => x.d.slice(0, 7) === mon).length;
      return { n, ok: !reasons.length, reasons, dual: isDual && !reasons.length ? 1 : 0, teaching, soft: proposed.has(n) ? 1 : 0, dist, b, week, day,
        load: slotsOf(data, n, item.d).length + day, month, total: fair.length };
    }).sort((a, b) => (b.ok - a.ok) || (a.dual - b.dual) || (a.soft - b.soft) || (a.dist - b.dist) || (a.week - b.week) || (a.day - b.day)
      || (a.load - b.load) || (a.month - b.month) || (a.total - b.total) || a.n.localeCompare(b.n, 'th'));
  };
}

const label = (c) => `${c.n} · ${c.dist === 0 ? 'ตึกเดียวกัน' : (c.b || 'ไม่ทราบตึก')} · สัปดาห์นี้ ${c.week} ครั้ง · วันนี้ ${c.load} คาบ${c.dual ? ` · คาบคู่ (คาบนี้สอน ${c.teaching || '-'} อยู่)` : ''}${c.soft ? ' · มีคำขออื่นเสนอไว้' : ''}`;

/**
 * แสดงตารางคาบที่ต้องสอนแทนพร้อมตัวเลือกครู
 * opts: { data, rank, absent, items, excludeRequest, autoFill, allowEmpty, dual (กติกาคาบคู่), skipped (วันหยุดที่ข้าม) }
 * คืน { items } (ค่า sel: ชื่อครู | NONE = ไม่ต้องสอนแทน | '' = ยังไม่เลือก)
 */
export function mountPlanner(el, { data, rank, absent, items, excludeRequest = null, autoFill = true, allowEmpty = false, dual = DUAL_DEFAULT, skipped = [] }) {
  const rankOf = makeRanker(data, rank, absent, excludeRequest, dual);
  // ค่าเริ่มต้น: คาบที่ยังมีครูร่วม = ไม่ต้องสอนแทน, คาบอื่นเลือกคนอันดับ 1 ทีละคาบ
  for (const it of items) {
    if (it.sel) continue;
    if (it.co.length) { it.sel = NONE; continue; }
    if (autoFill) { const best = rankOf(it, items).find((c) => c.ok && !c.dual); if (best) it.sel = best.n; }   // คาบคู่ให้ผู้จัดเลือกเอง
  }

  const draw = () => {
    const hol = skipped.length ? `<p class="g-note">ข้ามวันหยุด ${skipped.length} วัน: ${skipped.map(([d, n]) => `${esc(thDay(d))} ${esc(thDate(d))} (${esc(n)})`).join(', ')}</p>` : '';
    if (!items.length) { el.innerHTML = `${hol}<p class="g-empty">ไม่มีคาบสอนในวัน/คาบที่เลือก (ตามตารางสอนที่ใช้อยู่)</p>`; return; }
    el.innerHTML = `${hol}<div class="g-scroll"><table class="g-tbl planner">
      <thead><tr><th>วันที่</th><th>คาบ</th><th>ชั้น</th><th>วิชา</th><th>ครูสอนแทน</th><th>หมายเหตุ</th></tr></thead><tbody>
      ${items.map((it, i) => {
        const list = rankOf(it, items);
        const cur = list.find((c) => c.n === it.sel);
        it.dual = !!(cur && cur.dual);
        it.teaching = it.dual ? cur.teaching : '';
        const warn = cur && !cur.ok ? `<div class="warn small">⚠ ${esc(cur.reasons.join(', '))}</div>`
          : it.dual ? `<div class="g-note small">ⓘ ${esc(cur.n)} คาบนี้สอน ${esc(cur.teaching)} อยู่แล้ว · รับสอนแทนพร้อมกันได้ (รวม 2 ห้อง) (นักเรียน ${esc(it.grade)} มีจำนวนน้อย)</div>` : '';
        const coNote = it.co.length ? `<div class="muted small">ครูร่วม: ${esc(it.co.join(', '))}</div>` : '';
        return `<tr><td>${esc(thDay(it.date))} ${esc(thDate(it.date))}</td><td class="c">${it.p}</td>
          <td>${esc(it.grade)}</td><td>${esc(it.subject)}${coNote}</td>
          <td><select data-i="${i}" class="sel-sub">
            <option value="">${allowEmpty ? '— ให้ฝ่ายวิชาการจัด —' : '— เลือกครูสอนแทน —'}</option>
            <option value="${NONE}"${it.sel === NONE ? ' selected' : ''}>ไม่ต้องสอนแทน</option>
            <optgroup label="แนะนำ (เรียงตามลำดับ)">
              ${list.filter((c) => c.ok && !c.dual).map((c) => `<option value="${esc(c.n)}"${c.n === it.sel ? ' selected' : ''}>${esc(label(c))}</option>`).join('')}
            </optgroup>
            ${list.some((c) => c.ok && c.dual) ? `<optgroup label="คาบคู่ — มีสอน/สอนแทนคาบนี้อยู่ 1 ห้อง รับเพิ่มได้ (ห้องนักเรียนน้อย)">
              ${list.filter((c) => c.ok && c.dual).map((c) => `<option value="${esc(c.n)}"${c.n === it.sel ? ' selected' : ''}>${esc(label(c))}</option>`).join('')}
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
