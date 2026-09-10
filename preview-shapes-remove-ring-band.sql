-- ============================================================
-- LUXENAME — เอารูปทรง "ใต้แหวน" (ring_band) ออกจากตัวเลือกพรีวิว
-- รันไฟล์นี้ "ต่อจาก" preview-shapes-update.sql
-- รันซ้ำได้ ไม่พัง
-- ============================================================

-- สินค้าที่เคยตั้งเป็น ring_band ไว้ ให้ย้ายกลับไปค่าเริ่มต้นก่อน
-- (ต้องทำก่อน เพราะจะเพิ่ม constraint ที่ไม่รับค่า ring_band อีกต่อไป)
update products set preview_shape = 'rect_h' where preview_shape = 'ring_band';

alter table products drop constraint if exists products_preview_shape_check;
alter table products add constraint products_preview_shape_check
  check (preview_shape in (
    'square','rect_h','rect_v','circle','ellipse_h','ellipse_v',
    'ring_front','heart','star'
  ));
