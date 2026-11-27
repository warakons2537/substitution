// ทดสอบ supabase/schema.sql บน Postgres จำลองในเครื่อง (PGlite) — ไม่แตะ Supabase จริง
// ติดตั้งครั้งแรก: cd tests/sql && npm install · รัน: node tests/sql/sql.test.mjs
// จำลองส่วนของ Supabase ที่ schema ใช้: บทบาท anon/authenticated · auth.users · auth.uid() · public.profiles · public.is_admin()
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const schema = readFileSync(new URL('../../supabase/schema.sql', here), 'utf8');

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated;
create schema extensions;
create table auth.users (id uuid primary key, email text, encrypted_password text, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', (select email from auth.users where id = auth.uid())) $$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
create table public.profiles (id uuid primary key references auth.users(id), email text, full_name text default '', role text default 'user');
create function public.is_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
create publication supabase_realtime;
`;

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUB);
const notices = [];
try {
  await db.exec(schema);
  await db.exec(schema);   // ต้องรันซ้ำได้
} catch (e) {
  console.error('รัน schema.sql ไม่ผ่าน:', e.message, e.position ? `(ตำแหน่ง ${e.position}: ${schema.slice(e.position - 120, e.position + 60)})` : '');
  process.exit(1);
}

// ---------------------------------------------------------------------
// ผู้ใช้จำลอง: ฝ่ายวิชาการ 1 · ครู 3 (ก ลา · ข/ค สอนแทน)
// ---------------------------------------------------------------------
const U = { academic: '00000000-0000-0000-0000-00000000000a', ka: '00000000-0000-0000-0000-0000000000a1',
  kb: '00000000-0000-0000-0000-0000000000b2', kc: '00000000-0000-0000-0000-0000000000c3', other: '00000000-0000-0000-0000-0000000000d4' };
const TEACHER = { ka: 'ครูก', kb: 'ครูข', kc: 'ครูค', other: 'ครูง' };
for (const [k, id] of Object.entries(U)) {
  await db.query('insert into auth.users values ($1, $2)', [id, `${k}@test`]);
  await db.query('insert into public.profiles (id, email) values ($1, $2)', [id, `${k}@test`]);
}
await db.query(`insert into public.sub_users (user_id, role, duties, teacher_name) values ($1, 'academic', '{academic}', '')`, [U.academic]);
for (const k of ['ka', 'kb', 'kc', 'other']) await db.query(`insert into public.sub_users (user_id, role, duties, teacher_name) values ($1, 'requester', '{}', $2)`, [U[k], TEACHER[k]]);

/** รันคำสั่งในนามผู้ใช้ (บทบาท authenticated + auth.uid()) ภายใน transaction เดียว */
async function as(who, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [U[who]]);
    await tx.exec('set local role authenticated');
    return (await tx.query(sql, params)).rows;
  });
}
const sys = async (sql, params = []) => (await db.query(sql, params)).rows;
const notifs = async (who) => (await sys('select kind, title, body from public.sub_notifications where user_id = $1 order by id', [U[who]]));
const clearNotifs = () => sys('delete from public.sub_notifications');

let n = 0; const t = async (name, fn) => { await fn(); n += 1; console.log('✓', name); };
const day = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };
const D1 = day(7); const D2 = day(8);
const row = (date, p, sub, extra = {}) => ({ sub_date: date, academic_year: 2569, term: 2, period: p, absent_teacher: 'ครูก',
  leave_type: 'ลากิจ', grade: 'ป.2/1', subject: 'คณิต', substitute_teacher: sub, note: '', status: 'confirmed', source: 'request', ...extra });
const req = { teacher_name: 'ครูก', date_from: D1, date_to: D2, periods: [], leave_type: 'ลากิจ', reason: 'ธุระ', contact: '', status: 'approved', decision_note: '' };
const recsOf = (id) => sys('select sub_date::text d, period p, substitute_teacher s, ack_at, created_by from public.sub_records where request_id = $1 order by sub_date, period', [id]);

// ---------------------------------------------------------------------
let reqId;
await t('ยื่นคำขอ + รายการสอนแทนในคำสั่งเดียว (sub_submit_request) · ครูสอนแทนได้แจ้งเตือน', async () => {
  const [r] = await as('ka', 'select public.sub_submit_request($1, $2) j', [req, JSON.stringify([row(D1, 1, 'ครูข'), row(D1, 2, 'ครูค'), row(D2, 1, '')])]);
  reqId = r.j.id;
  assert.equal(r.j.reason, undefined, 'ไม่คืนเหตุผลการลา');
  assert.equal((await recsOf(reqId)).length, 3);
  assert.equal((await sys('select count(*)::int c from public.sub_leaves where request_id = $1', [reqId]))[0].c, 1, 'ลงทะเบียนการลาด้วย');
  assert.equal((await notifs('kb')).filter((x) => x.kind === 'sub_assigned').length, 1);
});

await t('ยื่นคำขอแทนครูคนอื่นไม่ได้ (RLS) และไม่เหลือข้อมูลค้าง', async () => {
  const before = (await sys('select count(*)::int c from public.sub_requests'))[0].c;
  await assert.rejects(as('kb', 'select public.sub_submit_request($1, $2)', [req, '[]']));
  assert.equal((await sys('select count(*)::int c from public.sub_requests'))[0].c, before);
});

await t('ครูสอนแทนซ้อนคาบ -> ย้อนกลับทั้งคำขอ (ไม่เหลือคำขอที่ไม่มีรายการ)', async () => {
  const before = (await sys('select count(*)::int c from public.sub_requests'))[0].c;
  const other = { ...req, teacher_name: 'ครูง' };
  await assert.rejects(as('other', 'select public.sub_submit_request($1, $2)', [other, JSON.stringify([row(D1, 1, 'ครูข', { absent_teacher: 'ครูง' })])]), /sub_records_no_double/);
  assert.equal((await sys('select count(*)::int c from public.sub_requests'))[0].c, before);
});

await t('รอบ 11: ครูว่างสอนแทน 2 ห้องในคาบเดียวกันได้เมื่อรายการที่ 2 เป็นคาบคู่ · ห้องที่ 3 ไม่ได้', async () => {
  const D9 = day(20);
  const ins = (absent, note) => sys(`insert into public.sub_records (sub_date, academic_year, term, period, absent_teacher, substitute_teacher, note)
    values ($1, 2569, 2, 3, $2, 'ครูจ', $3)`, [D9, absent, note]);
  await ins('ครูก', '');
  await assert.rejects(ins('ครูง', 'ทำใบงาน'), /sub_records_no_double/);
  await ins('ครูง', 'คาบคู่ (สอน ป.2/1 คณิต อยู่)');
  await assert.rejects(ins('ครูข', 'คาบคู่'), /sub_records_no_double/);
  await sys('delete from public.sub_records where sub_date = $1', [D9]);
});

await t('อนุมัติ: คาบที่ครูคนเดิมยังรับทราบอยู่ · เปลี่ยนตัว = แจ้งยกเลิกคนเดิม + แจ้งคนใหม่ · สลับตัวสองคาบได้', async () => {
  const ids = (await sys('select id from public.sub_records where request_id = $1 and substitute_teacher = $2', [reqId, 'ครูข'])).map((x) => x.id);
  await as('kb', 'select public.sub_ack($1)', [ids]);
  await clearNotifs();
  // คาบ D1/1 ครูข คงเดิม · D2/1 จากว่าง -> ครูค
  await as('academic', 'select public.sub_decide_request($1, $2, $3, $4)', [reqId, 'approved', 'ok',
    JSON.stringify([row(D1, 1, 'ครูข'), row(D1, 2, 'ครูค'), row(D2, 1, 'ครูค')])]);
  let r = await recsOf(reqId);
  assert.ok(r.find((x) => x.d === D1 && x.p === 1).ack_at, 'ยังรับทราบอยู่');
  assert.equal((await notifs('kb')).length, 0, 'ครูข ไม่ถูกแจ้งซ้ำ');
  // สลับ D1/1 กับ D1/2 (ครูข <-> ครูค) ในครั้งเดียว
  await clearNotifs();
  await as('academic', 'select public.sub_decide_request($1, $2, $3, $4)', [reqId, 'approved', '',
    JSON.stringify([row(D1, 1, 'ครูค'), row(D1, 2, 'ครูข'), row(D2, 1, 'ครูค')])]);
  r = await recsOf(reqId);
  assert.equal(r.find((x) => x.d === D1 && x.p === 1).s, 'ครูค');
  assert.equal(r.find((x) => x.d === D1 && x.p === 1).ack_at, null, 'เปลี่ยนตัวต้องรับทราบใหม่');
  const kinds = (await notifs('kb')).map((x) => x.kind);
  assert.ok(kinds.includes('sub_cancelled') && kinds.includes('sub_assigned'), `ครูข ได้ทั้งยกเลิกและมอบหมาย: ${kinds}`);
  assert.equal((await sys('select status from public.sub_requests where id = $1', [reqId]))[0].status, 'approved');
});

await t('ครูทั่วไปเรียก sub_decide_request ไม่ได้', async () => {
  await assert.rejects(as('ka', 'select public.sub_decide_request($1, $2, $3, $4)', [reqId, 'approved', '', '[]']), /permission denied/);
});

await t('sub_rank_data: ครูทั่วไปไม่เห็นรหัส/การรับทราบของคนอื่น · ช่วงวันที่ · ฝ่ายวิชาการเห็นครบ', async () => {
  const [{ j: mine }] = await as('other', 'select public.sub_rank_data() j');
  assert.ok(mine.records.length >= 3);
  assert.ok(mine.records.every((r) => !('i' in r) && !('k' in r) && !('n' in r)), 'ไม่มี i/k/n ของคนอื่น');
  assert.ok(mine.records.every((r) => 'du' in r && 'lt' in r));
  const [{ j: kb }] = await as('kb', 'select public.sub_rank_data() j');
  assert.ok(kb.records.filter((r) => r.s === 'ครูข').every((r) => 'i' in r && 'n' in r), 'ของตัวเองมีรหัส (กดรับทราบได้) และงานที่มอบหมาย');
  // ทะเบียนการลาที่ไม่มีคำขอ (งานบุคคลบันทึกแทน) ต้องอยู่ในข้อมูลจัดอันดับ — มีแค่ใคร/วัน/ครึ่งวัน
  await sys(`insert into public.sub_leaves (teacher_name, leave_type, date_from, date_to, reason) values ('ครูค', 'ลาป่วย', $1, $1, 'ไข้')`, [D1]);
  const [{ j: m2 }] = await as('other', 'select public.sub_rank_data() j');
  const lv = m2.leaves.find((l) => l.t === 'ครูค');
  assert.ok(lv && lv.from === D1, 'มีทะเบียนการลา');
  assert.deepEqual(Object.keys(lv).sort(), ['from', 'h', 't', 'to'], 'ไม่มีประเภท/เหตุผล');
  const [{ j: ac }] = await as('academic', 'select public.sub_rank_data($1::date) j', [day(30)]);
  assert.equal(ac.records.length, 0, 'ตัดตามวันเริ่ม');
  assert.equal(ac.requests.length, 0);
  const [{ j: ac2 }] = await as('academic', 'select public.sub_rank_data() j');
  assert.ok(ac2.records.every((r) => 'i' in r));
});

await t('ลบรายการ -> แจ้งยกเลิกครูสอนแทน (คาบที่ผ่านไปแล้วไม่แจ้ง)', async () => {
  await sys(`insert into public.sub_records (sub_date, academic_year, term, period, absent_teacher, substitute_teacher, source)
             values ($1, 2569, 2, 5, 'ครูง', 'ครูข', 'manual'), ($2, 2569, 2, 5, 'ครูง', 'ครูข', 'manual')`, [day(3), day(-3)]);
  await clearNotifs();
  await as('academic', `delete from public.sub_records where absent_teacher = 'ครูง' and period = 5`);
  const c = (await notifs('kb')).filter((x) => x.kind === 'sub_cancelled');
  assert.equal(c.length, 1);
});

await t('ยกเลิกคำขอ: ลบรายการทั้งหมด รวมที่ฝ่ายวิชาการเพิ่มให้ · คนอื่นยกเลิกไม่ได้', async () => {
  // ฝ่ายวิชาการเพิ่มคาบให้ (created_by = ฝ่ายวิชาการ)
  await as('academic', 'select public.sub_decide_request($1, $2, $3, $4)', [reqId, 'approved', '',
    JSON.stringify([row(D1, 1, 'ครูค'), row(D1, 2, 'ครูข'), row(D2, 1, 'ครูค'), row(D2, 2, 'ครูข')])]);
  assert.ok((await recsOf(reqId)).some((x) => x.created_by === U.academic));
  await assert.rejects(as('kb', 'select public.sub_cancel_request($1)', [reqId]), /ยกเลิกคำขอนี้ไม่ได้/);
  await clearNotifs();
  await as('ka', 'select public.sub_cancel_request($1)', [reqId]);
  assert.equal((await recsOf(reqId)).length, 0);
  assert.equal((await sys('select status from public.sub_requests where id = $1', [reqId]))[0].status, 'cancelled');
  assert.equal((await sys('select status from public.sub_leaves where request_id = $1', [reqId]))[0].status, 'cancelled', 'ทะเบียนการลายกเลิกตาม');
  assert.ok((await notifs('kb')).some((x) => x.kind === 'sub_cancelled'));
  await assert.rejects(as('ka', 'select public.sub_cancel_request($1)', [reqId]), /ยกเลิกคำขอนี้ไม่ได้/, 'ยกเลิกซ้ำไม่ได้');
});

await t('กติกาคาบคู่: ฝ่ายวิชาการบันทึกได้ · ครูทั่วไปไม่ได้', async () => {
  await as('academic', 'select public.sub_dual_save($1, $2, $3, $4)', ['ป1,ป2', false, 1, null]);
  const [s] = await sys('select dual_grades, dual_both_small, dual_max_dist, dual_max_day from public.sub_settings');
  assert.deepEqual(s, { dual_grades: 'ป1,ป2', dual_both_small: false, dual_max_dist: 1, dual_max_day: null });
  await assert.rejects(as('ka', 'select public.sub_dual_save($1, $2, $3, $4)', ['', true, null, 2]), /permission denied/);
});

await t('เตือนรับทราบซ้ำ: นับครูที่ยังไม่รับทราบ · ครูทั่วไปเรียกไม่ได้', async () => {
  await sys(`insert into public.sub_records (sub_date, academic_year, term, period, absent_teacher, substitute_teacher, source)
             values ($1, 2569, 2, 6, 'ครูง', 'ครูข', 'manual'), ($1, 2569, 2, 7, 'ครูง', 'ครูค', 'manual')`, [day(1)]);
  const ids = (await sys(`select id from public.sub_records where absent_teacher = 'ครูง' and period in (6, 7)`)).map((x) => x.id);
  await clearNotifs();
  const [{ n: sent }] = await as('academic', 'select public.sub_renotify($1) n', [ids]);
  assert.equal(sent, 2);
  assert.equal((await notifs('kc')).length, 1);
  await assert.rejects(as('ka', 'select public.sub_renotify($1)', [ids]), /permission denied/);
});

await t('ผู้ดูแลตั้งรหัสผ่านใหม่ให้ครู · บันทึกการใช้งานไม่เก็บรหัส · คนอื่น/บัญชีผู้ดูแล WL Admin ตั้งไม่ได้', async () => {
  await sys(`update public.sub_users set role = 'admin', duties = '{admin}' where user_id = $1`, [U.other]);
  await as('other', 'select public.sub_admin_set_password($1, $2)', [U.ka, 'NewPass#123']);
  const [{ ok }] = await sys(`select encrypted_password = extensions.crypt('NewPass#123', encrypted_password) ok from auth.users where id = $1`, [U.ka]);
  assert.ok(ok, 'รหัสผ่านใหม่ใช้ได้');
  const [a] = await sys(`select row_id, new_data::text j from public.sub_audit where tbl = 'auth_password' order by id desc limit 1`);
  assert.equal(a.row_id, U.ka);
  assert.ok(!a.j.includes('NewPass'), 'ไม่เก็บตัวรหัสผ่าน');
  await assert.rejects(as('other', 'select public.sub_admin_set_password($1, $2)', [U.ka, '123']), /อย่างน้อย 6/);
  await assert.rejects(as('ka', 'select public.sub_admin_set_password($1, $2)', [U.kb, 'Another#1']), /permission denied/);
  await assert.rejects(as('academic', 'select public.sub_admin_set_password($1, $2)', [U.kb, 'Another#1']), /permission denied/);
  await sys(`update public.profiles set role = 'admin' where id = $1`, [U.kb]);
  await assert.rejects(as('other', 'select public.sub_admin_set_password($1, $2)', [U.kb, 'Another#1']), /ผู้ดูแล WL Admin/);
  await sys(`update public.profiles set role = 'user' where id = $1`, [U.kb]);
  await sys(`update public.sub_users set role = 'requester', duties = '{}' where user_id = $1`, [U.other]);
});

console.log(`\nผ่าน ${n} ข้อ (SQL บน PGlite)`);
