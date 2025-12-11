const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const NAUTICA_URL =
  "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/main/proxyList.txt";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS")
      return new Response(null, { status: 200, headers: CORS });

    // ============================
    // 1. REGION + ISP API
    // ============================
    if (url.pathname === "/sub/regions") {
      try {
        const txt = await fetch(NAUTICA_URL).then((r) => r.text());
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
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: CORS,
        });
      }
    }

    // ============================
    // 2. UI PAGE
    // ============================
    if (url.pathname === "/sub" && url.searchParams.toString() === "") {
      return new Response(UI_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
      });
    }

    // ============================
    // 3. GENERATOR
    // ============================
    if (url.pathname === "/sub") {
      try {
        const domain = url.searchParams.get("domain") || url.hostname;
        const type = url.searchParams.get("type") || "vless";
        const wildcard = url.searchParams.get("wildcard") === "1";
        const bug = url.searchParams.get("bug") || domain;
        const region = url.searchParams.get("region");
        const isp = url.searchParams.get("isp");
        const count = Number(url.searchParams.get("count") || 1);

        const address = domain;
        const host = wildcard ? `${bug}.${domain}` : domain;
        const sni = wildcard ? `${bug}.${domain}` : domain;

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

        list.sort(() => Math.random() - 0.5);

        const uuid = crypto.randomUUID();
        const out = [];

        for (const p of list.slice(0, count)) {
          if (type === "vless")
            out.push(
              `vless://${uuid}@${address}:443?security=tls&type=ws&path=/${p.ip}-${p.port}&host=${host}&sni=${sni}#${p.cc}-${p.org}`
            );
          else
            out.push(
              `trojan://${uuid}@${address}:443?security=tls&type=ws&path=/${p.ip}-${p.port}&host=${host}&sni=${sni}#${p.cc}-${p.org}`
            );
        }

        return new Response(out.join("\n"), {
          headers: { "Content-Type": "text/plain", ...CORS },
        });
      } catch (e) {
        return new Response("ERR: " + e.message, {
          status: 500,
          headers: CORS,
        });
      }
    }

    return new Response("Running", { headers: CORS });
  },
};

// ============================
//  UI (langsung embed)
// ============================
const UI_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VPN Generator Panel</title>
<style>
body{background:#06101a;margin:0;font-family:Arial;color:#e2faff;}
.container{max-width:900px;margin:auto;padding:20px;}
.card{background:#0b1520;padding:20px;border-radius:12px;margin-bottom:20px;}
select,input,button{width:100%;padding:12px;margin-top:10px;border-radius:10px;border:none;background:#091621;color:#dff6ff;}
button{font-weight:bold;cursor:pointer;}
.btn-main{background:linear-gradient(90deg,#00ffc8,#00c4ff);color:#000;}
.output{background:#000b12;height:250px;overflow:auto;padding:10px;border-radius:10px;}
</style>
</head>

<body>
<div class="container">

<h2>VPN Generator Panel Premium</h2>

<div class="card">
  <label>Jumlah Config</label>
  <select id="count">
    <option>1</option><option>3</option><option>5</option><option>10</option>
  </select>

  <label>Jenis</label>
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
    <option>graph.facebook.com</option>
    <option>api.cloudflare.com</option>
  </select>

  <button class="btn-main" id="generate">Generate</button>
  <button id="copy">Copy All</button>
</div>

<div class="card">
  <h3>Output</h3>
  <pre id="out" class="output">Belum ada output…</pre>
</div>

</div>

<script>
async function loadRegions(){
  try{
    const res = await fetch("/sub/regions");
    const list = await res.json();
    window.REG = list;

    const rSel = document.getElementById("region");
    rSel.innerHTML = "";

    list.forEach(r=>{
      const op=document.createElement("option");
      op.value=r.code;
      op.textContent=r.code;
      rSel.appendChild(op);
    });

    rSel.addEventListener("change", fillISP);
    fillISP();
  }catch(e){
    alert("Gagal memuat region: " + e.message);
  }
}

function fillISP(){
  const cc = document.getElementById("region").value;
  const r = window.REG.find(x=>x.code===cc);
  const s = document.getElementById("isp");

  s.innerHTML = '<option value="">(Semua ISP)</option>';

  if(!r || !r.isps.length) return;

  r.isps.forEach(i=>{
    const op=document.createElement("option");
    op.value=i;
    op.textContent=i;
    s.appendChild(op);
  });
}

loadRegions();

document.getElementById("generate").addEventListener("click", async ()=>{
  const url =
    "/sub?count="+document.getElementById("count").value+
    "&type="+document.getElementById("type").value+
    "&wildcard="+document.getElementById("wildcard").value+
    "&region="+document.getElementById("region").value+
    "&isp="+encodeURIComponent(document.getElementById("isp").value)+
    "&bug="+encodeURIComponent(document.getElementById("bug").value)+
    "&domain="+location.hostname;

  const out=document.getElementById("out");
  out.textContent="Loading...";

  const res=await fetch(url);
  out.textContent=await res.text();
});

document.getElementById("copy").addEventListener("click",()=>{
  navigator.clipboard.writeText(document.getElementById("out").textContent);
  alert("Copied!");
});
</script>

</body>
</html>
`;
