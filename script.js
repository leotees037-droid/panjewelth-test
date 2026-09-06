let cart=[],metal="silver",currentFont="serif";const prices={silver:890,gold:1190,black:990,rose:1090};
function show(id){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));document.getElementById(id).classList.add("active")}
function update(){document.getElementById("preview").textContent=document.getElementById("name").value||"Your Name"}
function font(f){currentFont=f;document.getElementById("preview").style.fontFamily=f;document.querySelectorAll(".fonts button").forEach(b=>b.classList.remove("selected"));event.currentTarget.classList.add("selected")}
function selectMetal(m){metal=m;document.getElementById("price").textContent=prices[m];document.querySelectorAll("[data-metal]").forEach(b=>b.classList.toggle("selected",b.dataset.metal===m))}
function add(){cart.push({name:document.getElementById("name").value.trim()||"Your Name",metal,price:prices[metal]});render();show("cart")}
function cartTotal(){return cart.reduce((s,x)=>s+x.price,0)}
function render(){
  document.getElementById("count").textContent=cart.length;
  document.getElementById("items").innerHTML=cart.length?cart.map(x=>`<div class="item"><span>สร้อย ${x.metal}<br><b>${x.name}</b></span><b>฿${x.price.toLocaleString()}</b></div>`).join(""):"ยังไม่มีสินค้าในตะกร้า";
  const totalBox=document.getElementById("cartTotal");
  if(cart.length){totalBox.style.display="flex";document.getElementById("totalPrice").textContent="฿"+cartTotal().toLocaleString()}
  else{totalBox.style.display="none"}
}
let slipUploaded=false,slipFile=null;
function goToPayment(){
  if(!cart.length)return alert("กรุณาเพิ่มสินค้าในตะกร้าก่อน");
  document.getElementById("payAmount").textContent="฿"+cartTotal().toLocaleString();
  resetSlip();
  show("payment");
}
function resetSlip(){
  slipUploaded=false;
  slipFile=null;
  document.getElementById("slipInput").value="";
  document.getElementById("slipPreviewWrap").style.display="none";
  document.getElementById("confirmBtn").disabled=true;
  document.getElementById("payStatus").textContent="";
}
function uploadSlip(e){
  const file=e.target.files&&e.target.files[0];
  if(!file)return;
  slipFile=file;
  const reader=new FileReader();
  reader.onload=function(ev){
    document.getElementById("slipPreview").src=ev.target.result;
    document.getElementById("slipName").textContent=file.name;
    document.getElementById("slipPreviewWrap").style.display="flex";
    slipUploaded=true;
    document.getElementById("confirmBtn").disabled=false;
  };
  reader.readAsDataURL(file);
}
async function confirmPayment(){
  const status=document.getElementById("payStatus");
  const btn=document.getElementById("confirmBtn");
  if(!slipUploaded)return alert("กรุณาแนบสลิปการโอนเงินก่อนยืนยัน");
  const custName=document.getElementById("custName").value.trim();
  const custPhone=document.getElementById("custPhone").value.trim();
  const custAddress=document.getElementById("custAddress").value.trim();
  if(!custName||!custPhone||!custAddress)return alert("กรุณากรอกชื่อ เบอร์โทรศัพท์ และที่อยู่จัดส่งให้ครบ");
  if(typeof sb==="undefined"){status.textContent="ยังไม่ได้ตั้งค่า Supabase (ดู supabase-config.js)";return}
  btn.disabled=true;
  status.textContent="กำลังบันทึกคำสั่งซื้อ...";
  try{
    const ext=(slipFile.name.split(".").pop()||"jpg").toLowerCase();
    const path=`slip-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const{error:upErr}=await sb.storage.from("slips").upload(path,slipFile);
    if(upErr)throw upErr;
    const{data:urlData}=sb.storage.from("slips").getPublicUrl(path);
    const{error:insErr}=await sb.from("orders").insert({
      customer_name:custName,
      customer_phone:custPhone,
      customer_address:custAddress,
      items:cart,
      total:cartTotal(),
      slip_url:urlData.publicUrl
    });
    if(insErr)throw insErr;
    show("success");
  }catch(err){
    console.error(err);
    status.textContent="บันทึกไม่สำเร็จ: "+(err.message||"ลองใหม่อีกครั้ง");
    btn.disabled=false;
  }
}
function backToHome(){
  cart=[];
  render();
  document.getElementById("custName").value="";
  document.getElementById("custPhone").value="";
  document.getElementById("custAddress").value="";
  resetSlip();
  show("home");
}
selectMetal("silver");