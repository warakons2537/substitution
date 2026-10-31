import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL.trim(), SUPABASE_KEY.trim());

const TH = [
  [/Invalid login credentials/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
  [/Email not confirmed/i, 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล'],
  [/sub_records_no_double/i, 'มีครูถูกจัดสอนแทน 2 ห้องในคาบเดียวกัน กรุณาเลือกใหม่'],
  [/sub_users_user_id_fkey/i, 'บัญชีนี้ยังไม่ได้สมัคร/เข้าสู่ระบบ จึงยังกำหนดสิทธิ์ไม่ได้ ให้เจ้าของสมัครหรือเข้าสู่ระบบก่อน'],
  [/row-level security|permission denied/i, 'ไม่มีสิทธิ์ทำรายการนี้'],
  [/Failed to fetch|NetworkError/i, 'เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจสอบอินเทอร์เน็ต'],
  [/sub_(rank_data|role|list_users)|relation "public\.sub_/i, 'ฐานข้อมูลยังไม่มีตารางของระบบสอนแทน ให้รัน supabase/schema.sql ก่อน'],
];
/** รอผลคำสั่ง Supabase แล้วคืน data หรือโยนข้อความภาษาไทย */
export async function q(p) {
  const { data, error } = await p;
  if (error) {
    const m = error.message || String(error);
    const hit = TH.find(([r]) => r.test(m));
    throw new Error(hit ? hit[1] : m);
  }
  return data;
}

export const auth = {
  async user() { const { data } = await sb.auth.getSession(); return data.session?.user || null; },
  signIn: (email, password) => q(sb.auth.signInWithPassword({ email, password })),
  signUp: (email, password, full_name) => q(sb.auth.signUp({ email, password, options: { data: { full_name } } })),
  signOut: () => sb.auth.signOut(),
};

export async function loadMe(user) {
  const [role, duties] = await Promise.all([q(sb.rpc('sub_role')), q(sb.rpc('sub_duties')).catch(() => null)]);
  const row = (await q(sb.from('sub_users').select('teacher_name,full_name,position,position_short,phone').eq('user_id', user.id)))[0] || {};
  return { id: user.id, email: user.email, role,
    duties: Array.isArray(duties) ? duties : (role === 'admin' ? ['admin'] : role === 'academic' ? ['academic'] : []), teacher: row.teacher_name || '',
    full_name: row.full_name || '', position: row.position || '', position_short: row.position_short || '', phone: row.phone || '' };
}

export async function activeTimetable() {
  return (await q(sb.from('sub_timetables').select('id,academic_year,term,name,data').eq('is_active', true).limit(1)))[0] || null;
}

export async function rankData() {
  const d = await q(sb.rpc('sub_rank_data'));
  return { records: d?.records || [], requests: d?.requests || [] };
}

export async function settings() {
  return (await q(sb.from('sub_settings').select('*').eq('id', 1)))[0] || {};
}

/** คอลัมน์ของ sub_requests ที่อ่านได้ (เหตุผล/ที่ติดต่ออยู่ในทะเบียนการลา ฝ่ายวิชาการอ่านไม่ได้) */
export const REQ_COLS = 'id,teacher_name,date_from,date_to,periods,leave_type,status,requested_by,decided_by,decided_at,decision_note,created_at';
