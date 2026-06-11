import React, { useState, useEffect, useCallback, useRef } from "react";

export default function FileExplorer({ sessionId, initialPath, onOpenTerminal, onOpenFile, onClose }) {
  const [currentPath, setCurrentPath] = useState(initialPath || "~");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([initialPath || "~"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);

  // 保存状态到服务器
  const saveState = useCallback(async (path, hist, idx) => {
    try {
      await fetch(`/api/sessions/${sessionId}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explorerState: {
            currentPath: path,
            history: hist,
            historyIndex: idx,
          }
        }),
      });
    } catch (e) {
      console.error("保存状态失败:", e);
    }
  }, [sessionId]);

  // 加载目录内容
  const loadDir = useCallback(async (dirPath, addToHistory = true) => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    try {
      const res = await fetch(`/api/ls?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setEntries([]);
      } else {
        setCurrentPath(data.path);
        setEntries(data.entries || []);

        // 更新历史记录
        if (addToHistory) {
          const newHistory = [...history.slice(0, historyIndex + 1), data.path];
          const newIndex = newHistory.length - 1;
          setHistory(newHistory);
          setHistoryIndex(newIndex);
          saveState(data.path, newHistory, newIndex);
        }
      }
    } catch (e) {
      setError("加载失败");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [history, historyIndex, saveState]);

  // 初始化 - 从服务器恢复状态或加载初始路径
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = await res.json();
        if (data.explorerState) {
          const { currentPath: savedPath, history: savedHistory, historyIndex: savedIndex } = data.explorerState;
          setCurrentPath(savedPath);
          setHistory(savedHistory || [savedPath]);
          setHistoryIndex(savedIndex || 0);
          loadDir(savedPath, false);
        } else {
          loadDir(currentPath, false);
        }
      } catch {
        loadDir(currentPath, false);
      }
    };
    loadSavedState();
  }, [sessionId]);

  // 进入子目录
  const enterDir = (dirName) => {
    const newPath = currentPath.endsWith("/")
      ? currentPath + dirName
      : currentPath + "/" + dirName;
    loadDir(newPath);
  };

  // 返回上级目录
  const goUp = () => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
    loadDir(parentPath);
  };

  // 后退
  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const newPath = history[newIndex];
      setHistoryIndex(newIndex);
      setCurrentPath(newPath);
      loadDir(newPath, false);
      saveState(newPath, history, newIndex);
    }
  };

  // 前进
  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const newPath = history[newIndex];
      setHistoryIndex(newIndex);
      setCurrentPath(newPath);
      loadDir(newPath, false);
      saveState(newPath, history, newIndex);
    }
  };

  // 刷新
  const refresh = () => {
    loadDir(currentPath, false);
  };

  // 在终端中打开当前目录
  const openInTerminal = () => {
    if (onOpenTerminal) {
      onOpenTerminal(currentPath);
    }
  };

  // 点击文件
  const handleFileClick = (entry) => {
    if (entry.isDirectory) {
      enterDir(entry.name);
    } else {
      setSelectedFile(entry);
      // 预留：未来可以预览文件
      if (onOpenFile) {
        onOpenFile(currentPath + "/" + entry.name, entry);
      }
    }
  };

  // 格式化文件大小
  const formatSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // 获取文件图标
  const getIcon = (name, isDirectory) => {
    if (isDirectory) return "📂";
    const ext = name.split(".").pop()?.toLowerCase();
    const iconMap = {
      js: "📜", jsx: "⚛️", ts: "📘", tsx: "⚛️",
      py: "🐍", rb: "💎", go: "🔵", rs: "🦀",
      html: "🌐", css: "🎨", json: "📋", md: "📝",
      txt: "📄", log: "📊", yml: "⚙️", yaml: "⚙️",
      sh: "🐚", bash: "🐚",
      jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", svg: "🖼️",
      mp3: "🎵", wav: "🎵", mp4: "🎬", avi: "🎬",
      zip: "📦", tar: "📦", gz: "📦", rar: "📦",
    };
    return iconMap[ext] || "📄";
  };

  // 获取文件类型描述
  const getFileType = (name, isDirectory) => {
    if (isDirectory) return "文件夹";
    const ext = name.split(".").pop()?.toLowerCase();
    const typeMap = {
      js: "JavaScript", jsx: "React JSX", ts: "TypeScript", tsx: "React TSX",
      py: "Python", rb: "Ruby", go: "Go", rs: "Rust",
      html: "HTML", css: "CSS", json: "JSON", md: "Markdown",
      txt: "文本", log: "日志", yml: "YAML", yaml: "YAML",
      sh: "Shell", bash: "Bash",
      jpg: "图片", jpeg: "图片", png: "图片", gif: "图片", svg: "SVG",
      mp3: "音频", wav: "音频", mp4: "视频", avi: "视频",
      zip: "压缩包", tar: "压缩包", gz: "压缩包", rar: "压缩包",
    };
    return typeMap[ext] || "文件";
  };

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  return (
    <div style={styles.container}>
      {/* 工具栏 */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button
            style={{ ...styles.navBtn, opacity: canGoBack ? 1 : 0.4 }}
            onClick={goBack}
            disabled={!canGoBack}
            title="后退"
          >
            ⬅️
          </button>
          <button
            style={{ ...styles.navBtn, opacity: canGoForward ? 1 : 0.4 }}
            onClick={goForward}
            disabled={!canGoForward}
            title="前进"
          >
            ➡️
          </button>
          <button style={styles.navBtn} onClick={goUp} title="上级目录">
            ⬆️
          </button>
          <button style={styles.navBtn} onClick={refresh} title="刷新">
            🔄
          </button>
        </div>

        {/* 路径栏 */}
        <div style={styles.pathBar}>
          <span style={styles.pathIcon}>📍</span>
          <span style={styles.pathText}>{currentPath}</span>
        </div>

        <div style={styles.toolbarRight}>
          <button style={styles.terminalBtn} onClick={openInTerminal} title="在终端中打开">
            💻 终端
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.centerMessage}>
            <div style={styles.spinner}>⏳</div>
            <span>加载中...</span>
          </div>
        ) : error ? (
          <div style={styles.centerMessage}>
            <span style={{ color: "#f85149" }}>❌ {error}</span>
            <button style={styles.retryBtn} onClick={refresh}>重试</button>
          </div>
        ) : entries.length === 0 ? (
          <div style={styles.centerMessage}>
            <span style={styles.emptyIcon}>📂</span>
            <span>空文件夹</span>
          </div>
        ) : (
          <div style={styles.fileList}>
            {/* 表头 */}
            <div style={styles.tableHeader}>
              <span style={styles.colIcon}></span>
              <span style={styles.colName}>名称</span>
              <span style={styles.colType}>类型</span>
              <span style={styles.colSize}>大小</span>
            </div>

            {/* 返回上级目录 */}
            <div style={styles.fileRow} onClick={goUp}>
              <span style={styles.fileIcon}>📁</span>
              <span style={styles.fileName}>..</span>
              <span style={styles.fileType}>上级目录</span>
              <span style={styles.fileSize}>-</span>
            </div>

            {/* 文件和文件夹列表 */}
            {entries.map((entry) => (
              <div
                key={entry.name}
                style={{
                  ...styles.fileRow,
                  ...(selectedFile?.name === entry.name ? styles.fileRowSelected : {}),
                }}
                onClick={() => handleFileClick(entry)}
                onDoubleClick={() => entry.isDirectory ? enterDir(entry.name) : null}
              >
                <span style={styles.fileIcon}>
                  {getIcon(entry.name, entry.isDirectory)}
                </span>
                <span style={styles.fileName}>{entry.name}</span>
                <span style={styles.fileType}>
                  {getFileType(entry.name, entry.isDirectory)}
                </span>
                <span style={styles.fileSize}>
                  {entry.isDirectory ? "-" : formatSize(entry.size)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div style={styles.footer}>
        <span style={styles.footerText}>
          {loading ? "加载中..." : (
            `${entries.filter(e => e.isDirectory).length} 个文件夹，${entries.filter(e => !e.isDirectory).length} 个文件`
          )}
        </span>
        {selectedFile && (
          <span style={styles.footerSelected}>
            已选择: {selectedFile.name}
          </span>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#0d1117",
    color: "#c9d1d9",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    gap: 8,
    flexShrink: 0,
  },
  toolbarLeft: {
    display: "flex",
    gap: 4,
    flexShrink: 0,
  },
  toolbarRight: {
    display: "flex",
    gap: 8,
    flexShrink: 0,
  },
  navBtn: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 14,
    flexShrink: 0,
  },
  pathBar: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#0d1117",
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #30363d",
    overflow: "hidden",
  },
  pathIcon: {
    fontSize: 12,
    flexShrink: 0,
  },
  pathText: {
    fontSize: 13,
    color: "#58a6ff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  terminalBtn: {
    background: "#238636",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflow: "auto",
  },
  centerMessage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 12,
    color: "#8b949e",
  },
  spinner: {
    fontSize: 32,
    animation: "spin 1s linear infinite",
  },
  emptyIcon: {
    fontSize: 48,
  },
  retryBtn: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: "8px 16px",
    cursor: "pointer",
    color: "#c9d1d9",
    fontSize: 13,
  },
  fileList: {
    padding: "4px 0",
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    background: "#161b22",
    borderBottom: "1px solid #21262d",
    fontSize: 12,
    color: "#8b949e",
    fontWeight: 500,
    position: "sticky",
    top: 0,
  },
  colIcon: { width: 24, flexShrink: 0 },
  colName: { flex: 1, minWidth: 0 },
  colType: { width: 100, flexShrink: 0, textAlign: "right" },
  colSize: { width: 80, flexShrink: 0, textAlign: "right" },
  fileRow: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  fileRowSelected: {
    background: "rgba(88, 166, 255, 0.15)",
  },
  fileIcon: {
    width: 24,
    fontSize: 16,
    flexShrink: 0,
    textAlign: "center",
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  fileType: {
    width: 100,
    fontSize: 12,
    color: "#8b949e",
    textAlign: "right",
    flexShrink: 0,
  },
  fileSize: {
    width: 80,
    fontSize: 12,
    color: "#8b949e",
    textAlign: "right",
    flexShrink: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 16px",
    background: "#161b22",
    borderTop: "1px solid #30363d",
    fontSize: 12,
    color: "#8b949e",
    flexShrink: 0,
  },
  footerText: {},
  footerSelected: {
    color: "#58a6ff",
  },
};

// CSS 动画
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .file-row:hover {
    background: rgba(88, 166, 255, 0.1) !important;
  }
`;
document.head.appendChild(style);
