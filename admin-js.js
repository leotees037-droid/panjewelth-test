/* =====================================================================
   LUXENAME Admin — แดชบอร์ดออเดอร์ realtime
   ใช้ค่า SUPABASE_URL / SUPABASE_ANON_KEY จาก supabase-config.js
   (ไฟล์เดียวกับที่หน้าร้านใช้อยู่แล้ว ไม่ต้องตั้งค่าซ้ำ)
   ===================================================================== */

// ชื่อตาราง/คอลัมน์ — ตรงกับที่ script.js ของหน้าร้าน insert เข้าไป
const TABLE = "orders";
const COL = {
  id: "id",
  createdAt: "created_at",
  name: "customer_name",
  phone: "customer_phone",
  address: "customer_address",
  items: "items",     // jsonb array: [{name, metal, price}, ...]
  total: "total",
  slipUrl: "slip_url"
};

const METAL_LABEL = {
  silver: "Silver Classic",
  gold: "Gold Elegant",
  black: "Black Luxury",
  rose: "Rose Gold"
};

const isConfigured = typeof sb !== "undefined"
  && typeof SUPABASE_URL === "string"
  && SUPABASE_URL.startsWith("http")
  && !SUPABASE_URL.includes("YOUR-PROJECT-REF");

if (!isConfigured) {
  document.getElementById("config-warning").style.display = "block";
}

let allOrders = [];
let channel = null;

const $ = (sel) => document.querySelector(sel);

/* ---------------- Auth ---------------- */
async function init() {
  if (!isConfigured) return;

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showDashboard(session);
  } else {
    showLogin();
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
      showDashboard(session);
    } else if (event === "SIGNED_OUT") {
      showLogin();
    }
  });
}

function showLogin() {
  $("#login-screen").style.display = "flex";
  $("#dashboard").style.display = "none";
  if (channel) { sb.removeChannel(channel); channel = null; }
}

function showDashboard(session) {
  $("#login-screen").style.display = "none";
  $("#dashboard").style.display = "block";
  $("#user-email").textContent = session.user.email || "";
  loadInitialOrders();
  subscribeRealtime();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#login-btn");
  const errBox = $("#login-error");
  errBox.style.display = "none";
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ...";

  const email = $("#email").value.trim();
  const password = $("#password").value;

  const { error } = await sb.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "เข้าสู่ระบบ";

  if (error) {
    errBox.textContent = "เข้าสู่ระบบไม่สำเร็จ: " + error.message;
    errBox.style.display = "block";
  }
});

$("#logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
});

/* ---------------- Data loading ---------------- */
async function loadInitialOrders() {
  $("#load-error").style.display = "none";
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .order(COL.createdAt, { ascending: false })
    .limit(200);

  if (error) {
    $("#load-error").style.display = "block";
    $("#load-error").textContent = "โหลดข้อมูลไม่สำเร็จ: " + error.message +
      " — ตรวจสอบชื่อตาราง/คอลัมน์ และ RLS policy (ต้องอนุญาตให้ authenticated select ได้)";
    return;
  }

  allOrders = data || [];
  updateStats();
  renderOrders();
}

function subscribeRealtime() {
  if (channel) sb.removeChannel(channel);

  channel = sb
    .channel("admin-orders-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: TABLE },
      (payload) => {
        allOrders.unshift(payload.new);
        updateStats();
        renderOrders(payload.new[COL.id]);
      }
    )
    .subscribe();
}

/* ---------------- Stats ---------------- */
function updateStats() {
  const total = allOrders.reduce((s, o) => s + (Number(o[COL.total]) || 0), 0);
  const todayStr = new Date().toDateString();
  const todayCount = allOrders.filter(o => {
    const d = o[COL.createdAt] ? new Date(o[COL.createdAt]) : null;
    return d && d.toDateString() === todayStr;
  }).length;

  $("#stat-count").textContent = allOrders.length;
  $("#stat-total").textContent = "฿" + total.toLocaleString();
  $("#stat-today").textContent = todayCount + " ออเดอร์";
}

/* ---------------- Rendering ---------------- */
$("#search-input").addEventListener("input", () => renderOrders());

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch (e) { return []; }
  }
  return [];
}

function renderOrders(highlightId) {
  const q = $("#search-input").value.trim().toLowerCase();

  let list = allOrders;
  if (q) {
    list = list.filter(o => {
      const hay = [o[COL.name], o[COL.phone], o[COL.address]]
        .map(v => (v || "").toString().toLowerCase()).join(" ");
      return hay.includes(q);
    });
  }

  $("#order-count").textContent = `แสดง ${list.length} ออเดอร์`;
  $("#empty-state").style.display = list.length === 0 ? "block" : "none";

  const container = $("#orders-list");
  container.innerHTML = "";

  list.forEach(o => {
    const card = document.createElement("div");
    card.className = "order-card";
    const isNew = highlightId !== undefined && o[COL.id] === highlightId;
    if (isNew) card.classList.add("flash");

    const items = parseItems(o[COL.items]);
    const itemsHtml = items.map(it => `
      <div class="item-row">
        <span>สร้อยคอ — สลัก "<span class="item-name">${escapeHtml(it.name)}</span>"
          <span class="item-metal">${escapeHtml(METAL_LABEL[it.metal] || it.metal || "-")}</span>
        </span>
        <span class="item-price">฿${Number(it.price || 0).toLocaleString()}</span>
      </div>
    `).join("") || `<div class="item-row"><span>ไม่มีรายการสินค้า</span></div>`;

    card.innerHTML = `
      <div class="order-main">
        <div class="top-row">
          <span class="name">${escapeHtml(o[COL.name]) || "ไม่ระบุชื่อ"}</span>
          ${isNew ? '<span class="badge">ใหม่</span>' : ""}
          <span class="time">${formatTime(o[COL.createdAt])}</span>
        </div>
        <div class="info-grid">
          <div><div class="k">เบอร์โทร</div><div class="v">${escapeHtml(o[COL.phone]) || "-"}</div></div>
          <div><div class="k">ที่อยู่จัดส่ง</div><div class="v">${escapeHtml(o[COL.address]) || "-"}</div></div>
        </div>
        <div class="items-list">
          ${itemsHtml}
          <div class="total-row"><span>ยอดรวม</span><span class="amt">฿${Number(o[COL.total] || 0).toLocaleString()}</span></div>
        </div>
      </div>
      <div class="slip-wrap">
        ${o[COL.slipUrl]
          ? `<img src="${escapeHtml(o[COL.slipUrl])}" alt="สลิปโอนเงิน" data-full="${escapeHtml(o[COL.slipUrl])}">
             <span>สลิปโอน</span>`
          : `<div class="no-slip">ไม่มีสลิป</div>`}
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".slip-wrap img").forEach(img => {
    img.addEventListener("click", () => openLightbox(img.dataset.full));
  });
}

/* ---------------- Lightbox ---------------- */
function openLightbox(src) {
  $("#lightbox-img").src = src;
  $("#lightbox").style.display = "flex";
}
$("#lightbox").addEventListener("click", () => {
  $("#lightbox").style.display = "none";
  $("#lightbox-img").src = "";
});

init();
