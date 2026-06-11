# ChatMux 💬

聊天式终端多路复用器 — 把每个 CLI 工具变成一个聊天好友。

## 快速部署

```bash
# 1. 解压
tar xzf chatmux.tar.gz
cd chatmux

# 2. 一键安装并启动
chmod +x setup.sh
./setup.sh
```

脚本会自动检查 Node.js 环境、安装依赖、构建前端、启动服务。

## 手动安装

```bash
# 需要 Node.js >= 18
cd server && npm install
cd ../client && npm install && npx vite build
cd ../server && node index.js
```

## 使用

打开浏览器访问 `http://你的IP:9910`

- **点击 ＋** 或 **Ctrl+K** 添加 CLI 工具
- **Ctrl+F** 在终端中搜索
- **🏷️** 给会话设置分组标签
- 会话自动持久化，刷新页面不丢失

## 修改端口

```bash
PORT=8080 node index.js
```
