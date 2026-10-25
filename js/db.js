import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = window.supabase.createClient(SUPABASE_URL.trim(), SUPABASE_KEY.trim());

const TH = [
  [/Invalid login credentials/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
  [/Email not confirmed/i, 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล'],
  [/sub_records_no_double/i, 'มีครูถูกจัดสอนแทน 2 ห้องในคาบเดียวกัน กรุณาเลือกใหม่'],
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
  const role = await q(sb.rpc('sub_role'));
  const row = (await q(sb.from('sub_users').select('teacher_name').eq('user_id', user.id)))[0];
  return { id: user.id, email: user.email, role, teacher: row?.teacher_name || '' };
}

export async function activeTimetable() {
  return (await q(sb.from('sub_timetables').select('id,academic_year,term,name,data').eq('is_active', true).limit(1)))[0] || null;
}

export async function rankData() {
  const d = await q(sb.rpc('sub_rank_data'));
  return { records: d?.records || [], requests: d?.requests || [] };
}
