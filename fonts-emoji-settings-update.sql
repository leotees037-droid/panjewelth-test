-- ============================================================
-- LUXENAME — คลังฟอนต์ (อัปโหลดเองได้) + คลังอิโมจิแบบรูปภาพ (อัปโหลดเองได้)
-- + ตั้งค่าจำนวนตัวอักษรสูงสุดของข้อความสลัก
-- รันไฟล์นี้ "ต่อจาก" preview-shapes-remove-ring-band.sql
-- รันซ้ำได้ ไม่พัง
-- ============================================================

-- ============================================================
-- 1) ฟอนต์ที่แอดมินอัปโหลดเอง (.woff/.woff2/.ttf/.otf)
--    ฟอนต์ตั้งต้น (Classic/Elegant/Modern) ฝังอยู่ในโค้ดอยู่แล้ว ไม่ต้องเก็บในตารางนี้
-- ============================================================
create table if not exists fonts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_url text not null,
  storage_path text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table fonts enable row level security;
drop policy if exists "public read active fonts" on fonts;
drop policy if exists "admin read all fonts" on fonts;
drop policy if exists "admin write fonts" on fonts;

create policy "public read active fonts" on fonts for select to anon using (active = true);
create policy "admin read all fonts" on fonts for select to authenticated using (true);
create policy "admin write fonts" on fonts for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('fonts', 'fonts', true) on conflict (id) do nothing;

drop policy if exists "public read fonts-bucket" on storage.objects;
drop policy if exists "admin upload fonts-bucket" on storage.objects;
drop policy if exists "admin update fonts-bucket" on storage.objects;
drop policy if exists "admin delete fonts-bucket" on storage.objects;

create policy "public read fonts-bucket" on storage.objects for select to public using (bucket_id = 'fonts');
create policy "admin upload fonts-bucket" on storage.objects for insert to authenticated with check (bucket_id = 'fonts');
create policy "admin update fonts-bucket" on storage.objects for update to authenticated using (bucket_id = 'fonts');
create policy "admin delete fonts-bucket" on storage.objects for delete to authenticated using (bucket_id = 'fonts');

-- ============================================================
-- 2) อิโมจิแบบรูปภาพที่แอดมินอัปโหลดเอง (ลูกค้าเลือกจากคลังนี้เท่านั้น พิมพ์เองไม่ได้)
-- ============================================================
create table if not exists emoji_assets (
  id uuid primary key default gen_random_uuid(),
  name text,
  image_url text not null,
  storage_path text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table emoji_assets enable row level security;
drop policy if exists "public read active emojis" on emoji_assets;
drop policy if exists "admin read all emojis" on emoji_assets;
drop policy if exists "admin write emojis" on emoji_assets;

create policy "public read active emojis" on emoji_assets for select to anon using (active = true);
create policy "admin read all emojis" on emoji_assets for select to authenticated using (true);
create policy "admin write emojis" on emoji_assets for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('emojis', 'emojis', true) on conflict (id) do nothing;

drop policy if exists "public read emojis-bucket" on storage.objects;
drop policy if exists "admin upload emojis-bucket" on storage.objects;
drop policy if exists "admin update emojis-bucket" on storage.objects;
drop policy if exists "admin delete emojis-bucket" on storage.objects;

create policy "public read emojis-bucket" on storage.objects for select to public using (bucket_id = 'emojis');
create policy "admin upload emojis-bucket" on storage.objects for insert to authenticated with check (bucket_id = 'emojis');
create policy "admin update emojis-bucket" on storage.objects for update to authenticated using (bucket_id = 'emojis');
create policy "admin delete emojis-bucket" on storage.objects for delete to authenticated using (bucket_id = 'emojis');

-- ============================================================
-- 3) ตั้งค่าระบบ (ตอนนี้มีแค่จำนวนตัวอักษรสูงสุดของข้อความสลัก) — เก็บเป็นแถวเดียว id = 1
-- ============================================================
create table if not exists app_settings (
  id integer primary key default 1,
  max_text_length integer not null default 20,
  updated_at timestamptz not null default now()
);

insert into app_settings (id, max_text_length) values (1, 20) on conflict (id) do nothing;

alter table app_settings enable row level security;
drop policy if exists "public read app_settings" on app_settings;
drop policy if exists "admin write app_settings" on app_settings;

create policy "public read app_settings" on app_settings for select to anon using (true);
create policy "admin write app_settings" on app_settings for all to authenticated using (true) with check (true);

-- ============================================================
-- 4) เปิด Realtime (รันซ้ำแล้วอาจ error ว่า "already member" ได้ ข้ามไปได้เลย)
-- ============================================================
alter publication supabase_realtime add table fonts;
alter publication supabase_realtime add table emoji_assets;
alter publication supabase_realtime add table app_settings;
