import React, { useState } from "react";

export default function MobileKeys({ onKey }) {
  const [open, setOpen] = useState(false);

  const press = (data) => {
    onKey(data);
  };

  return (
    <>
      {/* 悬浮按钮 */}
      <button style={styles.fab} onClick={() => setOpen(!open)}>
        {open ? "✕" : "⌨"}
      </button>

      {/* 展开面板 */}
      {open && (
        <div style={styles.panel}>
          <div style={styles.row}>
            <Key label="Esc" data={"\x1b"} onPress={press} />
            <Key label="Tab" data={"\t"} onPress={press} />
            <Key label="↑" data={"\x1b[A"} onPress={press} />
            <Key label="↓" data={"\x1b[B"} onPress={press} />
            <Key label="←" data={"\x1b[D"} onPress={press} />
            <Key label="→" data={"\x1b[C"} onPress={press} />
          </div>
          <div style={styles.row}>
            <Key label="C-c" data={"\x03"} onPress={press} accent />
            <Key label="C-d" data={"\x04"} onPress={press} accent />
            <Key label="C-z" data={"\x1a"} onPress={press} accent />
            <Key label="C-l" data={"\x0c"} onPress={press} accent />
            <Key label="C-a" data={"\x01"} onPress={press} accent />
            <Key label="C-e" data={"\x05"} onPress={press} accent />
          </div>
          <div style={styles.row}>
            {["|", ">", "<", "~", "/", "-", "&", ";", "`"].map((k) => (
              <Key key={k} label={k} data={k} onPress={press} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Key({ label, data, onPress, accent }) {
  return (
    <button
      style={{ ...styles.key, ...(accent ? styles.accent : {}) }}
      onClick={(e) => { e.preventDefault(); onPress(data); }}
    >
      {label}
    </button>
  );
}

const styles = {
  fab: {
    position: "fixed",
    bottom: 24,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "#238636",
    color: "#fff",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    // 底部安全区
    marginBottom: "env(safe-area-inset-bottom)",
  },
  panel: {
    position: "fixed",
    bottom: 84,
    right: 12,
    left: 12,
    background: "#1c1c1e",
    borderRadius: 12,
    border: "1px solid #333",
    padding: "8px 6px",
    zIndex: 99,
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    marginBottom: "env(safe-area-inset-bottom)",
  },
  row: {
    display: "flex",
    gap: 4,
    marginBottom: 4,
  },
  key: {
    background: "#2c2c2e",
    color: "#c9d1d9",
    border: "1px solid #444",
    borderRadius: 6,
    padding: "10px 0",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    flex: 1,
    textAlign: "center",
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "manipulation",
  },
  accent: {
    background: "#1c3a5c",
    color: "#58a6ff",
    borderColor: "#1f4e8a",
  },
};
