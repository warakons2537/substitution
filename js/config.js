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
export const VERSION = '2569.10.31-6';

// ชุดตั้งต้น (ใช้เมื่อยังโหลดประเภทจากฐานข้อมูลไม่ได้) · ตัวจริงอยู่ที่ตาราง sub_leave_types แก้ได้ที่เมนู "ตั้งค่า"
export const LEAVE_TYPES = ['ลาป่วย', 'ลากิจ', 'ลาพักผ่อน', 'ไปราชการ', 'ลาคลอด', 'ลาไปช่วยเหลือภริยาที่คลอดบุตร', 'ลาอุปสมบท/ลาไปประกอบพิธีฮัจย์', 'ไม่ระบุ'];
export const LEAVE_STATUS = { pending: 'รอตรวจ', approved: 'บันทึกแล้ว', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิก' };
export const ROLES = { admin: 'ผู้ดูแลระบบ', academic: 'ฝ่ายวิชาการ', requester: 'ผู้ขอลา' };
