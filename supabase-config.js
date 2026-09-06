// ===== ตั้งค่าการเชื่อมต่อ Supabase =====
// เอาค่า 2 ตัวนี้มาจาก Supabase Dashboard > Project Settings > API
// Project URL:      https://xxxxxxxxxxxx.supabase.co
// anon public key:  eyJhbGciOi... (คีย์ยาวๆ ที่ระบุว่า "anon" / "public")
// ใส่แทนค่าด้านล่างนี้ (ห้ามใช้ "service_role" key เด็ดขาด เพราะจะเปิดสิทธิ์เต็มให้ทุกคนที่เข้าเว็บ)

const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
