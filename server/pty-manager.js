import * as pty from "node-pty";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import os from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_FILE = join(__dirname, "sessions.json");
const isWindows = process.platform === "win32";
const BUFFER_MAX = 1024 * 100; // 每个会话保留最近 100KB 输出

const sessions = new Map();

// ---- 持久化（防抖异步写入） ----

let saveTimer = null;

function _doSave() {
  const data = [...sessions.values()].map((s) => ({
    id: s.id,
    command: s.command,
    args: s.args,
    cwd: s.cwd,
    label: s.label,
    type: s.type || (s.command === "__folder__" ? "folder" : "terminal"),
    alive: s.alive,
    createdAt: s.createdAt,
    explorerState: s.explorerState || null,
  }));
  const json = JSON.stringify(data, null, 2);
  writeFile(STORE_FILE, json).catch((e) => {
    console.error("保存会话失败:", e.message);
  });
}

function saveStore() {
  // 合并 50ms 内的多次写入
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    _doSave();
  }, 50);
}

// 同步保存（仅用于进程退出等需要确保写入的场景）
export function saveStoreSync() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const data = [...sessions.values()].map((s) => ({
    id: s.id,
    command: s.command,
    args: s.args,
    cwd: s.cwd,
    label: s.label,
    type: s.type || (s.command === "__folder__" ? "folder" : "terminal"),
    alive: s.alive,
    createdAt: s.createdAt,
    explorerState: s.explorerState || null,
  }));
  writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

function loadStore() {
  if (!existsSync(STORE_FILE)) return [];
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf-8"));
  } catch {
    return [];
  }
}

// ---- 输出缓冲 ----

function createBuffer() {
  const chunks = [];
  let size = 0;

  return {
    write(data) {
      chunks.push(data);
      size += Buffer.byteLength(data);
      // 超过上限时从头丢弃
      while (size > BUFFER_MAX && chunks.length > 1) {
        const removed = chunks.shift();
        size -= Buffer.byteLength(removed);
      }
    },
    dump() {
      return chunks.join("");
    },
    clear() {
      chunks.length = 0;
      size = 0;
    },
  };
}

// 给 PTY 的 onData 挂缓冲
function attachBuffer(session) {
  if (!session.pty) return;
  session.pty.onData((data) => {
    session.buffer.write(data);
  });
}

// ---- 核心操作 ----

export function createSession(command, args = [], options = {}) {
  const id = options.id || randomUUID();

  // Windows 上自动将 bash 转为 PowerShell
  if (isWindows && (command === "bash" || command === "sh")) {
    command = "powershell.exe";
    if (args.length === 0) args = ["-NoLogo"];
  }

  // 文件夹类型会话
  if (command === "__folder__") {
    const folderName = options.cwd?.split("/").pop() || "文件夹";
    const session = {
      id,
      command: "__folder__",
      args: [],
      cwd: options.cwd || os.homedir(),
      label: folderName,
      type: "folder",
      pty: null,
      buffer: createBuffer(),
      createdAt: Date.now(),
      alive: true,
      explorerState: null,
    };
    sessions.set(id, session);
    saveStore();
    return session;
  }

  let shell;
  try {
    shell = pty.spawn(command, args, {
      name: "xterm-256color",
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd || os.homedir(),
      env: { ...process.env, TERM: "xterm-256color" },
    });
  } catch (e) {
    const session = {
      id,
      command,
      args,
      cwd: options.cwd || os.homedir(),
      label: options.label || command,
      type: "terminal",
      pty: null,
      buffer: createBuffer(),
      createdAt: Date.now(),
      alive: false,
    };
    sessions.set(id, session);
    saveStore();
    return session;
  }

  const session = {
    id,
    command,
    args,
    cwd: options.cwd || os.homedir(),
    label: options.label || command,
    type: "terminal",
    pty: shell,
    buffer: createBuffer(),
    createdAt: Date.now(),
    alive: true,
  };

  // 缓冲所有输出
  attachBuffer(session);

  shell.onExit(({ exitCode }) => {
    session.alive = false;
    saveStore();
  });

  sessions.set(id, session);
  saveStore();
  return session;
}

export function getSession(id) {
  return sessions.get(id);
}

export function getSessionBuffer(id) {
  const session = sessions.get(id);
  return session ? session.buffer.dump() : "";
}

export function getAllSessions() {
  return [...sessions.values()].map(({ pty, buffer, ...rest }) => ({
    ...rest,
    type: rest.type || (rest.command === "__folder__" ? "folder" : "terminal"),
  }));
}

export function writeToSession(id, data) {
  const session = sessions.get(id);
  if (session && session.alive && session.pty) {
    session.pty.write(data);
  }
}

// 在 PTY 会话中执行命令：终端显示 + 捕获输出
export function execInSession(id, command, timeout = 30000) {
  return new Promise((resolve) => {
    const session = sessions.get(id);
    if (!session || !session.alive || !session.pty) {
      return resolve({ stdout: "", stderr: "", exitCode: 1, error: "会话不可用" });
    }

    const shell = session.pty;
    const uid = Date.now().toString(36);
    const beginMark = `__CMX_B_${uid}__`;
    const endMark = `__CMX_E_${uid}__`;
    const exitMark = `__CMX_X_${uid}__`;

    let output = "";
    let capturing = false;
    let done = false;

    const onData = (data) => {
      if (done) return;

      if (capturing) {
        if (data.includes(endMark)) {
          const idx = data.indexOf(endMark);
          output += data.slice(0, idx);
          done = true;
          cleanup();
          // 查询退出码
          shell.write(`echo ${exitMark} $?\n`);
          // 等退出码输出后返回
          setTimeout(() => {
            // 从输出中提取退出码
            const exitMatch = output.match(new RegExp(`${exitMark}\\s*(\\d+)`));
            const exitCode = exitMatch ? parseInt(exitMatch[1]) : 0;
            // 清理 marker 残留
            output = output.replace(new RegExp(`${exitMark}\\s*\\d+`, "g"), "").trim();
            resolve({ stdout: output.trim(), stderr: "", exitCode });
          }, 300);
          return;
        }
        output += data;
      } else if (data.includes(beginMark)) {
        capturing = true;
        const idx = data.indexOf(beginMark) + beginMark.length;
        output += data.slice(idx).replace(/^\r?\n/, "");
      }
    };

    const cleanup = () => {
      shell.removeListener("data", onData);
      if (timer) clearTimeout(timer);
    };

    shell.on("data", onData);

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        cleanup();
        resolve({ stdout: output.trim(), stderr: "", exitCode: 0, timeout: true });
      }
    }, timeout);

    // 用 subshell 包裹：(命令) 的输出不包含 marker 本身
    // 用 printf 输出 marker 避免 echo 被 PS1 干扰
    shell.write(`printf '\\n%s\\n' '${beginMark}' && (${command}) 2>&1; printf '\\n%s\\n' '${endMark}'\n`);
  });
}

export function resizeSession(id, cols, rows) {
  const session = sessions.get(id);
  if (session && session.alive && session.pty) {
    session.pty.resize(cols, rows);
  }
}

export function removeSession(id) {
  const session = sessions.get(id);
  if (session) {
    if (session.alive && session.pty) session.pty.kill();
    sessions.delete(id);
    saveStore();
    return true;
  }
  return false;
}

export function renameSession(id, label) {
  const session = sessions.get(id);
  if (session) {
    session.label = label;
    saveStore();
  }
}

export function updateSessionState(id, state) {
  const session = sessions.get(id);
  if (session) {
    session.explorerState = state;
    saveStore();
  }
}

// 服务启动时恢复（只恢复元数据，不启动 PTY）
export function restoreSessions() {
  const saved = loadStore();
  for (const meta of saved) {
    if (sessions.has(meta.id)) continue;

    // 文件夹类型会话
    if (meta.type === "folder" || meta.command === "__folder__") {
      const folderName = meta.cwd?.split("/").pop() || "文件夹";
      const session = {
        id: meta.id,
        command: "__folder__",
        args: [],
        cwd: meta.cwd,
        label: folderName,
        type: "folder",
        pty: null,
        buffer: createBuffer(),
        createdAt: meta.createdAt || Date.now(),
        alive: true,
        explorerState: meta.explorerState || null,
      };
      sessions.set(meta.id, session);
      console.log(`  恢复文件夹: ${folderName} (${meta.cwd})`);
      continue;
    }

    const session = {
      id: meta.id,
      command: meta.command,
      args: meta.args || [],
      cwd: meta.cwd,
      label: meta.label || meta.command,
      type: "terminal",
      pty: null,
      buffer: createBuffer(),
      createdAt: meta.createdAt || Date.now(),
      alive: false,
    };
    sessions.set(meta.id, session);
    console.log(`  恢复会话: ${meta.label} (${meta.command}) — 已退出`);
  }
  if (saved.length > 0) saveStore();
}

// 重新启动已退出会话的 PTY
export function restartSession(id) {
  const session = sessions.get(id);
  if (!session || session.alive) return session;

  try {
    const shell = pty.spawn(session.command, session.args, {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: session.cwd || os.homedir(),
      env: { ...process.env, TERM: "xterm-256color" },
    });

    session.pty = shell;
    session.alive = true;
    session.buffer.clear();

    // 重新挂缓冲
    attachBuffer(session);

    shell.onExit(() => {
      session.alive = false;
      saveStore();
    });

    saveStore();
    return session;
  } catch (e) {
    console.log(`重启会话失败: ${session.label} — ${e.message}`);
    return session;
  }
}
