// ตัวช่วยสไตล์บอร์ด G (WL Design System) — ใช้กับหน้าที่ครอบด้วย .wl-g
import { esc } from './util.js';

export const ICON = {
  pending: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.6"/></svg>',
  approved: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
  rejected: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  cancelled: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3.5 8h9"/></svg>',
};
// ป้ายสถานะ: สีคงที่ + ไอคอนเสมอ (st = pending|approved|rejected|cancelled)
export const pill = (st, label, title = '') => `<span class="g-pill g-${st}"${title ? ` title="${esc(title)}"` : ''}>${ICON[st] || ''}<span>${esc(label)}</span></span>`;
// หัวหน้าย่อยแบบกะทัดรัด (ไม่มีโลโก้ — โลโก้อยู่ที่ rail/หน้าแรกแล้ว) ให้เนื้อหาขึ้นมาอยู่บนจอมากขึ้น · หน้าแรกใช้ฮีโร่เต็ม (heroFull)
export const hero = (title, sub, action = '') => `<header class="g-hero g-hero-sm"><div class="g-hero-text">
  <h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${action}</header>`;
export const heroFull = (title, sub, action = '') => `<header class="g-hero"><div class="g-logo"><span class="g-mark" aria-hidden="true"><img src="img/logo-192.png" alt=""></span><span class="g-brand">WL ระบบสอนแทน</span></div><div class="g-hero-text">
  <h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${action}</header>`;

// ลดขนาดชื่อเรื่องในฮีโร่ตามความกว้างจอ ให้อยู่บรรทัดเดียว (ไม่ลดต่ำกว่า 18px)
export function fitHeroTitles(root = document) {
  root.querySelectorAll('.g-hero h1').forEach((h) => {
    h.style.fontSize = '';
    const max = parseFloat(getComputedStyle(h).fontSize);
    let size = max;
    while (h.scrollWidth > h.clientWidth + 1 && size > 18) { size -= 1; h.style.fontSize = `${size}px`; }
  });
}

// แถบจัดการลอยแบบกระจกใส (แสดงเมื่อเลือกรายการ) — id = คำนำหน้า id ของปุ่ม/ตัวนับ
export const bulkBar = (id, actionsHtml) => `<div class="g-bulk" id="${id}-bulk" role="region" aria-label="จัดการรายการที่เลือก" hidden>
  <div class="g-bulk-top"><span>เลือกแล้ว <b class="num" id="${id}-n">0</b> รายการ</span><button class="g-btn g-btn-line g-btn-sm" type="button" id="${id}-clear">ล้างที่เลือก</button></div>
  <div class="g-bulk-actions">${actionsHtml}</div></div>`;
