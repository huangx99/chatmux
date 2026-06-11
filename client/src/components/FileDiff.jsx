import React, { useState, useEffect } from "react";
import { diffLines } from "diff";

export default function FileDiff({ file1Path, file1Name, file2Path, file2Name, onClose }) {
  const [file1Content, setFile1Content] = useState("");
  const [file2Content, setFile2Content] = useState("");
  const [diffResult, setDiffResult] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("split"); // "split" | "unified"

  // 加载文件内容
  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const [res1, res2] = await Promise.all([
          fetch(`/api/file-content?path=${encodeURIComponent(file1Path)}`),
          fetch(`/api/file-content?path=${encodeURIComponent(file2Path)}`),
        ]);

        if (!res1.ok || !res2.ok) {
          throw new Error("加载文件失败");
        }

        const [text1, text2] = await Promise.all([
          res1.text(),
          res2.text(),
        ]);

        setFile1Content(text1);
        setFile2Content(text2);

        // 计算差异
        const diff = diffLines(text1, text2);
        setDiffResult(diff);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [file1Path, file2Path]);

  // 统计差异
  const stats = {
    additions: 0,
    deletions: 0,
    unchanged: 0,
  };

  diffResult.forEach(part => {
    if (part.added) {
      stats.additions += part.count;
    } else if (part.removed) {
      stats.deletions += part.count;
    } else {
      stats.unchanged += part.count;
    }
  });

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
    <div style={styles.container} onContextMenu={(e) => e.stopPropagation()}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>📊 文件对比</span>
          <span style={styles.fileName}>{file1Name}</span>
          <span style={styles.vs}>VS</span>
          <span style={styles.fileName}>{file2Name}</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.stats}>
            <span style={styles.statUnchanged}>{stats.unchanged} 未变</span>
            <span style={styles.statAdd}>+{stats.additions} 新增</span>
            <span style={styles.statDelete}>-{stats.deletions} 删除</span>
          </div>
          <button
            style={{
              ...styles.viewBtn,
              ...(viewMode === "split" ? styles.viewBtnActive : {})
            }}
            onClick={() => setViewMode("split")}
          >
            分屏
          </button>
          <button
            style={{
              ...styles.viewBtn,
              ...(viewMode === "unified" ? styles.viewBtnActive : {})
            }}
            onClick={() => setViewMode("unified")}
          >
            统一
          </button>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* 差异内容 */}
      <div style={styles.content}>
        {viewMode === "split" ? (
          <SplitView diffResult={diffResult} />
        ) : (
          <UnifiedView diffResult={diffResult} />
        )}
      </div>
    </div>
  );
}

// 分屏视图
function SplitView({ diffResult }) {
  const leftLines = [];
  const rightLines = [];
  let leftLineNum = 1;
  let rightLineNum = 1;

  diffResult.forEach(part => {
    const lines = part.value.split("\n").filter((_, i, arr) =>
      i < arr.length - 1 || arr[arr.length - 1] !== ""
    );

    if (part.added) {
      lines.forEach(line => {
        rightLines.push({
          type: "add",
          content: line,
          lineNum: rightLineNum++,
        });
        leftLines.push({
          type: "empty",
          content: "",
          lineNum: null,
        });
      });
    } else if (part.removed) {
      lines.forEach(line => {
        leftLines.push({
          type: "remove",
          content: line,
          lineNum: leftLineNum++,
        });
        rightLines.push({
          type: "empty",
          content: "",
          lineNum: null,
        });
      });
    } else {
      lines.forEach(line => {
        leftLines.push({
          type: "normal",
          content: line,
          lineNum: leftLineNum++,
        });
        rightLines.push({
          type: "normal",
          content: line,
          lineNum: rightLineNum++,
        });
      });
    }
  });

  return (
    <div style={styles.splitContainer}>
      <div style={styles.splitPanel}>
        <div style={styles.splitHeader}>{/* 左侧文件 */}</div>
        <div style={styles.splitContent}>
          {leftLines.map((line, i) => (
            <div
              key={i}
              style={{
                ...styles.diffLine,
                ...(line.type === "remove" ? styles.diffLineRemove : {}),
                ...(line.type === "empty" ? styles.diffLineEmpty : {}),
              }}
            >
              <span style={styles.lineNumber}>{line.lineNum || ""}</span>
              <span style={styles.linePrefix}>
                {line.type === "remove" ? "-" : " "}
              </span>
              <span style={styles.lineContent}>{line.content}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={styles.splitPanel}>
        <div style={styles.splitHeader}>{/* 右侧文件 */}</div>
        <div style={styles.splitContent}>
          {rightLines.map((line, i) => (
            <div
              key={i}
              style={{
                ...styles.diffLine,
                ...(line.type === "add" ? styles.diffLineAdd : {}),
                ...(line.type === "empty" ? styles.diffLineEmpty : {}),
              }}
            >
              <span style={styles.lineNumber}>{line.lineNum || ""}</span>
              <span style={styles.linePrefix}>
                {line.type === "add" ? "+" : " "}
              </span>
              <span style={styles.lineContent}>{line.content}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 统一视图
function UnifiedView({ diffResult }) {
  const lines = [];
  let lineNum = 1;

  diffResult.forEach(part => {
    const partLines = part.value.split("\n").filter((_, i, arr) =>
      i < arr.length - 1 || arr[arr.length - 1] !== ""
    );

    if (part.added) {
      partLines.forEach(line => {
        lines.push({
          type: "add",
          content: line,
          lineNum: lineNum++,
        });
      });
    } else if (part.removed) {
      partLines.forEach(line => {
        lines.push({
          type: "remove",
          content: line,
          lineNum: lineNum++,
        });
      });
    } else {
      partLines.forEach(line => {
        lines.push({
          type: "normal",
          content: line,
          lineNum: lineNum++,
        });
      });
    }
  });

  return (
    <div style={styles.unifiedContent}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            ...styles.diffLine,
            ...(line.type === "add" ? styles.diffLineAdd : {}),
            ...(line.type === "remove" ? styles.diffLineRemove : {}),
          }}
        >
          <span style={styles.lineNumber}>{line.lineNum}</span>
          <span style={styles.linePrefix}>
            {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
          </span>
          <span style={styles.lineContent}>{line.content}</span>
        </div>
      ))}
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
    padding: "8px 16px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
  },
  fileName: {
    fontSize: 12,
    color: "#8b949e",
    padding: "2px 8px",
    background: "#21262d",
    borderRadius: 4,
  },
  vs: {
    fontSize: 11,
    color: "#484f58",
    fontWeight: 600,
  },
  stats: {
    display: "flex",
    gap: 8,
    fontSize: 12,
  },
  statUnchanged: {
    color: "#8b949e",
  },
  statAdd: {
    color: "#3fb950",
  },
  statDelete: {
    color: "#f85149",
  },
  viewBtn: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 4,
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: 12,
    color: "#8b949e",
  },
  viewBtnActive: {
    color: "#58a6ff",
    borderColor: "#58a6ff",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    padding: "4px 8px",
    fontSize: 16,
  },
  content: {
    flex: 1,
    overflow: "auto",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 13,
    lineHeight: 1.5,
  },
  splitContainer: {
    display: "flex",
    height: "100%",
  },
  splitPanel: {
    flex: 1,
    overflow: "auto",
    borderRight: "1px solid #30363d",
  },
  splitHeader: {
    padding: "6px 12px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    fontSize: 12,
    color: "#8b949e",
    position: "sticky",
    top: 0,
  },
  splitContent: {
    padding: "4px 0",
  },
  unifiedContent: {
    padding: "4px 0",
  },
  diffLine: {
    display: "flex",
    padding: "0 12px",
    minHeight: 20,
  },
  diffLineAdd: {
    background: "rgba(63,185,80,0.15)",
  },
  diffLineRemove: {
    background: "rgba(248,81,73,0.15)",
  },
  diffLineEmpty: {
    background: "#161b22",
  },
  lineNumber: {
    width: 40,
    color: "#484f58",
    textAlign: "right",
    paddingRight: 8,
    flexShrink: 0,
    userSelect: "none",
  },
  linePrefix: {
    width: 16,
    flexShrink: 0,
    textAlign: "center",
    color: "#8b949e",
  },
  lineContent: {
    flex: 1,
    whiteSpace: "pre",
    overflow: "hidden",
  },
  centerMessage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#8b949e",
  },
};
