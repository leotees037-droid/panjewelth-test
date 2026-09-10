-- ============================================================
-- LUXENAME — ย้ายจำนวนตัวอักษรสูงสุดของข้อความสลัก จากค่ากลาง (app_settings)
-- มาเป็นตั้งค่าแยกต่อสินค้า เพราะแต่ละสินค้าพื้นที่สลักไม่เท่ากัน
-- ตั้งค่าได้ที่ฟอร์มแก้ไขสินค้า ในแท็บ "สินค้า & สต๊อก"
-- รันไฟล์นี้ "ต่อจาก" fonts-emoji-settings-update.sql
-- รันซ้ำได้ ไม่พัง
-- ============================================================

alter table products add column if not exists max_text_length integer not null default 20;

alter table products drop constraint if exists products_max_text_length_check;
alter table products add constraint products_max_text_length_check check (max_text_length > 0);

-- ถ้าเคยตั้งค่ากลางไว้ใน app_settings ให้ใช้ค่านั้นเป็นค่าเริ่มต้นของทุกสินค้าที่ยังไม่เคยตั้งแยก
update products set max_text_length = coalesce((select max_text_length from app_settings where id = 1), 20)
where max_text_length = 20;

-- ค่ากลางไม่ใช้แล้ว ลบตารางทิ้งได้อย่างปลอดภัย
drop table if exists app_settings;
