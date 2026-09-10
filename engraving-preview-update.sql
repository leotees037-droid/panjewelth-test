-- ============================================================
-- LUXENAME — ระบบพรีวิวสลัก 2D + เปิด/ปิดฟีเจอร์ (ข้อความ/อิโมจิ/รูปภาพ) ต่อสินค้า
-- รันไฟล์นี้ "ต่อจาก" storage-and-images-update.sql และ option-value-images-update.sql
-- รันซ้ำได้ ไม่พัง (ใช้ if not exists / on conflict ทั้งหมด)
-- ============================================================

-- 1) เปิด/ปิดฟีเจอร์การสลักต่อสินค้า (แอดมินตั้งค่าได้ในฟอร์มแก้ไขสินค้า)
alter table products add column if not exists allow_text  boolean not null default true;
alter table products add column if not exists allow_emoji boolean not null default true;
alter table products add column if not exists allow_image boolean not null default false;

-- 2) ตำแหน่ง/ขนาดกรอบพรีวิวบนรูปสินค้าหลัก (% ของความกว้าง/สูงรูป 0-100)
--    ตั้งค่าเริ่มต้นเป็นกรอบกลางรูปแบบกว้างๆ แอดมินลากปรับได้ในแท็บ "พื้นที่พรีวิว"
alter table products add column if not exists engrave_x numeric not null default 20;
alter table products add column if not exists engrave_y numeric not null default 40;
alter table products add column if not exists engrave_w numeric not null default 60;
alter table products add column if not exists engrave_h numeric not null default 20;

-- 3) bucket แยกสำหรับรูปที่ "ลูกค้า" อัปโหลดตอนออกแบบสินค้า (ไม่ต้องล็อกอิน)
--    แยกจาก bucket product-images เดิม (ซึ่งจำกัดให้อัปโหลดได้เฉพาะแอดมิน/authenticated เท่านั้น)
insert into storage.buckets (id, name, public)
values ('engravings', 'engravings', true)
on conflict (id) do nothing;

drop policy if exists "public read engravings" on storage.objects;
drop policy if exists "public upload engravings" on storage.objects;

-- ทุกคนดูรูปที่ลูกค้าอัปโหลดได้ (ต้อง public เพื่อโชว์ในหน้าแอดมิน/ออเดอร์)
create policy "public read engravings"
on storage.objects for select
to public
using (bucket_id = 'engravings');

-- อนุญาตให้ "anon" (ลูกค้าที่ไม่ได้ล็อกอิน) อัปโหลดรูปตอนสั่งซื้อได้ — เหมือน bucket "slips" เดิม
create policy "public upload engravings"
on storage.objects for insert
to anon
with check (bucket_id = 'engravings');
