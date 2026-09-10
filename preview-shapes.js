/* =====================================================================
   LUXENAME — เอนจินวาดรูปทรงพรีวิว 2D สแตนเลส 304 (หรูหรา มินิมอล ไม่มีแสงสะท้อน)
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
  heart:      { label: "หัวใจ",                      aspect: 1.1,  kind: "heart" },
  star:       { label: "ดาว",                        aspect: 1.05, kind: "star" }
};

const PREVIEW_SHAPE_KEYS = Object.keys(PREVIEW_SHAPES);
const DEFAULT_PREVIEW_SHAPE = "rect_h";

function psFitBox(maxW, maxH, aspect) {
  let w = maxW, h = w / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }
  return { w, h };
}

/* พื้นผิวสแตนเลส 304 แบบด้าน (matte) — ไล่สีเรียบจากบนลงล่าง ไม่มีแถบแสงสะท้อน */
function psSilverGradient(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#e6e7e8");
  g.addColorStop(1, "#b7b9bb");
  return g;
}

/* พื้นหลังเรียบสีกลาง เน้นให้เห็นชิ้นงานชัด ไม่แย่งความสนใจ */
function psDrawBackground(ctx, W, H) {
  ctx.fillStyle = "#f2f1ee";
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

/* หัวใจทรงเรียบง่าย สมมาตรซ้าย-ขวา 100% (โค้งบนสองแฉกเท่ากัน + จรดปลายแหลมกึ่งกลางด้านล่าง) */
function psHeartPath(ctx, x, y, w, h) {
  const midX = x + w / 2;
  const topCurveY = y + h * 0.28;
  const midY = (h + topCurveY - y) / 2 + y;
  ctx.beginPath();
  ctx.moveTo(midX, topCurveY);
  ctx.bezierCurveTo(midX, y, x, y, x, topCurveY);
  ctx.bezierCurveTo(x, midY, midX, midY, midX, y + h);
  ctx.bezierCurveTo(midX, midY, x + w, midY, x + w, topCurveY);
  ctx.bezierCurveTo(x + w, y, midX, y, midX, topCurveY);
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
  ctx.shadowColor = "rgba(0,0,0,.12)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;

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
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.01);
  ctx.strokeStyle = "rgba(90,92,94,.3)";
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
function psZoneForHeart(x, y, w, h)      { return { x: x + w * 0.24, y: y + h * 0.4, w: w * 0.52, h: h * 0.2 }; }
function psZoneForStar(x, y, w, h) {
  const s = Math.min(w, h) * 0.34;
  return { x: x + w / 2 - s / 2, y: y + h / 2 - s * 0.28, w: s, h: s * 0.56 };
}

/* ---------------- ข้อความสลัก — สีเรียบเดียว อ่านง่าย ไม่มีเอฟเฟกต์แสง ---------------- */
function psFillEngravedText(ctx, text, cx, cy, maxW, font) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#2f3133";
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
  const textColor = (!hasLabel && content.isPlaceholder) ? "#9a9a9a" : "#2f3133";
  const fontFamily = content.fontFamily || "serif";

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

  if (textColor === "#2f3133") psFillEngravedText(ctx, label, cx, cy, maxW, font);
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
