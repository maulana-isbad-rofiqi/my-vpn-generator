export default {
  async fetch(request, env) {

    // 1. Simpan data ke KV
    await env.KV_PROXY_LIST.put("test", "Hello from KV!");

    // 2. Baca data dari KV
    const value = await env.KV_PROXY_LIST.get("test");

    // 3. List semua key di KV
    const list = await env.KV_PROXY_LIST.list();

    // 4. Return sebagai JSON
    return new Response(JSON.stringify({
      saved_value: value,
      key_list: list
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
