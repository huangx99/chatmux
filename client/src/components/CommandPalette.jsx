import React, { useState, useRef, useEffect } from "react";

const DEFAULT_COMMANDS = [
  { label: "🐚 新建 Bash", action: "add", command: "bash" },
  { label: "🟢 新建 Node.js", action: "add", command: "node" },
  { label: "🐍 新建 Python", action: "add", command: "python3" },
  { label: "📂 新建 Bash (指定目录)", action: "add-with-cwd", command: "bash" },
];

export default function CommandPalette({ sessions, onAdd, onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 构建候选列表：命令 + 已有会话
  const candidates = [
    ...DEFAULT_COMMANDS,
    ...sessions.map((s) => ({
      label: `${s.alive ? "🟢" : "⚪"} ${s.label || s.command}`,
      action: "switch",
      id: s.id,
    })),
  ];

  const filtered = candidates.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeItem(filtered[selectedIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const executeItem = (item) => {
    if (!item) return;
    if (item.action === "add") {
      onAdd(item.command, []);
    } else if (item.action === "add-with-cwd") {
      // TODO: 弹出目录选择
      onAdd(item.command, []);
    } else if (item.action === "switch") {
      onSelect(item.id);
    }
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          style={styles.input}
          placeholder="输入命令或搜索会话..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIdx(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <div style={styles.list}>
          {filtered.map((item, i) => (
            <div
              key={i}
              style={{
                ...styles.item,
                ...(i === selectedIdx ? styles.itemActive : {}),
              }}
              onClick={() => executeItem(item)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              {item.label}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={styles.empty}>没有匹配项</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    paddingTop: "15vh",
    zIndex: 200,
  },
  modal: {
    width: 480,
    maxHeight: 400,
    background: "#161b22",
    borderRadius: 12,
    border: "1px solid #30363d",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  input: {
    background: "#0d1117",
    border: "none",
    borderBottom: "1px solid #30363d",
    padding: "14px 16px",
    color: "#c9d1d9",
    fontSize: 15,
    outline: "none",
  },
  list: {
    overflowY: "auto",
    padding: "4px 0",
  },
  item: {
    padding: "10px 16px",
    color: "#c9d1d9",
    fontSize: 14,
    cursor: "pointer",
  },
  itemActive: {
    background: "#1f6feb33",
  },
  empty: {
    padding: "20px 16px",
    color: "#484f58",
    textAlign: "center",
    fontSize: 13,
  },
};
