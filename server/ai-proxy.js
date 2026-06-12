import { Router } from "express";
import { exec } from "child_process";

const router = Router();

// 工具定义
const TOOLS = [
  {
    type: "function",
    function: {
      name: "run_command",
      description: "在用户的终端中执行 shell 命令并返回输出。用于查看系统信息、检查配置、运行诊断命令等。",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "要执行的 shell 命令",
          },
        },
        required: ["command"],
      },
    },
  },
];

// System prompt
const SYSTEM_PROMPT = {
  role: "system",
  content:
    "你是一个终端助手，可以帮助用户执行 shell 命令并分析输出。" +
    "当用户需要查看系统信息、检查配置、运行诊断命令时，使用 run_command 工具执行命令。" +
    "执行命令后请分析输出并用中文给出清晰的总结。" +
    "可以组合多个命令一次性执行以提高效率。",
};

// POST /api/ai/chat — 代理 AI API 请求
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

    // 注入 system prompt 和 tools
    const fullMessages = [SYSTEM_PROMPT, ...messages];

    const apiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        tools: TOOLS,
        stream: false,
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res
        .status(apiRes.status)
        .json({ error: `API 错误 (${apiRes.status}): ${errText}` });
    }

    const data = await apiRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai/exec — 执行 shell 命令
router.post("/exec", (req, res) => {
  const { command, cwd } = req.body;

  if (!command) {
    return res.status(400).json({ error: "缺少 command 参数" });
  }

  const timeout = 30000; // 30 秒超时
  const options = {
    timeout,
    maxBuffer: 1024 * 1024 * 5, // 5MB
    cwd: cwd || process.env.HOME,
    shell: true,
  };

  exec(command, options, (error, stdout, stderr) => {
    res.json({
      stdout: stdout || "",
      stderr: stderr || "",
      exitCode: error ? error.code || 1 : 0,
      killed: error?.killed || false,
    });
  });
});

export default router;
