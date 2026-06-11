import React, { useState, useEffect } from "react";

// 判断文件类型
function getFileType(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase();

  const imageExts = ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico"];
  const videoExts = ["mp4", "webm", "ogg", "mov", "avi", "mkv"];
  const audioExts = ["mp3", "wav", "ogg", "aac", "flac", "m4a"];
  const pdfExts = ["pdf"];

  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (audioExts.includes(ext)) return "audio";
  if (pdfExts.includes(ext)) return "pdf";
  return "unknown";
}

export default function FilePreview({ filePath, fileName, onClose }) {
  const [fileType, setFileType] = useState("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const type = getFileType(fileName);
    setFileType(type);
    setLoading(false);

    if (type === "unknown") {
      setError("不支持预览此类型的文件");
    }
  }, [fileName]);

  // 获取文件 URL（二进制文件使用 download-file API）
  const fileUrl = `/api/download-file?path=${encodeURIComponent(filePath)}`;

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
        <div style={styles.header}>
          <span style={styles.title}>👁️ 文件预览</span>
          <span style={styles.fileName}>{fileName}</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.centerMessage}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container} onContextMenu={(e) => e.stopPropagation()}>
      {/* 头部 */}
      <div style={styles.header}>
        <span style={styles.title}>👁️ 文件预览</span>
        <span style={styles.fileName}>{fileName}</span>
        <span style={styles.fileType}>{fileType.toUpperCase()}</span>
        <a
          href={fileUrl}
          download={fileName}
          style={styles.downloadBtn}
          title="下载文件"
        >
          📥 下载
        </a>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* 预览内容 */}
      <div style={styles.content}>
        {fileType === "image" && (
          <div style={styles.imageContainer}>
            <img
              src={fileUrl}
              alt={fileName}
              style={styles.image}
              onError={() => setError("图片加载失败")}
            />
          </div>
        )}

        {fileType === "video" && (
          <div style={styles.mediaContainer}>
            <video
              src={fileUrl}
              controls
              style={styles.video}
              onError={() => setError("视频加载失败")}
            >
              您的浏览器不支持视频播放
            </video>
          </div>
        )}

        {fileType === "audio" && (
          <div style={styles.mediaContainer}>
            <div style={styles.audioInfo}>
              <span style={styles.audioIcon}>🎵</span>
              <span style={styles.audioName}>{fileName}</span>
            </div>
            <audio
              src={fileUrl}
              controls
              style={styles.audio}
              onError={() => setError("音频加载失败")}
            >
              您的浏览器不支持音频播放
            </audio>
          </div>
        )}

        {fileType === "pdf" && (
          <div style={styles.pdfContainer}>
            <iframe
              src={fileUrl}
              style={styles.pdf}
              title={fileName}
              onError={() => setError("PDF 加载失败")}
            />
          </div>
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
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 16px",
    background: "#161b22",
    borderBottom: "1px solid #30363d",
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    flexShrink: 0,
  },
  fileName: {
    fontSize: 13,
    color: "#8b949e",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileType: {
    fontSize: 11,
    color: "#8b949e",
    padding: "2px 8px",
    background: "#21262d",
    borderRadius: 4,
    flexShrink: 0,
  },
  downloadBtn: {
    marginLeft: "auto",
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: 4,
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: 12,
    color: "#c9d1d9",
    textDecoration: "none",
    flexShrink: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    padding: "4px 8px",
    fontSize: 16,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
  errorIcon: {
    fontSize: 48,
  },
  imageContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    padding: 20,
  },
  image: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    borderRadius: 8,
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  mediaContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    padding: 20,
  },
  video: {
    maxWidth: "100%",
    maxHeight: "100%",
    borderRadius: 8,
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  audioInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  audioIcon: {
    fontSize: 64,
  },
  audioName: {
    fontSize: 16,
    color: "#c9d1d9",
  },
  audio: {
    width: "100%",
    maxWidth: 400,
  },
  pdfContainer: {
    width: "100%",
    height: "100%",
  },
  pdf: {
    width: "100%",
    height: "100%",
    border: "none",
  },
};
