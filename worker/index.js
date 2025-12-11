// ======================================================
// VPN GENERATOR • PREMIUM PANEL (FINAL FIX)
// ======================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const NAUTICA =
  "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/main/proxyList.txt";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS")
      return new Response(null, { status: 200, headers: CORS });

    // ======================================================
    // ROUTE: /sub/regions → JSON DARI NAUTICA
    // ======================================================
    if (url.pathname === "/sub/regions") {
      const txt = await fetch(NAUTICA).then((r) => r.text());
      const rows = txt.split("\n").filter(Boolean);

      const map = {};

      for (const r of rows) {
        const [ip, port, cc, org] = r.split(",");

        if (!cc) continue;

        if (!map[cc]) map[cc] = new Set();
        if (org && org.trim()) map[cc].add(org.trim());
      }

      const result = Object.keys(map)
        .sort()
        .map((cc) => ({
          code: cc,
          isps: [...map[cc]],
        }));

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // ======================================================
    // ROUTE: /sub → UI PANEL
    // ======================================================
    if (url.pathname === "/sub" && url.searchParams.toString() === "") {
      return new Response(UI_HTML, {
        headers: { "Content-Type": "text/html", ...CORS },
      });
    }

    // ======================================================
    // ROUTE: /sub → GENERATE CONFIG
    // ======================================================
    if (url.pathname === "/sub") {
      return generateConfig(url);
    }

    return new Response("VPN Generator • Running", { headers: CORS });
  },
};

// ======================================================
// CONFIG GENERATOR
// ======================================================
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

  const txt = await fetch(NAUTICA).then((r) => r.text());
  let list = txt.split("\n").filter(Boolean).map((l) => {
    const [ip, port, cc, org] = l.split(",");
    return { ip, port: Number(port), cc, org };
  });

  if (region) list = list.filter((x) => x.cc === region);

  if (isp)
    list = list.filter((x) =>
      (x.org || "").toLowerCase().includes(isp.toLowerCase())
    );

  list.sort(() => Math.random() - 0.5);

  const uuid = crypto.randomUUID();
  const out = [];

  for (const p of list.slice(0, count)) {
    const base = `${p.ip}-${p.port}`;

    if (type === "vless") {
      out.push(
        `vless://${uuid}@${address}:443?security=tls&type=ws&path=/${base}&host=${host}&sni=${sni}#${p.cc}-${p.org}`
      );
    } else {
      out.push(
        `trojan://${uuid}@${address}:443?security=tls&type=ws&path=/${base}&host=${host}&sni=${sni}#${p.cc}-${p.org}`
      );
    }
  }

  return new Response(out.join("\n"), {
    headers: { "Content-Type": "text/plain", ...CORS },
  });
}

// ======================================================
// UI HTML • PREMIUM PANEL
// ======================================================
const UI_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>VPN Generator Premium</title>

<style>
body { background:#06101a; color:#e2faff; margin:0; font-family:Arial; }
.container { max-width:900px; margin:auto; padding:20px; }
.card { background:#0b1520; padding:18px; border-radius:12px; margin-bottom:20px; border:1px solid #10202d; }
select, input, button {
  width:100%; padding:12px; margin-top:10px; border:none;
  background:#091621; color:#dff6ff; border-radius:10px;
}
button { cursor:pointer; font-weight:bold; }
.btn-main { background:linear-gradient(90deg,#00ffc8,#00c4ff); color:#000; }
.output {
  background:#000b12; padding:12px; border-radius:10px;
  height:260px; overflow:auto; margin-top:10px;
}
</style>
</head>

<body>
<div class="container">

<h2>VPN Generator • Premium Panel</h2>

<div class="card">
  <label>Jumlah Config</label>
  <select id="count">
    <option>1</option><option>3</option><option>5</option><option>10</option>
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
    <option value="">(Semua ISP)</option>
  </select>

  <label>BUG Host</label>
  <select id="bug">
    <option>m.udemy.com</option>
    <option>graph.facebook.com</option>
    <option>api.cloudflare.com</option>
  </select>

  <button class="btn-main" id="generate">Generate</button>
  <button id="copy">Copy All</button>
</div>

<div class="card">
  <h3>Output Config</h3>
  <pre id="out" class="output">Belum ada output…</pre>
</div>

</div>

<script>
// =======================================
// LOAD REGION + ISP
// =======================================
async function loadRegions() {
  const res = await fetch("/sub/regions");
  const list = await res.json();

  window.REGION = list;

  const r = document.getElementById("region");
  r.innerHTML = "";

  list.forEach(x => {
    const op = document.createElement("option");
    op.value = x.code;
    op.textContent = x.code;
    r.appendChild(op);
  });

  r.addEventListener("change", updateISP);
  updateISP();
}

function updateISP() {
  const cc = document.getElementById("region").value;
  const ispBox = document.getElementById("isp");

  const item = window.REGION.find(x => x.code === cc);

  ispBox.innerHTML = '<option value="">(Semua ISP)</option>';

  if (!item || !item.isps.length) return;

  item.isps.forEach(i => {
    const op = document.createElement("option");
    op.value = i;
    op.textContent = i;
    ispBox.appendChild(op);
  });
}

loadRegions();

// =======================================
// GENERATE CONFIG
// =======================================
document.getElementById("generate").onclick = async () => {
  const url =
    "/sub?count="+document.getElementById("count").value+
    "&type="+document.getElementById("type").value+
    "&wildcard="+document.getElementById("wildcard").value+
    "&region="+document.getElementById("region").value+
    "&isp="+encodeURIComponent(document.getElementById("isp").value)+
    "&bug="+encodeURIComponent(document.getElementById("bug").value)+
    "&domain="+location.hostname;

  const out = document.getElementById("out");
  out.textContent = "Loading…";

  const res = await fetch(url);
  out.textContent = await res.text();
};

// =======================================
// COPY BUTTON
// =======================================
document.getElementById("copy").onclick = () => {
  navigator.clipboard.writeText(document.getElementById("out").textContent);
  alert("Copied!");
};
</script>

</body>
</html>
`;
