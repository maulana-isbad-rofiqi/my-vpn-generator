const UI_PAGE = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>VPN Generator Premium</title>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">

<style>
body {
  margin: 0;
  padding: 18px;
  background: #050c14;
  color: #e6f6ff;
  font-family: Inter, sans-serif;
}

.container {
  max-width: 600px;
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
  margin: 0 0 8px 0;
  font-size: 22px;
  font-weight: 700;
}

label {
  display: block;
  margin-top: 12px;
  font-size: 14px;
  font-weight: 600;
}

select, input {
  width: 100%;
  padding: 12px;
  margin-top: 6px;
  font-size: 14px;
  border-radius: 10px;
  border: 1px solid #132531;
  background: #09131b;
  color: #d4f2ff;
}

button {
  width: 100%;
  padding: 14px;
  margin-top: 14px;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}

.btn-main {
  background: linear-gradient(90deg, #00ffc8, #00c4ff);
  color: #002828;
}

.btn-secondary {
  background: #112631;
  color: #cdefff;
}

.output {
  background: #000a12;
  border: 1px solid #10212e;
  padding: 14px;
  border-radius: 12px;
  height: 260px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-size: 13px;
}

#qrcanvas {
  margin-top: 16px;
  text-align: center;
}

.footer {
  text-align: center;
  margin-top: 28px;
  font-size: 13px;
  color: #89a7b8;
}

</style>
</head>

<body>
<div class="container">

<h2>VPN Generator • Premium Mobile</h2>
<div style="color:#7fa5b7; font-size:13px; margin-bottom:14px;">
  Domain Worker: <b id="workerdomain"></b>
</div>

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
  <select id="isp">
    <option value="">(Semua ISP)</option>
  </select>

  <label>BUG Host</label>
  <select id="bug">
    <option>m.udemy.com</option>
    <option>cdn.cloudflare.com</option>
    <option>graph.facebook.com</option>
    <option>m.youtube.com</option>
    <option>api.cloudflare.com</option>
  </select>

  <button id="generate" class="btn-main">Generate Config</button>

  <label>Payment Link (QRIS)</label>
  <input id="paylink" placeholder="https://link-pembayaran..." />

  <button id="copy" class="btn-secondary">Copy All</button>
  <button id="showqr" class="btn-secondary">Tampilkan QR Config</button>
  <button id="showqris" class="btn-secondary">Tampilkan QRIS</button>
  <button id="download" class="btn-secondary">Download .txt</button>

  <div id="preview" style="margin-top:12px; font-size:13px; color:#8bb0c1;"></div>
</div>

<div class="card">
  <label>Hasil Config</label>
  <pre id="out" class="output">Belum ada output…</pre>
  <div id="qrcanvas"></div>
</div>

<div class="footer">UI Premium • Fully Mobile</div>

</div>

<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>

<script>
const REGIONS = __REGIONS__;
const workerDomain = location.hostname;
document.getElementById("workerdomain").textContent = workerDomain;

// populate region & isp
const regionSel = document.getElementById("region");
const ispSel = document.getElementById("isp");

function flag(c){
  return [...c].map(x=>String.fromCodePoint(127397 + x.charCodeAt())).join("");
}

REGIONS.forEach(r=>{
  const el = document.createElement("option");
  el.value = r.code;
  el.textContent = flag(r.code) + " " + r.code;
  regionSel.appendChild(el);
});

function loadISP(){
  ispSel.innerHTML = "<option value=''> (Semua ISP) </option>";
  const r = REGIONS.find(x => x.code === regionSel.value);
  if(r){
    r.isps.forEach(i=>{
      const el = document.createElement("option");
      el.value = i;
      el.textContent = i;
      ispSel.appendChild(el);
    });
  }
}
regionSel.addEventListener("change", loadISP);
loadISP();

// preview
function updatePreview(){
  const bug = document.getElementById("bug").value;
  const w = document.getElementById("wildcard").value === "1";
  const host = w ? bug : workerDomain;
  const sni  = w ? bug : workerDomain;
  document.getElementById("preview").textContent =
    "address=" + workerDomain + " • host=" + host + " • sni=" + sni;
}
document.getElementById("bug").addEventListener("change", updatePreview);
document.getElementById("wildcard").addEventListener("change", updatePreview);
updatePreview();

// generate
document.getElementById("generate").addEventListener("click", async ()=>{
  const url =
    "/sub?count="+document.getElementById("count").value+
    "&type="+document.getElementById("type").value+
    "&region="+encodeURIComponent(regionSel.value)+
    "&isp="+encodeURIComponent(ispSel.value)+
    "&wildcard="+document.getElementById("wildcard").value+
    "&bug="+encodeURIComponent(document.getElementById("bug").value)+
    "&domain="+encodeURIComponent(workerDomain);

  const out = document.getElementById("out");
  out.textContent = "Loading...\n" + url;

  const res = await fetch(url);
  out.textContent = await res.text();
});

// copy
document.getElementById("copy").addEventListener("click", ()=>{
  navigator.clipboard.writeText(document.getElementById("out").textContent);
  alert("Disalin!");
});

// QR config
document.getElementById("showqr").addEventListener("click", ()=>{
  const raw = document.getElementById("out").textContent.trim();
  const first = raw.split("\\n")[0];
  QRCode.toCanvas(first, { width: 240 }).then(c=>{
    document.getElementById("qrcanvas").innerHTML = "";
    document.getElementById("qrcanvas").appendChild(c);
  });
});

// QRIS
document.getElementById("showqris").addEventListener("click", ()=>{
  const link = document.getElementById("paylink").value.trim();
  if(!link) return alert("Isi link pembayaran dulu");
  QRCode.toCanvas(link, { width: 240 }).then(c=>{
    document.getElementById("qrcanvas").innerHTML = "";
    document.getElementById("qrcanvas").appendChild(c);
  });
});

// download
document.getElementById("download").addEventListener("click", ()=>{
  const text = document.getElementById("out").textContent;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vpn-config.txt";
  a.click();
});
</script>

</body>
</html>
`;
