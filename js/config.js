// =====================================================================
//  ตั้งค่า — ใช้ Supabase โปรเจกต์เดียวกับ WL Admin (บัญชี Login ชุดเดียวกัน)
//  SUPABASE_KEY = Publishable key เท่านั้น (ห้ามใส่ Secret / service_role key)
// =====================================================================
export const SUPABASE_URL = 'https://fvfdyskidcxxhzpsnanp.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_ReEEMSeH1iBJ2rzXlAqhVw_vX2xvqtz';

export const BRAND = {
  name: 'WL Substitution System',
  tagline: 'ระบบจัดการสอนแทน บ้านวังลึก (ย.น.)',
  school: 'บ้านวังลึก(ยุวนาฏชนูทิศ)',
};
// เปลี่ยนทุกครั้งที่ส่งไฟล์อัปเดต
export const VERSION = '2569.10.25-1';

export const LEAVE_TYPES = ['ลากิจ', 'ลาป่วย', 'ไปราชการ', 'ลาคลอด', 'ไม่ระบุ'];
export const ROLES = { admin: 'ผู้ดูแลระบบ', academic: 'ฝ่ายวิชาการ', requester: 'ผู้ขอลา' };
