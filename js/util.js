export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(msg, kind = 'ok') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), kind === 'err' ? 6000 : 3000);
}

// วันที่แบบ 'YYYY-MM-DD' (เวลาท้องถิ่น)
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => iso(new Date());
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
export const weekStart = (s) => { const d = parseISO(s); return addDays(s, -((d.getDay() + 6) % 7)); }; // จันทร์
/** ลำดับวันในตารางสอน: จันทร์ = 0 … ศุกร์ = 4, เสาร์-อาทิตย์ = -1 */
export const dowIndex = (s) => { const g = parseISO(s).getDay(); return g >= 1 && g <= 5 ? g - 1 : -1; };
export const dateRange = (from, to) => { const out = []; for (let d = from; d <= to && out.length < 62; d = addDays(d, 1)) out.push(d); return out; };
export const thDate = (s, opt = { day: 'numeric', month: 'short', year: '2-digit' }) => (s ? parseISO(s).toLocaleDateString('th-TH', opt) : '');
export const thDay = (s) => parseISO(s).toLocaleDateString('th-TH', { weekday: 'short' });

export const opts = (list, sel = '') => list.map((x) => {
  const [v, l] = Array.isArray(x) ? x : [x, x];
  return `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`;
}).join('');
