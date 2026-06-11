import React, { useState, useRef, useEffect } from "react";

export default function SearchBar({ onSearch, onNext, onPrev, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.shiftKey ? onPrev(query) : onNext(query);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div style={styles.bar}>
      <input
        ref={inputRef}
        style={styles.input}
        placeholder="搜索..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSearch(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <button style={styles.btn} onClick={() => onPrev(query)} title="上一个">▲</button>
      <button style={styles.btn} onClick={() => onNext(query)} title="下一个">▼</button>
      <button style={styles.btn} onClick={onClose} title="关闭">✕</button>
    </div>
  );
}

const styles = {
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
  },
  input: {
    flex: 1,
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: "6px 10px",
    color: "#c9d1d9",
    fontSize: 13,
    outline: "none",
  },
  btn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 14,
    padding: "4px 8px",
    borderRadius: 4,
  },
};
