// ==============================
// VPN GENERATOR PREMIUM UI (Mobile Optimized)
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

        const host = wildcard ? bug : domain;
        const sni = wildcard ? bug : domain;

        // fetch proxy list
        const txt = await fetch(NAUTICA_PROXY_URL).then((r) => r.text());
        let proxies = txt
          .split("\n")
          .filter(Boolean)
          .map((r) => {
            const [ip, port, cc, org] = r.split(",");
            return { ip, port: Number(port), cc, org };
          });

        if (region) proxies = proxies.filter((p) => p.cc === region);

        // fuzzy isp filter
        if (isp) {
          const ispf = isp.toLowerCase().replace(/[^a-z0-9]/g, "");
          proxies = proxies.filter((p) => {
            const org = (p.org || "")
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");
            return org.includes(ispf);
          });
        }

        // shuffle
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
// REGIONS + ISP PARSER
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
