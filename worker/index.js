// ==============================
// VPN GENERATOR FULL PREMIUM UI
// Compatible with cloudflare:sockets engine
// ==============================

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

    // -----------------------------------
    // API TEST REACH
    // -----------------------------------
    if (url.pathname === "/sub/test") {
      const ip = url.searchParams.get("ip");
      const port = url.searchParams.get("port") || "443";

      if (!ip) return new Response("Missing ip", { status: 400 });

      try {
        const res = await fetch(`https://${ip}:${port}/`, {
          method: "GET",
          redirect: "manual",
          cf: { cacheTtl: 0 },
        });

        return new Response(
          JSON.stringify({ ok: true, status: res.status }),
          {
            headers: { "Content-Type": "application/json", ...CORS },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ ok: false, error: err.message }),
          {
            headers: { "Content-Type": "application/json", ...CORS },
          }
        );
      }
    }

    // -----------------------------------
    // UI PAGE AT /sub
    // -----------------------------------
    if (url.pathname === "/sub" && [...url.searchParams.keys()].length === 0) {
      const regionList = await parseRegionsAndISPs();
      const html = UI_PAGE.replace("__REGIONS__", JSON.stringify(regionList));
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
      });
    }

    // -----------------------------------
    // API GENERATOR
    // -----------------------------------
    if (url.pathname === "/sub") {
      try {
        const domain = url.searchParams.get("domain") || url.hostname;
        const type = (url.searchParams.get("type") || "vless").toLowerCase();
        const wildcard = url.searchParams.get("wildcard") === "1";
        const bug = url.searchParams.get("bug") || domain;
        const region = url.searchParams.get("region") || null;
        const isp = url.searchParams.get("isp") || null;
        const count = Number(url.searchParams.get("count") || 1);

        // ADDRESS HARUS DOMAIN WORKER
        const address = domain;

        // HOST & SNI RULE
        const host = wildcard ? bug : domain;
        const sni = wildcard ? bug : domain;

        // FETCH NAUTICA
        const txt = await fetch(NAUTICA_PROXY_URL).then((r) => r.text());
        let proxies = txt
          .split("\n")
          .filter(Boolean)
          .map((r) => {
            const [ip, port, cc, org] = r.split(",");
            return { ip, port: Number(port), cc, org };
          });

        // FILTER REGION
        if (region) proxies = proxies.filter((p) => p.cc === region);

        // FUZZY ISP MATCH FIX
        if (isp) {
          const ispf = isp.toLowerCase().replace(/[^a-z0-9]/g, "");
          proxies = proxies.filter((p) => {
            const org = (p.org || "")
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");
            return org.includes(ispf);
          });
        }

        // SHUFFLE
        for (let i = proxies.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
        }

        const uuid = crypto.randomUUID();
        const outputs = [];

        for (const p of proxies.slice(0, count)) {
          if (type === "vless")
            outputs.push(buildVLESS(uuid, address, host, sni, p));
          else outputs.push(buildTROJAN(uuid, address, host, sni, p));
        }

        return new Response(outputs.join("\n"), {
          headers: { "Content-Type": "text/plain", ...CORS },
        });
      } catch (err) {
        return new Response("ERR: " + err.message, {
          status: 500,
          headers: CORS,
        });
      }
    }

    // DEFAULT
    return new Response("VPN Generator • Connected", { headers: CORS });
  },
};

// -----------------------------------
// BUILDERS
// -----------------------------------

function buildVLESS(uuid, address, host, sni, px) {
  return (
    `vless://${uuid}@${address}:443` +
    `?security=tls&type=ws` +
    `&path=/${px.ip}-${px.port}` +
    `&host=${encodeURIComponent(host)}` +
    `&sni=${encodeURIComponent(sni)}` +
    `#${px.cc}%20${encodeURIComponent(px.org)}`
  );
}

function buildTROJAN(uuid, address, host, sni, px) {
  return (
    `trojan://${uuid}@${address}:443` +
    `?security=tls&type=ws` +
    `&path=/${px.ip}-${px.port}` +
    `&host=${encodeURIComponent(host)}` +
    `&sni=${encodeURIComponent(sni)}` +
    `#${px.cc}%20${encodeURIComponent(px.org)}`
  );
}

// -----------------------------------
// PARSE REGIONS + ISPs
// -----------------------------------
async function parseRegionsAndISPs() {
  const txt = await fetch(NAUTICA_PROXY_URL).then((r) => r.text());
  const rows = txt.split("\n").filter(Boolean);

  const map = {};

  for (const r of rows) {
    const [ip, port, cc, org] = r.split(",");
    if (!cc) continue;
    if (!map[cc]) map[cc] = new Set();
    if (org) map[cc].add(org.trim());
  }

  return Object.keys(map)
    .sort()
    .map((code) => ({
      code,
      isps: [...map[code]],
    }));
}

// -----------------------------------
// UI TEMPLATE (HTML)
// -----------------------------------

const UI_PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VPN Generator Premium UI</title>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">

<style>
/* PREMIUM DARK UI */
body{margin:0;background:#050c14;font-family:Inter;color:#e2faff;}
.container{max-width:1100px;margin:auto;padding:20px;}
.card{background:#0b1520;border:1px solid #10202d;padding:16px;border-radius:12px;margin-bottom:18px;}
select,input,button{width:100%;padding:12px;margin-top:5px;border:none;border-radius:8px;background:#08131d;color:#d8f2ff;}
button{cursor:pointer;font-weight:700;}
.btn-main{background:linear-gradient(90deg,#00ffc8,#00c4ff);color:#003;}
.output{background:#000b12;padding:12px;border-radius:10px;max-height:400px;overflow:auto;color:#bdefff;}
.grid-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.qrdiv{margin-top:12px;}
.flag{display:inline-block;width:22px;}
</style>
</head>

<body>
<div class="container">

<h2>VPN Generator • Panel (Premium)</h2>
<div class="card">
  <label>Jumlah Config</label>
  <select id="count">
    <option>1</option><option>3</option><option>5</option><option>10</option>
  </select>

  <div class="grid-two">
    <div>
      <label>Jenis</label>
      <select id="type"><option value="vless">VLESS</option><option value="trojan">TROJAN</option></select>
    </div>
    <div>
      <label>Wildcard</label>
      <select id="wildcard"><option value="0">No</option><option value="1">Yes</option></select>
    </div>
  </div>

  <label>Region</label>
  <select id="region"></select>

  <label>ISP</label>
  <select id="isp"><option value="">(Semua ISP)</option></select>

  <label>BUG Host</label>
  <select id="bug">
    <option>m.udemy.com</option>
    <option>graph.facebook.com</option>
    <option>m.youtube.com</option>
    <option>api.cloudflare.com</option>
  </select>

  <button class="btn-main" id="generate">Generate</button>
  <button id="test">Test Reach</button>

  <label>Payment Link (QRIS)</label>
  <input id="paylink" placeholder="https://..." />

  <button id="copy">Copy All</button>
  <button id="showqr">Show QR</button>
  <button id="showqris">Show QRIS</button>
  <button id="download">Download .txt</button>

  <div id="preview"></div>
</div>

<div class="card">
  <h3>Hasil Config</h3>
  <pre id="out" class="output">Belum ada output…</pre>
  <div id="qrcanvas" class="qrdiv"></div>
</div>

</div>

<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>

<script>
// Injected Regions
const REGIONS = __REGIONS__;

const workerDomain = location.hostname;

// populate region list
const regionSel = document.getElementById("region");
const ispSel = document.getElementById("isp");

function flag(cc){
  return [...cc].map(c=>String.fromCodePoint(127397+c.charCodeAt())).join('');
}

REGIONS.forEach(r=>{
  const o=document.createElement("option");
  o.value=r.code;
  o.textContent=flag(r.code)+" "+r.code;
  regionSel.appendChild(o);
});

function loadISPs(){
  ispSel.innerHTML='<option value="">(Semua ISP)</option>';
  const code = regionSel.value;
  const r = REGIONS.find(x=>x.code===code);
  if(r) r.isps.forEach(i=>{
    const op=document.createElement("option");
    op.value=i;
    op.textContent=i;
    ispSel.appendChild(op);
  });
}
regionSel.addEventListener("change", loadISPs);
loadISPs();

// UPDATE PREVIEW
function updatePreview(){
  const bug=document.getElementById("bug").value;
  const wildcard=document.getElementById("wildcard").value==="1";
  const host = wildcard? bug : workerDomain;
  const sni  = wildcard? bug : workerDomain;
  document.getElementById("preview").textContent=
    "address="+workerDomain+" | host="+host+" | sni="+sni;
}
document.getElementById("bug").addEventListener("change", updatePreview);
document.getElementById("wildcard").addEventListener("change", updatePreview);
updatePreview();

// GENERATE
document.getElementById("generate").addEventListener("click", async ()=>{
  const url = "/sub?count="+document.getElementById("count").value+
              "&type="+document.getElementById("type").value+
              "&region="+encodeURIComponent(regionSel.value)+
              "&isp="+encodeURIComponent(ispSel.value)+
              "&wildcard="+document.getElementById("wildcard").value+
              "&bug="+encodeURIComponent(document.getElementById("bug").value)+
              "&domain="+encodeURIComponent(workerDomain);

  const out=document.getElementById("out");
  out.textContent="Loading…\n"+url;

  const res=await fetch(url);
  const txt=await res.text();
  out.textContent=txt;
});

// COPY
document.getElementById("copy").addEventListener("click",()=>{
  navigator.clipboard.writeText(document.getElementById("out").textContent);
  alert("Copied!");
});

// DOWNLOAD
document.getElementById("download").addEventListener("click",()=>{
  const blob=new Blob([document.getElementById("out").textContent],{type:"text/plain"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="vpn.txt";a.click();
});

// QR CONFIG
document.getElementById("showqr").addEventListener("click",()=>{
  const raw=document.getElementById("out").textContent.trim();
  const first=raw.split("\n")[0];
  QRCode.toCanvas(first,{width:260}).then(c=>{
    document.getElementById("qrcanvas").innerHTML="";
    document.getElementById("qrcanvas").appendChild(c);
  });
});

// QRIS
document.getElementById("showqris").addEventListener("click",()=>{
  const link=document.getElementById("paylink").value.trim();
  if(!link) return alert("Isi link Payment dulu");
  QRCode.toCanvas(link,{width:260}).then(c=>{
    document.getElementById("qrcanvas").innerHTML="";
    document.getElementById("qrcanvas").appendChild(c);
  });
});

// TEST REACH (FINAL FIX)
document.getElementById("test").addEventListener("click", async ()=>{
  const text=document.getElementById("out").textContent;
  const match = text.match(/\/(\d{1,3}(?:\.\d{1,3}){3})-(\d{1,5})/);

  if(!match) return alert("Tidak menemukan IP:PORT pada config");

  const ip=match[1], port=match[2];
  const res=await fetch(`/sub/test?ip=${ip}&port=${port}`);
  const json=await res.json();
  alert(JSON.stringify(json));
});
</script>

</body>
</html>
`;

