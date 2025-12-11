// ==============================
// VPN GENERATOR BACKEND (Final Fix)
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

    // ===============================================
    // API: REGION + ISP LIST
    // ===============================================
    if (url.pathname === "/sub/regions") {
      try {
        const txt = await fetch(NAUTICA_PROXY_URL).then(r => r.text());
        const rows = txt.split("\n").filter(Boolean);

        const map = {};

        for (const r of rows) {
          const [ip, port, cc, org] = r.split(",");

          if (!cc) continue;
          if (!map[cc]) map[cc] = new Set();

          if (org && org.trim()) map[cc].add(org.trim());
        }

        const result = Object.keys(map).sort().map(code => ({
          code,
          isps: [...map[code]]
        }));

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...CORS }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: CORS,
        });
      }
    }

    // ===============================================
    // UI PAGE (HTML)
    // ===============================================
    if (url.pathname === "/sub" && [...url.searchParams.keys()].length === 0) {
      const html = await renderUI();
      return new Response(html, {
        headers: { "Content-Type": "text/html", ...CORS },
      });
    }

    // ===============================================
    // API: GENERATE CONFIG
    // ===============================================
    if (url.pathname === "/sub") {
      try {
        const domain = url.searchParams.get("domain") || url.hostname;
        const type = (url.searchParams.get("type") || "vless").toLowerCase();
        const wildcard = url.searchParams.get("wildcard") === "1";
        const bug = url.searchParams.get("bug") || domain;
        const region = url.searchParams.get("region");
        const isp = url.searchParams.get("isp");
        const count = Number(url.searchParams.get("count") || 1);

        const address = domain;
        const host = wildcard ? `${bug}.` + domain : domain;
        const sni = wildcard ? `${bug}.` + domain : domain;

        // FETCH LIST
        const txt = await fetch(NAUTICA_PROXY_URL).then(r => r.text());
        let proxies = txt.split("\n").filter(Boolean).map(x => {
          const [ip, port, cc, org] = x.split(",");
          return { ip, port: Number(port), cc, org };
        });

        if (region) proxies = proxies.filter(p => p.cc === region);

        if (isp) {
          const norm = isp.toLowerCase().replace(/[^a-z0-9]/g,"");
          proxies = proxies.filter(p =>
            (p.org || "").toLowerCase().replace(/[^a-z0-9]/g,"")
              .includes(norm)
          );
        }

        // RANDOM
        proxies = proxies.sort(() => Math.random() - 0.5);

        const uuid = crypto.randomUUID();
        const output = [];

        for (const p of proxies.slice(0, count)) {
          if (type === "vless") output.push(buildVLESS(uuid, address, host, sni, p));
          else output.push(buildTROJAN(uuid, address, host, sni, p));
        }

        return new Response(output.join("\n"), {
          headers: { "Content-Type": "text/plain", ...CORS },
        });

      } catch (err) {
        return new Response("ERROR: " + err.message, {
          status: 500,
          headers: CORS,
        });
      }
    }

    return new Response("VPN Generator • Running", { headers: CORS });
  }
};

// --------------------------------------
// CONFIG BUILDERS
// --------------------------------------

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

// --------------------------------------
// HTML UI LOADER
// --------------------------------------
async function renderUI() {
  return UI_HTML;
}

const UI_HTML = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VPN Generator • Premium</title>

<style>
body{margin:0;background:#06101a;font-family:Arial;color:#e2faff;}
.container{max-width:1050px;margin:auto;padding:20px;}
.card{background:#0b1520;padding:18px;border-radius:14px;margin-bottom:18px;border:1px solid #10202d;}
select,input,button{width:100%;padding:12px;margin-top:8px;border:none;border-radius:10px;background:#091621;color:#dff6ff;font-size:15px;}
button{cursor:pointer;font-weight:bold;}
.btn-main{background:linear-gradient(90deg,#00ffc8,#00c4ff);color:#003;}
.output{background:#000b12;padding:12px;border-radius:10px;height:300px;overflow:auto;}
</style>
</head>

<body>
<div class="container">

<h2>VPN Generator • Panel Premium</h2>

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
    <option>api.cloudflare.com</option>
    <option>graph.facebook.com</option>
    <option>m.youtube.com</option>
  </select>

  <button class="btn-main" id="generate">Generate Config</button>
  <button id="copy">Copy All</button>
  <button id="qr">Show QR</button>
</div>

<div class="card">
  <h3>Hasil</h3>
  <pre id="out" class="output">Belum ada output…</pre>
  <div id="qrbox"></div>
</div>

</div>

<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>

<script>
// ========================================
// LOAD REGIONS + ISP FROM WORKER
// ========================================
async function loadRegions() {
  try {
    const data = await fetch("/sub/regions").then(r => r.json());
    window.REG_DATA = data;

    const regionSel = document.getElementById("region");
    regionSel.innerHTML = "";

    data.forEach(r => {
      const op = document.createElement("option");
      op.value = r.code;
      op.textContent = r.code;
      regionSel.appendChild(op);
    });

    regionSel.addEventListener("change", updateISP);
    updateISP();

  } catch (e) {
    alert("Gagal load region: " + e.message);
  }
}

function updateISP() {
  const ispSel = document.getElementById("isp");
  const regionSel = document.getElementById("region");

  const cc = regionSel.value;
  const r = window.REG_DATA.find(x => x.code === cc);

  ispSel.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "(Semua ISP)";
  ispSel.appendChild(all);

  if (!r || r.isps.length === 0) return;

  r.isps.forEach(i => {
    const op = document.createElement("option");
    op.value = i;
    op.textContent = i;
    ispSel.appendChild(op);
  });
}

loadRegions();

// ========================================
// GENERATE
// ========================================
document.getElementById("generate").addEventListener("click", async () => {
  const url =
    "/sub?count=" + document.getElementById("count").value +
    "&type=" + document.getElementById("type").value +
    "&wildcard=" + document.getElementById("wildcard").value +
    "&region=" + document.getElementById("region").value +
    "&isp=" + encodeURIComponent(document.getElementById("isp").value) +
    "&bug=" + encodeURIComponent(document.getElementById("bug").value) +
    "&domain=" + location.hostname;

  const out = document.getElementById("out");
  out.textContent = "Loading...\n" + url;

  const res = await fetch(url);
  out.textContent = await res.text();
});

// COPY
document.getElementById("copy").addEventListener("click", () => {
  navigator.clipboard.writeText(document.getElementById("out").textContent);
  alert("Copied!");
});

// QR
document.getElementById("qr").addEventListener("click", () => {
  const txt = document.getElementById("out").textContent.split("\n")[0];
  QRCode.toCanvas(txt, { width: 260 }).then(c => {
    document.getElementById("qrbox").innerHTML = "";
    document.getElementById("qrbox").appendChild(c);
  });
});
</script>

</body>
</html>
`;
