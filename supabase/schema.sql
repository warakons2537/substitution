-- =====================================================================
--  WL Substitution System (ระบบจัดการสอนแทน บ้านวังลึก (ย.น.)) — รอบ 1
--  รันใน SQL Editor ของ "โปรเจกต์เดียวกับ WL Admin" (ต้องมี public.profiles และ public.is_admin() อยู่แล้ว)
--  รันซ้ำได้ ไม่แตะตารางของ WL Admin  ทุกตารางขึ้นต้นด้วย sub_ และเปิด RLS
-- =====================================================================

-- 1) สิทธิ์ผู้ใช้ของระบบสอนแทน
create table if not exists public.sub_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('admin','academic','requester')),
  teacher_name text not null default '',
  updated_at   timestamptz not null default now()
);
comment on column public.sub_users.role is 'admin = ผู้ดูแลระบบ, academic = ฝ่ายวิชาการ, requester = ผู้ขอลา';

-- 2) ตารางสอนที่นำเข้าจาก WL Scheduler (เก็บทั้งชุดเป็น jsonb)
create table if not exists public.sub_timetables (
  id            uuid primary key default gen_random_uuid(),
  academic_year int  not null,
  term          int  not null check (term in (1,2,3)),
  name          text not null default '',
  source        text not null default 'json',
  data          jsonb not null,
  is_active     boolean not null default false,
  imported_by   uuid default auth.uid(),
  imported_at   timestamptz not null default now()
);
create unique index if not exists sub_timetables_one_active on public.sub_timetables (is_active) where is_active;

-- 3) คำขอลา/ขอสอนแทน จากผู้ขอลา
create table if not exists public.sub_requests (
  id            uuid primary key default gen_random_uuid(),
  teacher_name  text not null,
  date_from     date not null,
  date_to       date not null,
  periods       int[] not null default '{}',      -- ว่าง = ทั้งวัน
  leave_type    text not null default 'ไม่ระบุ',
  reason        text not null default '',
  status        text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by  uuid default auth.uid() references auth.users(id) on delete set null,
  decided_by    uuid references auth.users(id) on delete set null,
  decided_at    timestamptz,
  decision_note text not null default '',
  created_at    timestamptz not null default now(),
  check (date_to >= date_from)
);

-- 4) รายการสอนแทน (1 แถว = 1 คาบ)
create table if not exists public.sub_records (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid references public.sub_requests(id) on delete cascade,
  sub_date           date not null,
  academic_year      int  not null,
  term               int  not null,
  period             int  not null check (period between 1 and 12),
  absent_teacher     text not null,
  leave_type         text not null default 'ไม่ระบุ',
  grade              text not null default '',
  subject            text not null default '',
  substitute_teacher text not null default '',     -- ว่าง = ไม่ต้องสอนแทน
  status             text not null default 'confirmed' check (status in ('proposed','confirmed')),
  source             text not null default 'manual' check (source in ('assist','manual','request')),
  note               text not null default '',
  created_by         uuid default auth.uid() references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists sub_records_date on public.sub_records (sub_date);
create index if not exists sub_records_req  on public.sub_records (request_id);
-- ครูคนเดียวสอนแทน 2 ห้องในคาบเดียวกันไม่ได้
create unique index if not exists sub_records_no_double on public.sub_records (sub_date, period, substitute_teacher)
  where substitute_teacher <> '' and status = 'confirmed';

-- 5) ข้อมูลครูสำหรับแบบพิมพ์ (กรอกเองที่หน้า "ข้อมูลของฉัน")
alter table public.sub_users add column if not exists full_name      text not null default '';  -- มีคำนำหน้า เช่น นายวรากร ตรงต่อกิจ
alter table public.sub_users add column if not exists position       text not null default '';  -- ใช้ในใบลา เช่น ครูชำนาญการ
alter table public.sub_users add column if not exists position_short text not null default '';  -- ใช้ในบันทึกการสอนแทน เช่น ครู คศ.2
alter table public.sub_users add column if not exists phone          text not null default '';
alter table public.sub_requests add column if not exists contact     text not null default '';  -- ระหว่างลาติดต่อได้ที่

-- 6) ตั้งค่าแบบพิมพ์ (มีแถวเดียว)
create table if not exists public.sub_settings (
  id                 int primary key default 1 check (id = 1),
  district           text not null default '',
  area_office        text not null default '',
  personnel_name     text not null default '',
  personnel_position text not null default 'หัวหน้าฝ่ายบริหารงานบุคคล',
  academic_name      text not null default '',
  academic_position  text not null default 'หัวหน้าบริหารงานวิชาการ',
  director_name      text not null default '',
  director_position  text not null default 'ผู้อำนวยการโรงเรียนบ้านวังลึก(ยุวนาฏชนูทิศ)',
  updated_at         timestamptz not null default now()
);
insert into public.sub_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- ฟังก์ชันสิทธิ์
-- ---------------------------------------------------------------------
-- ผู้ดูแลของ WL Admin (profiles.role = 'admin') เป็นผู้ดูแลระบบสอนแทนโดยอัตโนมัติ ถ้ายังไม่ได้กำหนดสิทธิ์ไว้
create or replace function public.sub_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.sub_users where user_id = auth.uid()),
                  case when public.is_admin() then 'admin' end)
$$;
create or replace function public.sub_is_admin() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(public.sub_role() = 'admin', false) $$;
create or replace function public.sub_is_staff() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(public.sub_role() in ('admin','academic'), false) $$;
create or replace function public.sub_is_member() returns boolean
language sql stable security definer set search_path = public as $$ select public.sub_role() is not null $$;
create or replace function public.sub_my_teacher() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select teacher_name from public.sub_users where user_id = auth.uid()), '')
$$;

-- บันทึกข้อมูลครูของตัวเอง (แก้สิทธิ์/ชื่อครูในตารางสอนไม่ได้)
create or replace function public.sub_save_profile(p_full_name text, p_position text, p_position_short text, p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare r text := public.sub_role();
begin
  if r is null then raise exception 'ไม่มีสิทธิ์ทำรายการนี้'; end if;
  insert into public.sub_users (user_id, role, full_name, position, position_short, phone)
  values (auth.uid(), r, coalesce(p_full_name,''), coalesce(p_position,''), coalesce(p_position_short,''), coalesce(p_phone,''))
  on conflict (user_id) do update set full_name = excluded.full_name, position = excluded.position,
    position_short = excluded.position_short, phone = excluded.phone;
end $$;

-- ข้อมูลสำหรับจัดอันดับครูสอนแทน (ไม่ส่งประเภทการลา/เหตุผลของคนอื่น)
create or replace function public.sub_rank_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.sub_is_member() then null else jsonb_build_object(
    'records', coalesce((select jsonb_agg(jsonb_build_object(
        'd', sub_date, 'p', period, 'a', absent_teacher, 's', substitute_teacher, 'st', status, 'r', request_id))
      from public.sub_records), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 't', teacher_name, 'from', date_from, 'to', date_to, 'periods', periods))
      from public.sub_requests where status in ('pending','approved')), '[]'::jsonb)
  ) end
$$;

-- รายชื่อบัญชีทั้งหมด (จาก WL Admin) + สิทธิ์ในระบบสอนแทน — เฉพาะผู้ดูแลระบบ (ถูกแทนด้วยรุ่นใหม่ในส่วนรอบ 2 ด้านล่าง)
drop function if exists public.sub_list_users();
create function public.sub_list_users()
returns table (user_id uuid, email text, full_name text, role text, teacher_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.full_name, s.role, s.teacher_name
  from public.profiles p left join public.sub_users s on s.user_id = p.id
  where public.sub_is_admin()
  order by p.full_name, p.email
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.sub_users      enable row level security;
alter table public.sub_timetables enable row level security;
alter table public.sub_requests   enable row level security;
alter table public.sub_records    enable row level security;
alter table public.sub_settings   enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('sub_users','sub_timetables','sub_requests','sub_records','sub_settings') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- sub_users
create policy sub_users_read  on public.sub_users for select using (user_id = auth.uid() or public.sub_is_admin());
create policy sub_users_admin on public.sub_users for all    using (public.sub_is_admin()) with check (public.sub_is_admin());

-- sub_settings
create policy sub_set_read  on public.sub_settings for select using (public.sub_is_member());
create policy sub_set_admin on public.sub_settings for update using (public.sub_is_admin()) with check (public.sub_is_admin());

-- sub_timetables
create policy sub_tt_read  on public.sub_timetables for select using (public.sub_is_member());
create policy sub_tt_staff on public.sub_timetables for all    using (public.sub_is_staff()) with check (public.sub_is_staff());

-- sub_requests
create policy sub_req_read on public.sub_requests for select
  using (public.sub_is_staff() or requested_by = auth.uid());
create policy sub_req_insert on public.sub_requests for insert
  with check (public.sub_is_member() and requested_by = auth.uid() and status in ('pending','approved')
              and (public.sub_is_staff() or teacher_name = public.sub_my_teacher()));
create policy sub_req_staff on public.sub_requests for update
  using (public.sub_is_staff()) with check (public.sub_is_staff());
create policy sub_req_cancel on public.sub_requests for update
  using (requested_by = auth.uid() and status in ('pending','approved'))
  with check (requested_by = auth.uid() and status in ('pending','cancelled') and teacher_name = public.sub_my_teacher());
create policy sub_req_delete on public.sub_requests for delete using (public.sub_is_staff());

-- sub_records
create policy sub_rec_read on public.sub_records for select using (
  public.sub_is_staff()
  or exists (select 1 from public.sub_requests q where q.id = request_id and q.requested_by = auth.uid()));
create policy sub_rec_staff_ins on public.sub_records for insert with check (public.sub_is_staff());
create policy sub_rec_staff_upd on public.sub_records for update using (public.sub_is_staff()) with check (public.sub_is_staff());
-- ลบ: ผู้ดูแลระบบลบได้ทุกรายการ · ฝ่ายวิชาการลบได้เฉพาะรายการของคำขอ (ตอนไม่อนุมัติคำขอ)
create policy sub_rec_del on public.sub_records for delete using (
  public.sub_is_admin() or (public.sub_is_staff() and request_id is not null));
-- ผู้ขอลา: เลือกครูสอนแทนเองมีผลทันที (เฉพาะคำขอของตัวเอง)
create policy sub_rec_req_ins on public.sub_records for insert with check (
  source = 'request' and status in ('proposed','confirmed') and created_by = auth.uid()
  and absent_teacher = public.sub_my_teacher()
  and exists (select 1 from public.sub_requests q
              where q.id = request_id and q.requested_by = auth.uid() and q.status in ('pending','approved')));
-- ผู้ขอลายกเลิกคำขอของตัวเอง -> ลบรายการของคำขอนั้น
create policy sub_rec_req_del on public.sub_records for delete using (
  source = 'request' and created_by = auth.uid()
  and exists (select 1 from public.sub_requests q
              where q.id = request_id and q.requested_by = auth.uid() and q.status in ('pending','approved')));

-- updated_at
create or replace function public.sub_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists sub_records_touch on public.sub_records;
create trigger sub_records_touch before update on public.sub_records for each row execute function public.sub_touch();
drop trigger if exists sub_users_touch on public.sub_users;
create trigger sub_users_touch before update on public.sub_users for each row execute function public.sub_touch();

grant execute on function public.sub_role(), public.sub_is_admin(), public.sub_is_staff(), public.sub_is_member(),
  public.sub_my_teacher(), public.sub_rank_data(), public.sub_list_users(),
  public.sub_save_profile(text, text, text, text) to authenticated;

-- =====================================================================
--  รอบ 2 ส่วนที่ 3: Audit log (บันทึกการใช้งาน) + ข้อมูลผู้ใช้เพิ่มเติม
-- =====================================================================
create table if not exists public.sub_audit (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  user_id  uuid,
  email    text not null default '',
  tbl      text not null,
  op       text not null check (op in ('INSERT','UPDATE','DELETE')),
  row_id   text not null default '',
  old_data jsonb,
  new_data jsonb
);
create index if not exists sub_audit_at on public.sub_audit (at desc);
alter table public.sub_audit enable row level security;
drop policy if exists sub_audit_read on public.sub_audit;
-- ผู้ดูแลระบบอ่านได้อย่างเดียว (ไม่มี policy เพิ่ม/แก้/ลบ — trigger เป็นผู้เขียนเท่านั้น)
create policy sub_audit_read on public.sub_audit for select using (public.sub_is_admin());
revoke insert, update, delete, truncate on public.sub_audit from anon, authenticated;

create or replace function public.sub_audit_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; j jsonb;
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  if tg_table_name = 'sub_timetables' then o := o - 'data'; n := n - 'data'; end if;  -- ไม่เก็บก้อนตารางสอน
  if tg_op = 'UPDATE' and (o - 'updated_at') = (n - 'updated_at') then return null; end if;  -- ไม่มีอะไรเปลี่ยน
  j := coalesce(n, o);
  insert into public.sub_audit (user_id, email, tbl, op, row_id, old_data, new_data)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), tg_table_name, tg_op,
          coalesce(j ->> 'id', j ->> 'user_id', ''), o, n);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['sub_records','sub_requests','sub_users','sub_settings','sub_timetables'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.sub_audit_trg()', t || '_audit', t);
  end loop;
end $$;

-- รายชื่อผู้ใช้: เพิ่มข้อมูลแบบพิมพ์ (ชื่อ-สกุล ตำแหน่ง เบอร์โทร) เพื่อดูว่าใครยังไม่กรอก
drop function if exists public.sub_list_users();
create function public.sub_list_users()
returns table (user_id uuid, email text, full_name text, role text, teacher_name text,
               print_name text, "position" text, position_short text, phone text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.full_name, s.role, s.teacher_name, s.full_name, s.position, s.position_short, s.phone
  from public.profiles p left join public.sub_users s on s.user_id = p.id
  where public.sub_is_admin()
  order by p.full_name, p.email
$$;
grant execute on function public.sub_list_users() to authenticated;

-- =====================================================================
--  รอบ 2 ส่วนที่ 2: รายงาน — ฝ่ายวิชาการ/ผู้ดูแลพิมพ์บันทึกการสอนแทนแทนครู (ต้องใช้ชื่อ-ตำแหน่งของครูที่ลา)
-- =====================================================================
create or replace function public.sub_teacher_profiles()
returns table (teacher_name text, full_name text, position_short text)
language sql stable security definer set search_path = public as $$
  select teacher_name, full_name, position_short from public.sub_users
  where public.sub_is_staff() and teacher_name <> ''
$$;
grant execute on function public.sub_teacher_profiles() to authenticated;

-- =====================================================================
--  รอบ 3 ส่วนที่ 1: ทะเบียนการลาของครู (sub_leaves) + ประเภท/โควตา + วันหยุด
--  รันซ้ำได้ · ไม่แก้/ลบข้อมูลเดิม · คำขอลาเดิมถูกนำเข้าทะเบียนอัตโนมัติ
-- =====================================================================

-- ผูกบัญชีกับตาราง staff กลาง (WL Academic) — ผูกแบบอ่อน ไม่มี FK เพื่อให้ใช้ได้แม้ยังไม่ได้ติดตั้ง WL Academic
alter table public.sub_users add column if not exists staff_id uuid;

-- ประเภทการลา + โควตาต่อปีงบประมาณ (ว่าง = ไม่จำกัด/ไม่ตรวจ) · ผู้ดูแลระบบแก้ได้ที่เมนู "ตั้งค่า"
create table if not exists public.sub_leave_types (
  leave_type    text primary key,
  quota_days    numeric(6,1),
  calendar_days boolean not null default false,   -- true = นับวันปฏิทิน (รวมเสาร์-อาทิตย์/วันหยุด) เช่น ลาคลอด
  sort_order    int not null default 0,
  active        boolean not null default true
);
insert into public.sub_leave_types (leave_type, quota_days, calendar_days, sort_order) values
  ('ลาป่วย', null, false, 1), ('ลากิจ', null, false, 2), ('ลาพักผ่อน', 10, false, 3), ('ไปราชการ', null, false, 4),
  ('ลาคลอด', 90, true, 5), ('ลาไปช่วยเหลือภริยาที่คลอดบุตร', 15, false, 6), ('ลาอุปสมบท/ลาไปประกอบพิธีฮัจย์', 120, true, 7),
  ('ไม่ระบุ', null, false, 9)
on conflict (leave_type) do nothing;

-- วันหยุดราชการ/วันหยุดของโรงเรียน (ไม่นับเป็นวันลา ยกเว้นประเภทที่นับวันปฏิทิน)
create table if not exists public.sub_holidays (
  day  date primary key,
  name text not null default ''
);

-- จำนวนวันลา (วันทำการ จ.-ศ. หักวันหยุด · ครึ่งวัน = 0.5 · ประเภทนับวันปฏิทินนับทุกวัน)
create or replace function public.sub_leave_days(p_from date, p_to date, p_type text, p_half text)
returns numeric language sql stable set search_path = public as $$
  select case
    when p_to < p_from then 0
    when coalesce(p_half, '') <> '' then 0.5
    else coalesce((select count(*) from generate_series(p_from, p_to, interval '1 day') g(d)
      where coalesce((select calendar_days from public.sub_leave_types where leave_type = p_type), false)
         or (extract(isodow from g.d) < 6 and not exists (select 1 from public.sub_holidays h where h.day = g.d::date))), 0)
  end
$$;

-- ทะเบียนการลา (1 แถว = การลา 1 ครั้ง) · ไม่จำเป็นต้องมีการสอนแทน
create table if not exists public.sub_leaves (
  id           uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  leave_type   text not null default 'ไม่ระบุ',
  date_from    date not null,
  date_to      date not null,
  half         text not null default '' check (half in ('', 'am', 'pm')),   -- ครึ่งวันเช้า/บ่าย (ต้องลาวันเดียว)
  days         numeric(6,1) not null default 0,                              -- คำนวณโดย trigger
  reason       text not null default '',
  contact      text not null default '',
  has_cert     boolean not null default false,                               -- มีใบรับรองแพทย์
  note         text not null default '',
  status       text not null default 'approved' check (status in ('pending','approved','rejected','cancelled')),
  request_id   uuid references public.sub_requests(id) on delete set null,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (date_to >= date_from),
  check (half = '' or date_to = date_from)
);
create index if not exists sub_leaves_teacher on public.sub_leaves (teacher_name, date_from);
create index if not exists sub_leaves_from    on public.sub_leaves (date_from);
create unique index if not exists sub_leaves_request on public.sub_leaves (request_id) where request_id is not null;

create or replace function public.sub_leaves_before() returns trigger language plpgsql as $$
begin
  new.days := public.sub_leave_days(new.date_from, new.date_to, new.leave_type, new.half);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists sub_leaves_before on public.sub_leaves;
create trigger sub_leaves_before before insert or update on public.sub_leaves for each row execute function public.sub_leaves_before();

-- คำขอลา/ขอสอนแทน -> ลงทะเบียนการลาอัตโนมัติ และตามสถานะของคำขอ (แก้ไขรายการในทะเบียนเองได้ ไม่ถูกเขียนทับ ยกเว้นสถานะ)
create or replace function public.sub_leave_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.sub_leaves (teacher_name, leave_type, date_from, date_to, reason, contact, status, request_id, created_by)
    values (new.teacher_name, new.leave_type, new.date_from, new.date_to, new.reason, new.contact, new.status, new.id, new.requested_by)
    on conflict (request_id) where request_id is not null do nothing;
  else
    update public.sub_leaves set status = new.status where request_id = new.id and status <> new.status;
  end if;
  return null;
end $$;
drop trigger if exists sub_requests_leave_sync on public.sub_requests;
create trigger sub_requests_leave_sync after insert or update on public.sub_requests for each row execute function public.sub_leave_sync();

-- นำเข้าคำขอเดิมที่ยังไม่อยู่ในทะเบียน (รันซ้ำได้)
insert into public.sub_leaves (teacher_name, leave_type, date_from, date_to, reason, contact, status, request_id, created_by, created_at)
select r.teacher_name, r.leave_type, r.date_from, r.date_to, r.reason, r.contact, r.status, r.id, r.requested_by, r.created_at
from public.sub_requests r
where not exists (select 1 from public.sub_leaves l where l.request_id = r.id);

-- RLS
alter table public.sub_leave_types enable row level security;
alter table public.sub_holidays    enable row level security;
alter table public.sub_leaves      enable row level security;
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('sub_leave_types','sub_holidays','sub_leaves') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
create policy sub_lt_read  on public.sub_leave_types for select using (public.sub_is_member());
create policy sub_lt_admin on public.sub_leave_types for all    using (public.sub_is_admin()) with check (public.sub_is_admin());
create policy sub_hd_read  on public.sub_holidays    for select using (public.sub_is_member());
create policy sub_hd_admin on public.sub_holidays    for all    using (public.sub_is_admin()) with check (public.sub_is_admin());
-- ทะเบียนการลา: ฝ่ายวิชาการ/ผู้ดูแลเห็น/เพิ่ม/แก้ได้ทุกคน (ลบได้เฉพาะผู้ดูแลระบบ) · ครูเห็น/บันทึกได้เฉพาะของตัวเอง (บันทึกเองต้องรอตรวจ = pending)
create policy sub_lv_read on public.sub_leaves for select
  using (public.sub_is_staff() or teacher_name = public.sub_my_teacher() or created_by = auth.uid());
create policy sub_lv_staff_ins on public.sub_leaves for insert with check (public.sub_is_staff());
create policy sub_lv_staff_upd on public.sub_leaves for update using (public.sub_is_staff()) with check (public.sub_is_staff());
create policy sub_lv_ins on public.sub_leaves for insert
  with check (public.sub_is_member() and created_by = auth.uid() and status = 'pending' and request_id is null
              and teacher_name = public.sub_my_teacher());
create policy sub_lv_upd on public.sub_leaves for update
  using (created_by = auth.uid() and status = 'pending' and request_id is null)
  with check (created_by = auth.uid() and status = 'pending' and request_id is null and teacher_name = public.sub_my_teacher());
create policy sub_lv_del on public.sub_leaves for delete
  using (public.sub_is_admin() or (created_by = auth.uid() and status = 'pending' and request_id is null));

-- audit: เพิ่มตารางใหม่ (และรองรับตารางที่ไม่มี id)
create or replace function public.sub_audit_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; j jsonb;
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  if tg_table_name = 'sub_timetables' then o := o - 'data'; n := n - 'data'; end if;
  if tg_op = 'UPDATE' and (o - 'updated_at') = (n - 'updated_at') then return null; end if;
  j := coalesce(n, o);
  insert into public.sub_audit (user_id, email, tbl, op, row_id, old_data, new_data)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), tg_table_name, tg_op,
          coalesce(j ->> 'id', j ->> 'user_id', j ->> 'day', j ->> 'leave_type', ''), o, n);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['sub_leaves','sub_leave_types','sub_holidays'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.sub_audit_trg()', t || '_audit', t);
  end loop;
end $$;

grant execute on function public.sub_leave_days(date, date, text, text) to authenticated;
