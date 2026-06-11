import React, { useState, useEffect, useCallback } from "react";

export default function FileExplorer({ path, onOpenTerminal, onClose }) {
  const [currentPath, setCurrentPath] = useState(path || "~");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 加载目录内容
  const loadDir = useCallback(async (dirPath) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ls?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setEntries([]);
      } else {
        setCurrentPath(data.path);
        setEntries(data.entries || []);
      }
    } catch (e) {
      setError("加载失败");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDir(currentPath);
  }, []);

  // 进入子目录
  const enterDir = (dirName) => {
    const newPath = currentPath + "/" + dirName;
    loadDir(newPath);
  };

  // 返回上级目录
  const goUp = () => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
    loadDir(parentPath);
  };

  // 在终端中打开当前目录
  const openInTerminal = () => {
    if (onOpenTerminal) {
      onOpenTerminal(currentPath);
    }
  };

  // 获取文件图标
  const getIcon = (name) => {
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

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={goUp} title="返回上级">
            ⬆️
          </button>
          <div style={styles.pathDisplay}>
            <span style={styles.pathLabel}>📍</span>
            <span style={styles.pathText}>{currentPath}</span>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.terminalBtn} onClick={openInTerminal} title="在终端中打开">
            💻 终端
          </button>
          <button style={styles.closeBtn} onClick={onClose} title="关闭">
            ✕
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>
            <div style={styles.spinner}>⏳</div>
            <span>加载中...</span>
          </div>
        ) : error ? (
          <div style={styles.error}>
            <span>❌ {error}</span>
            <button style={styles.retryBtn} onClick={() => loadDir(currentPath)}>
              重试
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div style={styles.empty}>
            <span style={styles.emptyIcon}>📂</span>
            <span>空文件夹</span>
          </div>
        ) : (
          <div style={styles.fileList}>
            {/* 返回上级目录 */}
            <div style={styles.fileItem} onClick={goUp}>
              <span style={styles.fileIcon}>📁</span>
              <span style={styles.fileName}>..</span>
              <span style={styles.fileMeta}>上级目录</span>
            </div>

            {/* 文件和文件夹列表 */}
            {entries.map((entry) => (
              <div
                key={entry}
                style={styles.fileItem}
                onClick={() => enterDir(entry)}
              >
                <span style={styles.fileIcon}>📂</span>
                <span style={styles.fileName}>{entry}</span>
                <span style={styles.fileMeta}>文件夹</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div style={styles.footer}>
        <span style={styles.footerText}>
          {loading ? "加载中..." : `${entries.length} 个项目`}
        </span>
        <button style={styles.refreshBtn} onClick={() => loadDir(currentPath)}>
          🔄 刷新
        </button>
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    overflow: "hidden",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  backBtn: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 14,
    flexShrink: 0,
  },
  pathDisplay: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#0d1117",
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #30363d",
    overflow: "hidden",
  },
  pathLabel: {
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
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    padding: "6px 8px",
    fontSize: 16,
  },
  content: {
    flex: 1,
    overflow: "auto",
  },
  loading: {
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
  error: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 12,
    color: "#f85149",
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
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 12,
    color: "#8b949e",
  },
  emptyIcon: {
    fontSize: 48,
  },
  fileList: {
    padding: "8px 0",
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    padding: "10px 16px",
    cursor: "pointer",
    transition: "background 0.2s",
    gap: 12,
  },
  fileIcon: {
    fontSize: 18,
    flexShrink: 0,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileMeta: {
    fontSize: 11,
    color: "#8b949e",
    flexShrink: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    background: "#161b22",
    borderTop: "1px solid #30363d",
  },
  footerText: {
    fontSize: 12,
    color: "#8b949e",
  },
  refreshBtn: {
    background: "none",
    border: "none",
    color: "#58a6ff",
    cursor: "pointer",
    fontSize: 12,
    padding: "4px 8px",
  },
};

// 添加 CSS 动画
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .file-item:hover {
    background: rgba(88, 166, 255, 0.1) !important;
  }
`;
document.head.appendChild(style);
