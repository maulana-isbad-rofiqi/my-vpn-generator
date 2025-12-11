// worker/index.js
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const NAUTICA_PROXY_URL =
  "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/main/proxyList.txt";

// PUBLIC raw HTML URL (akan baca file frontend/index.html di repo kamu setelah dipush)
const RAW_UI_URL =
  "https://raw.githubusercontent.com/maulana-isbad-rofiqi/my-vpn-generator/main/frontend/index.html";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS });
    }

    // Jika path /sub dan tanpa query -> ambil UI dari raw.githubusercontent.com
    if (url.pathname === "/sub" && [...url.searchParams.keys()].length === 0) {
      try {
        const htmlResp = await fetch(RAW_UI_URL, { cf: { cacheTtl: 60 } });
        if (!htmlResp.ok) throw new Error("Failed fetch UI");
        const html = await htmlResp.text();
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
        });
      } catch (err) {
        // fallback: simple minimal UI jika fetch gagal
        const fallback = `<html><body><pre>UI loading error: ${err.message}</pre></body></html>`;
        return new Response(fallback, { headers: { "Content-Type": "text/html", ...CORS } });
      }
    }

    // API GENERATOR: /sub?count=...&type=...&region=...&isp=...&wildcard=...&bug=...&domain=...
    if (url.pathname === "/sub") {
      try {
        const domain = url.searchParams.get("domain") || url.hostname;
        const type = (url.searchParams.get("type") || "vless").toLowerCase();
        const wildcard = url.searchParams.get("wildcard") === "1";
        const bug = url.searchParams.get("bug") || domain;
        const region = url.searchParams.get("region") || null;
        const isp = url.searchParams.get("isp") || null;
        const count = Number(url.searchParams.get("count") || 1);

        const address = domain;
        const host = wildcard ? bug : domain;
        const sni = wildcard ? bug : domain;

        // ambil proxy list Nautica
        const txt = await fetch(NAUTICA_PROXY_URL).then((r) => r.text());
        let proxies = txt
          .split("\n")
          .filter(Boolean)
          .map((r) => {
            const [ip, port, cc, org] = r.split(",");
            return { ip, port: Number(port), cc, org };
          });

        if (region) proxies = proxies.filter((p) => p.cc === region);

        if (isp) {
          const ispf = isp.toLowerCase().replace(/[^a-z0-9]/g, "");
          proxies = proxies.filter((p) => {
            const org = (p.org || "").toLowerCase().replace(/[^a-z0-9]/g, "");
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
          headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS },
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
