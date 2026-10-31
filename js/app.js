import { $, $$, esc, toast } from './util.js';
import { BRAND, VERSION, ROLES } from './config.js';
import { auth, loadMe, activeTimetable } from './db.js';
import * as assist from './views/assist.js';
import * as request from './views/request.js';
import * as requests from './views/requests.js';
import * as records from './views/records.js';
import * as imp from './views/import.js';
import * as users from './views/users.js';
import * as profile from './views/profile.js';
import * as setts from './views/settings.js';
import * as audit from './views/audit.js';
import * as reports from './views/reports.js';
import * as home from './views/home.js';
import { icon } from './icons.js';
import { mountNav } from './navbar.js';

const root = $('#app');

// เมนูตามสิทธิ์: [hash, ชื่อสั้น (เมนู), view, ต้องมีตารางสอน]
const HOME = ['home', 'หน้าแรก', home.render, false];
const STAFF = [
  ['assist', 'จัดสอนแทน', assist.render, true],
  ['requests', 'คำขอ', requests.render, true],
  ['records', 'บันทึก', records.render, true],
  ['reports', 'รายงาน', reports.render, true],
  ['import', 'ตารางสอน', imp.render, false],
];
const MINE = ['profile', 'ข้อมูลฉัน', profile.render, false];
const NAV = {
  admin: [HOME, ...STAFF, ['users', 'ผู้ใช้', users.render, false], ['settings', 'ตั้งค่า', setts.render, false], ['audit', 'ประวัติใช้งาน', audit.render, false], MINE],
  academic: [HOME, ...STAFF, MINE],
  requester: [HOME, ['request', 'แจ้งลา', request.render, true], ['mine', 'คำขอฉัน', request.renderMine, false], MINE],
};
const SIBLINGS = [
  { name: 'ทางเข้า WL (ทุกแอป)', url: '../' },
  { name: 'WL Admin (ปพ.)', url: '../pp/' },
  { name: 'WL Scheduler (ตารางสอน)', url: '../planner/' },
  { name: 'WL Academic (งานวิชาการ)', url: '../wl-academic/' },
  { name: 'WL Draft (ร่างหนังสือ)', url: '../wl-draft/' },
];
let navCtl = null;

function loginPage(mode = 'in') {
  const up = mode === 'up';
  root.innerHTML = `<div class="login"><div class="login-book">
    <div class="login-cover">
      <a class="login-back" href="../" title="กลับหน้าทางเข้า Wangluek (Y.N.) Connected">← กลับหน้าทางเข้า</a>
      <div class="plate"><img src="img/logo-192.png" alt=""><div><b>${esc(BRAND.name)}</b><span>${esc(BRAND.tagline)}</span></div></div>
      <ul><li>แจ้งลา · ทะเบียนการลาของครู</li><li>ระบบเลือกครูสอนแทนให้อย่างเป็นธรรม</li><li>พิมพ์ใบลา บันทึกการสอนแทน และรายงาน A4 / Excel / Word</li></ul>
      <small>เวอร์ชัน ${esc(VERSION)}</small></div>
    <div class="login-form"><h1>${up ? 'สมัครใช้งาน (ครู)' : 'เข้าสู่ระบบ'}</h1>
    <form id="f-login">
      ${up ? '<label>ชื่อ-นามสกุล<input type="text" name="name" required></label>' : ''}
      <label>อีเมล<input type="email" name="email" autocomplete="username" required></label>
      <label>รหัสผ่าน<input type="password" name="password" minlength="6" autocomplete="${up ? 'new-password' : 'current-password'}" required></label>
      <button class="btn btn-primary" type="submit">${up ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ'}</button>
      <p class="muted small">${up ? 'สมัครแล้วต้องรอผู้ดูแลระบบกำหนดสิทธิ์ก่อนจึงจะใช้งานได้ · บัญชีนี้ใช้กับ WL Admin ได้ด้วย' : 'ใช้บัญชีเดียวกับ WL Admin'}</p>
    </form>
    <button class="btn btn-sm" type="button" data-m="${up ? 'in' : 'up'}">${up ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครใช้งาน (ครู)'}</button></div></div></div>`;
  $$('[data-m]').forEach((b) => b.addEventListener('click', () => loginPage(b.dataset.m)));
  $('#f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (!up) { await auth.signIn(f.email, f.password); boot(); return; }
      const r = await auth.signUp(f.email, f.password, f.name);
      if (r.session) boot();
      else { toast('สมัครแล้ว กรุณายืนยันอีเมลจากกล่องจดหมาย แล้วกลับมาเข้าสู่ระบบ'); loginPage('in'); }
    } catch (err) { toast(err.message, 'err'); }
  });
}

function shell(me) {
  const nav = NAV[me.role];
  const name = me.full_name || me.teacher || me.email || '';
  root.innerHTML = `<div class="shell"><aside class="side no-print">
      <div class="brand"><img class="mark" src="img/logo-192.png" alt=""></div>
      <nav class="nav">${nav.map(([h, t]) => `<a href="#${h}" data-v="${h}">${icon(h)}<span>${esc(t)}</span></a>`).join('')}
        <div class="sec"></div>${SIBLINGS.slice(0, 1).map((s) => `<a href="${esc(s.url)}">${icon('link')}<span>ทางเข้า WL</span></a>`).join('')}</nav>
    </aside><main class="main">
      <header class="topbar no-print"><div class="tb-title"><b>${esc(BRAND.name)}</b><small id="tt-line"></small></div>
        <div class="tb-user"><span class="avatar" aria-hidden="true">${esc((name.replace(/^(ครู|นาย|นางสาว|นาง)\s*/, '').replace(/^[เแโใไ]/, '')[0]) || '?')}</span>
          <span class="nm"><b title="${esc(name)}">${esc(name)}</b><small>${ROLES[me.role]}</small></span>
          <button class="btn btn-sm" id="logout" title="ออกจากระบบ" aria-label="ออกจากระบบ">${icon('logout')}</button></div></header>
      <div class="main-pad"><div id="view"></div></div>
      <footer class="app-ver no-print">${esc(BRAND.name)} เวอร์ชัน ${VERSION}</footer></main></div><div id="bnav-root"></div>`;
  const hashes = nav.map((n) => n[0]);
  const labels = Object.fromEntries(nav.map(([h, t]) => [h, t]));
  navCtl = mountNav($('#bnav-root'), { labels, bar: hashes.slice(0, 4), more: hashes.slice(4), ext: SIBLINGS });
  $('#logout').addEventListener('click', async () => { await auth.signOut(); location.hash = ''; boot(); });
}

let ctx = null;
async function route() {
  if (!ctx) return;
  const nav = NAV[ctx.me.role];
  const h = location.hash.slice(1);
  const item = nav.find(([k]) => k === h) || nav[0];
  $$('.nav a[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === item[0]));
  navCtl?.setView(item[0]);
  const view = $('#view');
  $('#tt-line').textContent = ctx.tt ? `ตารางสอน: ปีการศึกษา ${ctx.tt.academic_year} ภาคเรียนที่ ${ctx.tt.term} · ${ctx.tt.name}` : 'ยังไม่มีตารางสอน';
  if (item[3] && !ctx.tt) {
    view.innerHTML = `<h2>${esc(item[1])}</h2><div class="card"><p>ยังไม่มีตารางสอนในระบบ ${ctx.me.role === 'requester' ? 'กรุณาแจ้งฝ่ายวิชาการ' : 'กรุณานำเข้าตารางสอนก่อน'}</p></div>`;
    return;
  }
  view.innerHTML = '<div class="loading" role="status"><i class="bar"></i><span>กำลังโหลด…</span></div>';
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
