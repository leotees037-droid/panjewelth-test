-- ============================================================
-- LUXENAME — เปลี่ยนพื้นที่พรีวิวจาก "ลากกรอบบนรูปสินค้า" เป็น
-- "เลือกรูปทรงเรขาคณิตสีเงิน" (แหวน/กำไล/จี้ ฯลฯ มีรูปทรงพรีวิวของตัวเอง)
-- รันไฟล์นี้ "ต่อจาก" engraving-preview-update.sql (แทนที่แนวทางกรอบลากเดิม)
-- รันซ้ำได้ ไม่พัง
-- ============================================================

-- 1) คอลัมน์เก็บรูปทรงพรีวิวที่แอดมินเลือกต่อสินค้า
alter table products add column if not exists preview_shape text not null default 'rect_h';

-- จำกัดค่าที่เก็บได้ ให้ตรงกับรายการรูปทรงที่มีในระบบเท่านั้น
alter table products drop constraint if exists products_preview_shape_check;
alter table products add constraint products_preview_shape_check
  check (preview_shape in (
    'square','rect_h','rect_v','circle','ellipse_h','ellipse_v',
    'ring_front','ring_band','heart','star'
  ));

-- 2) คอลัมน์ตำแหน่งกรอบแบบลากบนรูปเดิม (engrave_x/y/w/h) ไม่ใช้แล้ว ลบทิ้งได้อย่างปลอดภัย
alter table products drop column if exists engrave_x;
alter table products drop column if exists engrave_y;
alter table products drop column if exists engrave_w;
alter table products drop column if exists engrave_h;
