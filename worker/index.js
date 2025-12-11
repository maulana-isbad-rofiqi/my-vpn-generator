// Worker lengkap: premium UI + API generator + small test endpoint
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const NAUTICA_PROXY_URL =
  "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/main/proxyList.txt";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS });
    }

    // Test endpoint for basic reachability
    if (url.pathname === "/sub/test") {
      const ip = url.searchParams.get("ip");
      const port = url.searchParams.get("port") || "443";
      if (!ip) return new Response("Missing ip", { status: 400, headers: CORS });
      try {
        // Try HTTPS fetch to ip (note: might fail due to TLS/SNI)
        const res = await fetch(`https://${ip}:${port}/`, { method: "GET", redirect: "manual" , cf: { cacheTtl: 0 }});
        return new Response(JSON.stringify({ ok: true, status: res.status }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    // If /sub with no query keys -> serve premium UI
    if (url.pathname === "/sub" && [...url.searchParams.keys()].length === 0) {
      const regionList = await parseRegionsAndISPs();
      const html = PREMIUM_UI.replace("__REGIONS__", JSON.stringify(regionList));
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
      });
    }

    // API generate
    if (url.pathname === "/sub") {
      try {
        // params
        const domain = url.searchParams.get("domain") || url.hostname;
        const type = (url.searchParams.get("type") || "vless").toLowerCase(); // vless|trojan
        const wildcard = url.searchParams.get("wildcard") === "1";
        const bug = url.searchParams.get("bug") || domain;
        const region = url.searchParams.get("region") || null; // CC like SG, ID
        const isp = url.searchParams.get("isp") || null; // ISP string
        const count = Number(url.searchParams.get("count") || url.searchParams.get("limit") || 1);

        // address/host/sni rules
        const address = bug;
        const host = wildcard ? `${bug}.${domain}` : domain;
        const sni = wildcard ? `${bug}.${domain}` : domain;

        // get proxies
        const txt = await fetch(NAUTICA_PROXY_URL).then(r => r.text());
        const rows = txt.split("\n").filter(Boolean);
        let proxies = rows.map(r => {
          const [ip, port, cc, org] = r.split(",");
          return { ip, port: Number(port), cc, org };
        });

        // filter by region & isp if provided
        if (region) proxies = proxies.filter(p => p.cc === region);
        if (isp) proxies = proxies.filter(p => p.org && p.org.toLowerCase().includes(isp.toLowerCase()));

        // shuffle
        for (let i = proxies.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
        }

        const uuid = crypto.randomUUID();
        const out = [];

        // produce exactly `count` entries or fewer if not enough proxies
        for (const p of proxies.slice(0, count)) {
          if (type === "vless") out.push(buildVLESS(uuid, address, host, sni, p));
          else out.push(buildTROJAN(uuid, address, host, sni, p));
        }

        return new Response(out.join("\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS },
        });

      } catch (e) {
        return new Response("ERR: " + e.message, { status: 500, headers: CORS });
      }
    }

    return new Response("VPN Generator • Connected", { headers: CORS });
  }
};

// helper: parse region list with ISPs mapping
async function parseRegionsAndISPs() {
  const txt = await fetch(NAUTICA_PROXY_URL).then(r => r.text());
  const rows = txt.split("\n").filter(Boolean);
  const map = {}; // cc -> { code, isps: Set() }

  for (const r of rows) {
    const [ip, port, cc, org] = r.split(",");
    if (!cc) continue;
    if (!map[cc]) map[cc] = { code: cc, isps: new Set() };
    if (org) map[cc].isps.add(org.trim());
  }

  const out = Object.values(map).map(x => ({ code: x.code, isps: [...x.isps] }));
  // sort by code
  out.sort((a,b)=> a.code.localeCompare(b.code));
  return out;
}

function buildVLESS(uuid, address, host, sni, px) {
  return `vless://${uuid}@${address}:443?security=tls&type=ws&sni=${encodeURIComponent(sni)}&host=${encodeURIComponent(host)}&path=/${px.ip}-${px.port}#${px.cc}%20${encodeURIComponent(px.org)}`;
}
function buildTROJAN(uuid, address, host, sni, px) {
  return `trojan://${uuid}@${address}:443?security=tls&type=ws&sni=${encodeURIComponent(sni)}&host=${encodeURIComponent(host)}&path=/${px.ip}-${px.port}#${px.cc}%20${encodeURIComponent(px.org)}`;
}

// PREMIUM UI HTML (embedded). Uses jsDelivr qrcode library for QR generation.
// __REGIONS__ will be injected as JSON [{code:"SG", isps:["Cloudflare",...]}, ...]
const PREMIUM_UI = `
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>VPN Generator • Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07101a;--card:#0f1720;--muted:#9fb0c1;--accent:#00ffc3}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,Arial;background:linear-gradient(180deg,#061018,#07101a);color:#e6f7ff;padding:28px}
.container{max-width:1100px;margin:0 auto}
.header{display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand{font-weight:700;font-size:20px}
.panel{display:grid;grid-template-columns:320px 1fr;gap:20px;margin-top:20px}
.card{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));padding:18px;border-radius:12px;border:1px solid rgba(255,255,255,0.04)}
.select,input,button{width:100%;padding:10px;border-radius:8px;border:none;background:#07121a;color:inherit;font-size:14px}
.row{display:flex;gap:10px}
.grid-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.badge{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.02);border-radius:8px}
.flag{width:20px;display:inline-block;text-align:center}
.actions{display:flex;gap:8px;align-items:center}
.btn{background:linear-gradient(90deg,var(--accent),#00c2ff);color:#001217;font-weight:700;padding:10px 12px;border-radius:8px;cursor:pointer}
.secondary{background:#0b2633;color:#bfeff2}
.output{margin-top:12px;background:#02050a;padding:12px;border-radius:10px;max-height:360px;overflow:auto;white-space:pre-wrap;color:#cfe7f0}
.qrwrap{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px}
.small{font-size:13px;color:var(--muted)}
.footer{margin-top:18px;color:var(--muted);font-size:13px;text-align:center}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">VPN Generator • Dashboard (Premium)</div>
    <div class="small">Endpoint: <code>/sub</code> • Powered by Nautica</div>
  </div>

  <div class="panel">
    <div class="card">
      <div class="small" style="margin-bottom:8px">Jumlah Config</div>
      <select id="count">
        <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option>
      </select>

      <div class="small" style="margin-top:12px">Jenis</div>
      <div class="grid-two" style="margin-top:6px">
        <select id="type"><option value="vless">VLESS</option><option value="trojan">TROJAN</option></select>
        <select id="wildcard"><option value="0">No Wildcard</option><option value="1">Wildcard</option></select>
      </div>

      <div class="small" style="margin-top:12px">Region</div>
      <select id="region"></select>

      <div class="small" style="margin-top:12px">Pilih ISP (berdasarkan region)</div>
      <select id="isp"></select>

      <div class="small" style="margin-top:12px">Pilih BUG (host)</div>
      <select id="bug">
        <option>m.udemy.com</option>
        <option>m.youtube.com</option>
        <option>graph.facebook.com</option>
        <option>api.cloudflare.com</option>
        <option>cdn.cloudflare.com</option>
      </select>

      <div style="margin-top:12px" class="row">
        <button class="btn" id="generate">Generate</button>
        <button class="secondary" id="test">Test Reach</button>
      </div>

      <div class="small" style="margin-top:14px">QRIS / Payment (masukkan link pembayaran jika mau buat QRIS)</div>
      <input id="paylink" placeholder="https://pay.link/your-checkout"/>

      <div class="qrwrap">
        <button id="copy" class="secondary">Copy All</button>
        <button id="showqr" class="secondary">Show QR</button>
        <button id="showqris" class="secondary">Show QRIS</button>
      </div>

      <div style="margin-top:10px" class="small">Preview (address / host / sni)</div>
      <div class="small badge" id="preview">—</div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><strong>Hasil</strong> <span class="small">(config / subscription)</span></div>
        <div class="small">Copy / QR available</div>
      </div>

      <pre id="out" class="output">Klik Generate untuk membuat config...</pre>

      <div id="qrcanvas" style="margin-top:12px"></div>
    </div>
  </div>

  <div class="footer">Jika koneksi tidak jalan, cek client logs (TLS/SNI/timeout). Test Reach hanya indikatif.</div>
</div>

<!-- qrcode lib -->
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>

<script>
const regions = __REGIONS__; // injected
const REGION_SELECT = document.getElementById('region');
const ISP_SELECT = document.getElementById('isp');
const OUT = document.getElementById('out');
const PREVIEW = document.getElementById('preview');

function flagEmoji(cc){
  if(!cc || cc.length!==2) return cc;
  return [...cc.toUpperCase()].map(c=>String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
}

// populate region dropdown (show flag + code)
regions.forEach(r=>{
  const opt = document.createElement('option');
  opt.value = r.code;
  opt.textContent = flagEmoji(r.code.substr(0,2)) + "  " + r.code;
  REGION_SELECT.appendChild(opt);
});

// when region changes populate ISP
function populateISPs(){
  const code = REGION_SELECT.value;
  ISP_SELECT.innerHTML = '<option value="">(Semua ISP)</option>';
  const obj = regions.find(x=>x.code===code);
  if(obj && obj.isps){
    obj.isps.forEach(i=>{
      const o = document.createElement('option');
      o.value = i; o.textContent = i;
      ISP_SELECT.appendChild(o);
    });
  }
  updatePreview();
}

// preview generation
function updatePreview(){
  const bug = document.getElementById('bug').value;
  const wildcard = document.getElementById('wildcard').value === '1';
  const domain = location.hostname;
  const address = bug;
  const host = wildcard ? (bug + '.' + domain) : domain;
  const sni = wildcard ? (bug + '.' + domain) : domain;
  PREVIEW.textContent = 'address: ' + address + '  |  host: ' + host + '  |  sni: ' + sni;
}

REGION_SELECT.addEventListener('change', populateISPs);
document.getElementById('bug').addEventListener('change', updatePreview);
document.getElementById('wildcard').addEventListener('change', updatePreview);

// initial populate
if(REGION_SELECT.options.length) REGION_SELECT.selectedIndex = 0;
populateISPs();

document.getElementById('generate').addEventListener('click', async ()=>{
  const count = document.getElementById('count').value;
  const type = document.getElementById('type').value;
  const wildcard = document.getElementById('wildcard').value;
  const region = document.getElementById('region').value;
  const isp = document.getElementById('isp').value;
  const bug = document.getElementById('bug').value;
  const domain = location.hostname;

  const url = \`/sub?count=\${count}&type=\${encodeURIComponent(type)}&region=\${encodeURIComponent(region)}&isp=\${encodeURIComponent(isp)}&wildcard=\${wildcard}&bug=\${encodeURIComponent(bug)}&domain=\${encodeURIComponent(domain)}\`;
  OUT.textContent = 'Requesting...\\n' + url;
  try {
    const r = await fetch(url);
    const t = await r.text();
    OUT.textContent = t;
  } catch(e){
    OUT.textContent = 'Fetch error: ' + e.message;
  }
  updatePreview();
});

document.getElementById('copy').addEventListener('click', ()=>{
  const t = OUT.textContent;
  if(!t) return alert('Tidak ada hasil.');
  navigator.clipboard.writeText(t).then(()=>alert('Tersalin!'),()=>alert('Gagal copy'));
});

document.getElementById('showqr').addEventListener('click', async ()=>{
  const text = OUT.textContent.trim();
  if(!text) return alert('Tidak ada hasil untuk QR');
  // show first config only
  const first = text.split('\\n')[0];
  document.getElementById('qrcanvas').innerHTML='';
  QRCode.toCanvas(first, { width: 240 }).then(canvas=>{
    document.getElementById('qrcanvas').appendChild(canvas);
  }).catch(err=>alert('QR error: '+err));
});

// QRIS (payment) — generate QR from link in input
document.getElementById('showqris').addEventListener('click', ()=>{
  const link = document.getElementById('paylink').value.trim();
  if(!link) return alert('Masukkan link pembayaran/checkout untuk QRIS');
  document.getElementById('qrcanvas').innerHTML='';
  QRCode.toCanvas(link, { width: 240 }).then(canvas=>{
    document.getElementById('qrcanvas').appendChild(canvas);
  }).catch(err=>alert('QR error: '+err));
});

// Test Reach button
document.getElementById('test').addEventListener('click', async ()=>{
  const raw = OUT.textContent.trim();
  if(!raw) return alert('Generate dulu config untuk mendapatkan IP (hasil akan dipakai untuk test)');
  // get first ip from first line's path /ip-port
  const first = raw.split('\\n')[0];
  // find /ip-port in url
  const m = first.match(/\\/([0-9\\.]+)-([0-9]+)/);
  if(!m) return alert('Tidak menemukan IP:PORT di hasil pertama');
  const ip = m[1], port = m[2];
  const testUrl = \`/sub/test?ip=\${ip}&port=\${port}\`;
  OUT.textContent += '\\n\\nRunning reachability test to ' + ip + ':' + port + ' ...';
  try{
    const r = await fetch(testUrl);
    const j = await r.json();
    OUT.textContent += '\\nTest result: ' + JSON.stringify(j);
  } catch(e){
    OUT.textContent += '\\nTest error: ' + e.message;
  }
});

</script>
</body>
</html>
`;

