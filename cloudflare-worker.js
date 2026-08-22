/**
 * DeepSeek Harness - Cloudflare Worker 动态路由 (免密直达版)
 * 
 * 环境变量配置（Cloudflare Worker -> Settings -> Variables and Secrets）：
 * 1. DSH_KV     : 绑定的 KV 存储（Variable name 填 DSH_KV）
 * 2. AUTH_TOKEN : Action 上报专用 Token（如：cf_token_dsh_2026）
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const authToken = env.AUTH_TOKEN || "dsh-secret-token";

    // ----------------------------------------------------
    // 1. Action 上报接口: POST /update (使用 AUTH_TOKEN 校验)
    // ----------------------------------------------------
    if (request.method === "POST" && url.pathname === "/update") {
      const authHeader = request.headers.get("Authorization") || request.headers.get("X-Auth-Token");
      if (authHeader !== `Bearer ${authToken}` && authHeader !== authToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        const body = await request.json();
        const tunnelUrl = body.url;
        if (!tunnelUrl || !tunnelUrl.startsWith("https://")) {
          return new Response(JSON.stringify({ error: "Invalid tunnel URL" }), { status: 400 });
        }

        const data = {
          url: tunnelUrl,
          updatedAt: new Date().toISOString(),
          port: body.port || 3080,
          status: "online"
        };

        if (env.DSH_KV) {
          await env.DSH_KV.put("latest_tunnel", JSON.stringify(data));
        }

        return new Response(JSON.stringify({ ok: true, message: "Tunnel URL updated successfully", data }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // ----------------------------------------------------
    // 2. 获取最新隧道数据
    // ----------------------------------------------------
    let data = null;
    if (env.DSH_KV) {
      const raw = await env.DSH_KV.get("latest_tunnel");
      if (raw) {
        try { data = JSON.parse(raw); } catch (e) {}
      }
    }

    // JSON API: GET /json 或携带 Accept: application/json
    if (url.pathname === "/json" || request.headers.get("accept")?.includes("application/json")) {
      if (!data) return new Response(JSON.stringify({ status: "offline", message: "No active instance" }), { status: 404, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json" } });
    }

    // 纯文本 URL: GET /url (方便脚本调用)
    if (url.pathname === "/url") {
      if (!data) return new Response("offline", { status: 404, headers: { "Content-Type": "text/plain" } });
      return new Response(data.url, { headers: { "Content-Type": "text/plain" } });
    }

    // ----------------------------------------------------
    // 3. 访问直达：直接 302 重定向到 DeepSeek Harness
    // ----------------------------------------------------
    if (data && data.url) {
      // 🚀 免密秒级直达 Harness
      return Response.redirect(data.url, 302);
    }

    // 实例离线时的提示页面
    return new Response(renderOfflineHtml(), {
      status: 503,
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

function renderOfflineHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Service Offline - DeepSeek Harness</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2.5rem 2rem; border-radius: 1rem; max-width: 420px; width: 90%; text-align: center; border: 1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background: #ef444420; color: #f87171; padding: 4px 14px; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; border: 1px solid #ef444440; }
    h2 { font-size: 1.35rem; margin: 0 0 0.75rem 0; font-weight: 600; }
    p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">● Offline</div>
    <h2>DeepSeek Harness 离线</h2>
    <p>当前没有活跃的 Action 实例正在运行。<br>在 GitHub 触发 Action 后，刷新此页即可秒级进入系统。</p>
  </div>
</body>
</html>`;
}
