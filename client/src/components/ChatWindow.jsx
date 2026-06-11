import React, { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import SearchBar from "./SearchBar";
import MobileKeys from "./MobileKeys";
import FileExplorer from "./FileExplorer";

export default function ChatWindow({
  sessions,
  activeId,
  sendInput,
  sendResize,
  registerWriter,
  onReconnect,
  onAddSession,
  onDeleteSession,
  mobile = false,
}) {
  const termsRef = useRef(new Map());
  const [showSearch, setShowSearch] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeId);

  // Ctrl+F
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape" && showSearch) setShowSearch(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSearch]);

  const createTerminal = useCallback((session, container) => {
    if (termsRef.current.has(session.id)) return;

    const term = new Terminal({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        selectionBackground: "#264f78",
      },
      cursorBlink: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.open(container);
    requestAnimationFrame(() => fitAddon.fit());

    term.onData((data) => {
      if (session.id === activeIdRef.current) {
        sendInputRef.current(data);
      }
    });

    term.onResize(({ cols, rows }) => {
      if (session.id === activeIdRef.current) {
        sendResizeRef.current(cols, rows);
      }
    });

    termsRef.current.set(session.id, { term, fitAddon, searchAddon, container });
    // 存到 DOM 上方便触摸滚动访问
    container._chatmux_term = term;
    registerWriter(session.id, (data) => term.write(data));

    const handleResize = () => {
      if (session.id === activeIdRef.current) fitAddon.fit();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const activeIdRef = useRef(activeId);
  const sendInputRef = useRef(sendInput);
  const sendResizeRef = useRef(sendResize);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { sendInputRef.current = sendInput; }, [sendInput]);
  useEffect(() => { sendResizeRef.current = sendResize; }, [sendResize]);

  // 切换显示
  useEffect(() => {
    termsRef.current.forEach(({ container, fitAddon }, id) => {
      const isActive = id === activeId;
      container.style.display = isActive ? "block" : "none";
      if (isActive) requestAnimationFrame(() => fitAddon.fit());
    });
  }, [activeId]);

  // 清理已删除
  useEffect(() => {
    const ids = new Set(sessions.map((s) => s.id));
    termsRef.current.forEach(({ term, container }, id) => {
      if (!ids.has(id)) {
        term.dispose();
        container.remove();
        termsRef.current.delete(id);
      }
    });
  }, [sessions]);

  // 搜索
  const doSearch = useCallback((q) => {
    const e = termsRef.current.get(activeId);
    if (e && q) e.searchAddon.findNext(q);
  }, [activeId]);
  const doSearchNext = doSearch;
  const doSearchPrev = useCallback((q) => {
    const e = termsRef.current.get(activeId);
    if (e && q) e.searchAddon.findPrevious(q);
  }, [activeId]);

  // 移动端按键：直接发给 PTY
  const handleMobileKey = useCallback((data) => {
    // 所有特殊按键直接发给 PTY（控制字符、转义序列、符号）
    sendInputRef.current(data);
  }, []);

  // 处理文件夹中打开终端
  const handleOpenTerminalFromFolder = useCallback((path) => {
    if (onAddSession) {
      onAddSession("bash", [], path);
    }
  }, [onAddSession]);

  // 处理关闭文件夹
  const handleCloseFolder = useCallback((id) => {
    if (onDeleteSession) {
      onDeleteSession(id);
    }
  }, [onDeleteSession]);

  if (!activeSession) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>💬</div>
        <div style={styles.emptyText}>Ctrl+K 命令面板，或点击 ＋ 添加 CLI</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {showSearch && (
        <SearchBar
          onSearch={doSearch}
          onNext={doSearchNext}
          onPrev={doSearchPrev}
          onClose={() => setShowSearch(false)}
        />
      )}

      {!mobile && (
        <div style={styles.header}>
          <span style={activeSession.type === "folder" || activeSession.command === "__folder__" ? styles.folderDot : styles.dot(activeSession.alive)} />
          <span style={styles.name}>{activeSession.label || activeSession.command}</span>
          <span style={styles.status}>
            {activeSession.type === "folder" || activeSession.command === "__folder__" ? "文件夹" : (activeSession.alive ? "运行中" : "已退出")}
          </span>
          {!activeSession.alive && activeSession.type !== "folder" && activeSession.command !== "__folder__" && (
            <button style={styles.reconnectBtn} onClick={() => onReconnect?.(activeSession.id)}>
              🔄 重连
            </button>
          )}
        </div>
      )}

      {mobile && !activeSession.alive && (
        <div style={styles.mobileReconnect}>
          <button style={styles.reconnectBtn} onClick={() => onReconnect?.(activeSession.id)}>
            🔄 重连
          </button>
        </div>
      )}

      <div style={styles.terminalsWrapper}>
        {sessions.map((s) => (
          s.command === "__folder__" ? (
            <div
              key={s.id}
              style={{
                flex: 1,
                display: s.id === activeId ? "flex" : "none",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <FileExplorer
                path={s.cwd}
                onOpenTerminal={handleOpenTerminalFromFolder}
                onClose={() => handleCloseFolder(s.id)}
              />
            </div>
          ) : (
            <TerminalPanel
              key={s.id}
              session={s}
              isActive={s.id === activeId}
              onCreate={createTerminal}
            />
          )
        ))}
      </div>

      {mobile && activeSession?.alive && (
        <MobileKeys onKey={handleMobileKey} />
      )}
    </div>
  );
}

function TerminalPanel({ session, isActive, onCreate }) {
  const containerRef = useRef(null);
  const touchRef = useRef({ startY: 0, lastY: 0, scrolling: false });
  const initialized = useRef(false);

  useEffect(() => {
    if (containerRef.current && !initialized.current) {
      initialized.current = true;
      onCreate(session, containerRef.current);
    }
  }, [session.id]);

  const focusTerminal = () => {
    const textarea = containerRef.current?.querySelector("textarea");
    if (textarea) textarea.focus();
  };

  // 触摸滚动处理
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchRef.current.startY = e.touches[0].clientY;
      touchRef.current.lastY = e.touches[0].clientY;
      touchRef.current.scrolling = false;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - touchRef.current.lastY;
    const totalDy = e.touches[0].clientY - touchRef.current.startY;

    // 移动超过 10px 判定为滚动
    if (!touchRef.current.scrolling && Math.abs(totalDy) > 10) {
      touchRef.current.scrolling = true;
    }

    if (touchRef.current.scrolling) {
      e.preventDefault();
      const term = containerRef.current?._chatmux_term;
      if (term) {
        term.scrollLines(-dy);
      }
    }
    touchRef.current.lastY = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (!touchRef.current.scrolling) {
      // 没有滚动 = 点击，聚焦终端
      focusTerminal();
    }
    touchRef.current.scrolling = false;
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={focusTerminal}
      style={{
        flex: 1,
        display: isActive ? "flex" : "none",
        flexDirection: "column",
        overflow: "hidden",
        touchAction: "none",
        minHeight: 0,
      }}
    />
  );
}

const styles = {
  container: {
    flex: 1, display: "flex", flexDirection: "column", background: "#0d1117",
    overflow: "hidden",
  },
  terminalsWrapper: {
    flex: 1, display: "flex", flexDirection: "column",
    overflow: "hidden", minHeight: 0,
  },
  header: {
    padding: "8px 12px", background: "#161b22", borderBottom: "1px solid #30363d",
    display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
  },
  dot: (alive) => ({
    width: 7, height: 7, borderRadius: "50%", background: alive ? "#4ade80" : "#666",
  }),
  folderDot: {
    width: 7, height: 7, borderRadius: "50%", background: "#f0883e",
  },
  name: { fontWeight: 600, color: "#c9d1d9", fontSize: 13 },
  status: { fontSize: 11, color: "#8b949e", marginLeft: "auto" },
  reconnectBtn: {
    background: "#238636", color: "#fff", border: "none",
    borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer",
  },
  mobileReconnect: {
    padding: "10px 12px", background: "#161b22",
    borderBottom: "1px solid #30363d", textAlign: "center",
  },
  empty: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    background: "#0d1117", color: "#8b949e",
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 14 },
};
