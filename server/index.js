import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { readdir, stat } from "fs/promises";
import { execSync } from "child_process";
import os from "os";
import {
  createSession,
  getSession,
  getSessionBuffer,
  getAllSessions,
  writeToSession,
  resizeSession,
  removeSession,
  renameSession,
  restoreSessions,
  restartSession,
} from "./pty-manager.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function expandHome(p) {
  if (p === "~" || p.startsWith("~/")) {
    return join(os.homedir(), p.slice(1));
  }
  return p;
}

function bindPty(ws, session) {
  if (!session.pty) return;

  session.pty.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "output", data }));
    }
  });

  session.pty.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "exit", exitCode }));
    }
  });
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(join(__dirname, "../client/dist")));
app.use(express.json());

// REST: 下载项目包
app.get("/api/download", (req, res) => {
  const projectDir = join(__dirname, "..");
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", "attachment; filename=chatmux.tar.gz");
  try {
    const archive = execSync(
      `tar czf - -C "${projectDir}" --exclude=node_modules --exclude=dist --exclude=sessions.json .`,
      { maxBuffer: 50 * 1024 * 1024 }
    );
    res.send(archive);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// REST: 列出所有会话
app.get("/api/sessions", (req, res) => {
  res.json(getAllSessions());
});

// REST: 重命名会话
app.patch("/api/sessions/:id", (req, res) => {
  const { label } = req.body;
  if (label) renameSession(req.params.id, label);
  res.json({ ok: true });
});

// REST: 删除会话
app.delete("/api/sessions/:id", (req, res) => {
  removeSession(req.params.id);
  res.json({ ok: true });
});

// REST: 浏览目录
app.get("/api/ls", async (req, res) => {
  try {
    const rawPath = req.query.path || "~";
    const dirPath = resolve(expandHome(rawPath));
    const entries = await readdir(dirPath);
    const dirs = [];
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      try {
        const s = await stat(join(dirPath, entry));
        if (s.isDirectory()) dirs.push(entry);
      } catch {}
    }
    res.json({ path: dirPath, entries: dirs });
  } catch (e) {
    res.json({ path: req.query.path, entries: [], error: e.message });
  }
});

// WebSocket
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get("action");
  const sessionId = url.searchParams.get("sessionId");

  if (action === "create") {
    const command = url.searchParams.get("command") || "bash";
    const args = (url.searchParams.get("args") || "").split(",").filter(Boolean);
    const cols = parseInt(url.searchParams.get("cols")) || 80;
    const rows = parseInt(url.searchParams.get("rows")) || 24;
    const cwd = url.searchParams.get("cwd")
      ? resolve(expandHome(url.searchParams.get("cwd")))
      : undefined;

    const session = createSession(command, args, { cols, rows, cwd });

    ws.send(JSON.stringify({ type: "created", sessionId: session.id, command }));

    bindPty(ws, session);

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === "input") {
          writeToSession(session.id, parsed.data);
        } else if (parsed.type === "resize") {
          resizeSession(session.id, parsed.cols, parsed.rows);
        }
      } catch {
        writeToSession(session.id, msg.toString());
      }
    });

    ws.on("close", () => {
      // 不销毁，PTY 继续跑
    });
  } else if (action === "attach" && sessionId) {
    let session = getSession(sessionId);
    if (!session) {
      ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
      ws.close();
      return;
    }

    // 如果会话已退出，重新启动 PTY
    if (!session.alive) {
      session = restartSession(sessionId);
    }

    ws.send(JSON.stringify({ type: "attached", sessionId: session.id, command: session.command }));

    // 发送历史缓冲
    const history = getSessionBuffer(sessionId);
    if (history) {
      ws.send(JSON.stringify({ type: "output", data: history }));
    }

    // 触发 PTY 重绘
    if (session.alive && session.pty) {
      const { cols, rows } = session.pty;
      session.pty.resize(cols + 1, rows);
      session.pty.resize(cols, rows);
    }

    bindPty(ws, session);

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === "input") {
          writeToSession(sessionId, parsed.data);
        } else if (parsed.type === "resize") {
          resizeSession(sessionId, parsed.cols, parsed.rows);
        }
      } catch {
        writeToSession(sessionId, msg.toString());
      }
    });

    ws.on("close", () => {
      // 不销毁
    });
  }
});

// 启动时恢复会话
console.log("ChatMux 正在恢复会话...");
restoreSessions();

const PORT = process.env.PORT || 9910;
server.listen(PORT, () => {
  console.log(`ChatMux server running on http://localhost:${PORT}`);
});
