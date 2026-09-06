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
let slipUploaded=false;
function goToPayment(){
  if(!cart.length)return alert("กรุณาเพิ่มสินค้าในตะกร้าก่อน");
  document.getElementById("payAmount").textContent="฿"+cartTotal().toLocaleString();
  resetSlip();
  show("payment");
}
function resetSlip(){
  slipUploaded=false;
  document.getElementById("slipInput").value="";
  document.getElementById("slipPreviewWrap").style.display="none";
  document.getElementById("confirmBtn").disabled=true;
}
function uploadSlip(e){
  const file=e.target.files&&e.target.files[0];
  if(!file)return;
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
function confirmPayment(){
  if(!slipUploaded)return alert("กรุณาแนบสลิปการโอนเงินก่อนยืนยัน");
  show("success");
}
function backToHome(){
  cart=[];
  render();
  resetSlip();
  show("home");
}
selectMetal("silver");