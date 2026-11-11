// กระดิ่งแจ้งเตือนในแอป: อ่านจากตาราง sub_notifications (ผู้ใช้เห็นเฉพาะของตัวเอง) + Realtime + โพลทุก 60 วินาทีสำรอง
// รอบ 7: เตือนสอนแทนตามเวลาที่กำหนด (ฐานข้อมูลเป็นผู้สร้างรายการเตือน: pg_cron ทุก 5 นาที · แอปที่เปิดอยู่ช่วยกระตุ้นซ้ำทุก 60 วินาที)
//         รายการใหม่ → ป้ายเด้งในแอป + แจ้งเตือนของอุปกรณ์ (ถ้าผู้ใช้กดอนุญาตแล้ว)
import { sb, q } from './db.js';
import { esc } from './util.js';
import { icon } from './icons.js';
import { VAPID_PUBLIC_KEY } from './config.js';

const when = (s) => new Date(s).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const BASE_TITLE = document.title;
const KIND_ICON = { sub_assigned: 'mysubs', sub_remind_eve: 'remind', sub_remind_morning: 'remind', sub_remind_soon: 'remind', sub_remind_staff: 'remind',
  leave_wait: 'approvals', leave_new: 'leaves', leave_noplan: 'assist', leave_decided: 'mine', req_new: 'requests' };
const kindIcon = (k) => icon(KIND_ICON[k] || 'bell');

// ---------- แจ้งเตือนของอุปกรณ์ (Notification API ผ่าน service worker) ----------
/** 'unsupported' | 'default' | 'granted' | 'denied' */
export const deviceState = () => (!('Notification' in window) ? 'unsupported' : Notification.permission);
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'wlsub-nav' && e.data.link) location.hash = e.data.link; });
  } catch { /* เปิดจากไฟล์/เบราว์เซอร์ไม่รองรับ → ใช้แจ้งเตือนในแอปอย่างเดียว */ }
}
export async function enableDevice() {
  if (deviceState() === 'unsupported') return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return deviceState(); }
}
export async function showDevice(title, body, link = '', tag = '') {
  if (deviceState() !== 'granted') return false;
  const opt = { body, tag: tag || undefined, icon: 'img/logo-192.png', badge: 'img/logo-64.png', lang: 'th', data: { link } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, opt);
    else { const n = new Notification(title, opt); n.onclick = () => { window.focus(); if (link) location.hash = link; n.close(); }; }
    return true;
  } catch { return false; }
}
// ---------- Web Push: สมัครอุปกรณ์นี้กับ push service แล้วฝากไว้ที่ฐานข้อมูล (รอบ 8) → ได้รับแจ้งเตือนแม้ปิดแอป ----------
const b64u = (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(t.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const sameKey = (buf, key) => { if (!buf) return true; const a = new Uint8Array(buf); return a.length === key.length && a.every((x, i) => x === key[i]); };
export const pushSupported = () => !!VAPID_PUBLIC_KEY && 'serviceWorker' in navigator && 'PushManager' in window;
let pushSt = 'off';   // 'on' = อุปกรณ์นี้ลงทะเบียนแล้ว · 'off' = ยังไม่เปิด/ไม่รองรับ · 'nosql' = ฐานข้อมูลยังไม่มีรอบ 8 · 'error'
export const pushState = () => pushSt;
/** เรียกเมื่อผู้ใช้อนุญาตแจ้งเตือนแล้ว (และทุกครั้งที่เปิดแอป — กุญแจ/เจ้าของอุปกรณ์อาจเปลี่ยน) */
export async function syncPush() {
  pushSt = 'off';
  if (!pushSupported() || deviceState() !== 'granted') return pushSt;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return pushSt;
    const key = b64u(VAPID_PUBLIC_KEY);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options?.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }   // เปลี่ยนกุญแจ → สมัครใหม่
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const j = sub.toJSON();
    const { error } = await sb.rpc('sub_push_save', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent.slice(0, 200) });
    pushSt = error ? 'nosql' : 'on';
  } catch { pushSt = 'error'; }
  return pushSt;
}
/** ออกจากระบบ → เลิกส่งมาที่อุปกรณ์นี้ (กันคนถัดไปที่ใช้เครื่องเดียวกันเห็นแจ้งเตือนของคนก่อน) */
export async function dropPush() {
  try {
    const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager?.getSubscription();
    if (sub) { await sb.rpc('sub_push_remove', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
  } catch { /* */ }
  pushSt = 'off';
}

export const DEVICE_TEXT = {
  unsupported: 'เบราว์เซอร์นี้ยังแจ้งเตือนนอกแอปไม่ได้ (iPhone/iPad: เพิ่มแอปไปยังหน้าจอโฮมก่อน แล้วเปิดจากไอคอน)',
  default: 'ยังไม่ได้เปิดแจ้งเตือนบนอุปกรณ์นี้',
  granted: 'เปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว',
  denied: 'อุปกรณ์นี้ปิดกั้นการแจ้งเตือนไว้ — เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์',
};

// ---------- ป้ายเด้งในแอป ----------
function popHost() {
  let h = document.getElementById('npop-root');
  if (!h) { h = document.createElement('div'); h.id = 'npop-root'; h.className = 'npop-root no-print'; h.setAttribute('aria-live', 'polite'); document.body.appendChild(h); }
  return h;
}
export function pop({ kind = '', title, body = '', link = '' }, onOpen) {
  const el = document.createElement('div');
  el.className = 'npop';
  el.innerHTML = `<button type="button" class="npop-main">${kindIcon(kind)}<span><b>${esc(title)}</b><span>${esc(body)}</span></span></button>
    <button type="button" class="npop-x" aria-label="ปิด">×</button>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
  el.querySelector('.npop-main').addEventListener('click', () => { close(); onOpen?.(); if (link) location.hash = link; });
  el.querySelector('.npop-x').addEventListener('click', close);
  popHost().appendChild(el);
  setTimeout(close, 15000);
}

export function mountBell(host, me) {
  let list = []; let open = false; let timer = null; let chan = null; let first = true; let canRemind = true;
  const seen = new Set();
  const unread = () => list.filter((n) => !n.read_at).length;

  function draw() {
    const n = unread(); const dev = deviceState();
    document.title = n ? `(${n}) ${BASE_TITLE}` : BASE_TITLE;
    try { n ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch { /* */ }
    host.innerHTML = `<button class="bell${n ? ' has' : ''}" type="button" aria-haspopup="true" aria-expanded="${open}" aria-label="การแจ้งเตือน${n ? ` ${n} รายการที่ยังไม่อ่าน` : ''}">${icon('bell')}${n ? `<span class="bell-n">${n > 99 ? '99+' : n}</span>` : ''}</button>
      <div class="bell-panel" ${open ? '' : 'hidden'} role="dialog" aria-label="การแจ้งเตือน">
        <div class="bell-head"><b>การแจ้งเตือน</b><button type="button" class="btn btn-sm" data-all ${n ? '' : 'disabled'}>อ่านทั้งหมด</button></div>
        ${list.length ? `<div class="bell-list">${list.map((x) => `<button type="button" class="bell-item ${x.read_at ? '' : 'unread'}" data-id="${x.id}" data-link="${esc(x.link)}">
          <span class="bell-ic">${kindIcon(x.kind)}</span><span class="bell-tx"><b>${esc(x.title)}</b><span>${esc(x.body)}</span><small>${esc(when(x.created_at))}</small></span></button>`).join('')}</div>`
          : `<p class="bell-empty">${icon('bell')}<span>ยังไม่มีการแจ้งเตือน</span></p>`}
        <div class="bell-foot ${dev}">${icon('phone')}<span>${dev === 'granted' && pushSt === 'on' ? 'เปิดแจ้งเตือนบนอุปกรณ์นี้แล้ว (เตือนแม้ปิดแอป)' : DEVICE_TEXT[dev]}</span>${dev === 'default' ? '<button type="button" class="btn btn-sm btn-gold" data-dev>เปิดแจ้งเตือน</button>' : ''}</div></div>`;
  }
  /** รายการใหม่ที่ยังไม่อ่าน → เด้งในแอป (ถ้าจอเปิดอยู่) หรือแจ้งเตือนของอุปกรณ์ (ถ้าแอปอยู่เบื้องหลัง) */
  function announce(fresh) {
    fresh.slice(0, 3).reverse().forEach((x) => {
      if (document.visibilityState === 'visible') pop(x, () => markRead([x.id]));
      else if (pushSt !== 'on') showDevice(x.title, x.body, x.link, `wlsub-${x.id}`);   // มี Web Push แล้ว = service worker แสดงให้เอง (ไม่ซ้ำ)
    });
    if (fresh.length) { const b = host.querySelector('.bell'); b?.classList.add('ring'); try { navigator.vibrate?.(120); } catch { /* */ } }
  }
  async function load() {
    // ให้ฐานข้อมูลสร้างรายการเตือนที่ถึงเวลาแล้ว (ทำซ้ำได้ ไม่ส่งซ้ำ) — สำรองกรณียังไม่ได้เปิด pg_cron
    if (canRemind) { const { error } = await sb.rpc('sub_remind_run').then((r) => r, () => ({ error: null })); if (error && /sub_remind_run|schema cache|not exist|404/i.test(error.message || '')) canRemind = false; }
    let rows;
    try { rows = await q(sb.from('sub_notifications').select('id,kind,title,body,link,read_at,created_at').order('created_at', { ascending: false }).limit(30)); }
    catch { rows = null; }   // ยังไม่ได้รัน SQL รอบ 4 / ออฟไลน์ชั่วคราว
    if (!rows) { if (first) draw(); return; }
    const recent = Date.now() - 3 * 60000;
    const fresh = rows.filter((x) => !x.read_at && !seen.has(x.id) && (!first || +new Date(x.created_at) > recent));
    rows.forEach((x) => seen.add(x.id));
    list = rows; first = false;
    draw(); announce(fresh);
    if (fresh.length) window.dispatchEvent(new Event('wlsub:counts'));
  }
  async function markRead(ids) {
    const now = new Date().toISOString();
    list.forEach((x) => { if (!ids || ids.includes(x.id)) x.read_at ||= now; });
    draw();
    try { await q(sb.rpc('sub_notif_read', { p_ids: ids })); } catch { /* */ }
  }
  host.addEventListener('click', async (e) => {
    const item = e.target.closest('.bell-item');
    if (item) { open = false; const link = item.dataset.link; markRead([+item.dataset.id]); if (link) location.hash = link; return; }
    if (e.target.closest('[data-all]')) { markRead(null); return; }
    if (e.target.closest('[data-dev]')) { const st = await enableDevice(); if (st === 'granted') await syncPush(); draw(); if (st === 'granted') showDevice('เปิดแจ้งเตือนแล้ว', 'ระบบจะเตือนเมื่อคุณมีคาบสอนแทนตามเวลาที่โรงเรียนกำหนด', 'mysubs', 'wlsub-hello'); return; }
    if (e.target.closest('.bell')) { open = !open; draw(); }
  });
  const away = (e) => { if (open && !host.contains(e.target)) { open = false; draw(); } };
  const esc2 = (e) => { if (e.key === 'Escape' && open) { open = false; draw(); } };
  const wake = () => { if (document.visibilityState === 'visible') load(); };   // กลับมาที่แอป → เช็กทันที
  document.addEventListener('click', away); document.addEventListener('keydown', esc2); document.addEventListener('visibilitychange', wake);

  load();
  syncPush().then(() => draw());
  try {
    chan = sb.channel(`sub-notif-${me.id}`).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sub_notifications', filter: `user_id=eq.${me.id}` }, load).subscribe();
  } catch { /* ใช้โพลแทน */ }
  timer = setInterval(load, 60000);
  return { destroy() { clearInterval(timer); document.removeEventListener('click', away); document.removeEventListener('keydown', esc2); document.removeEventListener('visibilitychange', wake);
    try { chan && sb.removeChannel(chan); } catch { /* */ } try { navigator.clearAppBadge?.(); } catch { /* */ } document.title = BASE_TITLE; } };
}
