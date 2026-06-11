import React, { useState, useEffect, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";

// 文件类型映射
const LANGUAGE_MAP = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  ps1: "powershell",
  dockerfile: "dockerfile",
  makefile: "makefile",
  txt: "plaintext",
  log: "plaintext",
  csv: "plaintext",
  ini: "ini",
  conf: "ini",
  cfg: "ini",
  env: "plaintext",
  gitignore: "plaintext",
  dockerignore: "plaintext",
  editorconfig: "ini",
  prettierrc: "json",
  eslintrc: "json",
  babelrc: "json",
};

// 获取文件语言
function getLanguage(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return LANGUAGE_MAP[ext] || "plaintext";
}

// 判断是否是 Markdown 文件
function isMarkdown(fileName) {
  return fileName.toLowerCase().endsWith(".md");
}

// 判断是否是文本文件（可编辑）
function isTextFile(fileName) {
  const textExtensions = new Set(Object.keys(LANGUAGE_MAP));
  const ext = fileName.split(".").pop()?.toLowerCase();
  return textExtensions.has(ext) || !fileName.includes(".");
}

export default function FileEditor({ filePath, fileName, onClose, onSave }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [modified, setModified] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef(null);
  const language = getLanguage(fileName);
  const isMd = isMarkdown(fileName);

  // 加载文件内容
  useEffect(() => {
    const loadFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "加载失败");
        }
        const text = await res.text();
        setContent(text);
        setModified(false);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    loadFile();
  }, [filePath]);

  // 保存文件
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: content,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存失败");
      }
      setModified(false);
      if (onSave) onSave();
    } catch (e) {
      alert("保存失败: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // 编辑器内容变化
  const handleChange = (value) => {
    setContent(value || "");
    setModified(true);
  };

  // 编辑器挂载
  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    // 添加保存快捷键
    editor.addAction({
      id: "save",
      label: "保存",
      keybindings: [2048 | 49], // Ctrl+S
      run: () => handleSave(),
    });
  };

  // 键盘快捷键
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [content]);

  // 关闭前检查
  const handleClose = () => {
    if (modified) {
      if (confirm("文件已修改，确定关闭吗？")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.fileName}>{fileName}</span>
          <button style={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>
        <div style={styles.centerMessage}>
          <span>⏳ 加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.fileName}>{fileName}</span>
          <button style={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>
        <div style={styles.centerMessage}>
          <span style={{ color: "#f85149" }}>❌ {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 头部工具栏 */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.fileIcon}>
            {isMd ? "📝" : "📄"}
          </span>
          <span style={styles.fileName}>
            {fileName}
            {modified && <span style={styles.modifiedDot}>●</span>}
          </span>
          <span style={styles.language}>{language}</span>
        </div>
        <div style={styles.headerRight}>
          {isMd && (
            <button
              style={styles.previewBtn}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "✏️ 编辑" : "👁️ 预览"}
            </button>
          )}
          <button
            style={styles.saveBtn}
            onClick={handleSave}
            disabled={!modified || saving}
          >
            {saving ? "💾 保存中..." : "💾 保存"}
          </button>
          <button style={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>
      </div>

      {/* 编辑器区域 */}
      <div style={styles.editorContainer}>
        {showPreview && isMd ? (
          <div style={styles.preview} dangerouslySetInnerHTML={{ __html: simpleMarkdown(content) }} />
        ) : (
          <Editor
            height="100%"
            language={language}
            value={content}
            onChange={handleChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              tabSize: 2,
              renderWhitespace: "selection",
              bracketPairColorization: { enabled: true },
            }}
          />
        )}
      </div>

      {/* 底部状态栏 */}
      <div style={styles.footer}>
        <span>{language}</span>
        <span>{content.split("\n").length} 行</span>
        <span>{new Blob([content]).size} 字节</span>
      </div>
    </div>
  );
}

// 简单的 Markdown 转 HTML
function simpleMarkdown(md) {
  let html = md
    // 标题
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    // 粗体和斜体
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // 链接和图片
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" style="max-width:100%">')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
    // 代码块
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`(.*?)`/g, "<code>$1</code>")
    // 列表
    .replace(/^\s*[-*]\s+(.*$)/gm, "<li>$1</li>")
    .replace(/^\s*\d+\.\s+(.*$)/gm, "<li>$1</li>")
    // 引用
    .replace(/^>\s+(.*$)/gm, "<blockquote>$1</blockquote>")
    // 水平线
    .replace(/^---$/gm, "<hr>")
    // 换行
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // 包装列表项
  html = html.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
  // 包装段落
  html = "<p>" + html + "</p>";
  // 清理空段落
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[1-6]>)/g, "$1");
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");
  html = html.replace(/<p>(<hr>)/g, "$1");

  return html;
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#1e1e1e",
    color: "#d4d4d4",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    background: "#252526",
    borderBottom: "1px solid #3c3c3c",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  fileIcon: {
    fontSize: 16,
    flexShrink: 0,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  modifiedDot: {
    color: "#e8a230",
    fontSize: 18,
  },
  language: {
    fontSize: 11,
    color: "#8b8b8b",
    padding: "2px 8px",
    background: "#3c3c3c",
    borderRadius: 4,
    flexShrink: 0,
  },
  previewBtn: {
    background: "#0e639c",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
  },
  saveBtn: {
    background: "#0e639c",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 12,
    opacity: 1,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b8b8b",
    cursor: "pointer",
    padding: "4px 8px",
    fontSize: 16,
  },
  editorContainer: {
    flex: 1,
    overflow: "hidden",
  },
  preview: {
    flex: 1,
    padding: "20px 40px",
    overflow: "auto",
    background: "#fff",
    color: "#333",
    fontSize: 15,
    lineHeight: 1.6,
  },
  centerMessage: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#8b8b8b",
  },
  footer: {
    display: "flex",
    gap: 16,
    padding: "4px 16px",
    background: "#007acc",
    color: "#fff",
    fontSize: 12,
    flexShrink: 0,
  },
};

// 添加 Markdown 预览样式
const mdStyle = document.createElement("style");
mdStyle.textContent = `
  .preview h1, .preview h2, .preview h3, .preview h4, .preview h5, .preview h6 {
    margin-top: 16px;
    margin-bottom: 8px;
    font-weight: 600;
    line-height: 1.25;
  }
  .preview h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 8px; }
  .preview h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 6px; }
  .preview h3 { font-size: 1.25em; }
  .preview p { margin: 8px 0; }
  .preview a { color: #0366d6; text-decoration: none; }
  .preview a:hover { text-decoration: underline; }
  .preview code {
    background: #f6f8fa;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 85%;
  }
  .preview pre {
    background: #f6f8fa;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
  }
  .preview pre code {
    background: none;
    padding: 0;
  }
  .preview blockquote {
    border-left: 4px solid #dfe2e5;
    padding: 0 16px;
    color: #6a737d;
    margin: 8px 0;
  }
  .preview ul, .preview ol {
    padding-left: 2em;
    margin: 8px 0;
  }
  .preview li { margin: 4px 0; }
  .preview hr {
    border: none;
    border-top: 1px solid #eaecef;
    margin: 16px 0;
  }
  .preview img {
    max-width: 100%;
    border-radius: 6px;
  }
  .preview table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
  }
  .preview th, .preview td {
    border: 1px solid #dfe2e5;
    padding: 8px 12px;
    text-align: left;
  }
  .preview th {
    background: #f6f8fa;
    font-weight: 600;
  }
`;
document.head.appendChild(mdStyle);
