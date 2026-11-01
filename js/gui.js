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
export const hero = (title, sub, action = '') => `<header class="g-hero"><div class="g-logo"><span class="g-mark" aria-hidden="true">WL</span><span class="g-brand">WL ระบบสอนแทน</span></div><div class="g-hero-text">
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
