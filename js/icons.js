// ไอคอนเส้น (24×24) ใช้สีตามตัวอักษร — ชื่อ = hash ของเมนู
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  assist: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4"/><path d="M17 5v6M14 8h6"/>',
  requests: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 15.5h5"/>',
  records: '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/><path d="m8.5 15 2.3 2.3 4.7-4.8"/>',
  leaves: '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v3M16 3v3"/><path d="M8 13h3M8 16.5h6"/>',
  summary: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  reports: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7.5 14 3.5-4 3 2.5L19 7"/>',
  import: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M4.5 20h15"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4"/><path d="M16 4.8a3 3 0 0 1 0 6"/><path d="M18 14.8c1.7.7 2.8 2.4 3 5.2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  audit: '<path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  profile: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-4 3.6-6 7.5-6s6.7 2 7.5 6"/>',
  request: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  mine: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="m9.5 15 2 2 3.5-4"/>',
  link: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
};
export const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
