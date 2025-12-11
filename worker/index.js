const UI_PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>VPN Generator Premium</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">

<style>
body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  background: #050c14;
  color: #e5f6ff;
  padding: 18px;
  line-height: 1.45;
}

.container {
  max-width: 620px;
  margin: auto;
}

.card {
  background: #0c1620;
  padding: 16px;
  border-radius: 14px;
  margin-bottom: 18px;
  border: 1px solid #112431;
}

h2 {
  margin-bottom: 6px;
  font-size: 22px;
  font-weight: 700;
}

label {
  font-size: 14px;
  font-weight: 600;
  margin-top: 10px;
  display: block;
}

select, input {
  width: 100%;
  padding: 12px;
  margin-top: 6px;
  background: #09131b;
  border: 1px solid #132531;
  border-radius: 10px;
  color: #d2f1ff;
  font-size: 14px;
}

button {
  width: 100%;
  padding: 14px;
  margin-top: 12px;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}

.btn-main {
  background: linear-gradient(90deg, #00ffc8, #00c4ff);
  color: #002e2e;
}

.btn-secondary {
  background: #112631;
  color: #ccefff;
}

.output {
  background: #000a12;
  padding: 14px;
  border-radius: 12px;
  height: 260px;
  overflow: auto;
  font-size: 13px;
  border: 1px solid #10212e;
}

.qrbox {
  margin-top: 16px;
  text-align: center;
}

.footer {
  margin-top: 26px;
  font-size: 13px;
  color: #88a7b8;
  text-align: center;
}

.flag {
  width: 20px;
  margin-right: 6px;
}
</style>
</head>

<body>
<div class="container">

<h2>VPN Generator • Mobile Panel</h2>
<p style="color:#7fa5b7; font-size:13px; margin-top:0;">
  Powered by Nautica • <b id="workerdomain"></b>
</p>

<div class="card">
  <label>Jumlah Config</label>
  <select id="count">
    <option>1</option>
    <option>3</option>
    <option>5</option>
    <option>10</option>
  </select>

  <label>Jenis Config</label>
  <select id="type">
    <option value="vless">VLESS</option>
    <option value="trojan">TROJAN</option>
  </select>

  <label>Wildcard</label>
  <select id="wildcard">
    <option value="0">Tidak</option>
    <option value="1">Ya (Host = BUG)</option>
  </select>

  <label>Region</label>
  <select id="region"></select>

  <label>ISP</label>
  <select id="isp"><option value="">(Semua ISP)</option></select>

  <label>BUG Host</label>
  <select id="bug">
    <option>m.udemy.com</option>
    <option>m.youtube.com</option>
    <option>cdn.cloudflare.com</option>
    <option>graph.facebook.com</option>
    <option>api.cloudflare.com</option>
  </select>

  <button class="btn-main" id="generate">Generate Config</button>

  <label>Payment Link (QRIS)</label>
  <input id="paylink" placeholder="https://pembayaran..." />

  <button class="btn-secondary" id="copy">Copy All</button>
  <button class="btn-secondary" id="showqr">Tampilkan QR</button>
  <button class="btn-secondary" id="showqris">QRIS Bayar</button>
  <button class="btn-secondary" id="download">Download .txt</button>

  <p id="preview" style="font-size:13px; color:#8bb0c1; margin-top:12px;"></p>
</div>

<div class="card">
  <label>Hasil Config</label>
  <pre id="out" class="output">Belum ada output…</pre>

  <div id="qrcanvas" class="qrbox"></div>
</div>

<div class="footer">UI Premium • Mobile Optimized</div>

</div>

<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>

<script>
const REGIONS = __REGIONS__;
const workerDomain = location.hostname;
document.getElementById("workerdomain").textContent = workerDomain;

// populate region list
const regionSelect = document.getElementById("region");
const ispSelect = document.getElementById("isp");

function flag(cc){
  return [...cc].map(c=>String.fromCodePoint(127397+c.charCodeAt())).join('');
}

REGIONS.forEach(r=>{
  const opt=document.createElement("option");
  opt.value=r.code;
  opt.textContent = flag(r.code)+" "+r.code;
  regionSelect.appendChild(opt);
});

function loadISPs(){
  ispSelect.innerHTML = '<option value="">(Semua ISP)</option>';
  const reg = REGIONS.find(x=>x.code === regionSelect.value);
  if(reg) reg.isps.forEach(i=>{
    const op=document.createElement("option");
    op.value=i;
    op.textContent=i;
    ispSelect.appendChild(op);
  });
}
regionSelect.addEventListener("change", loadISPs);
loadISPs();

// preview updater
function updatePreview(){
  const bug = document.getElementById("bug").value;
  const wildcard = document.getElementById("wildcard").value === "1";
  const host = wildcard ? bug : workerDomain;
  const sni  = wildcard ? bug : workerDomain;
  document.getElementById("preview").textContent =
    "address="+workerDomain+" • host="+host+" • sni="+sni;
}
document.getElementById("bug").addEventListener("change", updatePreview);
document.getElementById("wildcard").addEventListener("change", updatePreview);
updatePreview();

// GENERATE
document.getElementById("generate").addEventListener("click", async ()=>{
  const url =
    "/sub?count="+document.getElementById("count").value+
    "&type="+document.getElementById("type").value+
    "&region="+encodeURIComponent(regionSelect.value)+
    "&isp="+encodeURIComponent(ispSelect.value)+
    "&wildcard="+document.getElementById("wildcard").value+
    "&bug="+encodeURIComponent(document.getElementById("bug").value)+
    "&domain="+encodeURIComponent(workerDomain);

  const out = document.getElementById("out");
  out.textContent = "Loading config...\n"+url;

  const res = await fetch(url);
  out.textContent = await res.text();
});

// COPY
document.getElementById("copy").addEventListener("click",()=>{
  navigator.clipboard.writeText(document.getElementById("out").textContent);
  alert("Disalin!");
});

// QR config
document.getElementById("showqr").addEventListener("click",()=>{
  const raw=document.getElementById("out").textContent.trim();
  const first=raw.split("\\n")[0];
  QRCode.toCanvas(first,{width:240}).then(c=>{
    document.getElementById("qrcanvas").innerHTML="";
    document.getElementById("qrcanvas").appendChild(c);
  });
});

// QRIS
document.getElementById("showqris").addEventListener("click",()=>{
  const link=document.getElementById("paylink").value.trim();
  if(!link) return alert("Masukkan Payment Link dulu!");
  QRCode.toCanvas(link,{width:240}).then(c=>{
    document.getElementById("qrcanvas").innerHTML="";
    document.getElementById("qrcanvas").appendChild(c);
  });
});

// DOWNLOAD
document.getElementById("download").addEventListener("click",()=>{
  const text=document.getElementById("out").textContent;
  const blob=new Blob([text],{type:"text/plain"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="vpn-config.txt";a.click();
});
</script>

</body>
</html>`;
