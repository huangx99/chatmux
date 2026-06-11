import React, { useState, useEffect, useRef, useCallback } from "react";

// 默认日志级别配置
const DEFAULT_LEVELS = [
  { id: "error", label: "ERROR", color: "#f85149", bgColor: "rgba(248,81,73,0.1)", pattern: /\b(error|err|fatal|panic|critical)\b/i },
  { id: "warn", label: "WARN", color: "#e8a230", bgColor: "rgba(232,162,48,0.1)", pattern: /\b(warn|warning)\b/i },
  { id: "info", label: "INFO", color: "#58a6ff", bgColor: "rgba(88,166,255,0.1)", pattern: /\b(info|notice)\b/i },
  { id: "debug", label: "DEBUG", color: "#8b949e", bgColor: "rgba(139,148,158,0.1)", pattern: /\b(debug|trace)\b/i },
  { id: "success", label: "SUCCESS", color: "#3fb950", bgColor: "rgba(63,185,80,0.1)", pattern: /\b(success|ok|done|complete)\b/i },
];

// 时间格式识别
const TIME_PATTERNS = [
  { name: "ISO 8601", pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ },
  { name: "Common Log", pattern: /\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}/ },
  { name: "Syslog", pattern: /\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/ },
  { name: "Simple", pattern: /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/ },
  { name: "Timestamp", pattern: /\d{10,13}/ },
];

export default function LogViewer({ filePath, fileName, onClose }) {
  const [lines, setLines] = useState([]);
  const [filteredLines, setFilteredLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levels, setLevels] = useState(DEFAULT_LEVELS);
  const [enabledLevels, setEnabledLevels] = useState(new Set(DEFAULT_LEVELS.map(l => l.id)));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(1000);
  const [showSettings, setShowSettings] = useState(false);
  const [newLevel, setNewLevel] = useState({ id: "", label: "", color: "#58a6ff", pattern: "" });
  const [stats, setStats] = useState({});
  const [selectedLine, setSelectedLine] = useState(null);

  const containerRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // 加载日志文件
  const loadLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "加载失败");
      }
      const text = await res.text();
      const logLines = text.split("\n").map((line, index) => ({
        id: index,
        raw: line,
        level: detectLevel(line, levels),
        time: extractTime(line),
      }));
      setLines(logLines);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filePath, levels]);

  // 检测日志级别
  function detectLevel(line, levels) {
    for (const level of levels) {
      if (level.pattern.test(line)) {
        return level.id;
      }
    }
    return "unknown";
  }

  // 提取时间
  function extractTime(line) {
    for (const tp of TIME_PATTERNS) {
      const match = line.match(tp.pattern);
      if (match) {
        try {
          const date = new Date(match[0]);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch {}
      }
    }
    return null;
  }

  // 初始化
  useEffect(() => {
    loadLog();
  }, [loadLog]);

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(loadLog, refreshInterval);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, loadLog]);

  // 过滤和统计
  useEffect(() => {
    let filtered = lines;

    // 按级别过滤
    filtered = filtered.filter(line => {
      if (line.level === "unknown") return true;
      return enabledLevels.has(line.level);
    });

    // 按搜索词过滤
    if (searchQuery) {
      const query = searchCaseSensitive ? searchQuery : searchQuery.toLowerCase();
      filtered = filtered.filter(line => {
        const text = searchCaseSensitive ? line.raw : line.raw.toLowerCase();
        return text.includes(query);
      });
    }

    setFilteredLines(filtered);

    // 统计
    const newStats = {};
    lines.forEach(line => {
      newStats[line.level] = (newStats[line.level] || 0) + 1;
    });
    setStats(newStats);
  }, [lines, enabledLevels, searchQuery, searchCaseSensitive]);

  // 切换级别
  const toggleLevel = (levelId) => {
    setEnabledLevels(prev => {
      const next = new Set(prev);
      if (next.has(levelId)) {
        next.delete(levelId);
      } else {
        next.add(levelId);
      }
      return next;
    });
  };

  // 全选/取消全选
  const toggleAllLevels = () => {
    if (enabledLevels.size === levels.length) {
      setEnabledLevels(new Set());
    } else {
      setEnabledLevels(new Set(levels.map(l => l.id)));
    }
  };

  // 添加自定义级别
  const addLevel = () => {
    if (!newLevel.id || !newLevel.label || !newLevel.pattern) return;
    try {
      const pattern = new RegExp(newLevel.pattern, "i");
      const level = { ...newLevel, pattern };
      setLevels(prev => [...prev, level]);
      setEnabledLevels(prev => new Set([...prev, level.id]));
      setNewLevel({ id: "", label: "", color: "#58a6ff", pattern: "" });
    } catch (e) {
      alert("正则表达式无效: " + e.message);
    }
  };

  // 删除自定义级别
  const removeLevel = (levelId) => {
    setLevels(prev => prev.filter(l => l.id !== levelId));
    setEnabledLevels(prev => {
      const next = new Set(prev);
      next.delete(levelId);
      return next;
    });
  };

  // 获取级别样式
  const getLevelStyle = (levelId) => {
    const level = levels.find(l => l.id === levelId);
    if (level) {
      return { color: level.color, backgroundColor: level.bgColor };
    }
    return {};
  };

  // 获取级别标签
  const getLevelLabel = (levelId) => {
    const level = levels.find(l => l.id === levelId);
    return level ? level.label : levelId.toUpperCase();
  };

  // 滚动到底部
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  // 导出过滤后的日志
  const exportFiltered = () => {
    const content = filteredLines.map(l => l.raw).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `filtered_${fileName}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 高亮搜索词
  const highlightText = (text) => {
    if (!searchQuery) return text;
    const query = searchCaseSensitive ? searchQuery : searchQuery.toLowerCase();
    const textLower = searchCaseSensitive ? text : text.toLowerCase();
    const index = textLower.indexOf(query);
    if (index === -1) return text;
    return (
      <>
        {text.substring(0, index)}
        <span style={styles.highlight}>{text.substring(index, index + searchQuery.length)}</span>
        {text.substring(index + searchQuery.length)}
      </>
    );
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.centerMessage}>⏳ 加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.centerMessage}>
          <span style={{ color: "#f85149" }}>❌ {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 头部工具栏 */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.fileName}>📋 {fileName}</span>
          <span style={styles.lineCount}>{filteredLines.length} / {lines.length} 行</span>
        </div>
        <div style={styles.toolbarRight}>
          <button
            style={styles.toolBtn}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "停止刷新" : "自动刷新"}
          >
            {autoRefresh ? "⏸️" : "▶️"} {autoRefresh ? "停止" : "刷新"}
          </button>
          <button style={styles.toolBtn} onClick={loadLog} title="手动刷新">
            🔄
          </button>
          <button style={styles.toolBtn} onClick={scrollToBottom} title="滚动到底部">
            ⬇️
          </button>
          <button style={styles.toolBtn} onClick={exportFiltered} title="导出过滤后的日志">
            📥
          </button>
          <button style={styles.toolBtn} onClick={() => setShowSettings(!showSettings)} title="设置">
            ⚙️
          </button>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* 级别过滤器 */}
      <div style={styles.levelBar}>
        <button
          style={{
            ...styles.levelBtn,
            ...(enabledLevels.size === levels.length ? styles.levelBtnAll : styles.levelBtnDisabled)
          }}
          onClick={toggleAllLevels}
        >
          全部
        </button>
        {levels.map(level => (
          <button
            key={level.id}
            style={{
              ...styles.levelBtn,
              color: enabledLevels.has(level.id) ? level.color : "#484f58",
              borderColor: enabledLevels.has(level.id) ? level.color : "#30363d",
              backgroundColor: enabledLevels.has(level.id) ? level.bgColor : "transparent",
            }}
            onClick={() => toggleLevel(level.id)}
          >
            {level.label}
            <span style={styles.levelCount}>{stats[level.id] || 0}</span>
          </button>
        ))}
      </div>

      {/* 搜索栏 */}
      <div style={styles.searchBar}>
        <input
          style={styles.searchInput}
          placeholder="🔍 搜索日志..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          style={{
            ...styles.searchOption,
            ...(searchCaseSensitive ? styles.searchOptionActive : {})
          }}
          onClick={() => setSearchCaseSensitive(!searchCaseSensitive)}
          title="区分大小写"
        >
          Aa
        </button>
        {searchQuery && (
          <span style={styles.searchCount}>
            {filteredLines.length} 个匹配
          </span>
        )}
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div style={styles.settingsPanel}>
          <h4 style={styles.settingsTitle}>自定义日志级别</h4>
          <div style={styles.levelList}>
            {levels.map(level => (
              <div key={level.id} style={styles.levelItem}>
                <span style={{ color: level.color, fontWeight: 600 }}>{level.label}</span>
                <code style={styles.levelPattern}>{level.pattern.toString()}</code>
                {!DEFAULT_LEVELS.find(l => l.id === level.id) && (
                  <button style={styles.removeBtn} onClick={() => removeLevel(level.id)}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={styles.addLevelForm}>
            <input
              style={styles.addInput}
              placeholder="ID (如: critical)"
              value={newLevel.id}
              onChange={(e) => setNewLevel(prev => ({ ...prev, id: e.target.value }))}
            />
            <input
              style={styles.addInput}
              placeholder="标签 (如: CRITICAL)"
              value={newLevel.label}
              onChange={(e) => setNewLevel(prev => ({ ...prev, label: e.target.value }))}
            />
            <input
              style={styles.addInput}
              placeholder="正则 (如: \bcritical\b)"
              value={newLevel.pattern}
              onChange={(e) => setNewLevel(prev => ({ ...prev, pattern: e.target.value }))}
            />
            <input
              type="color"
              style={styles.colorInput}
              value={newLevel.color}
              onChange={(e) => setNewLevel(prev => ({ ...prev, color: e.target.value }))}
            />
            <button style={styles.addBtn} onClick={addLevel}>添加</button>
          </div>
        </div>
      )}

      {/* 日志内容 */}
      <div ref={containerRef} style={styles.logContent}>
        {filteredLines.length === 0 ? (
          <div style={styles.emptyMessage}>没有匹配的日志</div>
        ) : (
          filteredLines.map((line) => (
            <div
              key={line.id}
              style={{
                ...styles.logLine,
                ...(line.level !== "unknown" ? getLevelStyle(line.level) : {}),
                ...(selectedLine === line.id ? styles.logLineSelected : {}),
              }}
              onClick={() => setSelectedLine(line.id === selectedLine ? null : line.id)}
            >
              <span style={styles.lineNumber}>{line.id + 1}</span>
              {line.level !== "unknown" && (
                <span style={{
                  ...styles.levelBadge,
                  color: levels.find(l => l.id === line.level)?.color || "#8b949e",
                }}>
                  {getLevelLabel(line.level)}
                </span>
              )}
              <span style={styles.logText}>{highlightText(line.raw)}</span>
            </div>
          ))
        )}
      </div>

      {/* 详情面板 */}
      {selectedLine !== null && (
        <div style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <span>行 {selectedLine + 1}</span>
            <button style={styles.detailClose} onClick={() => setSelectedLine(null)}>✕</button>
          </div>
          <pre style={styles.detailContent}>
            {lines[selectedLine]?.raw}
          </pre>
        </div>
      )}
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
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    flexShrink: 0,
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 600,
  },
  lineCount: {
    fontSize: 12,
    color: "#8b949e",
    padding: "2px 8px",
    background: "#21262d",
    borderRadius: 4,
  },
  toolBtn: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
    color: "#c9d1d9",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    padding: "4px 8px",
    fontSize: 16,
  },
  levelBar: {
    display: "flex",
    gap: 6,
    padding: "8px 16px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  levelBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    border: "1px solid #30363d",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
    background: "transparent",
  },
  levelBtnAll: {
    color: "#58a6ff",
    borderColor: "#58a6ff",
  },
  levelBtnDisabled: {
    color: "#484f58",
    borderColor: "#30363d",
  },
  levelCount: {
    fontSize: 10,
    opacity: 0.7,
  },
  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#c9d1d9",
    fontSize: 13,
    outline: "none",
  },
  searchOption: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 4,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
    color: "#8b949e",
  },
  searchOptionActive: {
    color: "#58a6ff",
    borderColor: "#58a6ff",
  },
  searchCount: {
    fontSize: 12,
    color: "#8b949e",
  },
  settingsPanel: {
    padding: "16px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    flexShrink: 0,
  },
  settingsTitle: {
    margin: "0 0 12px 0",
    fontSize: 14,
    color: "#c9d1d9",
  },
  levelList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
  },
  levelItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "6px 10px",
    background: "#0d1117",
    borderRadius: 4,
  },
  levelPattern: {
    flex: 1,
    fontSize: 12,
    color: "#8b949e",
    background: "#21262d",
    padding: "2px 6px",
    borderRadius: 3,
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#f85149",
    cursor: "pointer",
    padding: "2px 6px",
    fontSize: 12,
  },
  addLevelForm: {
    display: "flex",
    gap: 8,
  },
  addInput: {
    flex: 1,
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
    padding: "6px 10px",
    color: "#c9d1d9",
    fontSize: 12,
    outline: "none",
  },
  colorInput: {
    width: 40,
    height: 32,
    padding: 0,
    border: "1px solid #30363d",
    borderRadius: 4,
    cursor: "pointer",
  },
  addBtn: {
    background: "#238636",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 12,
  },
  logContent: {
    flex: 1,
    overflow: "auto",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 13,
    lineHeight: 1.5,
  },
  emptyMessage: {
    padding: 40,
    textAlign: "center",
    color: "#8b949e",
  },
  logLine: {
    display: "flex",
    alignItems: "flex-start",
    padding: "2px 16px",
    cursor: "pointer",
    borderBottom: "1px solid transparent",
    minHeight: 24,
  },
  logLineSelected: {
    background: "rgba(88,166,255,0.15)",
    borderColor: "#30363d",
  },
  lineNumber: {
    width: 50,
    color: "#484f58",
    textAlign: "right",
    paddingRight: 12,
    flexShrink: 0,
    userSelect: "none",
    fontSize: 11,
  },
  levelBadge: {
    width: 60,
    fontSize: 10,
    fontWeight: 600,
    textAlign: "center",
    flexShrink: 0,
    marginRight: 8,
  },
  logText: {
    flex: 1,
    wordBreak: "break-all",
    whiteSpace: "pre-wrap",
  },
  highlight: {
    background: "#e8a230",
    color: "#0d1117",
    padding: "0 2px",
    borderRadius: 2,
  },
  detailPanel: {
    background: "#161b22",
    borderTop: "1px solid #30363d",
    maxHeight: 200,
    flexShrink: 0,
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    borderBottom: "1px solid #30363d",
    fontSize: 12,
    color: "#8b949e",
  },
  detailClose: {
    background: "none",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    padding: "2px 6px",
    fontSize: 14,
  },
  detailContent: {
    padding: "12px 16px",
    margin: 0,
    fontSize: 12,
    overflow: "auto",
    maxHeight: 150,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  centerMessage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#8b949e",
  },
};
