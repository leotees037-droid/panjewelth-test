/* =====================================================================
   LUXENAME Admin — แดชบอร์ดออเดอร์ + จัดการสินค้า/รูปภาพ/ตัวเลือก/สต๊อก
   ใช้ค่า SUPABASE_URL / SUPABASE_ANON_KEY จาก supabase-config.js
   (ไฟล์เดียวกับที่หน้าร้านใช้อยู่แล้ว ไม่ต้องตั้งค่าซ้ำ)
   ต้องรัน products-schema-v2.sql ใน Supabase ก่อนใช้งานหน้า "สินค้า & สต๊อก"
   ===================================================================== */

// ชื่อตาราง/คอลัมน์ — ตรงกับที่ script.js ของหน้าร้าน insert เข้าไป
const TABLE = "orders";
const COL = {
  id: "id",
  createdAt: "created_at",
  name: "customer_name",
  phone: "customer_phone",
  address: "customer_address",
  items: "items",     // jsonb array: [{sku, name, label, price}, ...]
  total: "total",
  slipUrl: "slip_url"
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

let allProducts = [];          // สินค้าทั้งหมด พร้อมรูป/ตัวเลือก/variant (nested)
let productsChannels = [];     // realtime channels หลายตัวสำหรับตารางที่เกี่ยวข้องกับสินค้า
let currentView = "orders";
let currentManageProduct = null;

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
  productsChannels.forEach(ch => sb.removeChannel(ch));
  productsChannels = [];
}

function showDashboard(session) {
  $("#login-screen").style.display = "none";
  $("#dashboard").style.display = "block";
  $("#user-email").textContent = session.user.email || "";
  loadInitialOrders();
  subscribeRealtime();
  loadProducts();
  subscribeProductsRealtime();
}

/* ---------------- View switching ---------------- */
function switchView(view) {
  currentView = view;
  $("#tab-orders").classList.toggle("active", view === "orders");
  $("#tab-products").classList.toggle("active", view === "products");
  $("#orders-view").style.display = view === "orders" ? "block" : "none";
  $("#products-view").style.display = view === "products" ? "block" : "none";
  $("#view-title").textContent = view === "orders" ? "ออเดอร์ล่าสุด" : "สินค้า & สต๊อก";
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

/* ---------------- Orders: data loading ---------------- */
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

/* ---------------- Orders: stats ---------------- */
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

/* ---------------- Orders: rendering ---------------- */
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
        <span>${escapeHtml(it.label || it.metal || "สินค้า")} — สลัก "<span class="item-name">${escapeHtml(it.name)}</span>"</span>
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

/* =====================================================================
   สินค้า & สต๊อก — โหลดข้อมูลแบบซ้อน (รูปภาพ / กลุ่มตัวเลือก / ตัวแปรสินค้า)
   ===================================================================== */
async function loadProducts() {
  $("#product-load-error").style.display = "none";
  const { data, error } = await sb
    .from("products")
    .select(`
      id, key, name, description, active, sort_order,
      product_images ( id, url, sort_order ),
      product_options (
        id, name, sort_order,
        product_option_values ( id, value, sort_order )
      ),
      product_variants (
        id, sku, price, stock, image_url, active,
        variant_option_values ( option_value_id )
      )
    `)
    .order("sort_order", { ascending: true });

  if (error) {
    $("#product-load-error").style.display = "block";
    $("#product-load-error").textContent = "โหลดสินค้าไม่สำเร็จ: " + error.message +
      " — ตรวจสอบว่ารันสคริปต์ products-schema-v2.sql ใน Supabase แล้วหรือยัง";
    return;
  }

  allProducts = (data || []).map(p => {
    const images = [...(p.product_images || [])].sort((a, b) => a.sort_order - b.sort_order);
    const options = [...(p.product_options || [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(o => ({
        id: o.id,
        name: o.name,
        values: [...(o.product_option_values || [])].sort((a, b) => a.sort_order - b.sort_order)
      }));
    const variants = (p.product_variants || []).map(v => ({
      id: v.id,
      sku: v.sku,
      price: Number(v.price),
      stock: v.stock,
      image_url: v.image_url,
      active: v.active,
      valueIds: (v.variant_option_values || []).map(x => x.option_value_id).sort()
    }));
    return { id: p.id, key: p.key, name: p.name, description: p.description, active: p.active, images, options, variants };
  });

  updateProductStats();
  renderProducts();

  // ถ้า manage modal เปิดอยู่ ให้รีเฟรชข้อมูลสินค้าตัวที่กำลังจัดการอยู่
  if (currentManageProduct) {
    const fresh = allProducts.find(p => p.id === currentManageProduct.id);
    if (fresh) {
      currentManageProduct = fresh;
      renderManageImages();
      renderManageOptions();
      renderManageVariants();
    }
  }
}

function subscribeProductsRealtime() {
  productsChannels.forEach(ch => sb.removeChannel(ch));
  productsChannels = ["products", "product_images", "product_options", "product_option_values", "product_variants", "variant_option_values"]
    .map(table => sb.channel("admin-" + table)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => loadProducts())
      .subscribe());
}

function updateProductStats() {
  $("#stat-product-count").textContent = allProducts.length;
  $("#stat-product-active").textContent = allProducts.filter(p => p.active).length;
  const totalStock = allProducts.reduce((s, p) => s + p.variants.reduce((s2, v) => s2 + (Number(v.stock) || 0), 0), 0);
  $("#stat-stock-total").textContent = totalStock.toLocaleString() + " ชิ้น";
}

/* ---------------- รายการสินค้า ---------------- */
function renderProducts() {
  const container = $("#products-list");
  container.innerHTML = "";
  $("#products-empty-state").style.display = allProducts.length === 0 ? "block" : "none";

  allProducts.forEach(p => {
    const totalStock = p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    const card = document.createElement("div");
    card.className = "product-card" + (p.active ? "" : " inactive");
    card.innerHTML = `
      <div class="pc-info">
        ${p.images[0]
          ? `<img class="pc-thumb" src="${escapeHtml(p.images[0].url)}" alt="">`
          : `<div class="pc-thumb"></div>`}
        <div>
          <div class="pc-name">${escapeHtml(p.name)}${p.active ? "" : " (ปิดขาย)"}</div>
          <div class="pc-key">key: ${escapeHtml(p.key)} • ${p.options.length} กลุ่มตัวเลือก • ${p.variants.length} ตัวเลือกย่อย</div>
        </div>
      </div>
      <div class="pc-price">สต๊อกรวม ${totalStock.toLocaleString()} ชิ้น</div>
      <div class="pc-actions">
        <button type="button" data-action="manage">จัดการรูป/ตัวเลือก</button>
        <button type="button" data-action="edit">แก้ไข</button>
        <button type="button" class="danger" data-action="delete">ลบ</button>
      </div>
    `;
    card.querySelector('[data-action="manage"]').addEventListener("click", () => openManageModal(p.id));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => openProductForm(p));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteProduct(p));
    container.appendChild(card);
  });
}

async function deleteProduct(p) {
  if (!confirm(`ลบสินค้า "${p.name}" ใช่หรือไม่? รูปภาพ/ตัวเลือก/ตัวแปรสินค้าทั้งหมดของสินค้านี้จะถูกลบไปด้วย และกู้คืนไม่ได้ (ถ้าแค่อยากซ่อนจากหน้าร้าน ให้กด "แก้ไข" แล้วปิดสวิตช์เปิดขายแทน)`)) return;
  const { error } = await sb.from("products").delete().eq("id", p.id);
  if (error) alert("ลบสินค้าไม่สำเร็จ: " + error.message);
}

/* ---------------- ฟอร์มเพิ่ม/แก้ไขสินค้า (ข้อมูลพื้นฐาน) ---------------- */
function openProductForm(product) {
  $("#product-form-error").style.display = "none";
  $("#product-form").reset();
  if (product) {
    $("#product-form-title").textContent = "แก้ไขสินค้า";
    $("#p-id").value = product.id;
    $("#p-key").value = product.key;
    $("#p-key").disabled = true;
    $("#p-name").value = product.name;
    $("#p-description").value = product.description || "";
    $("#p-active").checked = !!product.active;
  } else {
    $("#product-form-title").textContent = "เพิ่มสินค้าใหม่";
    $("#p-id").value = "";
    $("#p-key").disabled = false;
    $("#p-active").checked = true;
  }
  $("#product-modal").style.display = "flex";
}

function closeProductForm() {
  $("#product-modal").style.display = "none";
}

$("#product-modal").addEventListener("click", (e) => {
  if (e.target.id === "product-modal") closeProductForm();
});

$("#product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = $("#product-form-error");
  errBox.style.display = "none";

  const id = $("#p-id").value;
  const payload = {
    key: $("#p-key").value.trim().toLowerCase(),
    name: $("#p-name").value.trim(),
    description: $("#p-description").value.trim() || null,
    active: $("#p-active").checked
  };

  if (!/^[a-z0-9_-]+$/.test(payload.key)) {
    errBox.textContent = "รหัสสินค้า (key) ใช้ได้เฉพาะตัวอักษรเล็ก a-z, ตัวเลข, - และ _ เท่านั้น";
    errBox.style.display = "block";
    return;
  }

  let error;
  if (id) {
    ({ error } = await sb.from("products").update({
      name: payload.name,
      description: payload.description,
      active: payload.active
    }).eq("id", id));
  } else {
    ({ error } = await sb.from("products").insert(payload));
  }

  if (error) {
    errBox.textContent = "บันทึกไม่สำเร็จ: " + error.message +
      (error.message.includes("duplicate") ? " (รหัสสินค้านี้มีอยู่แล้ว)" : "");
    errBox.style.display = "block";
    return;
  }

  closeProductForm();
});

/* =====================================================================
   Manage modal: รูปภาพ / ตัวเลือก / ตัวแปรสินค้า
   ===================================================================== */
function openManageModal(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;
  currentManageProduct = p;
  $("#manage-title").textContent = "จัดการ: " + p.name;
  switchManageTab("images");
  renderManageImages();
  renderManageOptions();
  renderManageVariants();
  $("#manage-modal").style.display = "flex";
}

function closeManageModal() {
  $("#manage-modal").style.display = "none";
  currentManageProduct = null;
}

$("#manage-modal").addEventListener("click", (e) => {
  if (e.target.id === "manage-modal") closeManageModal();
});

function switchManageTab(tab) {
  ["images", "options", "variants"].forEach(t => {
    $("#mtab-" + t).classList.toggle("active", t === tab);
    $("#manage-" + t).style.display = t === tab ? "block" : "none";
  });
}

/* ---------------- รูปภาพ ---------------- */
function renderManageImages() {
  const wrap = $("#manage-images-list");
  const images = currentManageProduct.images;
  if (!images.length) {
    wrap.innerHTML = `<p class="hint-text">ยังไม่มีรูปสินค้า — เพิ่มลิงก์รูปด้านล่าง</p>`;
  } else {
    wrap.innerHTML = images.map(img => `
      <div class="manage-image-row" data-id="${img.id}">
        <img src="${escapeHtml(img.url)}" alt="">
        <input type="number" class="img-sort" value="${img.sort_order}" title="ลำดับการแสดงผล">
        <button type="button" class="danger img-remove">ลบ</button>
      </div>
    `).join("");
  }

  wrap.querySelectorAll(".manage-image-row").forEach(row => {
    const id = row.dataset.id;
    row.querySelector(".img-sort").addEventListener("change", async (e) => {
      await sb.from("product_images").update({ sort_order: Number(e.target.value) || 0 }).eq("id", id);
    });
    row.querySelector(".img-remove").addEventListener("click", async () => {
      if (!confirm("ลบรูปนี้ใช่หรือไม่?")) return;
      await sb.from("product_images").delete().eq("id", id);
    });
  });
}

$("#image-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentManageProduct) return;
  const url = $("#img-url").value.trim();
  if (!url) return;
  const nextSort = currentManageProduct.images.length
    ? Math.max(...currentManageProduct.images.map(i => i.sort_order)) + 1
    : 0;
  const { error } = await sb.from("product_images").insert({
    product_id: currentManageProduct.id, url, sort_order: nextSort
  });
  if (error) { alert("เพิ่มรูปไม่สำเร็จ: " + error.message); return; }
  $("#image-form").reset();
});

/* ---------------- ตัวเลือก (option groups + values) ---------------- */
function renderManageOptions() {
  const wrap = $("#manage-options-list");
  const options = currentManageProduct.options;
  if (!options.length) {
    wrap.innerHTML = `<p class="hint-text">ยังไม่มีกลุ่มตัวเลือก — เพิ่มด้านล่าง เช่น "โลหะ", "ความยาวสร้อย"</p>`;
  } else {
    wrap.innerHTML = options.map(group => `
      <div class="og-block" data-group-id="${group.id}">
        <div class="og-header">
          <b>${escapeHtml(group.name)}</b>
          <button type="button" class="danger og-remove">ลบกลุ่มนี้</button>
        </div>
        <div class="og-values">
          ${group.values.map(val => `
            <span class="og-chip" data-value-id="${val.id}">${escapeHtml(val.value)} <button type="button" class="val-remove">✕</button></span>
          `).join("") || `<span class="hint-text">ยังไม่มีค่าในกลุ่มนี้</span>`}
        </div>
        <form class="inline-add-form og-value-form">
          <input placeholder="เพิ่มค่าใหม่ในกลุ่มนี้ เช่น Silver, 45 cm" required>
          <button type="submit" class="primary">+ เพิ่ม</button>
        </form>
      </div>
    `).join("");
  }

  wrap.querySelectorAll(".og-block").forEach(block => {
    const groupId = block.dataset.groupId;

    block.querySelector(".og-remove").addEventListener("click", async () => {
      if (!confirm('ลบกลุ่มตัวเลือกนี้ใช่หรือไม่? ค่าตัวเลือกทั้งหมดในกลุ่มจะถูกลบไปด้วย และตัวแปรสินค้าที่ใช้ค่าเหล่านี้จะขาดมิตินี้ไป (แนะนำให้ตรวจสอบแท็บ "ตัวแปรสินค้า" อีกครั้งหลังลบ)')) return;
      await sb.from("product_options").delete().eq("id", groupId);
    });

    block.querySelectorAll(".val-remove").forEach(btn => {
      btn.addEventListener("click", async () => {
        const chip = btn.closest(".og-chip");
        if (!confirm("ลบค่าตัวเลือกนี้ใช่หรือไม่? ตัวแปรสินค้าที่ใช้ค่านี้จะขาดมิตินี้ไป")) return;
        await sb.from("product_option_values").delete().eq("id", chip.dataset.valueId);
      });
    });

    block.querySelector(".og-value-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = e.target.querySelector("input");
      const value = input.value.trim();
      if (!value) return;
      const group = currentManageProduct.options.find(o => o.id === groupId);
      const nextSort = group && group.values.length ? Math.max(...group.values.map(v => v.sort_order)) + 1 : 0;
      const { error } = await sb.from("product_option_values").insert({ option_id: groupId, value, sort_order: nextSort });
      if (error) { alert("เพิ่มค่าตัวเลือกไม่สำเร็จ: " + error.message); return; }
      input.value = "";
    });
  });
}

$("#option-group-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentManageProduct) return;
  const name = $("#og-name").value.trim();
  if (!name) return;
  const nextSort = currentManageProduct.options.length
    ? Math.max(...currentManageProduct.options.map(o => o.sort_order)) + 1
    : 0;
  const { error } = await sb.from("product_options").insert({
    product_id: currentManageProduct.id, name, sort_order: nextSort
  });
  if (error) { alert("เพิ่มกลุ่มตัวเลือกไม่สำเร็จ: " + error.message); return; }
  $("#option-group-form").reset();
});

/* ---------------- ตัวแปรสินค้า (variants: ราคา/สต๊อกแยกต่อชุดตัวเลือก) ---------------- */
function variantLabel(product, variant) {
  const names = product.options.map(group => {
    const val = group.values.find(v => variant.valueIds.includes(v.id));
    return val ? val.value : null;
  }).filter(Boolean);
  return names.length ? names.join(" / ") : "(ไม่มีตัวเลือก)";
}

function stockBadgeClass(stock) {
  if (stock <= 0) return "out";
  if (stock <= 5) return "low";
  return "ok";
}

function renderManageVariants() {
  const wrap = $("#manage-variants-list");
  const variants = currentManageProduct.variants;

  if (!variants.length) {
    wrap.innerHTML = `<p class="hint-text">ยังไม่มีตัวแปรสินค้า — ถ้ามีกลุ่มตัวเลือกแล้ว กด "สร้างตัวเลือกที่ขาดหายอัตโนมัติ" ด้านบน</p>`;
    return;
  }

  wrap.innerHTML = variants.map(v => `
    <div class="product-card variant-row${v.active ? "" : " inactive"}" data-id="${v.id}">
      <div class="pc-info">
        <div>
          <div class="pc-name">${escapeHtml(variantLabel(currentManageProduct, v))}</div>
          <div class="pc-key">sku: ${escapeHtml(v.sku)}</div>
        </div>
      </div>
      <div class="stock-control">
        <span style="font-size:12px;color:#999;margin-right:2px;">฿</span>
        <input type="number" min="0" step="1" class="variant-price" value="${v.price}" style="width:72px;">
      </div>
      <div class="stock-control">
        <button type="button" data-action="dec">−</button>
        <input type="number" min="0" step="1" class="variant-stock" value="${v.stock}">
        <button type="button" data-action="inc">+</button>
        <span class="stock-badge ${stockBadgeClass(v.stock)}">${v.stock <= 0 ? "หมด" : v.stock + " ชิ้น"}</span>
      </div>
      <div class="pc-actions">
        <label style="font-size:12px;display:flex;align-items:center;gap:5px;">
          <input type="checkbox" class="variant-active" ${v.active ? "checked" : ""}> เปิดขาย
        </label>
        <button type="button" class="danger" data-action="delete">ลบ</button>
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll(".variant-row").forEach(row => {
    const id = row.dataset.id;
    const priceInput = row.querySelector(".variant-price");
    const stockInput = row.querySelector(".variant-stock");
    const activeInput = row.querySelector(".variant-active");

    priceInput.addEventListener("change", async () => {
      await sb.from("product_variants").update({ price: Number(priceInput.value) || 0 }).eq("id", id);
    });

    row.querySelector('[data-action="dec"]').addEventListener("click", async () => {
      stockInput.value = Math.max(0, Number(stockInput.value || 0) - 1);
      await sb.from("product_variants").update({ stock: Number(stockInput.value) }).eq("id", id);
    });
    row.querySelector('[data-action="inc"]').addEventListener("click", async () => {
      stockInput.value = Number(stockInput.value || 0) + 1;
      await sb.from("product_variants").update({ stock: Number(stockInput.value) }).eq("id", id);
    });
    stockInput.addEventListener("change", async () => {
      const v = Math.max(0, Number(stockInput.value || 0));
      stockInput.value = v;
      await sb.from("product_variants").update({ stock: v }).eq("id", id);
    });

    activeInput.addEventListener("change", async () => {
      await sb.from("product_variants").update({ active: activeInput.checked }).eq("id", id);
    });

    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!confirm("ลบตัวเลือกย่อยนี้ใช่หรือไม่?")) return;
      await sb.from("product_variants").delete().eq("id", id);
    });
  });
}

async function generateMissingVariants() {
  const p = currentManageProduct;
  if (!p) return;
  if (!p.options.length || p.options.some(o => !o.values.length)) {
    alert('ต้องมีอย่างน้อย 1 กลุ่มตัวเลือก และแต่ละกลุ่มต้องมีค่าอย่างน้อย 1 ค่า ก่อนสร้างตัวแปรสินค้า');
    return;
  }

  // คำนวณชุดค่าผสมทั้งหมด (cartesian product) จากทุกกลุ่มตัวเลือก
  let combos = [[]];
  p.options.forEach(group => {
    const next = [];
    combos.forEach(combo => {
      group.values.forEach(val => next.push([...combo, val]));
    });
    combos = next;
  });

  const existingKeys = new Set(p.variants.map(v => v.valueIds.slice().sort().join("|")));
  const missing = combos.filter(combo => {
    const key = combo.map(v => v.id).sort().join("|");
    return !existingKeys.has(key);
  });

  if (!missing.length) {
    alert("มีตัวแปรสินค้าครบทุกชุดค่าผสมแล้ว");
    return;
  }

  for (const combo of missing) {
    const sku = `${p.key}-${combo.map(v => v.id.slice(0, 6)).join("-")}`;
    const { data: newVariant, error: vErr } = await sb.from("product_variants")
      .insert({ product_id: p.id, sku, price: 0, stock: 0, active: true })
      .select().single();
    if (vErr) { console.error("สร้างตัวแปรสินค้าไม่สำเร็จ:", vErr.message); continue; }

    const joinRows = combo.map(val => ({ variant_id: newVariant.id, option_value_id: val.id }));
    const { error: joinErr } = await sb.from("variant_option_values").insert(joinRows);
    if (joinErr) console.error("บันทึกค่าตัวเลือกของตัวแปรสินค้าไม่สำเร็จ:", joinErr.message);
  }

  alert(`สร้างตัวแปรสินค้าใหม่ ${missing.length} รายการ — ตั้งราคา/สต๊อกด้านล่างได้เลย`);
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
