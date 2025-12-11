# VPN Generator (Cloudflare)

Generator akun VLESS / Trojan / Shadowsocks tanpa VPS.  
Menggunakan Cloudflare Workers + Cloudflare Pages + Workers KV.

## Fitur (Versi Awal)
- Generate VLESS
- API REST sederhana
- Reverse Proxy fallback
- WebSocket stub (akan diperluas)
- KV untuk menyimpan proxy list

## Struktur
- `/worker` → Cloudflare Worker API
- `/frontend` → UI generator (Cloudflare Pages)
- `wrangler.toml` → konfigurasi worker

## Deploy
### 1. Buat KV
Cloudflare Dashboard → Workers → KV → Create KV  
Ganti ID KV pada wrangler.toml

### 2. Upload proxy list
Key: `all`  
Value:
```json
[
  { "ip": "104.18.10.10", "port": 443, "country": "SG" },
  { "ip": "104.21.90.20", "port": 443, "country": "ID" }
]
