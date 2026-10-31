// กระดิ่งแจ้งเตือนในแอป: อ่านจากตาราง sub_notifications (ผู้ใช้เห็นเฉพาะของตัวเอง) + Realtime + โพลทุก 60 วินาทีสำรอง
import { sb, q } from './db.js';
import { esc } from './util.js';
import { icon } from './icons.js';

const when = (s) => new Date(s).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const BASE_TITLE = document.title;

export function mountBell(host, me) {
  let list = []; let open = false; let timer = null; let chan = null;
  const unread = () => list.filter((n) => !n.read_at).length;

  function draw() {
    const n = unread();
    document.title = n ? `(${n}) ${BASE_TITLE}` : BASE_TITLE;
    host.innerHTML = `<button class="btn btn-sm bell" type="button" aria-haspopup="true" aria-expanded="${open}" aria-label="การแจ้งเตือน${n ? ` ${n} รายการที่ยังไม่อ่าน` : ''}">${icon('bell')}${n ? `<span class="bell-n">${n > 99 ? '99+' : n}</span>` : ''}</button>
      <div class="bell-panel" ${open ? '' : 'hidden'} role="dialog" aria-label="การแจ้งเตือน">
        <div class="bell-head"><b>การแจ้งเตือน</b><button type="button" class="btn btn-sm" data-all ${n ? '' : 'disabled'}>อ่านทั้งหมด</button></div>
        ${list.length ? `<div class="bell-list">${list.map((x) => `<button type="button" class="bell-item ${x.read_at ? '' : 'unread'}" data-id="${x.id}" data-link="${esc(x.link)}">
          <b>${esc(x.title)}</b><span>${esc(x.body)}</span><small>${esc(when(x.created_at))}</small></button>`).join('')}</div>`
          : '<p class="muted small" style="padding:16px">ยังไม่มีการแจ้งเตือน</p>'}</div>`;
  }
  async function load() {
    try { list = await q(sb.from('sub_notifications').select('id,kind,title,body,link,read_at,created_at').order('created_at', { ascending: false }).limit(30)); }
    catch { list = []; }   // ยังไม่ได้รัน SQL รอบ 4
    draw();
  }
  async function markRead(ids) {
    const now = new Date().toISOString();
    list.forEach((x) => { if (!ids || ids.includes(x.id)) x.read_at ||= now; });
    draw();
    try { await q(sb.rpc('sub_notif_read', { p_ids: ids })); } catch { /* */ }
  }
  host.addEventListener('click', (e) => {
    const item = e.target.closest('.bell-item');
    if (item) { open = false; const link = item.dataset.link; markRead([+item.dataset.id]); if (link) location.hash = link; return; }
    if (e.target.closest('[data-all]')) { markRead(null); return; }
    if (e.target.closest('.bell')) { open = !open; draw(); }
  });
  const away = (e) => { if (open && !host.contains(e.target)) { open = false; draw(); } };
  const esc2 = (e) => { if (e.key === 'Escape' && open) { open = false; draw(); } };
  document.addEventListener('click', away); document.addEventListener('keydown', esc2);

  load();
  try {
    chan = sb.channel(`sub-notif-${me.id}`).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sub_notifications', filter: `user_id=eq.${me.id}` }, load).subscribe();
  } catch { /* ใช้โพลแทน */ }
  timer = setInterval(load, 60000);
  return { destroy() { clearInterval(timer); document.removeEventListener('click', away); document.removeEventListener('keydown', esc2); try { chan && sb.removeChannel(chan); } catch { /* */ } document.title = BASE_TITLE; } };
}
