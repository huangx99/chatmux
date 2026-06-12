import { Router } from "express";

const router = Router();

// POST /api/ai/chat — 代理 AI API 请求（SSE 流式）
router.post("/chat", async (req, res) => {
  const { endpoint, apiKey, model, messages } = req.body;

  if (!endpoint || !apiKey || !model || !messages) {
    return res.status(400).json({ error: "缺少必要参数: endpoint, apiKey, model, messages" });
  }

  try {
    // 规范化 endpoint
    let url = endpoint.replace(/\/+$/, "");
    if (!url.endsWith("/chat/completions")) {
      url += "/chat/completions";
    }

    const apiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({ error: `API 错误 (${apiRes.status}): ${errText}` });
    }

    // SSE 流式转发
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    };

    req.on("close", () => {
      reader.cancel();
    });

    await pump();
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    } else {
      res.end();
    }
  }
});

export default router;
