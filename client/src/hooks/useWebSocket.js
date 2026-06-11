import { useRef, useCallback } from "react";

export function useWebSocket() {
  const wsRef = useRef(null);

  const connect = useCallback((command, args = [], { onOutput, onExit, onCreated }) => {
    const wsUrl = `ws://${window.location.hostname}:3000`;
    const params = new URLSearchParams({
      action: "create",
      command,
      args: args.join(","),
      cols: "80",
      rows: "24",
    });

    const ws = new WebSocket(`${wsUrl}?${params}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "created":
            onCreated?.(msg.sessionId);
            break;
          case "output":
            onOutput?.(msg.data);
            break;
          case "exit":
            onExit?.(msg.exitCode);
            break;
          case "error":
            console.error("WS error:", msg.message);
            break;
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);

    return ws;
  }, []);

  const sendInput = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "input", data }));
    }
  }, []);

  const sendResize = useCallback((cols, rows) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  return { connect, sendInput, sendResize, disconnect };
}
