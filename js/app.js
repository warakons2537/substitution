import { $, $$, esc, toast } from './util.js';
import { BRAND, VERSION } from './config.js';
import { auth, loadMe, activeTimetable } from './db.js';
import { pagesFor, modulesFor, landing, MODULES, dutyText } from './perm.js';
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
import * as leaves from './views/leaves.js';
import * as summary from './views/summary.js';
import * as approvals from './views/approvals.js';
import * as mysubs from './views/mysubs.js';
import { icon } from './icons.js';
import { mountNav } from './navbar.js';
import { mountBell } from './notify.js';

const root = $('#app');

// hash -> ฟังก์ชันแสดงหน้า (สิทธิ์การเห็นอยู่ที่ js/perm.js)
const VIEWS = {
  home: home.render, request: request.render, mine: request.renderMine, approvals: approvals.render, leaves: leaves.render,
  'leave-settings': setts.renderLeave, mysubs: mysubs.render, assist: assist.render, requests: requests.render, records: records.render,
  summary: summary.render, reports: reports.render, import: imp.render, users: users.render, settings: setts.render, audit: audit.render,
  profile: profile.render,
};
const SIBLINGS = [
  { name: 'ทางเข้า WL (ทุกแอป)', url: '../' },
  { name: 'WL Admin (ปพ.)', url: '../pp/' },
  { name: 'WL Scheduler (ตารางสอน)', url: '../planner/' },
  { name: 'WL Academic (งานวิชาการ)', url: '../wl-academic/' },
  { name: 'WL Draft (ร่างหนังสือ)', url: '../wl-draft/' },
];
const MOD_KEY = 'wlsub-mod';
let navCtl = null; let bell = null;

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
  const name = me.full_name || me.teacher || me.email || '';
  root.innerHTML = `<div class="shell"><aside class="side no-print">
      <div class="brand"><img class="mark" src="img/logo-192.png" alt=""></div>
      <nav class="nav" id="side-nav"></nav>
    </aside><main class="main">
      <header class="topbar no-print"><div class="tb-title"><b>${esc(BRAND.name)}</b><small id="tt-line"></small></div>
        <div class="modsw" id="modsw" role="tablist" aria-label="เลือกระบบ"></div>
        <div id="bell-root" class="bell-wrap"></div>
        <div class="tb-user"><span class="avatar" aria-hidden="true">${esc((name.replace(/^(ครู|นาย|นางสาว|นาง)\s*/, '').replace(/^[เแโใไ]/, '')[0]) || '?')}</span>
          <span class="nm"><b title="${esc(name)}">${esc(name)}</b><small>${esc(dutyText(me))}</small></span>
          <button class="btn btn-sm" id="logout" title="ออกจากระบบ" aria-label="ออกจากระบบ">${icon('logout')}</button></div></header>
      <div class="main-pad"><div id="view"></div></div>
      <footer class="app-ver no-print">${esc(BRAND.name)} เวอร์ชัน ${VERSION}</footer></main></div><div id="bnav-root"></div>`;
  bell?.destroy();
  bell = mountBell($('#bell-root'), me);
  $('#logout').addEventListener('click', async () => { bell?.destroy(); bell = null; await auth.signOut(); location.hash = ''; boot(); });
}

/** วาดเมนูซ้าย/แถบล่าง/แถบสลับระบบ ตามระบบ (โมดูล) ปัจจุบัน */
function drawNav(me, mod, page) {
  const pages = pagesFor(me);
  // เมนูของระบบปัจจุบัน + หน้าผู้ดูแลระบบ (แสดงในทุกระบบสำหรับผู้ดูแล จะได้หาเจอเสมอ) + ข้อมูลฉัน
  const items = pages.filter((p) => p[0] === 'home' || p[2] === mod || p[0] === 'profile' || p[2] === 'admin');
  $('#side-nav').innerHTML = items.map(([h, t]) => `<a href="#${h}" data-v="${h}">${icon(h)}<span>${esc(t)}</span></a>`).join('')
    + `<div class="sec"></div><a href="../">${icon('link')}<span>ทางเข้า WL</span></a>`;
  const mods = modulesFor(me);
  $('#modsw').innerHTML = mods.length > 1 ? mods.map((m) => `<a href="#${landing(me, m)}" role="tab" class="${m === mod ? 'on' : ''}" aria-selected="${m === mod}">
    <b>${esc(MODULES[m].name)}</b>${MODULES[m].sub ? `<small>${esc(MODULES[m].sub)}</small>` : ''}</a>`).join('') : '';
  const fresh = document.createElement('div'); fresh.id = 'bnav-root';
  $('#bnav-root').replaceWith(fresh);
  const hashes = items.map((p) => p[0]);
  navCtl = mountNav(fresh, { labels: Object.fromEntries(items.map(([h, t]) => [h, t])), bar: hashes.slice(0, 4), more: hashes.slice(4), ext: SIBLINGS });
  navCtl.setView(page);
  $$('#side-nav a[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === page));
}

let ctx = null;
async function route() {
  if (!ctx) return;
  const { me } = ctx;
  const pages = pagesFor(me);
  const h = location.hash.slice(1).split('?')[0];
  const item = pages.find((p) => p[0] === h) || pages[0];
  let mod = item[2];
  if (mod === 'common') {
    let last = ''; try { last = sessionStorage.getItem(MOD_KEY) || ''; } catch { /* */ }
    const mods = modulesFor(me);
    mod = mods.includes(last) ? last : mods[0] || 'leave';
  } else { try { sessionStorage.setItem(MOD_KEY, mod); } catch { /* */ } }
  drawNav(me, mod, item[0]);
  const view = $('#view');
  $('#tt-line').textContent = ctx.tt ? `ตารางสอน: ปีการศึกษา ${ctx.tt.academic_year} ภาคเรียนที่ ${ctx.tt.term} · ${ctx.tt.name}` : 'ยังไม่มีตารางสอน';
  if (item[4] && !ctx.tt) {
    view.innerHTML = `<h2>${esc(item[1])}</h2><div class="card"><p>ยังไม่มีตารางสอนในระบบ ${me.duties.includes('academic') || me.duties.includes('admin') ? 'กรุณานำเข้าตารางสอนก่อน' : 'กรุณาแจ้งฝ่ายวิชาการ'}</p></div>`;
    return;
  }
  view.innerHTML = '<div class="loading" role="status"><i class="bar"></i><span>กำลังโหลด…</span></div>';
  try { await VIEWS[item[0]](view, ctx); } catch (e) { console.error(e); view.innerHTML = `<div class="card"><p class="warn">${esc(e.message)}</p></div>`; }
  window.scrollTo(0, 0);
}

async function boot() {
  ctx = null;
  bell?.destroy(); bell = null;
  try {
    const user = await auth.user();
    if (!user) { loginPage(); return; }
    const me = await loadMe(user);
    if (!me.role) {
      root.innerHTML = `<div class="login"><div class="login-card"><h1>${esc(BRAND.name)}</h1>
        <p>บัญชี ${esc(me.email)} ยังไม่ได้รับสิทธิ์ใช้ระบบ<br>กรุณาแจ้งผู้ดูแลระบบ</p>
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
