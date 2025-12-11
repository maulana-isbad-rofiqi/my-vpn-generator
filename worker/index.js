// vpn-generator: Auto proxy from Nautica + UI on /sub

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const NAUTICA_PROXY_URL =
  "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Allow OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS });
    }

    // ============================
    // 1️⃣ SERVE UI IF /sub WITHOUT PARAMS
    // ============================
    if (
      url.pathname === "/sub" &&
      !url.searchParams.get("limit") &&
      !url.searchParams.get("type")
    ) {
      return new Response(UI_PAGE, {
        headers: { "Content-Type": "text/html", ...CORS },
      });
    }

    // ============================
    // 2️⃣ API MODE
    // ============================
    if (url.pathname === "/sub") {
      try {
        const limit = Number(url.searchParams.get("limit") || 10);
        const domain = url.searchParams.get("domain") || url.hostname;

        const type = url.searchParams.get("type") || "vless"; // vless/trojan
        const wildcard = url.searchParams.get("wildcard") === "1";
        const bug = url.searchParams.get("bug") || domain;

        // address/host/sni logic
        let address = bug;
        let host, sni;

        if (wildcard) {
          host = `${bug}.${domain}`;
          sni = `${bug}.${domain}`;
        } else {
          host = domain;
          sni = domain;
        }

        // Fetch proxy list
        const txt = await fetch(NAUTICA_PROXY_URL).then((r) => r.text());
        const lines = txt.split("\n").filter(Boolean);

        const proxies = lines.map((row) => {
          const [ip, port, cc, org] = row.split(",");
          return { ip, port: Number(port), cc, org };
        });

        // shuffle
        for (let i = proxies.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
        }

        const uuid = crypto.randomUUID();
        const results = [];

        for (const p of proxies) {
          if (results.length >= limit) break;

          if (type === "vless") {
            results.push(buildVLESS(uuid, address, host, sni, p));
          } else if (type === "trojan") {
            results.push(buildTROJAN(uuid, address, host, sni, p));
          }
        }

        return new Response(results.join("\n"), {
          headers: { "Content-Type": "text/plain", ...CORS },
        });

      } catch (e) {
        return new Response("Error: " + e.message, {
          status: 500,
          headers: CORS,
        });
      }
    }

    // Root
    return new Response("VPN Generator Connected", { headers: CORS });
  },
};

// CONFIG BUILDER
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

// ===============================
// EMBED UI (langsung di worker)
// ===============================

const UI_PAGE = `
<!DOCTYPE html>
<html>
<head>
<title>VPN Generator UI</title>
<style>
body { background:#0e0f14; color:white; font-family:Arial; padding:20px; }
.card { background:#1b1d24; padding:20px; border-radius:12px; max-width:500px; margin:auto; }
input,select { width:100%; padding:10px; margin-top:10px; border-radius:8px; border:none; }
button { margin-top:20px; width:100%; padding:12px; border:none; border-radius:8px; background:#00ffc3; font-weight:bold; }
pre { background:#000; padding:15px; border-radius:10px; margin-top:20px; }
</style>
</head>
<body>

<div class="card">
<h2>VPN Generator UI</h2>

<label>Jenis Config</label>
<select id="type">
<option value="vless">VLESS</option>
<option value="trojan">TROJAN</option>
</select>

<label>Wildcard?</label>
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

<pre id="out"></pre>
</div>

<script>
function gen() {
  let type = document.getElementById("type").value;
  let bug = document.getElementById("bug").value;
  let wildcard = document.getElementById("wildcard").value;

  let url = "/sub?limit=10&domain=vpn-generator.isbadd84.workers.dev&type=" + type + "&bug=" + bug + "&wildcard=" + wildcard;

  fetch(url).then(r=>r.text()).then(t=>{
    document.getElementById("out").textContent = t;
  });
}
</script>

</body>
</html>
`;
