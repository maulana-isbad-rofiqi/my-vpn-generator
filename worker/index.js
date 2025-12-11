const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const NAUTICA_URL =
  "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/main/proxyList.txt";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS });
    }

    // ============================
    // ROUTE: /sub/regions (JSON)
    // ============================
    if (url.pathname === "/sub/regions") {
      const regions = await loadRegions();
      return new Response(JSON.stringify(regions), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // ============================
    // ROUTE: /sub (UI PAGE)
    // ============================
    if (url.pathname === "/sub" && url.searchParams.toString() === "") {
      const html = UI_HTML;
      return new Response(html, {
        headers: { "Content-Type": "text/html", ...CORS },
      });
    }

    // ============================
    // ROUTE: /sub?generate config
    // ============================
    if (url.pathname === "/sub") {
      return generateConfig(url);
    }

    return new Response("VPN Generator • Connected", { headers: CORS });
  },
};

// ===============================================
// LOAD REGIONS + ISP LIST
// ===============================================
async function loadRegions() {
  const txt = await fetch(NAUTICA_URL).then((r) => r.text());
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
    .map((cc) => ({
      code: cc,
      isps: [...map[cc]],
    }));
}

// ===============================================
// CONFIG GENERATOR
// ===============================================
async function generateConfig(url) {
  const domain = url.searchParams.get("domain") || url.hostname;
  const type = url.searchParams.get("type") || "vless";
  const wildcard = url.searchParams.get("wildcard") === "1";
  const bug = url.searchParams.get("bug") || domain;
  const region = url.searchParams.get("region");
  const isp = url.searchParams.get("isp");
  const count = Number(url.searchParams.get("count") || 1);

  const address = domain;
  const host = wildcard ? `${bug}.${domain}` : domain;
  const sni = host;

  // Load Nautica proxies
  const txt = await fetch(NAUTICA_URL).then((r) => r.text());
  let list = txt.split("\n").filter(Boolean).map((l) => {
    const [ip, port, cc, org] = l.split(",");
    return { ip, port: Number(port), cc, org };
  });

  if (region) list = list.filter((x) => x.cc === region);
  if (isp)
    list = list.filter((x) =>
      (x.org || "").toLowerCase().includes(isp.toLowerCase())
    );

  // Shuffle
  list.sort(() => Math.random() - 0.5);

  const uuid = crypto.randomUUID();
  const output = [];

  for (const p of list.slice(0, count)) {
    if (type === "vless") {
      output.push(
        `vless://${uuid}@${address}:443?security=tls&type=ws&path=/${p.ip}-${p.port}&host=${host}&sni=${sni}#${p.cc}-${encodeURIComponent(
          p.org
        )}`
      );
    } else {
      output.push(
        `trojan://${uuid}@${address}:443?security=tls&type=ws&path=/${p.ip}-${p.port}&host=${host}&sni=${sni}#${p.cc}-${encodeURIComponent(
          p.org
        )}`
      );
    }
  }

  return new Response(output.join("\n"), {
    headers: { "Content-Type": "text/plain", ...CORS },
  });
}

// ===============================================
// UI HTML PAGE
// ===============================================
const UI_HTML = `
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>VPN Generator Premium</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{background:#020b14;color:white;font-family:sans-serif;margin:0;padding:0}
.container{max-width:600px;margin:20px auto;padding:20px;background:#071620;border-radius:12px}
label{display:block;margin-top:10px}
select,input,button{width:100%;padding:12px;margin-top:6px;border-radius:8px;border:none;background:#0c1f2e;color:white}
button{background:#00c4ff;font-weight:bold;color:#002}
#out{background:#000;padding:10px;margin-top:15px;border-radius:10px;min-height:150px;white-space:pre-wrap}
</style>
</head>
<body>

<div class="container">
  <h2>VPN Generator Premium</h2>
  <small>Domain: <b id="dom"></b></small><br><br>

  <label>Jumlah Config</label>
  <select id="count"><option>1</option><option>3</option><option>5</option><option>10</option></select>

  <label>Jenis Config</label>
  <select id="type"><option value="vless">VLESS</option><option value="trojan">TROJAN</option></select>

  <label>Wildcard</label>
  <select id="wildcard"><option value="0">Tidak</option><option value="1">Ya</option></select>

  <label>Region</label>
  <select id="region"></select>

  <label>ISP</label>
  <select id="isp"><option value="">(Semua ISP)</option></select>

  <label>BUG Host</label>
  <select id="bug">
    <option>m.udemy.com</option>
    <option>m.youtube.com</option>
    <option>api.cloudflare.com</option>
    <option>graph.facebook.com</option>
  </select>

  <button onclick="gen()">Generate</button>

  <pre id="out">Menunggu generate...</pre>
</div>

<script>
// Tampilkan domain
document.getElementById("dom").textContent = location.hostname;

// Ambil region
fetch("/sub/regions").then(r => r.json()).then(list => {
  const region = document.getElementById("region");
  list.forEach(r => {
    const op = document.createElement("option");
    op.value = r.code;
    op.textContent = r.code;
    region.appendChild(op);
  });

  region.onchange = () => {
    const ispSel = document.getElementById("isp");
    ispSel.innerHTML = '<option value="">(Semua ISP)</option>';
    const selected = list.find(x => x.code === region.value);
    if (!selected) return;
    selected.isps.forEach(i => {
      const op = document.createElement("option");
      op.value = i;
      op.textContent = i;
      ispSel.appendChild(op);
    });
  };
})
.catch(err => alert("Gagal memuat region: " + err));

function gen(){
  const url = "/sub?count="+document.getElementById("count").value
    +"&type="+document.getElementById("type").value
    +"&wildcard="+document.getElementById("wildcard").value
    +"&region="+document.getElementById("region").value
    +"&isp="+encodeURIComponent(document.getElementById("isp").value)
    +"&bug="+encodeURIComponent(document.getElementById("bug").value)
    +"&domain="+location.hostname;

  fetch(url)
    .then(r => r.text())
    .then(txt => document.getElementById("out").textContent = txt)
    .catch(e => alert("Error: " + e));
}
</script>

</body>
</html>
`;
