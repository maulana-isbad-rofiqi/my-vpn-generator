// vpn-generator: Auto proxy from Nautica

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

    // Allow OPTIONS for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS });
    }

    // MAIN SUB API
    if (url.pathname.startsWith("/sub")) {
      try {
        const limit = Number(url.searchParams.get("limit") || 10);
        const domain = url.searchParams.get("domain") || url.hostname;
        const ports = (url.searchParams.get("port") || "443,80")
          .split(",")
          .map(Number);

        // Fetch proxy list from Nautica
        const txt = await fetch(NAUTICA_PROXY_URL).then((r) => r.text());
        const lines = txt.split("\n").filter(Boolean);

        // Convert to objects
        const proxies = lines.map((row) => {
          const [ip, port, cc, org] = row.split(",");
          return { ip, port: Number(port), cc, org };
        });

        // Shuffle
        for (let i = proxies.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
        }

        // Generate VLESS configs
        const uuid = crypto.randomUUID();
        const results = [];

        for (const p of proxies) {
          for (const port of ports) {
            if (results.length >= limit) break;

            const urlObj = new URL(`vless://${uuid}@${domain}`);
            urlObj.port = port;
            urlObj.searchParams.set("encryption", "none");
            urlObj.searchParams.set("security", port === 443 ? "tls" : "none");
            urlObj.searchParams.set("type", "ws");
            urlObj.searchParams.set("host", domain);
            urlObj.searchParams.set("path", `/${p.ip}-${p.port}`);
            urlObj.hash = `${flag(p.cc)} ${p.org}`;

            results.push(urlObj.toString());
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

function flag(cc) {
  if (!cc || cc.length !== 2) return "";
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))
  );
}
