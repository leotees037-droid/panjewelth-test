let cart=[],metal="silver",currentFont="serif";const prices={silver:890,gold:1190,black:990,rose:1090};
function show(id){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));document.getElementById(id).classList.add("active")}
function update(){document.getElementById("preview").textContent=document.getElementById("name").value||"Your Name"}
function font(f){currentFont=f;document.getElementById("preview").style.fontFamily=f;document.querySelectorAll(".fonts button").forEach(b=>b.classList.remove("selected"));event.currentTarget.classList.add("selected")}
function selectMetal(m){metal=m;document.getElementById("price").textContent=prices[m];document.querySelectorAll("[data-metal]").forEach(b=>b.classList.toggle("selected",b.dataset.metal===m))}
function add(){cart.push({name:document.getElementById("name").value.trim()||"Your Name",metal,price:prices[metal]});render();show("cart")}
function render(){document.getElementById("count").textContent=cart.length;document.getElementById("items").innerHTML=cart.length?cart.map(x=>`<div class="item"><span>สร้อย ${x.metal}<br><b>${x.name}</b></span><b>฿${x.price.toLocaleString()}</b></div>`).join(""):"ยังไม่มีสินค้าในตะกร้า"}
function checkout(){if(!cart.length)return alert("กรุณาเพิ่มสินค้าในตะกร้าก่อน");alert("สั่งซื้อ Demo สำเร็จ! ไม่มีการตัดเงินจริง")}
selectMetal("silver");