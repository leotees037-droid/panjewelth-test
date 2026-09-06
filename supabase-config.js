// ===== ตั้งค่าการเชื่อมต่อ Supabase =====
// เอาค่า 2 ตัวนี้มาจาก Supabase Dashboard > Project Settings > API
// Project URL:      https://xxxxxxxxxxxx.supabase.co
// anon public key:  eyJhbGciOi... (คีย์ยาวๆ ที่ระบุว่า "anon" / "public")
// ใส่แทนค่าด้านล่างนี้ (ห้ามใช้ "service_role" key เด็ดขาด เพราะจะเปิดสิทธิ์เต็มให้ทุกคนที่เข้าเว็บ)

const SUPABASE_URL = "https://gcfjvnnartgfhnkzxumg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZmp2bm5hcnRnZmhua3p4dW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDU4MjAsImV4cCI6MjEwNDE4MTgyMH0._ZJGRsY-P_rbf-Zy6MASB-HKuDRKdpH3Pi_knnwVRFI";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
