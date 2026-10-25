// =====================================================================
//  แปลงไฟล์สำรอง JSON ของ WL Scheduler -> ตารางสอนของระบบสอนแทน
//  โครงที่ใช้: scenarios[].data.{teachers, rows, jointGroups, timetable.{days, periods, placements, mobility}}
//  placements: key = "R~<rowId>~n" (วิชาของชั้น) หรือ "G~<jointGroupId>~n" (เรียนรวม/กิจกรรมร่วม)
//              slot (เลขคู่) ÷ 2 = ลำดับช่อง -> วัน = ช่อง ÷ คาบต่อวัน, คาบ = เศษ + 1
// =====================================================================
const PSEUDO = /ลส\.|สำรอง|แนะแนวและสวดมนต์/;
const DEFAULT_DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

export function listScenarios(json) {
  if (!json || !Array.isArray(json.scenarios) || !json.scenarios.length) {
    throw new Error('ไม่ใช่ไฟล์สำรองของ WL Scheduler (ไม่พบ scenarios)');
  }
  return json.scenarios.map((s) => ({ id: s.id, name: s.name || s.id, active: s.id === json.activeScenarioId }));
}

export function convertScenario(json, scenarioId) {
  const sc = json.scenarios.find((s) => s.id === scenarioId);
  const D = sc?.data;
  if (!D?.timetable?.placements) throw new Error('แผนนี้ยังไม่มีตารางสอนที่จัดแล้ว');
  const T = D.timetable;
  const periods = Number(T.periods) || 6;
  const days = Array.isArray(T.days) && T.days.length ? T.days : DEFAULT_DAYS;
  const mob = T.mobility || {};
  const byId = Object.fromEntries((D.teachers || []).map((t) => [t.id, t]));
  const nameOf = (id) => byId[id]?.name || String(id);
  const rows = Object.fromEntries((D.rows || []).map((r) => [r.id, r]));
  const groups = Object.fromEntries((D.jointGroups || []).map((g) => [g.id, g]));

  const slots = [];
  const skipped = [];
  for (const [key, v] of Object.entries(T.placements)) {
    if (!v || typeof v.slot !== 'number') continue;
    const parts = key.split('~');
    const type = parts[0];
    const id = decodeURIComponent(parts.slice(1, -1).join('~'));
    const s = Math.floor(v.slot / 2);
    const d = Math.floor(s / periods);
    const p = (s % periods) + 1;
    if (d >= days.length) { skipped.push(id); continue; }
    let grades; let subject; let lead; let co;
    if (type === 'R') {
      const r = rows[id]; if (!r) { skipped.push(id); continue; }
      grades = [r.grade]; subject = r.subject; lead = r.teacher; co = r.coTeachers || [];
    } else if (type === 'G') {
      const g = groups[id]; if (!g) { skipped.push(id); continue; }
      grades = [...new Set((g.members || []).map((m) => rows[m]?.grade).filter(Boolean))];
      subject = id; lead = g.leader; co = [...(g.coTeachers || []), ...Object.keys(g.teacherHours || {})];
    } else continue;
    const teachers = [...new Set([lead, ...co].filter(Boolean))].map(nameOf);
    slots.push({ d, p, grades, subject, teachers, building: (mob.gradeBuildings || {})[grades[0]] || '' });
  }
  slots.sort((a, b) => a.d - b.d || a.p - b.p);

  const teachers = (D.teachers || []).map((t) => ({
    name: t.name,
    building: (mob.teacherBuildings || {})[t.id] || '',
    homeroom: t.profile?.homeroom?.[0] || '',
    pseudo: !!t.team || PSEUDO.test(t.name),
    active: (t.status || 'active') === 'active',
  }));

  // ตรวจครูสอนชนกัน (ถ้ามี แปลว่าการถอดรหัสช่องเวลาผิด)
  const seen = new Map(); const conflicts = [];
  for (const sl of slots) for (const t of sl.teachers) {
    const k = `${t}|${sl.d}|${sl.p}`;
    if (seen.has(k)) conflicts.push(`${t} ${days[sl.d]} คาบ ${sl.p}`); else seen.set(k, 1);
  }

  return {
    data: {
      scenario: sc.name || sc.id, days, periods,
      buildingOrder: mob.buildingOrder || [], gradeBuildings: mob.gradeBuildings || {},
      grades: D.grades || [], teachers, slots,
    },
    skipped, conflicts,
  };
}

// ---------------------------------------------------------------------
// ตัวช่วยอ่านตารางสอน (data = sub_timetables.data)
// ---------------------------------------------------------------------
export const slotsOf = (data, teacher, d) => data.slots.filter((s) => s.d === d && s.teachers.includes(teacher));
export const realTeachers = (data) => data.teachers.filter((t) => !t.pseudo && t.active).map((t) => t.name);
export const gradeLabel = (s) => s.grades.join(', ');
