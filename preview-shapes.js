/* =====================================================================
   LUXENAME — เอนจินวาดรูปทรงพรีวิว 2D สีเงิน (ใช้ร่วมกันทั้งหน้าร้านและแอดมิน)
   โหลดไฟล์นี้ก่อน script.js / admin.js เสมอ
   ===================================================================== */

const PREVIEW_SHAPES = {
  square:     { label: "สี่เหลี่ยมจัตุรัส",         aspect: 1,    kind: "rect" },
  rect_h:     { label: "สี่เหลี่ยมผืนผ้าแนวนอน",     aspect: 2.1,  kind: "rect" },
  rect_v:     { label: "สี่เหลี่ยมผืนผ้าแนวตั้ง",     aspect: 0.55, kind: "rect" },
  circle:     { label: "วงกลม",                     aspect: 1,    kind: "ellipse" },
  ellipse_h:  { label: "วงรีแนวนอน",                 aspect: 1.8,  kind: "ellipse" },
  ellipse_v:  { label: "วงรีแนวตั้ง",                 aspect: 0.6,  kind: "ellipse" },
  ring_front: { label: "หน้าแหวน",                   aspect: 2.6,  kind: "ring_front" },
  ring_band:  { label: "ใต้แหวน (แถบโค้ง)",           aspect: 3.2,  kind: "ring_band" },
  heart:      { label: "หัวใจ",                      aspect: 1.05, kind: "heart" },
  star:       { label: "ดาว",                        aspect: 1.05, kind: "star" }
};

const PREVIEW_SHAPE_KEYS = Object.keys(PREVIEW_SHAPES);
const DEFAULT_PREVIEW_SHAPE = "rect_h";

function psFitBox(maxW, maxH, aspect) {
  let w = maxW, h = w / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }
  return { w, h };
}

function psSilverGradient(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0,    "#fcfcfc");
  g.addColorStop(0.16, "#e6e6e6");
  g.addColorStop(0.36, "#b9b9b9");
  g.addColorStop(0.5,  "#8f8f8f");
  g.addColorStop(0.64, "#c6c6c6");
  g.addColorStop(0.84, "#ececec");
  g.addColorStop(1,    "#c2c2c2");
  return g;
}

function psDrawBackground(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.08, W / 2, H * 0.5, H * 0.9);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#d8d4cc");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ---------------- เส้นทางรูปทรง ---------------- */
function psRoundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y,     x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x,     y + h, rr);
  ctx.arcTo(x,     y + h, x,     y,     rr);
  ctx.arcTo(x,     y,     x + w, y,     rr);
  ctx.closePath();
}

function psHeartPath(ctx, x, y, w, h) {
  const cx = x + w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.28);
  ctx.bezierCurveTo(cx, y, x + w * 0.02, y, x + w * 0.02, y + h * 0.28);
  ctx.bezierCurveTo(x + w * 0.02, y + h * 0.55, cx, y + h * 0.72, cx, y + h);
  ctx.bezierCurveTo(cx, y + h * 0.72, x + w * 0.98, y + h * 0.55, x + w * 0.98, y + h * 0.28);
  ctx.bezierCurveTo(x + w * 0.98, y, cx, y, cx, y + h * 0.28);
  ctx.closePath();
}

function psStarPath(ctx, x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2;
  const outerR = Math.min(w, h) / 2;
  const innerR = outerR * 0.42;
  const spikes = 5;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = (Math.PI / spikes) * i - Math.PI / 2;
    const px = cx + r * Math.cos(ang), py = cy + r * Math.sin(ang);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function psDrawShapeBase(ctx, kind, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.28)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;

  if (kind === "rect") psRoundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.14);
  else if (kind === "ellipse") { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); }
  else if (kind === "ring_front") psRoundRectPath(ctx, x, y, w, h, h / 2);
  else if (kind === "heart") psHeartPath(ctx, x, y, w, h);
  else if (kind === "star") psStarPath(ctx, x, y, w, h);
  else psRoundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.14);

  ctx.fillStyle = psSilverGradient(ctx, x, y, w, h);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.012);
  ctx.strokeStyle = "rgba(70,70,70,.35)";
  ctx.stroke();
  ctx.restore();
}

/* ---------------- พื้นที่สลักปลอดภัยภายในแต่ละรูปทรง ---------------- */
function psZoneForRect(x, y, w, h)       { return { x: x + w * 0.1, y: y + h * 0.3, w: w * 0.8, h: h * 0.4 }; }
function psZoneForEllipse(x, y, w, h) {
  const rx = w / 2, ry = h / 2, ratio = 0.5;
  const zh = ry * 2 * ratio;
  const zw = 2 * rx * Math.sqrt(1 - ratio * ratio);
  return { x: x + w / 2 - zw / 2, y: y + h / 2 - zh / 2, w: zw, h: zh };
}
function psZoneForRingFront(x, y, w, h)  { return { x: x + h * 0.55, y: y + h * 0.24, w: w - h * 1.1, h: h * 0.52 }; }
function psZoneForHeart(x, y, w, h)      { return { x: x + w * 0.22, y: y + h * 0.38, w: w * 0.56, h: h * 0.24 }; }
function psZoneForStar(x, y, w, h) {
  const s = Math.min(w, h) * 0.34;
  return { x: x + w / 2 - s / 2, y: y + h / 2 - s * 0.28, w: s, h: s * 0.56 };
}

/* ---------------- ใต้แหวน: แถบโค้งตามวง ---------------- */
function psRingBandGeometry(x, y, w, h) {
  const R = w * 0.95;
  const cx = x + w / 2;
  const cy = y + h / 2 + R - h * 0.42;
  const halfAngle = Math.asin(Math.min(0.98, (w / 2) / R));
  return { cx, cy, R, thickness: h * 0.62, startAngle: -Math.PI / 2 - halfAngle, endAngle: -Math.PI / 2 + halfAngle };
}

function psDrawRingBand(ctx, x, y, w, h) {
  const geo = psRingBandGeometry(x, y, w, h);
  const outerR = geo.R + geo.thickness / 2, innerR = geo.R - geo.thickness / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.28)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.arc(geo.cx, geo.cy, outerR, geo.startAngle, geo.endAngle, false);
  ctx.arc(geo.cx, geo.cy, innerR, geo.endAngle, geo.startAngle, true);
  ctx.closePath();
  ctx.fillStyle = psSilverGradient(ctx, x, y, w, h);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.lineWidth = Math.max(1, h * 0.02);
  ctx.strokeStyle = "rgba(70,70,70,.35)";
  ctx.stroke();
  ctx.restore();

  return geo;
}

/* ---------------- ข้อความโค้งตามส่วนโค้งของแหวน ---------------- */
function psFillTextArc(ctx, text, geo, font, color) {
  if (!text) return;
  ctx.font = font;
  const maxAngle = (geo.endAngle - geo.startAngle) * 0.92;
  let widths = [...text].map(ch => ctx.measureText(ch).width);
  let totalW = widths.reduce((a, b) => a + b, 0);
  let angleTotal = totalW / geo.R;

  if (angleTotal > maxAngle) {
    const scale = maxAngle / angleTotal;
    const sizeMatch = font.match(/([\d.]+)px/);
    if (sizeMatch) {
      const newSize = Math.max(10, parseFloat(sizeMatch[1]) * scale);
      font = font.replace(/[\d.]+px/, newSize.toFixed(1) + "px");
      ctx.font = font;
      widths = [...text].map(ch => ctx.measureText(ch).width);
      totalW = widths.reduce((a, b) => a + b, 0);
      angleTotal = totalW / geo.R;
    }
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const midAngle = (geo.startAngle + geo.endAngle) / 2;
  let angle = -angleTotal / 2;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const chAngle = widths[i] / geo.R;
    const a = midAngle + angle + chAngle / 2;
    const px = geo.cx + geo.R * Math.cos(a), py = geo.cy + geo.R * Math.sin(a);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    angle += chAngle;
  }
  ctx.restore();
}

/* ---------------- ข้อความสลักแบบมีมิติเบาๆ (เงาสว่างใต้ตัวอักษรหลัก) ---------------- */
function psFillEngravedText(ctx, text, cx, cy, maxW, font) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,.65)";
  ctx.fillText(text, cx, cy + 1.4, maxW);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillText(text, cx, cy, maxW);
  ctx.restore();
}

/* =====================================================================
   drawPreviewShape — ฟังก์ชันหลัก
   content = { text, emoji, image: HTMLImageElement|null, fontFamily, isPlaceholder }
   ===================================================================== */
function drawPreviewShape(ctx, W, H, shapeKey, content) {
  const shape = PREVIEW_SHAPES[shapeKey] || PREVIEW_SHAPES[DEFAULT_PREVIEW_SHAPE];
  psDrawBackground(ctx, W, H);

  const box = psFitBox(W * 0.76, H * 0.62, shape.aspect);
  const x = W / 2 - box.w / 2, y = H / 2 - box.h / 2;

  const text = content.text || "";
  const emoji = content.emoji || "";
  const hasLabel = !!(text || emoji);
  const label = hasLabel ? [text, emoji].filter(Boolean).join("  ") : (content.isPlaceholder ? "Your Name" : "");
  const textColor = (!hasLabel && content.isPlaceholder) ? "#9a9a9a" : "#2a2a2a";
  const fontFamily = content.fontFamily || "serif";

  if (shape.kind === "ring_band") {
    const geo = psDrawRingBand(ctx, x, y, box.w, box.h);
    if (content.image) {
      const s = box.h * 0.68;
      const sx = geo.cx + geo.R * Math.cos(geo.startAngle) - s / 2;
      const sy = geo.cy + geo.R * Math.sin(geo.startAngle) - s / 2;
      ctx.drawImage(content.image, sx, sy, s, s);
    }
    const fontSize = Math.max(12, box.h * 0.34);
    psFillTextArc(ctx, label, geo, `${fontSize}px ${fontFamily}, serif`, textColor);
    return;
  }

  psDrawShapeBase(ctx, shape.kind, x, y, box.w, box.h);

  let zone;
  if (shape.kind === "rect") zone = psZoneForRect(x, y, box.w, box.h);
  else if (shape.kind === "ellipse") zone = psZoneForEllipse(x, y, box.w, box.h);
  else if (shape.kind === "ring_front") zone = psZoneForRingFront(x, y, box.w, box.h);
  else if (shape.kind === "heart") zone = psZoneForHeart(x, y, box.w, box.h);
  else if (shape.kind === "star") zone = psZoneForStar(x, y, box.w, box.h);
  else zone = psZoneForRect(x, y, box.w, box.h);

  let textX = zone.x, textW = zone.w;
  if (content.image) {
    const size = Math.min(zone.h, zone.w * 0.32);
    ctx.drawImage(content.image, zone.x, zone.y + (zone.h - size) / 2, size, size);
    textX = zone.x + size + zone.w * 0.06;
    textW = zone.w - size - zone.w * 0.06;
  }

  if (!label) return;
  const fontSize = Math.max(13, zone.h * 0.58);
  const font = `${fontSize}px ${fontFamily}, serif`;
  const cx = textX + textW / 2, cy = zone.y + zone.h / 2, maxW = Math.max(textW, 10);

  if (textColor === "#2a2a2a") psFillEngravedText(ctx, label, cx, cy, maxW, font);
  else {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy, maxW);
    ctx.restore();
  }
}
