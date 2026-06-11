import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { readdir, stat, unlink, rename, copyFile } from "fs/promises";
import { createReadStream, existsSync } from "fs";
import { execSync } from "child_process";
import os from "os";
import multer from "multer";
import {
  createSession,
  getSession,
  getSessionBuffer,
  getAllSessions,
  writeToSession,
  resizeSession,
  removeSession,
  renameSession,
  updateSessionState,
  restoreSessions,
  restartSession,
} from "./pty-manager.js";
import { transferManager, fileClipboard, deleteFiles } from "./file-ops.js";

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

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetDir = req.query.path || os.homedir();
    cb(null, expandHome(targetDir));
  },
  filename: (req, file, cb) => {
    // 处理中文文件名
    const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");
    cb(null, originalName);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB 限制
});

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

// REST: 获取单个会话
app.get("/api/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "会话不存在" });
  }
  const { pty, buffer, ...rest } = session;
  res.json({
    ...rest,
    type: rest.type || (rest.command === "__folder__" ? "folder" : "terminal"),
  });
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

// REST: 更新会话状态（用于文件浏览器状态同步）
app.patch("/api/sessions/:id/state", (req, res) => {
  const { explorerState } = req.body;
  if (explorerState) {
    updateSessionState(req.params.id, explorerState);
  }
  res.json({ ok: true });
});

// REST: 浏览目录
app.get("/api/ls", async (req, res) => {
  try {
    const rawPath = req.query.path || "~";
    const dirPath = resolve(expandHome(rawPath));
    const entries = await readdir(dirPath);
    const items = [];
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      try {
        const s = await stat(join(dirPath, entry));
        items.push({
          name: entry,
          isDirectory: s.isDirectory(),
          size: s.size,
          mtime: s.mtime,
        });
      } catch {}
    }
    // 按类型排序：文件夹在前，文件在后，然后按名称排序
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ path: dirPath, entries: items });
  } catch (e) {
    res.json({ path: req.query.path, entries: [], error: e.message });
  }
});

// REST: 文件上传
app.post("/api/upload", upload.array("files"), (req, res) => {
  try {
    const files = req.files.map(f => ({
      name: f.filename,
      size: f.size,
      path: f.path,
    }));
    res.json({ success: true, files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// REST: 文件下载
app.get("/api/download-file", async (req, res) => {
  try {
    const filePath = expandHome(req.query.path);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }

    const fileStat = await stat(filePath);

    // 检查是否是文件（不是目录）
    if (!fileStat.isFile()) {
      return res.status(400).json({ error: "不能下载文件夹" });
    }

    const fileName = filePath.split("/").pop();

    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", fileStat.size);

    const readStream = createReadStream(filePath);

    // 处理流错误
    readStream.on("error", (err) => {
      console.error("文件读取错误:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    readStream.pipe(res);
  } catch (e) {
    console.error("下载错误:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

// REST: 删除文件
app.delete("/api/files", async (req, res) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files)) {
      return res.status(400).json({ error: "files 必须是数组" });
    }
    const results = await deleteFiles(files);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// REST: 复制文件到剪贴板
app.post("/api/clipboard/copy", (req, res) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files)) {
      return res.status(400).json({ error: "files 必须是数组" });
    }
    fileClipboard.copy(files);
    res.json({ success: true, count: files.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// REST: 剪切文件到剪贴板
app.post("/api/clipboard/cut", (req, res) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files)) {
      return res.status(400).json({ error: "files 必须是数组" });
    }
    fileClipboard.cut(files);
    res.json({ success: true, count: files.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// REST: 粘贴文件
app.post("/api/clipboard/paste", async (req, res) => {
  try {
    const { targetDir } = req.body;
    const results = await fileClipboard.paste(expandHome(targetDir));
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// REST: 获取剪贴板状态
app.get("/api/clipboard", (req, res) => {
  res.json(fileClipboard.getClipboard());
});

// REST: 获取传输任务列表
app.get("/api/transfers", (req, res) => {
  res.json(transferManager.getAllTasks());
});

// REST: 重命名文件
app.post("/api/files/rename", async (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    const dir = dirname(oldPath);
    const newPath = join(dir, newName);
    await rename(oldPath, newPath);
    res.json({ success: true, newPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// REST: 创建文件夹
app.post("/api/files/mkdir", async (req, res) => {
  try {
    const { path, name } = req.body;
    const dirPath = join(expandHome(path), name);
    await mkdir(dirPath, { recursive: true });
    res.json({ success: true, path: dirPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
