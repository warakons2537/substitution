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

-- รายชื่อบัญชีทั้งหมด (จาก WL Admin) + สิทธิ์ในระบบสอนแทน — เฉพาะผู้ดูแลระบบ
create or replace function public.sub_list_users()
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
