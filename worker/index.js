// ========================================
//  VPN GENERATOR API (STARTER VERSION)
//  Cloudflare Worker
// ========================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // OPTIONS → wajib untuk CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ===== API ROUTES =====
    if (path.startsWith("/api/")) {
      return handleAPI(request, env);
    }

    // ===== WebSocket (nanti untuk proxy) =====
    if (request.headers.get("Upgrade") === "websocket") {
      return websocketStub();
    }

    // ===== Fallback reverse proxy =====
    return reverseProxy(request, env.REVERSE_PRX_TARGET);
  },
};

// ========================================
// API Handler
// ========================================
async function handleAPI(request, env) {
  const url = new URL(request.url);
  const route = url.pathname.replace("/api", "");

  // GET /api/sub
  if (route === "/sub") {
    const domain = url.searchParams.get("domain") || "example.com";
    const limit = parseInt(url.searchParams.get("limit") || "5");

    const proxies = await env.KV_PROXY_LIST.get("all", "json") || [];
    const selected = proxies.slice(0, limit);

    const uuid = crypto.randomUUID();
    const output = selected.map((p) => {
      return `vless://${uuid}@${domain}:443?encryption=none&security=tls&type=ws&path=/${p.ip}-${p.port}#${p.country}`;
    });

    return new Response(output.join("\n"), {
      headers: { "Content-Type": "text/plain", ...CORS },
    });
  }

  // GET /api/myip
  if (route === "/myip") {
    return new Response(JSON.stringify({
      ip: request.headers.get("cf-connecting-ip"),
      colo: request.cf?.colo
    }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  return new Response("Route Not Found", { status: 404 });
}

// ========================================
// WebSocket (placeholder untuk langkah selanjutnya)
// ========================================
function websocketStub() {
  const wsPair = new WebSocketPair();
  const [client, server] = Object.values(wsPair);
  server.accept();
  server.send("WebSocket OK (stub)");
  return new Response(null, { status: 101, webSocket: client });
}

// ========================================
// Reverse Proxy (Minimal)
// ========================================
async function reverseProxy(request, target) {
  const url = new URL(request.url);
  url.hostname = target;

  const req = new Request(url.toString(), request);
  const res = await fetch(req);

  return new Response(res.body, res);
}
