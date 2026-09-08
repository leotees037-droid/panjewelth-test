-- ============================================================
-- LUXENAME — เพิ่มระบบอัปโหลดรูปสินค้า (Supabase Storage)
-- รันไฟล์นี้ "ต่อจาก" products-schema-v2.sql (รันแค่ครั้งเดียว หรือรันซ้ำก็ได้ ไม่พัง)
-- ============================================================

-- 1) เพิ่มคอลัมน์เก็บ path ของไฟล์ใน Storage (ไว้ใช้ตอนลบ/แทนที่รูป)
alter table product_images add column if not exists storage_path text;

-- 2) สร้าง bucket สำหรับเก็บรูปสินค้า (public อ่านได้ทุกคน)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- 3) Policy ของ storage.objects เฉพาะ bucket นี้
drop policy if exists "public read product-images" on storage.objects;
drop policy if exists "admin upload product-images" on storage.objects;
drop policy if exists "admin update product-images" on storage.objects;
drop policy if exists "admin delete product-images" on storage.objects;

-- ใครก็ดูรูปสินค้าได้ (ต้อง public เพราะหน้าร้านต้องโชว์รูปให้ลูกค้าเห็น)
create policy "public read product-images"
on storage.objects for select
to public
using (bucket_id = 'product-images');

-- เฉพาะแอดมิน (authenticated) เท่านั้นที่อัปโหลด/แก้ไข/ลบรูปได้
create policy "admin upload product-images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images');

create policy "admin update product-images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images');

create policy "admin delete product-images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images');
