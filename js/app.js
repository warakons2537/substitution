import { $, $$, esc, toast } from './util.js';
import { BRAND, VERSION, ROLES } from './config.js';
import { auth, loadMe, activeTimetable } from './db.js';
import * as assist from './views/assist.js';
import * as request from './views/request.js';
import * as requests from './views/requests.js';
import * as records from './views/records.js';
import * as imp from './views/import.js';
import * as users from './views/users.js';

const root = $('#app');

// เมนูตามสิทธิ์: [hash, ชื่อ, view, ต้องมีตารางสอน]
const STAFF = [
  ['assist', 'ช่วยจัดครูสอนแทน', assist.render, true],
  ['requests', 'คำขอสอนแทน', requests.render, true],
  ['records', 'บันทึกการสอนแทน', records.render, true],
  ['import', 'นำเข้าตารางสอน', imp.render, false],
];
const NAV = {
  admin: [...STAFF, ['users', 'ผู้ใช้และสิทธิ์', users.render, false]],
  academic: STAFF,
  requester: [['request', 'แจ้งขอลา/ขอสอนแทน', request.render, true], ['mine', 'คำขอของฉัน', request.renderMine, false]],
};

function loginPage() {
  root.innerHTML = `<div class="login"><div class="login-card">
    <img src="img/logo-full.png" alt="" class="login-logo" onerror="this.src='img/logo-512.png'">
    <h1>${esc(BRAND.name)}</h1><p class="muted">${esc(BRAND.tagline)}</p>
    <form id="f-login">
      <label>อีเมล<input type="email" name="email" autocomplete="username" required></label>
      <label>รหัสผ่าน<input type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn btn-primary" type="submit">เข้าสู่ระบบ</button>
      <p class="muted small">ใช้บัญชีเดียวกับ WL Admin</p>
    </form><p class="ver">v${VERSION}</p></div></div>`;
  $('#f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    try { await auth.signIn(f.email, f.password); boot(); } catch (err) { toast(err.message, 'err'); }
  });
}

function shell(me) {
  const nav = NAV[me.role];
  root.innerHTML = `<div class="shell"><aside class="side">
      <div class="brand"><img src="img/logo-192.png" alt=""><div><b>${esc(BRAND.name)}</b><span>${esc(BRAND.school)}</span></div></div>
      <nav>${nav.map(([h, t]) => `<a href="#${h}" data-h="${h}">${esc(t)}</a>`).join('')}</nav>
      <div class="side-foot"><div>${esc(me.teacher || me.email)}</div><div class="small">${ROLES[me.role]}</div>
        <button class="btn btn-sm" id="logout">ออกจากระบบ</button><div class="ver">v${VERSION}</div></div>
    </aside><main class="main"><div class="topline" id="tt-line"></div><div id="view"></div></main></div>`;
  $('#logout').addEventListener('click', async () => { await auth.signOut(); location.hash = ''; boot(); });
}

let ctx = null;
async function route() {
  if (!ctx) return;
  const nav = NAV[ctx.me.role];
  const h = location.hash.slice(1);
  const item = nav.find(([k]) => k === h) || nav[0];
  $$('[data-h]').forEach((a) => a.classList.toggle('on', a.dataset.h === item[0]));
  const view = $('#view');
  $('#tt-line').textContent = ctx.tt ? `ตารางสอน: ปีการศึกษา ${ctx.tt.academic_year} ภาคเรียนที่ ${ctx.tt.term} · ${ctx.tt.name}` : 'ยังไม่มีตารางสอน';
  if (item[3] && !ctx.tt) {
    view.innerHTML = `<h2>${esc(item[1])}</h2><div class="card"><p>ยังไม่มีตารางสอนในระบบ ${ctx.me.role === 'requester' ? 'กรุณาแจ้งฝ่ายวิชาการ' : 'กรุณานำเข้าตารางสอนก่อน'}</p></div>`;
    return;
  }
  view.innerHTML = '<p class="muted">กำลังโหลด…</p>';
  try { await item[2](view, ctx); } catch (e) { view.innerHTML = `<div class="card"><p class="warn">${esc(e.message)}</p></div>`; }
}

async function boot() {
  ctx = null;
  try {
    const user = await auth.user();
    if (!user) { loginPage(); return; }
    const me = await loadMe(user);
    if (!me.role) {
      root.innerHTML = `<div class="login"><div class="login-card"><h1>${esc(BRAND.name)}</h1>
        <p>บัญชี ${esc(me.email)} ยังไม่ได้รับสิทธิ์ใช้ระบบสอนแทน<br>กรุณาแจ้งผู้ดูแลระบบ</p>
        <button class="btn" id="logout">ออกจากระบบ</button></div></div>`;
      $('#logout').addEventListener('click', async () => { await auth.signOut(); boot(); });
      return;
    }
    shell(me);
    ctx = { me, tt: await activeTimetable(), reload: async () => { ctx.tt = await activeTimetable(); route(); } };
    route();
  } catch (e) {
    root.innerHTML = `<div class="login"><div class="login-card"><p class="warn">${esc(e.message)}</p>
      <button class="btn" onclick="location.reload()">ลองใหม่</button></div></div>`;
  }
}

window.addEventListener('hashchange', route);
boot();
