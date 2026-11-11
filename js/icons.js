// ไอคอนแบบสองโทน (24×24): เส้นสีตามตัวอักษร + พื้นจาง (class "f") — ชื่อ = hash ของหน้า/กลุ่มเมนู
// พื้นจางเข้มขึ้นเมื่อเมนูถูกเลือก (ดู svg.i .f ใน css/app.css) · ทุกหน้ามีไอคอนของตัวเอง ไม่ใช้ซ้ำกัน
const DOC = 'M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z';
const CAL = '<rect class="f" x="3.5" y="4.5" width="17" height="16" rx="2.5"/><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/>';
const GEAR = 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z';
const P = {
  // ----- เมนูหลัก -----
  home: '<path class="f" d="M5.5 10 12 4.5l6.5 5.5v10h-13z"/><path d="M3 11.2 12 3.5l9 7.7"/><path d="M5.5 9.6V20h13V9.6"/><path d="M10 20v-5.5h4V20"/>',
  request: '<path class="f" d="M4 20v-4L15 5l4 4L8 20z"/><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/><path d="M13.5 20H20"/>',
  mysubs: '<rect class="f" x="3.5" y="4" width="17" height="11.5" rx="2"/><rect x="3.5" y="4" width="17" height="11.5" rx="2"/><path d="M12 15.5v3.2M8 20.5l4-1.8 4 1.8"/><path d="m8.8 9.9 2.2 2.2 4.2-4.4"/>',
  approvals: `<path class="f" d="${DOC}"/><path d="${DOC}"/><path d="M14 3v4h4"/><path d="m9.2 14.3 2 2 3.8-4.2"/>`,
  assist: '<circle class="f" cx="9" cy="8" r="3.4"/><circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c.6-3.5 3-5.5 6.2-5.5 1.4 0 2.6.4 3.6 1"/><path d="M15.5 14.5H21l-2-2M21 18.5h-5.5l2 2"/>',
  books: '<path class="f" d="M12 6.6C10 5.3 7.5 4.8 4 5v13c3.5-.2 6 .3 8 1.6 2-1.3 4.5-1.8 8-1.6V5c-3.5-.2-6 .3-8 1.6z"/><path d="M12 6.6C10 5.3 7.5 4.8 4 5v13c3.5-.2 6 .3 8 1.6 2-1.3 4.5-1.8 8-1.6V5c-3.5-.2-6 .3-8 1.6z"/><path d="M12 6.6v13"/>',
  setup: `<g transform="translate(1.8 1.8) scale(.85)"><path class="f" d="${GEAR}"/><path d="${GEAR}"/><circle cx="12" cy="12" r="3"/></g>`,
  // ----- หน้าย่อย (แท็บ) -----
  mine: `<path class="f" d="${DOC}"/><path d="${DOC}"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/>`,
  'assist-leave': `${CAL}<path d="M12 12.2v5M9.5 14.7h5"/>`,
  leaves: `${CAL}<path d="M7.5 13h4M7.5 16.5h7"/>`,
  'leave-settings': '<circle class="f" cx="15" cy="7" r="2.2"/><circle class="f" cx="9" cy="12" r="2.2"/><circle class="f" cx="16" cy="17" r="2.2"/><path d="M4 7h8.8M17.2 7H20M4 12h2.8M11.2 12H20M4 17h9.8M18.2 17H20"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="16" cy="17" r="2.2"/>',
  requests: '<rect class="f" x="3.5" y="4" width="17" height="16" rx="2.5"/><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M11 9h6M11 15h6"/><path d="M7 9h.01M7 15h.01" stroke-width="2.6"/>',
  records: '<rect class="f" x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/><path d="M8.5 11h7M8.5 15h4.5"/>',
  summary: '<rect class="f" x="4" y="11" width="4" height="9" rx="1"/><rect class="f" x="10" y="4" width="4" height="16" rx="1"/><rect class="f" x="16" y="14" width="4" height="6" rx="1"/><rect x="4" y="11" width="4" height="9" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="16" y="14" width="4" height="6" rx="1"/>',
  reports: '<path class="f" d="M4 19h16V8l-5 4.5-3.5-3L4 15z"/><path d="M4 4.5V19h16.5"/><path d="m7 14.5 4.5-5 3.5 3L20 7.5"/>',
  import: '<path class="f" d="M4 14.5h16v4a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><path d="M12 3.5v10M8 9.8l4 4 4-4"/><path d="M4 14.5v4A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-4"/>',
  users: '<circle class="f" cx="9" cy="8" r="3.4"/><circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c.6-3.5 3-5.5 6.2-5.5s5.6 2 6.2 5.5"/><path d="M16 4.8a3.2 3.2 0 0 1 0 6.4"/><path d="M18.2 14.9c1.7.8 2.7 2.5 3 5.1"/>',
  settings: '<rect class="f" x="3.5" y="8.5" width="17" height="8.5" rx="2"/><path d="M7 8.5V4h10v4.5"/><path d="M7 17H5.5a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H17"/><path d="M7 14h10v6.5H7z"/><path d="M17 11.5h.01" stroke-width="2.4"/>',
  audit: '<circle class="f" cx="12" cy="12" r="8"/><path d="M4.6 15a8 8 0 1 0 .9-7.5"/><path d="M4 4.5v4h4"/><path d="M12 8v4.3l2.8 1.7"/>',
  remind: '<circle class="f" cx="12" cy="13" r="7.2"/><circle cx="12" cy="13" r="7.2"/><path d="M12 9.3V13l2.4 1.6"/><path d="M5.2 3.8 2.8 6.2M18.8 3.8l2.4 2.4"/>',
  profile: '<circle class="f" cx="12" cy="8" r="3.7"/><circle cx="12" cy="8" r="3.7"/><path d="M4.5 20.5c.8-4 3.6-6 7.5-6s6.7 2 7.5 6"/>',
  // ----- ทั่วไป -----
  link: '<rect class="f" x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>',
  logout: '<path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H16"/>',
  bell: '<path class="f" d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.8a2.1 2.1 0 0 0 4 0"/>',
  more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  clock: '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  check: '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.6 2.6 4.9-5.3"/>',
  alert: '<path class="f" d="M12 4 2.8 19.5h18.4z"/><path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17h.01"/>',
  print: '<rect class="f" x="3.5" y="8.5" width="17" height="8.5" rx="2"/><path d="M7 8.5V4h10v4.5"/><path d="M7 17H5.5a2 2 0 0 1-2-2v-4.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H17"/><path d="M7 14h10v6.5H7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<rect class="f" x="6.5" y="2.5" width="11" height="19" rx="2.5"/><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
};
// ชื่อเดิมที่ยังมีที่เรียกใช้
P.leave = P.request; P['sub-admin'] = P.assist; P['leave-admin'] = P.approvals;
export const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
export const ICON_NAMES = Object.keys(P);
