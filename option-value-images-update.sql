-- ============================================================
-- LUXENAME — เพิ่มรูปภาพให้ "ค่าตัวเลือกย่อย" (เช่น สีแดง, สีทอง)
-- ให้ลูกค้าเห็นสี/ลาย จากรูปจริงตอนเลือกตัวเลือก แทนที่จะเห็นแค่ชื่อ
-- รันต่อจาก storage-and-images-update.sql (ต้องมี bucket product-images อยู่แล้ว)
-- ============================================================

alter table product_option_values add column if not exists image_url text;
alter table product_option_values add column if not exists storage_path text;

-- ใช้ bucket "product-images" เดิม (path แยกใต้โฟลเดอร์ option-values/) ไม่ต้องสร้าง bucket ใหม่
-- policy เดิมของ bucket นี้ (public read, authenticated write) ใช้ได้กับรูปตัวเลือกย่อยด้วยอยู่แล้ว
