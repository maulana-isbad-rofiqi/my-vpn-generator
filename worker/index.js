const UI_PAGE = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VPN Generator Premium</title>

<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap">

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
  margin-top: 0;
  font-size: 22px;
  font-weight: 700;
}
label {
  margin-top: 12px;
  display: block;
  font-weight: 600;
}
select, input {
  width: 100%;
  margin-top: 6px;
  padding: 12px;
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
  padding: 14px;
  border-radius: 12px;
  height: 260px;
  overflow-y: auto;
  border: 1px solid #10212e;
  white-space: pre-wrap;
}
#qrcanvas {
  margin-top: 20px;
  text-align: center;
}
</style>
</head>

<body>
<div class="container">

<h2>VPN Generator Premium (Mobile)</h2>

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
<option value="1">Ya</option>
</select>

<label>Region</label>
<select id="region"></select>

<label>ISP</label>
<select id="isp">
<option value="">Semua ISP</option>
</select>

<label>Bug Host</label>
<select id="bug">
<option>m.udemy.com</option>
<option>graph.facebook.com</option>
<option>m.youtube.com</option>
<option>api.cloudflare.com</option>
</select>

<button id="generate" class="btn-main">Generate Config</button>

<label>Payment QRIS</label>
<input id="paylink" placeholder="https://qris-link">

<button id="copy" class="btn-secondary">Copy All</button>
<button id="showqr" class="btn-secondary">QR Config</button>
<button id="showqris" class="btn-secondary">QRIS</button>
<button id="download" class="btn-secondary">Download .txt</button>

</div>

<div class="card">
<label>Hasil Config</label>
<pre id="out" class="output">Belum ada output...</pre>
<div id="qrcanvas"></div>
</div>

</div>

<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>

<script>
const REGIONS = __REGIONS__;
const workerDomain = location.hostname;

// populate region
const regionSel = document.getElementById("region");
REGIONS.forEach(function(r){
  var opt = document.createElement("option");
  opt.value = r.code;
  opt.textContent = r.code;
  regionSel.appendChild(opt);
});

// populate isp
regionSel.addEventListener("change", function(){
  var ispSel = document.getElementById("isp");
  ispSel.innerHTML = "<option value=''>Semua ISP</option>";
  var region = REGIONS.find(function(x){ return x.code === regionSel.value; });
  if(region){
    region.isps.forEach(function(i){
      var o = document.createElement("option");
      o.value = i;
      o.textContent = i;
      ispSel.appendChild(o);
    });
  }
});

document.getElementById("generate").addEventListener("click", function(){
  var url =
    "/sub?count=" + document.getElementById("count").value +
    "&type=" + document.getElementById("type").value +
    "&region=" + encodeURIComponent(regionSel.value) +
    "&isp=" + encodeURIComponent(document.getElementById("isp").value) +
    "&wildcard=" + document.getElementById("wildcard").value +
    "&bug=" + encodeURIComponent(document.getElementById("bug").value) +
    "&domain=" + encodeURIComponent(workerDomain);

  fetch(url).then(function(r){ return r.text(); }).then(function(t){
    document.getElementById("out").textContent = t;
  });
});

document.getElementById("copy").addEventListener("click", function(){
  navigator.clipboard.writeText(document.getElementById("out").textContent);
  alert("Disalin!");
});

document.getElementById("download").addEventListener("click", function(){
  var text = document.getElementById("out").textContent;
  var blob = new Blob([text], { type: "text/plain" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vpn.txt";
  a.click();
});

document.getElementById("showqr").addEventListener("click", function(){
  var cfg = document.getElementById("out").textContent.trim().split("\n")[0] || "";
  QRCode.toCanvas(cfg, { width: 240 }, function(err, canvas){
    var box = document.getElementById("qrcanvas");
    box.innerHTML = "";
    if(!err) box.appendChild(canvas);
  });
});

document.getElementById("showqris").addEventListener("click", function(){
  var link = document.getElementById("paylink").value.trim();
  if(!link){ alert("Masukkan link terlebih dahulu"); return; }
  QRCode.toCanvas(link, { width: 240 }, function(err, canvas){
    var box = document.getElementById("qrcanvas");
    box.innerHTML = "";
    if(!err) box.appendChild(canvas);
  });
});
</script>

</body>
</html>
`;
