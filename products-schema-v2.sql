-- ============================================================
-- LUXENAME — สคีมาสินค้าแบบเต็ม (รูปหลายรูป + รายละเอียด + ตัวเลือกย่อยหลายมิติ
-- แต่ละตัวเลือกมีราคา/สต๊อกแยกของตัวเอง)
--
-- ⚠️ ไฟล์นี้แทนที่ products-schema.sql ตัวเก่า (ตาราง products แบบเรียบง่าย)
-- ด้วยโครงสร้างใหม่ทั้งหมด ถ้าเคยรันไฟล์เก่าไปแล้วและมีข้อมูลสินค้าจริงอยู่
-- ให้บันทึกข้อมูลไว้ก่อน เพราะสคริปต์นี้จะ DROP ตาราง products เดิมทิ้ง
--
-- วิธีใช้: Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
-- ============================================================

-- 0) ล้างของเก่า (ถ้ามี) จากสคีมาเวอร์ชันก่อนหน้า
drop function if exists decrement_product_stock(text, integer);
drop table if exists products cascade;

-- 1) สินค้า (1 แถว = 1 แบบสินค้า/ดีไซน์ เช่น "สร้อยคอสลักชื่อ")
create table products (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2) รูปภาพสินค้า (หลายรูปต่อสินค้า เลื่อนดูได้)
create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0
);

-- 3) กลุ่มตัวเลือก (เช่น "โลหะ", "ความยาวสร้อย")
create table product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

-- 4) ค่าในแต่ละกลุ่มตัวเลือก (เช่น "Silver Classic","Gold Elegant" / "40 cm","45 cm")
create table product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references product_options(id) on delete cascade,
  value text not null,
  sort_order integer not null default 0
);

-- 5) ตัวแปรสินค้า (variant) = สินค้าที่ขายได้จริง 1 ชุดค่าผสมของตัวเลือก
--    มีราคา/สต๊อกของตัวเอง แยกกัน เช่น "Gold Elegant + 45 cm"
create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text unique not null,
  price numeric not null default 0,
  stock integer not null default 0,
  image_url text,             -- รูปเฉพาะของตัวเลือกนี้ (ไม่ใส่ก็ได้ จะใช้รูปสินค้าหลักแทน)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6) ตารางเชื่อม: 1 variant ประกอบด้วยค่าตัวเลือกกี่ค่า (1 ค่าต่อ 1 กลุ่มตัวเลือก)
create table variant_option_values (
  variant_id uuid not null references product_variants(id) on delete cascade,
  option_value_id uuid not null references product_option_values(id) on delete cascade,
  primary key (variant_id, option_value_id)
);

-- ============================================================
-- 7) ข้อมูลตัวอย่าง (seed) — สร้างครั้งเดียวตอนตารางยังว่าง
--    ตัวอย่าง: สร้อยคอสลักชื่อ x โลหะ 4 แบบ x ความยาว 3 แบบ = 12 ตัวเลือกย่อย
--    (แก้ไข/ลบ/เพิ่มเองได้ทั้งหมดในหน้าแอดมินภายหลัง อันนี้แค่ตั้งต้นให้)
-- ============================================================
do $$
declare
  v_product_id uuid;
  v_opt_metal uuid;
  v_opt_length uuid;
  v_val_silver uuid; v_val_gold uuid; v_val_black uuid; v_val_rose uuid;
  v_val_40 uuid; v_val_45 uuid; v_val_50 uuid;
  metals uuid[];
  metal_prices numeric[] := array[890, 1190, 990, 1090];
  metal_keys text[] := array['silver','gold','black','rose'];
  lengths uuid[];
  length_delta numeric[] := array[-50, 0, 100];
  length_keys text[] := array['40cm','45cm','50cm'];
  i int; j int;
  vid uuid;
begin
  if exists (select 1 from products where key = 'engraved-necklace') then
    return; -- เคย seed ไว้แล้ว ข้าม
  end if;

  insert into products (key, name, description, active, sort_order)
  values ('engraved-necklace', 'สร้อยคอสลักชื่อ',
    'สร้อยคอสแตนเลส 316L คุณภาพพรีเมียม สลักชื่อด้วยเลเซอร์ คมชัด ไม่ลอกไม่ดำ เลือกโลหะและความยาวได้ตามต้องการ',
    true, 1)
  returning id into v_product_id;

  insert into product_options (product_id, name, sort_order) values (v_product_id, 'โลหะ', 1) returning id into v_opt_metal;
  insert into product_options (product_id, name, sort_order) values (v_product_id, 'ความยาวสร้อย', 2) returning id into v_opt_length;

  insert into product_option_values (option_id, value, sort_order) values (v_opt_metal, 'Silver Classic', 1) returning id into v_val_silver;
  insert into product_option_values (option_id, value, sort_order) values (v_opt_metal, 'Gold Elegant', 2) returning id into v_val_gold;
  insert into product_option_values (option_id, value, sort_order) values (v_opt_metal, 'Black Luxury', 3) returning id into v_val_black;
  insert into product_option_values (option_id, value, sort_order) values (v_opt_metal, 'Rose Gold', 4) returning id into v_val_rose;

  insert into product_option_values (option_id, value, sort_order) values (v_opt_length, '40 cm', 1) returning id into v_val_40;
  insert into product_option_values (option_id, value, sort_order) values (v_opt_length, '45 cm', 2) returning id into v_val_45;
  insert into product_option_values (option_id, value, sort_order) values (v_opt_length, '50 cm', 3) returning id into v_val_50;

  metals := array[v_val_silver, v_val_gold, v_val_black, v_val_rose];
  lengths := array[v_val_40, v_val_45, v_val_50];

  for i in 1..4 loop
    for j in 1..3 loop
      insert into product_variants (product_id, sku, price, stock, active)
      values (v_product_id, metal_keys[i] || '-' || length_keys[j], metal_prices[i] + length_delta[j], 20, true)
      returning id into vid;

      insert into variant_option_values (variant_id, option_value_id) values (vid, metals[i]);
      insert into variant_option_values (variant_id, option_value_id) values (vid, lengths[j]);
    end loop;
  end loop;
end $$;

-- ============================================================
-- 8) Row Level Security
-- ============================================================
alter table products enable row level security;
alter table product_images enable row level security;
alter table product_options enable row level security;
alter table product_option_values enable row level security;
alter table product_variants enable row level security;
alter table variant_option_values enable row level security;

-- products: ลูกค้าเห็นเฉพาะที่เปิดขาย, แอดมินเห็น/แก้ไขได้ทั้งหมด
create policy "public read active products" on products for select to anon using (active = true);
create policy "admin read all products" on products for select to authenticated using (true);
create policy "admin write products" on products for all to authenticated using (true) with check (true);

-- รูปภาพ/กลุ่มตัวเลือก/ค่าตัวเลือก: ไม่ใช่ข้อมูลอ่อนไหว ให้อ่านได้ทุกคน แก้ไขได้เฉพาะแอดมิน
create policy "public read product_images" on product_images for select to anon using (true);
create policy "admin write product_images" on product_images for all to authenticated using (true) with check (true);

create policy "public read product_options" on product_options for select to anon using (true);
create policy "admin write product_options" on product_options for all to authenticated using (true) with check (true);

create policy "public read product_option_values" on product_option_values for select to anon using (true);
create policy "admin write product_option_values" on product_option_values for all to authenticated using (true) with check (true);

-- ตัวแปรสินค้า: ลูกค้าเห็นเฉพาะที่เปิดขาย (ราคา/สต๊อกที่ปิดไว้จะไม่โชว์), แอดมินเห็น/แก้ไขได้ทั้งหมด
create policy "public read active variants" on product_variants for select to anon using (active = true);
create policy "admin read all variants" on product_variants for select to authenticated using (true);
create policy "admin write variants" on product_variants for all to authenticated using (true) with check (true);

create policy "public read variant_option_values" on variant_option_values for select to anon using (true);
create policy "admin write variant_option_values" on variant_option_values for all to authenticated using (true) with check (true);

-- ============================================================
-- 9) ฟังก์ชันตัดสต๊อกแบบอะตอมมิก (ต่อ variant/sku)
-- ============================================================
create or replace function decrement_variant_stock(p_sku text, p_qty integer)
returns void
language plpgsql
security definer
as $$
begin
  update product_variants
  set stock = stock - p_qty
  where sku = p_sku and stock >= p_qty;

  if not found then
    raise exception 'ตัวเลือกสินค้าหมดสต๊อกหรือไม่พบ: %', p_sku;
  end if;
end;
$$;

grant execute on function decrement_variant_stock(text, integer) to anon;

-- ============================================================
-- 10) เปิด Realtime ให้ทุกตารางที่เกี่ยวข้อง (รันซ้ำแล้วอาจ error ว่า "already member" ได้ ข้ามไปได้เลย)
-- ============================================================
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table product_images;
alter publication supabase_realtime add table product_options;
alter publication supabase_realtime add table product_option_values;
alter publication supabase_realtime add table product_variants;
alter publication supabase_realtime add table variant_option_values;
