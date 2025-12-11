// worker/index.js
// Full Worker: UI Premium + API generator compatible with "cloudflare:sockets" engine

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

    // Test endpoint (indikatif)
    if (url.pathname === "/sub/test") {
      const ip = url.searchParams.get("ip");
      const port = url.searchParams.get("port") || "443";
      if (!ip) return new Response("Missing ip", { status: 400, headers: CORS });
      try {
        const res = await fetch(`https://${ip}:${port}/`, { method: "GET", redirect: "manual", cf: { cacheTtl: 0 }});
        return new Response(JSON.stringify({ ok: true, status: res.status }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    // Serve UI when calling /sub without api params (or when no query keys)
    if (url.pathname === "/sub" && [...url.searchParams.keys()].length === 0) {
      const regionList = await parseRegionsAndISPs();
      const html = UI_PAGE.replace("__REGIONS__", JSON.stringify(regionList));
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
      });
    }

    // API: /sub?count=1&type=vless&region=SG&isp=Cloudflare&wildcard=0&bug=m.udemy.com&domain=...
    if (url.pathname === "/sub") {
      try {
        const domain = url.searchParams.get("domain") || url.hostname; // address must be worker domain
        const type = (url.searchParams.get("type") || "vless").toLowerCase(); // vless|trojan
        const wildcard = url.searchParams.get("wildcard") === "1";
        const bug = url.searchParams.get("bug") || domain;
        const region = url.searchParams.get("region") || null;
        const isp = url.searchParams.get("isp") || null;
        const count = Number(url.searchParams.get("count") || url.searchParams.get("limit") || 1);

        // address = worker domain always (so worker accepts WS upgrade)
        const address = domain;
        // host/sni rules:
        // if wildcard ON -> host = bug, sni = bug
        // if wildcard OFF -> host = domain, sni = domain
        const host = wildcard ? bug : domain;
        const sni = wildcard ? bug : domain;

        // fetch proxy list and parse
        const txt = await fetch(NAUTICA_PROXY_URL).then(r => r.text());
        const rows = txt.split("\n").filter(Boolean);
        let proxies = rows.map(r => {
          const [ip, port, cc, org] = r.split(",");
          return { ip, port: Number(port), cc, org };
        });

        // filter region and isp
        if (region) proxies = proxies.filter(p => p.cc === region);
        if (isp) proxies = proxies.filter(p => p.org && p.org.toLowerCase().includes(isp.toLowerCase()));

        // shuffle
        for (let i = proxies.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
        }

        const uuid = crypto.randomUUID();
        const outputs = [];

        for (const p of proxies.slice(0, count)) {
          if (type === "vless") {
            outputs.push(buildVLESS(uuid, address, host, sni, p));
          } else {
            outputs.push(buildTROJAN(uuid, address, host, sni, p));
          }
        }

        // default plain text list (one per line)
        return new Response(outputs.join("\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS },
        });

      } catch (err) {
        return new Response("ERR: " + err.message, {
          status: 500,
          headers: CORS,
        });
      }
    }

    // default root
    return new Response("VPN Generator • Connected", { headers: CORS });
  }
};

// helpers: builders & parsers
function buildVLESS(uuid, address, host, sni, px) {
  // keep ws + path = /<ip>-<port> and security=tls
  // ensure url encoded host and sni
  return `vless://${uuid}@${address}:443?security=tls&type=ws&path=/${px.ip}-${px.port}&host=${encodeURIComponent(host)}&sni=${encodeURIComponent(sni)}#${px.cc}%20${encodeURIComponent(px.org)}`;
}
function buildTROJAN(uuid, address, host, sni, px) {
  return `trojan://${uuid}@${address}:443?security=tls&type=ws&path=/${px.ip}-${px.port}&host=${encodeURIComponent(host)}&sni=${encodeURIComponent(sni)}#${px.cc}%20${encodeURIComponent(px.org)}`;
}

async function parseRegionsAndISPs() {
  const txt = await fetch(NAUTICA_PROXY_URL).then(r => r.text());
  const rows = txt.split("\n").filter(Boolean);
  const map = {};
  for (const r of rows) {
    const [ip, port, cc, org] = r.split(",");
    if (!cc) continue;
    const code = cc.trim();
    if (!map[code]) map[code] = new Set();
    if (org) map[code].add(org.trim());
  }
  const out = Object.keys(map).sort().map(code => ({ code, isps: [...map[code]] }));
  return out;
}

function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return cc;
  return [...cc.toUpperCase()].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
}

// =========================
// PREMIUM UI (embedded) - responsive & mobile friendly
// __REGIONS__ will be replaced with JSON array: [{code:'SG', isps:['Cloudflare',...]}...]
// =========================
const UI_PAGE = `
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>VPN Generator • Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#07101a; --card:#0f1720; --muted:#93a9b8; --accent1:#00ffc3; --accent2:#00c2ff;
}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,Arial;background:linear-gradient(180deg,#061018,#07101a);color:#e6f7ff;padding:20px}
.container{max-width:1100px;margin:0 auto}
.header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.brand{font-weight:700;font-size:18px}
.note{font-size:13px;color:var(--muted)}
.panel{display:grid;grid-template-columns:360px 1fr;gap:18px;margin-top:18px}
@media(max-width:900px){.panel{grid-template-columns:1fr;}}
.card{background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));padding:16px;border-radius:12px;border:1px solid rgba(255,255,255,0.04)}
.select,input,button{width:100%;padding:10px;border-radius:8px;border:none;background:#06151a;color:inherit;font-size:14px}
.grid-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.row{display:flex;gap:10px;align-items:center}
.badge{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.02);border-radius:8px}
.flag{width:20px;display:inline-block;text-align:center}
.btn{background:linear-gradient(90deg,var(--accent1),var(--accent2));color:#001217;font-weight:700;padding:10px;border-radius:8px;cursor:pointer}
.secondary{background:#0b2633;color:#bfeff2;padding:10px;border-radius:8px;cursor:pointer}
.small{font-size:13px;color:var(--muted)}
.output{margin-top:12px;background:#02050a;padding:12px;border-radius:10px;max-height:420px;overflow:auto;white-space:pre-wrap;color:#cfe7f0}
.controls{display:flex;gap:8px;flex-wrap:wrap}
.qrwrap{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px}
.footer{margin-top:18px;color:var(--muted);font-size:13px;text-align:center}
.copynote{font-size:13px;color:var(--muted);margin-top:8px}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <div class="brand">VPN Generator • Panel (Premium)</div>
      <div class="small note">UI tampil di <code>/sub</code>. Address akan diset ke domain worker (agar kompatibel dengan engine socket).</div>
    </div>
    <div class="small note">Powered by Nautica • <span id="workerdomain"></span></div>
  </div>

  <div class="panel">
    <div class="card">
      <div class="small">Jumlah Config</div>
      <select id="count">
        <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option>
      </select>

      <div class="grid-two" style="margin-top:10px">
        <div>
          <div class="small">Jenis</div>
          <select id="type"><option value="vless">VLESS</option><option value="trojan">TROJAN</option></select>
        </div>
        <div>
          <div class="small">Wildcard</div>
          <select id="wildcard"><option value="0">No Wildcard</option><option value="1">Wildcard (host = BUG)</option></select>
        </div>
      </div>

      <div style="margin-top:12px">
        <div class="small">Region</div>
        <select id="region"></select>
      </div>

      <div style="margin-top:12px">
        <div class="small">Pilih ISP (berdasarkan region)</div>
        <select id="isp"><option value="">(Semua ISP)</option></select>
      </div>

      <div style="margin-top:12px">
        <div class="small">Pilih BUG (host)</div>
        <select id="bug">
          <option>m.udemy.com</option>
          <option>m.youtube.com</option>
          <option>graph.facebook.com</option>
          <option>api.cloudflare.com</option>
          <option>cdn.cloudflare.com</option>
        </select>
      </div>

      <div style="margin-top:12px" class="row">
        <button class="btn" id="generate">Generate</button>
        <button class="secondary" id="test">Test Reach</button>
      </div>

      <div style="margin-top:12px">
        <div class="small">QRIS / Payment link (opsional)</div>
        <input id="paylink" placeholder="https://pay.link/your-checkout"/>
        <div class="qrwrap">
          <button id="copy" class="secondary">Copy All</button>
          <button id="showqr" class="secondary">Show QR</button>
          <button id="showqris" class="secondary">Show QRIS</button>
          <button id="download" class="secondary">Download .txt</button>
        </div>
      </div>

      <div style="margin-top:12px">
        <div class="small">Preview (address | host | sni)</div>
        <div class="small badge" id="preview">—</div>
      </div>

      <div class="copynote">Tip: gunakan <strong>address = worker domain</strong> di client, host/sni diisi sesuai preview.</div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><strong>Hasil</strong> <span class="small">(config)</span></div>
        <div class="small">Copy / QR / Download tersedia</div>
      </div>

      <pre id="out" class="output">Klik Generate untuk membuat config...</pre>

      <div id="qrcanvas" style="margin-top:12px"></div>
    </div>
  </div>

  <div class="footer">Jika tidak bisa internet: periksa client logs (TLS/SNI/timeout). Test Reach hanya indikatif.</div>
</div>

<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>

<script>
const REGIONS = __REGIONS__ || [];
const workerDomain = location.hostname;
document.getElementById('workerdomain').textContent = workerDomain;

// populate regions dropdown with flags
const regionSelect = document.getElementById('region');
const ispSelect = document.getElementById('isp');

function flagEmoji(cc){
  if(!cc || cc.length!==2) return cc;
  return [...cc.toUpperCase()].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
}
REGIONS.forEach(r=>{
  const opt = document.createElement('option');
  opt.value = r.code;
  // if code length 2, show emoji; otherwise plain code
  opt.textContent = (r.code.length===2?flagEmoji(r.code):'') + ' ' + r.code;
  regionSelect.appendChild(opt);
});

// populate ISPs for current region
function populateISPs(){
  ispSelect.innerHTML = '<option value="">(Semua ISP)</option>';
  const code = regionSelect.value;
  const obj = REGIONS.find(x=>x.code === code);
  if(obj && obj.isps){
    obj.isps.forEach(i=>{
      const o = document.createElement('option');
      o.value = i; o.textContent = i;
      ispSelect.appendChild(o);
    });
  }
  updatePreview();
}

regionSelect.addEventListener('change', populateISPs);
document.getElementById('bug').addEventListener('change', updatePreview);
document.getElementById('wildcard').addEventListener('change', updatePreview);

// initial populate
if(regionSelect.options.length) regionSelect.selectedIndex = 0;
populateISPs();

// preview logic
function updatePreview(){
  const bug = document.getElementById('bug').value;
  const wildcard = document.getElementById('wildcard').value === '1';
  const address = workerDomain; // MUST be worker domain
  const host = wildcard ? bug : workerDomain;
  const sni = wildcard ? bug : workerDomain;
  document.getElementById('preview').textContent = 'address: ' + address + ' | host: ' + host + ' | sni: ' + sni;
}

// generate configs
document.getElementById('generate').addEventListener('click', async ()=>{
  const count = document.getElementById('count').value;
  const type = document.getElementById('type').value;
  const wildcard = document.getElementById('wildcard').value;
  const region = document.getElementById('region').value;
  const isp = document.getElementById('isp').value;
  const bug = document.getElementById('bug').value;

  const url = \`/sub?count=\${count}&type=\${encodeURIComponent(type)}&region=\${encodeURIComponent(region)}&isp=\${encodeURIComponent(isp)}&wildcard=\${wildcard}&bug=\${encodeURIComponent(bug)}&domain=\${encodeURIComponent(workerDomain)}\`;
  const out = document.getElementById('out');
  out.textContent = 'Requesting...\\n' + url;
  try {
    const res = await fetch(url);
    const txt = await res.text();
    out.textContent = txt || 'No result';
    updatePreview();
  } catch (e) {
    out.textContent = 'Fetch error: ' + e.message;
  }
});

// copy all
document.getElementById('copy').addEventListener('click', ()=>{
  const t = document.getElementById('out').textContent;
  if(!t) return alert('Tidak ada hasil.');
  navigator.clipboard.writeText(t).then(()=>alert('Tersalin!'),()=>alert('Gagal copy'));
});

// download .txt
document.getElementById('download').addEventListener('click', ()=>{
  const text = document.getElementById('out').textContent;
  if(!text) return alert('Tidak ada hasil.');
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vpn-configs.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// show QR (first config only)
document.getElementById('showqr').addEventListener('click', ()=>{
  const text = document.getElementById('out').textContent.trim();
  if(!text) return alert('Tidak ada hasil untuk QR');
  const first = text.split('\\n')[0];
  document.getElementById('qrcanvas').innerHTML = '';
  QRCode.toCanvas(first, { width: 260 }).then(canvas=>{
    document.getElementById('qrcanvas').appendChild(canvas);
  }).catch(err=>alert('QR error: '+err));
});

// show QRIS from paylink
document.getElementById('showqris').addEventListener('click', ()=>{
  const link = document.getElementById('paylink').value.trim();
  if(!link) return alert('Masukkan link pembayaran');
  document.getElementById('qrcanvas').innerHTML = '';
  QRCode.toCanvas(link, { width: 260 }).then(canvas=>{
    document.getElementById('qrcanvas').appendChild(canvas);
  }).catch(err=>alert('QR error: '+err));
});

// test reach: use first line ip-port
document.getElementById('test').addEventListener('click', async ()=>{
  const raw = document.getElementById('out').textContent.trim();
  if(!raw) return alert('Generate dulu config untuk test');
  const first = raw.split('\\n')[0];
  const m = first.match(/\\/([0-9\\.]+)-([0-9]+)/);
  if(!m) return alert('Tidak menemukan IP:PORT pada hasil pertama');
  const ip = m[1], port = m[2];
  const turl = \`/sub/test?ip=\${ip}&port=\${port}\`;
  const out = document.getElementById('out');
  out.textContent += '\\n\\nRunning test to ' + ip + ':' + port;
  try {
    const r = await fetch(turl);
    const j = await r.json();
    out.textContent += '\\nTest result: ' + JSON.stringify(j);
  } catch(e){
    out.textContent += '\\nTest error: ' + e.message;
  }
});

// on load update preview
updatePreview();
</script>
</body>
</html>
`;

