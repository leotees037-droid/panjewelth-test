/* =====================================================================
   LUXENAME — หน้าร้าน (mobile demo)
   สินค้า/รูปภาพ/รายละเอียด/ตัวเลือกย่อย/สต๊อก โหลดสดจาก Supabase ทั้งหมด
   (ต้องรัน products-schema-v2.sql ใน Supabase ก่อนใช้งานไฟล์นี้)
   ===================================================================== */

let cart = [];
let currentFont = "serif";

let catalog = [];              // สินค้าทั้งหมด (พร้อมรูป/ตัวเลือก/variant) ที่เปิดขายอยู่
let productsByKey = {};        // key -> product
let variantsBySku = {};        // sku -> variant (แนบ productId ไว้ด้วย)

let currentProduct = null;     // สินค้าที่กำลังดูอยู่ในหน้าออกแบบ
let selectedValues = {};       // { optionGroupId: optionValueId }

function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function goDesign() {
  if (!catalog.length) return show("products");
  if (catalog.length === 1) return openProductDetail(catalog[0].key);
  show("products");
}

/* ---------------- โหลดสินค้าทั้งหมด (พร้อมรูป/ตัวเลือก/variant) ---------------- */
async function loadCatalog() {
  if (typeof sb === "undefined") {
    console.error("ยังไม่ได้ตั้งค่า Supabase (ดู supabase-config.js)");
    return;
  }

  const { data, error } = await sb
    .from("products")
    .select(`
      id, key, name, description, active, sort_order,
      product_images ( id, url, sort_order ),
      product_options (
        id, name, sort_order,
        product_option_values ( id, value, sort_order, image_url )
      ),
      product_variants (
        id, sku, price, stock, image_url, active,
        variant_option_values ( option_value_id )
      )
    `)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("โหลดสินค้าไม่สำเร็จ:", error.message);
    return;
  }

  catalog = (data || []).map(p => {
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
    return { id: p.id, key: p.key, name: p.name, description: p.description, images, options, variants };
  });

  productsByKey = {};
  variantsBySku = {};
  catalog.forEach(p => {
    productsByKey[p.key] = p;
    p.variants.forEach(v => { variantsBySku[v.sku] = { ...v, productId: p.id, productName: p.name }; });
  });

  renderProductGrid();

  // ถ้ากำลังดูหน้ารายละเอียดสินค้าอยู่ ให้รีเฟรชราคา/สต๊อกของตัวเลือกที่เลือกไว้แบบสดๆ
  if (currentProduct && productsByKey[currentProduct.key]) {
    currentProduct = productsByKey[currentProduct.key];
    computeAndRenderVariant();
  }
}

function subscribeCatalogRealtime() {
  if (typeof sb === "undefined") return;
  ["products", "product_images", "product_options", "product_option_values", "product_variants", "variant_option_values"]
    .forEach(table => {
      sb.channel("storefront-" + table)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => loadCatalog())
        .subscribe();
    });
}

/* ---------------- ราคาเริ่มต้น/สถานะสต๊อกของสินค้า (สำหรับการ์ดในหน้ารายการ) ---------------- */
function productPriceRange(p) {
  const inStock = p.variants.filter(v => v.active && v.stock > 0);
  const pool = inStock.length ? inStock : p.variants.filter(v => v.active);
  if (!pool.length) return { min: null, max: null, hasStock: false };
  const prices = pool.map(v => v.price);
  return { min: Math.min(...prices), max: Math.max(...prices), hasStock: inStock.length > 0 };
}

function renderProductGrid() {
  const list = document.querySelector("#products .product-list");
  if (!list) return;

  if (!catalog.length) {
    list.innerHTML = `<p style="grid-column:1/-1;color:#999;font-size:13px;">ยังไม่มีสินค้าเปิดขายในตอนนี้</p>`;
    return;
  }

  list.innerHTML = catalog.map(p => {
    const { min, max, hasStock } = productPriceRange(p);
    const thumb = p.images[0]?.url;
    const priceLabel = min === null
      ? "สินค้าหมดชั่วคราว"
      : (min === max ? "฿" + min.toLocaleString() : "เริ่มต้น ฿" + min.toLocaleString());

    return `
      <button class="product" ${hasStock ? `onclick="openProductDetail('${p.key}')"` : "disabled"}>
        <div class="pic custom-pic" ${thumb ? `style="background-image:url('${thumb}');background-size:cover;background-position:center;"` : ""}>
          ${thumb ? "" : "Your Name"}
        </div>
        <b>${p.name}</b>
        <span>${priceLabel}</span>
      </button>
    `;
  }).join("");
}

/* ---------------- หน้ารายละเอียดสินค้า (แกลเลอรี/รายละเอียด/ตัวเลือกย่อย) ---------------- */
function openProductDetail(key) {
  const p = productsByKey[key];
  if (!p) return;
  currentProduct = p;
  selectedValues = {};
  p.options.forEach(o => { if (o.values.length) selectedValues[o.id] = o.values[0].id; });

  document.getElementById("product-title").textContent = p.name;
  document.getElementById("product-description").textContent = p.description || "";

  const gallery = document.getElementById("product-gallery");
  gallery.innerHTML = p.images.length
    ? p.images.map(img => `<img src="${img.url}" alt="${p.name}">`).join("")
    : `<div class="no-img">ยังไม่มีรูปสินค้า</div>`;

  renderProductOptions();
  computeAndRenderVariant();

  document.getElementById("name").value = "";
  update();
  show("custom");
}

function renderProductOptions() {
  const wrap = document.getElementById("product-options");
  if (!currentProduct.options.length) { wrap.innerHTML = ""; return; }

  wrap.innerHTML = currentProduct.options.map(group => `
    <div class="option-group">
      <label class="og-label">${group.name}</label>
      <div class="option-values">
        ${group.values.map(val => `
          <button type="button"
            data-group="${group.id}" data-value="${val.id}"
            class="${selectedValues[group.id] === val.id ? "selected" : ""}"
            onclick="selectOptionValue('${group.id}','${val.id}')">
            ${val.image_url ? `<span class="swatch-thumb" style="background-image:url('${val.image_url}')"></span>` : ""}
            ${val.value}
          </button>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function selectOptionValue(groupId, valueId) {
  selectedValues[groupId] = valueId;
  document.querySelectorAll(`#product-options button[data-group="${groupId}"]`).forEach(b => {
    b.classList.toggle("selected", b.dataset.value === valueId);
  });
  computeAndRenderVariant();
}

function currentMatchedVariant() {
  if (!currentProduct) return null;
  const wanted = currentProduct.options.map(o => selectedValues[o.id]).filter(Boolean).sort();
  return currentProduct.variants.find(v => v.active && JSON.stringify(v.valueIds) === JSON.stringify(wanted)) || null;
}

function computeAndRenderVariant() {
  const variant = currentMatchedVariant();
  const priceEl = document.getElementById("price");
  const msgEl = document.getElementById("variant-stock-msg");
  const addBtn = document.getElementById("add-btn");

  if (!variant) {
    priceEl.textContent = "-";
    msgEl.textContent = "ตัวเลือกนี้ยังไม่เปิดขาย กรุณาเลือกแบบอื่น";
    addBtn.disabled = true;
    return;
  }

  priceEl.textContent = variant.price.toLocaleString();
  if (variant.stock <= 0) {
    msgEl.textContent = "ตัวเลือกนี้สินค้าหมดชั่วคราว";
    addBtn.disabled = true;
  } else if (variant.stock <= 5) {
    msgEl.textContent = `เหลือเพียง ${variant.stock} ชิ้น`;
    addBtn.disabled = false;
  } else {
    msgEl.textContent = "";
    addBtn.disabled = false;
  }
}

/* ---------------- ออกแบบชื่อ ---------------- */
function update() {
  document.getElementById("preview").textContent = document.getElementById("name").value || "Your Name";
}

function font(f) {
  currentFont = f;
  document.getElementById("preview").style.fontFamily = f;
  document.querySelectorAll(".fonts button").forEach(b => b.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
}

/* ---------------- ตะกร้า ---------------- */
function optionSummaryText() {
  return currentProduct.options
    .map(o => {
      const val = o.values.find(v => v.id === selectedValues[o.id]);
      return val ? val.value : "";
    })
    .filter(Boolean)
    .join(", ");
}

function add() {
  const variant = currentMatchedVariant();
  if (!currentProduct || !variant) return alert("กรุณาเลือกตัวเลือกสินค้าก่อน");
  if (variant.stock <= 0) return alert("ตัวเลือกนี้สินค้าหมดชั่วคราว กรุณาเลือกแบบอื่น");

  cart.push({
    sku: variant.sku,
    name: document.getElementById("name").value.trim() || "Your Name",
    label: currentProduct.name + (optionSummaryText() ? " — " + optionSummaryText() : ""),
    price: variant.price
  });
  render();
  show("cart");
}

function cartTotal() {
  return cart.reduce((s, x) => s + x.price, 0);
}

function render() {
  document.getElementById("count").textContent = cart.length;
  document.getElementById("items").innerHTML = cart.length
    ? cart.map(x => `<div class="item"><span>${x.label}<br><b>${x.name}</b></span><b>฿${x.price.toLocaleString()}</b></div>`).join("")
    : "ยังไม่มีสินค้าในตะกร้า";

  const totalBox = document.getElementById("cartTotal");
  if (cart.length) {
    totalBox.style.display = "flex";
    document.getElementById("totalPrice").textContent = "฿" + cartTotal().toLocaleString();
  } else {
    totalBox.style.display = "none";
  }
}

/* ---------------- ชำระเงิน ---------------- */
let slipUploaded = false, slipFile = null;

function goToPayment() {
  if (!cart.length) return alert("กรุณาเพิ่มสินค้าในตะกร้าก่อน");
  document.getElementById("payAmount").textContent = "฿" + cartTotal().toLocaleString();
  resetSlip();
  show("payment");
}

function resetSlip() {
  slipUploaded = false;
  slipFile = null;
  document.getElementById("slipInput").value = "";
  document.getElementById("slipPreviewWrap").style.display = "none";
  document.getElementById("confirmBtn").disabled = true;
  document.getElementById("payStatus").textContent = "";
}

function uploadSlip(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  slipFile = file;
  const reader = new FileReader();
  reader.onload = function (ev) {
    document.getElementById("slipPreview").src = ev.target.result;
    document.getElementById("slipName").textContent = file.name;
    document.getElementById("slipPreviewWrap").style.display = "flex";
    slipUploaded = true;
    document.getElementById("confirmBtn").disabled = false;
  };
  reader.readAsDataURL(file);
}

// รวมจำนวนต่อ sku 1 ตัว จากตะกร้า เพื่อตัดสต๊อกทีเดียวต่อตัวเลือก
function cartQuantitiesBySku() {
  const qty = {};
  cart.forEach(x => { qty[x.sku] = (qty[x.sku] || 0) + 1; });
  return qty;
}

async function confirmPayment() {
  const status = document.getElementById("payStatus");
  const btn = document.getElementById("confirmBtn");
  if (!slipUploaded) return alert("กรุณาแนบสลิปการโอนเงินก่อนยืนยัน");

  const custName = document.getElementById("custName").value.trim();
  const custPhone = document.getElementById("custPhone").value.trim();
  const custAddress = document.getElementById("custAddress").value.trim();
  if (!custName || !custPhone || !custAddress) return alert("กรุณากรอกชื่อ เบอร์โทรศัพท์ และที่อยู่จัดส่งให้ครบ");
  if (typeof sb === "undefined") { status.textContent = "ยังไม่ได้ตั้งค่า Supabase (ดู supabase-config.js)"; return; }

  // เช็คสต๊อกล่าสุดอีกครั้งก่อนตัดเงิน กันกรณีคนอื่นซื้อตัดหน้าไปแล้ว
  const qtyBySku = cartQuantitiesBySku();
  for (const sku of Object.keys(qtyBySku)) {
    const v = variantsBySku[sku];
    if (!v || v.stock < qtyBySku[sku]) {
      status.textContent = `ตัวเลือกสินค้า "${v ? v.sku : sku}" มีไม่พอในสต๊อกแล้ว กรุณากลับไปแก้ตะกร้า`;
      return;
    }
  }

  btn.disabled = true;
  status.textContent = "กำลังบันทึกคำสั่งซื้อ...";
  try {
    const mimeExt = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "image/gif": "gif" };
    const nameMatch = slipFile.name.match(/\.(jpg|jpeg|png|webp|heic|heif|gif)$/i);
    const ext = mimeExt[slipFile.type] || (nameMatch ? nameMatch[1].toLowerCase() : "jpg");
    const path = `slip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await sb.storage.from("slips").upload(path, slipFile);
    if (upErr) throw upErr;
    const { data: urlData } = sb.storage.from("slips").getPublicUrl(path);

    const { error: insErr } = await sb.from("orders").insert({
      customer_name: custName,
      customer_phone: custPhone,
      customer_address: custAddress,
      items: cart,
      total: cartTotal(),
      slip_url: urlData.publicUrl
    });
    if (insErr) throw insErr;

    // ตัดสต๊อกทีละตัวเลือก (แบบอะตอมมิกในฐานข้อมูล กันสต๊อกติดลบ)
    for (const sku of Object.keys(qtyBySku)) {
      const { error: stockErr } = await sb.rpc("decrement_variant_stock", { p_sku: sku, p_qty: qtyBySku[sku] });
      if (stockErr) console.error("ตัดสต๊อกไม่สำเร็จสำหรับ", sku, stockErr.message);
    }

    show("success");
  } catch (err) {
    console.error(err);
    status.textContent = "บันทึกไม่สำเร็จ: " + (err.message || "ลองใหม่อีกครั้ง");
    btn.disabled = false;
  }
}

function backToHome() {
  cart = [];
  render();
  document.getElementById("custName").value = "";
  document.getElementById("custPhone").value = "";
  document.getElementById("custAddress").value = "";
  resetSlip();
  loadCatalog(); // รีเฟรชสต๊อกล่าสุดตอนกลับหน้าแรก
  show("home");
}

loadCatalog();
subscribeCatalogRealtime();
