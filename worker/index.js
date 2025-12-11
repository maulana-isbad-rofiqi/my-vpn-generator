// vpn-generator: Auto proxy from Nautica (MODDED for wildcard vless/trojan)

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

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS });
    }

    if (url.pathname.startsWith("/sub")) {
      try {
        // INPUT PARAMETERS
        const limit = Number(url.searchParams.get("limit") || 10);
        const domain = url.searchParams.get("domain") || url.hostname;
        const type = url.searchParams.get("type") || "vless";    // vless | trojan
        const wildcard = url.searchParams.get("wildcard") === "1";
        const bug = url.searchParams.get("bug") || domain;        // BUG DOMAIN

        // BUILD host/sni/address (FIXED)
        let address = bug;
        let host, sni;

        if (wildcard) {
          host = `${bug}.${domain}`;
          sni  = `${bug}.${domain}`;
        } else {
          host = domain;
          sni  = domain;
        }

        // Fetch proxy list from Nautica
        const txt = await fetch(NAUTICA_PROXY_URL).then((r) => r.text());
        const lines = txt.split("\n").filter(Boolean);

        const proxies = lines.map((row) => {
          const [ip, port, cc, org] = row.split(",");
          return { ip, port: Number(port), cc, org };
        });

        // Shuffle proxies
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

    return new Response("VPN Generator • Connected", { headers: CORS });
  },
};

// FORMAT CONFIG
function buildVLESS(uuid, address, host, sni, px) {
  return (
    `vless://${uuid}@${address}:443` +
    `?security=tls` +
    `&sni=${sni}` +
    `&type=ws` +
    `&host=${host}` +
    `&path=/${px.ip}-${px.port}` +
    `#${flag(px.cc)} ${px.org}`
  );
}

function buildTROJAN(uuid, address, host, sni, px) {
  return (
    `trojan://${uuid}@${address}:443` +
    `?security=tls` +
    `&sni=${sni}` +
    `&type=ws` +
    `&host=${host}` +
    `&path=/${px.ip}-${px.port}` +
    `#${flag(px.cc)} ${px.org}`
  );
}

function flag(cc) {
  if (!cc || cc.length !== 2) return "";
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))
  );
}
