// vpn-generator: Auto proxy from Nautica • UI on /sub • wildcard • region auto

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

    // ==========================================
    // 1) SERVE UI ⇒ only if no params
    // ==========================================
    if (
      url.pathname === "/sub" &&
      [...url.searchParams.keys()].length === 0
    ) {
      const regionList = await getRegionList();
      const html = UI_PAGE.replace("__REGIONS__", JSON.stringify(regionList));
      return new Response(html, {
        headers: { "Content-Type": "text/html", ...CORS },
      });
    }

    // ==========================================
    // 2) API MODE
    // ==========================================
    if (url.pathname === "/sub") {
      try {
        const domain = url.searchParams.get("domain") || url.hostname;
        const type = url.searchParams.get("type") || "vless";
        const wildcard = url.searchParams.get("wildcard") === "1";
        const bug = url.searchParams.get("bug") || domain;
        const region = url.searchParams.get("region") || null;
        const limit = Number(url.searchParams.get("count") || 1);

        // Build address/host/sni
        const address = bug;
        const host = wildcard ? `${bug}.${domain}` : domain;
        const sni = wildcard ? `${bug}.${domain}` : domain;

        // Fetch proxy list
        const txt = await fetch(NAUTICA_PROXY_URL).then((r) => r.text());
        const rows = txt.split("\n").filter(Boolean);

        let proxies = rows.map((r) => {
          const [ip, port, cc, org] = r.split(",");
          return { ip, port: Number(port), cc, org };
        });

        // Region filter
        if (region) {
          proxies = proxies.filter((p) => p.cc === region);
        }

        // Shuffle
        for (let i = proxies.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
        }

        const uuid = crypto.randomUUID();
        const results = [];

        for (const p of proxies.slice(0, limit)) {
          if (type === "vless") {
            results.push(buildVLESS(uuid, address, host, sni, p));
          } else {
            results.push(buildTROJAN(uuid, address, host, sni, p));
          }
        }

        return new Response(results.join("\n"), {
          headers: { "Content-Type": "text/plain", ...CORS },
        });

      } catch (err) {
        return new Response("ERR: " + err.message, {
          status: 500,
          headers: CORS,
        });
      }
    }

    return new Response("VPN Generator • Connected", { headers: CORS });
  },
};

// Extract region list (unique CC)
async function getRegionList() {
  const txt = await fetch(NAUTICA_PROXY_URL).then((r) => r.text());
  const rows = txt.split("\n").filter(Boolean);
  const regions = new Set();

  rows.forEach((r) => {
    const parts = r.split(",");
    regions.add(parts[2]); // CC
  });

  return [...regions];
}

function buildVLESS(uuid, address, host, sni, px) {
  return (
    `vless://${uuid}@${address}:443` +
    `?security=tls&type=ws&sni=${sni}&host=${host}` +
    `&path=/${px.ip}-${px.port}` +
    `#${px.cc} ${px.org}`
  );
}

function buildTROJAN(uuid, address, host, sni, px) {
  return (
    `trojan://${uuid}@${address}:443` +
    `?security=tls&type=ws&sni=${sni}&host=${host}` +
    `&path=/${px.ip}-${px.port}` +
    `#${px.cc} ${px.org}`
  );
}

// =====================================================
// UI HTML — region akan diinject otomatis dari worker
// =====================================================
const UI_PAGE = `
<!DOCTYPE html>
<html>
<head>
<title>VPN Generator UI</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { font-family:Arial; background:#0d1117; color:#fff; padding:20px;}
.card{background:#161b22;padding:20px;border-radius:12px;max-width:550px;margin:auto;}
select,input,button{width:100%;padding:12px;margin-top:10px;border-radius:8px;border:none;}
button{background:#00ffc3;color:#000;font-weight:bold;}
pre{background:#000;padding:15px;border-radius:10px;white-space:pre-wrap;margin-top:20px;}
</style>
</head>
<body>

<div class="card">
<h2>VPN Generator</h2>

<label>Jumlah Config</label>
<select id="count">
<option value="1">1</option>
<option value="2">2</option>
<option value="3">3</option>
<option value="5">5</option>
<option value="10">10</option>
<option value="20">20</option>
<option value="50">50</option>
</select>

<label>Jenis Config</label>
<select id="type">
<option value="vless">VLESS</option>
<option value="trojan">TROJAN</option>
</select>

<label>Region</label>
<select id="region"></select>

<label>Wildcard</label>
<select id="wildcard">
<option value="0">Tidak</option>
<option value="1">Ya</option>
</select>

<label>Bug Host</label>
<select id="bug">
<option>m.udemy.com</option>
<option>graph.facebook.com</option>
<option>api.cloudflare.com</option>
</select>

<button onclick="gen()">Generate</button>

<pre id="out">Klik Generate…</pre>
</div>

<script>
let regions = __REGIONS__;
let regionBox = document.getElementById("region");

regions.forEach(r=>{
  let o=document.createElement("option");
  o.value=r;
  o.textContent=r;
  regionBox.appendChild(o);
});

function gen(){
  let type = document.getElementById("type").value;
  let count = document.getElementById("count").value;
  let region = document.getElementById("region").value;
  let wildcard = document.getElementById("wildcard").value;
  let bug = document.getElementById("bug").value;

  let url =
    "/sub?count="+count+
    "&type="+type+
    "&region="+region+
    "&wildcard="+wildcard+
    "&bug="+bug+
    "&domain=vpn-generator.isbadd84.workers.dev";

  fetch(url).then(r=>r.text()).then(t=>{
    document.getElementById("out").textContent = t;
  });
}
</script>

</body>
</html>
`;
