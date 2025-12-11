// worker/index.js
import { connect } from "cloudflare:sockets"; // requires Service / sockets enabled

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;

const DEFAULT_DNS = "8.8.8.8";
const DEFAULT_DNS_PORT = 53;
const RELAY = { host: Deno?.env?.get?.("RELAY_HOST") || "udp-relay.hobihaus.space", port: parseInt(Deno?.env?.get?.("RELAY_PORT") || "7300") };

const horse_b64 = "dHJvamFu"; // 'trojan'
const flash_b64 = "dm1lc3M="; // 'vmess'
const v2_b64 = "djJyYXk="; // 'v2ray'
const neko_b64 = "Y2xhc2g="; // 'clash'

function atobSafe(s) {
  try { return atob(s); } catch(e) { return s; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // OPTIONS CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // API: add proxy list (POST JSON array) -> saves into KV key "all"
    if (url.pathname === "/api/add-proxy" && request.method === "POST") {
      // Simple auth: optional header x-admin-token (implement later)
      try {
        const body = await request.json();
        if (!Array.isArray(body)) {
          return new Response("Invalid format, expected JSON array", { status: 400, headers: CORS });
        }
        await env.KV_PROXY_LIST.put("all", JSON.stringify(body));
        return new Response("OK", { headers: CORS });
      } catch (e) {
        return new Response("Bad Request: " + e.message, { status: 400, headers: CORS });
      }
    }

    // API: list proxy
    if (url.pathname === "/api/list-proxy") {
      const raw = await env.KV_PROXY_LIST.get("all") || "[]";
      return new Response(raw, { headers: { "Content-Type": "application/json", ...CORS }});
    }

    // API: generator sub (vless basic). Params: limit, domain
    if (url.pathname === "/api/sub") {
      const proxies = (await env.KV_PROXY_LIST.get("all", "json")) || [];
      if (!proxies.length) return new Response("Proxy list kosong", { status: 400, headers: CORS });

      const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 100);
      const domain = url.searchParams.get("domain") || url.hostname;
      const uuid = crypto.randomUUID();

      const out = [];
      const ports = (url.searchParams.get("port") || "443,80").split(",").map(p => parseInt(p));
      const protocols = (url.searchParams.get("vpn") || `${atobSafe(horse_b64)},${atobSafe(flash_b64)},ss`).split(",");

      // shuffle
      for (let i = proxies.length -1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i+1));
        [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
      }

      for (const p of proxies) {
        for (const port of ports) {
          for (const protocol of protocols) {
            if (out.length >= limit) break;
            const uri = new URL(`${protocol}://${domain}`);
            uri.port = port;
            uri.username = protocol === "ss" ? btoa(`none:${uuid}`) : uuid;
            uri.searchParams.set("encryption","none");
            uri.searchParams.set("type","ws");
            uri.searchParams.set("host", domain);
            uri.searchParams.set("path", `/${p.ip}-${p.port}`);
            uri.searchParams.set("security", port === 443 ? "tls" : "none");
            uri.hash = `${getFlagEmoji(p.country||"UN")} ${p.org||"Org"}`;
            out.push(uri.toString());
          }
        }
        if (out.length >= limit) break;
      }

      return new Response(out.join("\n"), { headers: { "Content-Type": "text/plain", ...CORS }});
    }

    // If WebSocket upgrade: handle VLESS/Trojan/SS passthrough
    const upgradeHeader = request.headers.get("Upgrade") || "";
    if (upgradeHeader.toLowerCase() === "websocket") {
      // Accept websocket and proxy to remote via raw TCP using sockets API
      return await websocketHandler(request, env);
    }

    // fallback: static or reverse proxy
    return new Response("OK - vpn generator", { headers: CORS });
  }
};

async function websocketHandler(request, env) {
  // create pair
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();

  // Read early data (sec-websocket-protocol) if any
  const earlyHeader = request.headers.get("sec-websocket-protocol") || "";

  // We'll make a readable stream from server websocket messages
  const wsServer = server;
  const readable = makeReadableWebSocketStream(wsServer, earlyHeader);
  const writerLock = { socket: null }; // will hold tcp socket writer

  // When we analyze first chunk we will decide protocol and remote address
  let isDNS = false;
  let remoteSocket = { value: null };

  readable.pipeTo(new WritableStream({
    async write(chunk) {
      try {
        // chunk is ArrayBuffer or Blob string depending client
        const data = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : (chunk instanceof Blob ? new Uint8Array(await chunk.arrayBuffer()) : new TextEncoder().encode(String(chunk)));

        // First detect protocol if remote not connected
        if (!remoteSocket.value) {
          const protocol = await protocolSniffer(data);
          let header;
          if (protocol === atobSafe(horse_b64)) header = readHorseHeader(data);
          else if (protocol === atobSafe(flash_b64)) header = readFlashHeader(data);
          else if (protocol === "ss") header = readSsHeader(data);
          else throw new Error("Unknown protocol");

          if (header.hasError) throw new Error(header.message);

          // handle UDP separately: DNS (53) go to relay
          if (header.isUDP) {
            // handle UDP via TCP relay service
            isDNS = header.portRemote === 53;
            await handleUDPOutbound(header.addressRemote, header.portRemote, data, wsServer);
            return;
          }

          // Connect TCP to the target (use prxIP from path or header)
          // NOTE: we attempt direct connect to header.addressRemote:portRemote
          const targetAddress = header.addressRemote;
          const targetPort = header.portRemote;
          const tcp = await connect({ hostname: targetAddress, port: targetPort });
          remoteSocket.value = tcp;
          // write initial client data (rawClientData)
          const writer = tcp.writable.getWriter();
          await writer.write(header.rawClientData);
          writer.releaseLock();

          // pipe remote -> websocket
          pipeRemoteToWS(tcp, wsServer);
          return;
        }

        // if connected: forward chunk to remote
        if (remoteSocket.value) {
          const writer = remoteSocket.value.writable.getWriter();
          await writer.write(data);
          writer.releaseLock();
        }
      } catch (err) {
        console.error("ws write error:", err);
        safeCloseWebSocket(wsServer);
      }
    },
    close() { safeCloseWebSocket(wsServer); },
    abort(reason) { console.error("ws stream abort", reason); safeCloseWebSocket(wsServer); }
  })).catch(e => {
    console.error("pipeTo error", e);
    safeCloseWebSocket(server);
  });

  return new Response(null, { status: 101, webSocket: client });
}

// helper: pipe remote tcp readable to websocket
async function pipeRemoteToWS(tcpSocket, wsServer) {
  let headerPending = null; // not used now
  await tcpSocket.readable.pipeTo(new WritableStream({
    async write(chunk) {
      if (wsServer.readyState !== WS_READY_STATE_OPEN) return;
      try {
        wsServer.send(await new Blob([chunk]).arrayBuffer());
      } catch (e) {
        console.error("send to ws error", e);
      }
    },
    close() { safeCloseWebSocket(wsServer); },
    abort(reason) { console.error("remote pipe abort", reason); safeCloseWebSocket(wsServer); }
  })).catch(e => {
    console.error("tcp->ws pipe error", e);
    safeCloseWebSocket(wsServer);
  });
}

function safeCloseWebSocket(ws) {
  try {
    if (ws && (ws.readyState === WS_READY_STATE_OPEN || ws.readyState === WS_READY_STATE_CLOSING)) ws.close();
  } catch(e) { console.error("safeClose error", e); }
}

function makeReadableWebSocketStream(wsServer, earlyDataHeader) {
  let cancelled = false;
  return new ReadableStream({
    start(controller) {
      wsServer.addEventListener("message", e => {
        if (cancelled) return;
        controller.enqueue(e.data instanceof ArrayBuffer ? e.data : (e.data instanceof Blob ? e.data : new TextEncoder().encode(String(e.data))));
      });
      wsServer.addEventListener("close", () => {
        cancelled = true;
        controller.close();
      });
      wsServer.addEventListener("error", err => { cancelled = true; controller.error(err); });

      const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
      if (error) controller.error(error);
      if (earlyData) controller.enqueue(earlyData);
    },
    pull() {},
    cancel(reason) { cancelled = true; safeCloseWebSocket(wsServer); }
  });
}

// ---------- protocol sniffers & readers (adaptasi dari Nautica) ----------
async function protocolSniffer(buffer) {
  // buffer: Uint8Array or ArrayBuffer
  const b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (b.length >= 62) {
    // check horse delimiter (trojan-like)
    const horseDelimiter = b.slice(56, 60);
    if (horseDelimiter[0] === 0x0d && horseDelimiter[1] === 0x0a) {
      if ([0x01,0x03,0x7f].includes(horseDelimiter[2]) && [0x01,0x03,0x04].includes(horseDelimiter[3])) {
        return atobSafe(horse_b64);
      }
    }
  }
  // check vmess uuid at position 1..16
  if (b.length >= 17) {
    const hex = [...b.slice(1,17)].map(x => x.toString(16).padStart(2,"0")).join("");
    if (/^[0-9a-f]{8}[0-9a-f]{4}4[0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/i.test(hex)) return atobSafe(flash_b64);
  }
  return "ss";
}

function readSsHeader(ssBuffer) {
  const view = new DataView(ssBuffer.buffer || ssBuffer);
  const addressType = view.getUint8(0);
  let idx = 1;
  let host = "";
  if (addressType === 1) {
    host = [...new Uint8Array(ssBuffer.slice(1,5))].join(".");
    idx = 5;
  } else if (addressType === 3) {
    const len = new Uint8Array(ssBuffer.slice(1,2))[0]; idx = 2;
    host = new TextDecoder().decode(ssBuffer.slice(idx, idx+len)); idx += len;
  } else if (addressType === 4) {
    // ipv6
    const dv = new DataView(ssBuffer.slice(1,17)); const parts=[];
    for (let i=0;i<8;i++) parts.push(dv.getUint16(i*2).toString(16));
    host = parts.join(":"); idx = 17;
  } else return { hasError:true, message:"Invalid ss address type" };
  const port = new DataView(ssBuffer.slice(idx, idx+2)).getUint16(0);
  return { hasError:false, addressRemote:host, portRemote:port, rawClientData:ssBuffer.slice(idx+2), isUDP: port === 53 };
}

function readFlashHeader(buffer) {
  // vmess-like header adapted
  const b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const version = b[0];
  const optLen = b[17];
  const cmd = b[18 + optLen];
  const isUDP = cmd === 2; // 2 -> UDP
  const portIdx = 18 + optLen + 1;
  const portRemote = (b[portIdx] << 8) | b[portIdx+1];
  let addrIdx = portIdx + 2;
  const addrType = b[addrIdx]; addrIdx++;
  let addressValue = "";
  if (addrType === 1) {
    addressValue = `${b[addrIdx++]}.${b[addrIdx++]}.${b[addrIdx++]}.${b[addrIdx++]}`;
  } else if (addrType === 2) {
    const len = b[addrIdx++]; addressValue = new TextDecoder().decode(buffer.slice(addrIdx, addrIdx + len)); addrIdx += len;
  } else if (addrType === 3) {
    // ipv6
    const dv = new DataView(buffer.slice(addrIdx, addrIdx + 16));
    const parts = [];
    for (let i=0;i<8;i++) parts.push(dv.getUint16(i*2).toString(16));
    addressValue = parts.join(":"); addrIdx += 16;
  } else return { hasError:true, message:`invalid addressType ${addrType}` };
  return { hasError:false, addressRemote:addressValue, portRemote, rawClientData: buffer.slice(addrIdx), version: new Uint8Array([version,0]), isUDP };
}

function readHorseHeader(buffer) {
  const dataBuffer = buffer.slice(58);
  if (dataBuffer.byteLength < 6) return { hasError:true, message:"invalid request data" };
  const dv = new DataView(dataBuffer.buffer || dataBuffer);
  const cmd = dv.getUint8(0);
  const isUDP = cmd === 3;
  const addressType = dv.getUint8(1);
  let addrIdx = 2;
  let host = "";
  if (addressType === 1) {
    host = [...new Uint8Array(dataBuffer.slice(addrIdx, addrIdx+4))].join("."); addrIdx += 4;
  } else if (addressType === 3) {
    const len = new Uint8Array(dataBuffer.slice(addrIdx, addrIdx+1))[0]; addrIdx += 1;
    host = new TextDecoder().decode(dataBuffer.slice(addrIdx, addrIdx + len)); addrIdx += len;
  } else if (addressType === 4) {
    const dv2 = new DataView(dataBuffer.slice(addrIdx, addrIdx+16));
    const parts = []; for (let i=0;i<8;i++) parts.push(dv2.getUint16(i*2).toString(16));
    host = parts.join(":"); addrIdx += 16;
  } else return { hasError:true, message:"invalid address type" };
  const portRemote = new DataView(dataBuffer.slice(addrIdx, addrIdx+2)).getUint16(0);
  return { hasError:false, addressRemote:host, portRemote, rawClientData: dataBuffer.slice(addrIdx+4), version:null, isUDP };
}

// UDP handling via relay (sends header udp:host:port|<data>) - example simple implementation
async function handleUDPOutbound(targetAddress, targetPort, dataChunk, wsServer) {
  try {
    const tcpSocket = await connect({ hostname: RELAY.host || RELAY.host, port: RELAY.port || RELAY.port });
    const header = `udp:${targetAddress}:${targetPort}`;
    const headerBuf = new TextEncoder().encode(header);
    const sep = new Uint8Array([0x7c]); // '|'
    const payload = new Uint8Array(headerBuf.length + sep.length + dataChunk.byteLength);
    payload.set(headerBuf, 0); payload.set(sep, headerBuf.length); payload.set(new Uint8Array(dataChunk), headerBuf.length + sep.length);

    const writer = tcpSocket.writable.getWriter();
    await writer.write(payload);
    writer.releaseLock();

    // pipe back
    await tcpSocket.readable.pipeTo(new WritableStream({
      async write(chunk) {
        if (wsServer.readyState === WS_READY_STATE_OPEN) wsServer.send(await new Blob([chunk]).arrayBuffer());
      },
      close() {},
      abort(err) { console.error("relay abort", err); }
    }));
  } catch (e) {
    console.error("handleUDP error", e);
    safeCloseWebSocket(wsServer);
  }
}

// helpers
function base64ToArrayBuffer(base64Str) {
  if (!base64Str) return { earlyData: null, error: null };
  try {
    base64Str = base64Str.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64Str);
    const arr = Uint8Array.from(decoded, c => c.charCodeAt(0));
    return { earlyData: arr.buffer, error: null };
  } catch (e) { return { earlyData:null, error:e }; }
}

function getFlagEmoji(cc) {
  if (!cc) return "";
  try {
    return cc.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0)).map(cp => String.fromCodePoint(cp)).join("");
  } catch (e) { return ""; }
}
