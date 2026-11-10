import { fitHeroTitles } from './gui.js';
import { $, $$, esc, toast } from './util.js';
import { BRAND, VERSION } from './config.js';
import { auth, loadMe, activeTimetable } from './db.js';
import { pagesFor, groupsFor, tabsOf, dutyText } from './perm.js';
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
import * as assistleave from './views/assistleave.js';
import * as mysubs from './views/mysubs.js';
import { icon } from './icons.js';
import { mountNav, labelHtml } from './navbar.js';
import { mountBell } from './notify.js';

const root = $('#app');

// hash -> ฟังก์ชันแสดงหน้า (สิทธิ์การเห็นอยู่ที่ js/perm.js)
const VIEWS = {
  home: home.render, request: request.render, mine: request.renderMine, approvals: approvals.render, 'assist-leave': assistleave.render, leaves: leaves.render,
  'leave-settings': setts.renderLeave, mysubs: mysubs.render, assist: assist.render, requests: requests.render, records: records.render,
  summary: summary.render, reports: reports.render, import: imp.render, users: users.render, settings: setts.render, audit: audit.render,
  profile: profile.render,
};
// แอปอื่นในเครือ เข้าผ่านหน้าทางเข้า WL ที่เดียว
const SIBLINGS = [{ name: 'ทางเข้า WL (ทุกแอป)', url: '../' }];
const TAB_KEY = 'wlsub-tab:';   // จำแท็บล่าสุดของแต่ละเมนู (กดเมนูเดิมแล้วกลับไปแท็บที่ใช้ล่าสุด)
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
      <header class="topbar no-print"><div class="tb-title"><b id="tb-page">${esc(BRAND.name)}</b><small id="tt-line"></small></div>
        <div class="tb-clock" id="tb-clock" aria-hidden="true"></div><div class="tb-online" id="tb-online"></div>
        <div id="bell-root" class="bell-wrap"></div>
        <div class="tb-user" id="user-menu">
          <button type="button" class="tb-userbtn" aria-haspopup="true" aria-expanded="false" aria-label="เมนูผู้ใช้">
            <span class="avatar" aria-hidden="true">${esc((name.replace(/^(ครู|นาย|นางสาว|นาง)\s*/, '').replace(/^[เแโใไ]/, '')[0]) || '?')}</span>
            <span class="nm"><b title="${esc(name)}">${esc(name)}</b><small>${esc(dutyText(me))}</small></span>
            <svg class="i chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          <div class="user-panel" hidden role="menu">
            <div class="user-head"><b>${esc(name)}</b><small>${esc(me.email || '')}</small><small>${esc(dutyText(me))}</small></div>
            <a href="#profile" role="menuitem">${icon('profile')}<span>ข้อมูลของฉัน</span></a>
            <a href="../" role="menuitem">${icon('link')}<span>ทางเข้า WL (ทุกแอป)</span></a>
            <button type="button" id="logout" role="menuitem">${icon('logout')}<span>ออกจากระบบ</span></button>
          </div></div>
        <button type="button" class="tb-logout" id="logout-btn" aria-label="ออกจากระบบ" title="ออกจากระบบ">${icon('logout')}</button></header>
      <div class="main-pad"><nav class="ptabs no-print" id="ptabs" aria-label="หน้าย่อย"></nav><div id="view"></div></div>
      <footer class="app-ver no-print">${esc(BRAND.name)} เวอร์ชัน ${VERSION}</footer></main></div><div id="bnav-root"></div>`;
  bell?.destroy();
  bell = mountBell($('#bell-root'), me);
  const um = $('#user-menu'); const panel = $('.user-panel', um); const ub = $('.tb-userbtn', um);
  const setMenu = (on) => { panel.hidden = !on; ub.setAttribute('aria-expanded', String(on)); };
  ub.addEventListener('click', () => setMenu(panel.hidden));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', (e) => { if (!panel.hidden && !um.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  const doLogout = async () => { bell?.destroy(); bell = null; clearInterval(clockTimer); await auth.signOut(); location.hash = ''; boot(); };
  $('#logout').addEventListener('click', doLogout);
  $('#logout-btn').addEventListener('click', doLogout);
  // วันที่-เวลาปัจจุบัน (จอกว้าง) และสถานะออนไลน์
  clearInterval(clockTimer);
  const tick = () => {
    const d = new Date();
    $('#tb-clock').textContent = `${d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })} · ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} น.`;
  };
  tick(); clockTimer = setInterval(tick, 1000);
  const net = () => { const on = navigator.onLine; const el = $('#tb-online'); el.className = `tb-online ${on ? 'on' : 'off'}`; el.textContent = on ? 'ออนไลน์' : 'ออฟไลน์'; };
  window.addEventListener('online', net); window.addEventListener('offline', net); net();
}
let clockTimer = null;

const lastTab = (g) => { try { return sessionStorage.getItem(TAB_KEY + g) || ''; } catch { return ''; } };
const saveTab = (g, h) => { try { sessionStorage.setItem(TAB_KEY + g, h); } catch { /* */ } };

/** วาดเมนูหลัก (ซ้าย/แถบล่าง) ตามงาน + แท็บหน้าย่อยของเมนูปัจจุบัน */
function drawNav(me, group, page) {
  // เมนูชี้ไปแท็บล่าสุดที่ใช้ในกลุ่มนั้น (ครั้งแรก = แท็บแรก)
  const groups = groupsFor(me).map(([g, t, ic]) => {
    const tabs = tabsOf(me, g).map((p) => p[0]);
    return { g, t, ic, href: tabs.includes(lastTab(g)) ? lastTab(g) : tabs[0] };
  });
  $('#side-nav').innerHTML = groups.map((x) => `<a href="#${x.href}" data-v="${x.g}">${icon(x.ic)}<span>${labelHtml(x.t)}</span></a>`).join('')
    + `<div class="sec"></div>${SIBLINGS.map((x) => `<a href="${esc(x.url)}" class="ext">${icon('link')}<span>${esc(x.name)}</span></a>`).join('')}`;
  const tabs = tabsOf(me, group);
  $('#ptabs').innerHTML = tabs.length > 1 ? tabs.map(([h, t]) => `<a href="#${h}" class="${h === page ? 'on' : ''}"${h === page ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('') : '';
  const fresh = document.createElement('div'); fresh.id = 'bnav-root';
  $('#bnav-root').replaceWith(fresh);
  const keys = groups.map((x) => x.g);
  navCtl = mountNav(fresh, { labels: Object.fromEntries(groups.map((x) => [x.g, x.t])), icons: Object.fromEntries(groups.map((x) => [x.g, x.ic])),
    hrefs: Object.fromEntries(groups.map((x) => [x.g, x.href])), bar: keys.length <= 5 ? keys : keys.slice(0, 4), more: keys.length <= 5 ? [] : keys.slice(4) });   // มือถือ: ทางเข้า WL อยู่ในเมนูผู้ใช้มุมขวาบนแล้ว
  navCtl.setView(group);
  $('#ptabs a.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });   // มือถือ: แท็บที่เลือกไม่หลุดขอบ
  $$('#side-nav a[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === group));
}

let ctx = null;
async function route() {
  if (!ctx) return;
  const { me } = ctx;
  const pages = pagesFor(me);
  const h = location.hash.slice(1).split('?')[0];
  const item = pages.find((p) => p[0] === h) || pages[0];
  saveTab(item[2], item[0]);
  drawNav(me, item[2], item[0]);
  $('#tb-page').textContent = item[0] === 'home' ? BRAND.name : item[1];
  const view = $('#view');
  $('#tt-line').textContent = ctx.tt ? `ตารางสอน: ปีการศึกษา ${ctx.tt.academic_year} ภาคเรียนที่ ${ctx.tt.term} · ${ctx.tt.name}` : 'ยังไม่มีตารางสอน';
  if (item[4] && !ctx.tt) {
    view.innerHTML = `<h2>${esc(item[1])}</h2><div class="card"><p>ยังไม่มีตารางสอนในระบบ ${me.duties.includes('academic') || me.duties.includes('admin') ? 'กรุณานำเข้าตารางสอนก่อน' : 'กรุณาแจ้งฝ่ายวิชาการ'}</p></div>`;
    return;
  }
  view.innerHTML = '<div class="loading" role="status"><i class="bar"></i><span>กำลังโหลด…</span></div>';
  try { await VIEWS[item[0]](view, ctx); } catch (e) { console.error(e); view.innerHTML = `<div class="card"><p class="warn">${esc(e.message)}</p></div>`; }
  fitHeroTitles(view);
  window.scrollTo(0, 0); $('.main')?.scrollTo(0, 0);   // มือถือ: .main เป็นตัวเลื่อน
}

window.addEventListener('resize', () => fitHeroTitles());
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
