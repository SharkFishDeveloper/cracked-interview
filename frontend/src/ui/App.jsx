import { useState, useEffect, useRef } from "react";

const WS_URL = "ws://localhost:8080/ui";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const audioTimer = useRef(null);

  // ------------------- WebSocket -------------------
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setFinalTranscript("");
      setPartialTranscript("");
      setAiResponse("");
    };

    ws.onclose = () => {
      setConnected(false);
      setIsReceivingAudio(false);
    };
    ws.onerror = () => setConnected(false);

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.type === "transcript") {
        const text = msg.transcript.trim();
        if (msg.isPartial) {
          setPartialTranscript(text);
        } else {
          setFinalTranscript((p) => {
            const combined = (p + " " + text).trim();
            const words = combined.split(/\s+/);
            return words.slice(-150).join(" ");
          });
          setPartialTranscript("");
        }
      }

      if (msg.type === "audio_status") {
        setIsReceivingAudio(true);
        clearTimeout(audioTimer.current);
        audioTimer.current = setTimeout(() => setIsReceivingAudio(false), 2000);
      }

      if (msg.type === "ai_answer") {
        setAiResponse(msg.text || "⚠️ No response");
      }
    };
  };

  const disconnectWebSocket = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setIsReceivingAudio(false);
  };

  const askAI = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("WS not connected");
      return;
    }
    const full = `${finalTranscript} ${partialTranscript}`.trim();
    wsRef.current.send(JSON.stringify({ type: "ask_ai", text: full }));
    setAiResponse("🤔 Thinking...");
  };

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [finalTranscript, partialTranscript]);

  // ------------------- Resize Logic -------------------
  const resizing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ w: 0, h: 0 });

  const onResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;

    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = {
      w: window.innerWidth,
      h: window.innerHeight,
    };

    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeEnd);
  };

  const onResizeMove = (e) => {
    if (!resizing.current) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    const w = Math.max(360, startSize.current.w + dx);
    const h = Math.max(220, startSize.current.h + dy);

    if (window.electronAPI?.resizeWindow) {
      window.electronAPI.resizeWindow(w, h);
    } else {
      window.resizeTo(w, h);
    }
  };

  const onResizeEnd = () => {
    resizing.current = false;
    window.removeEventListener("mousemove", onResizeMove);
    window.removeEventListener("mouseup", onResizeEnd);
  };

  // ------------------- UI -------------------
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,                     // <-- FULL WINDOW ALWAYS
        background: "transparent",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        paddingTop: 2,
        padding:6,
        userSelect: "none",
      }}
    >
      {/* Drag pill */}
      <div
        style={{
          WebkitAppRegion: "drag",
          width: "50%",
          height: 26,
          borderRadius: 14,
          border: "2px solid white",
          background: "rgba(255,255,255,0.12)",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "80%",
            height: 10,
            borderRadius: 6,
            background: "rgba(255,255,255,0.18)",
          }}
        />
      </div>

      {/* Main box */}
      <div
        style={{
          width: "95%",
          flex: 1,
          border: "1.5px solid white",
          borderRadius: 12,
          padding: 2,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",      // ✅ FIX RESPONSIVENESS
          overflowX: "hidden",
          WebkitAppRegion: "no-drag",
        }}
      >
        {/* Status + Buttons */}
        <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,     // ↓ minimal spacing
          padding: 0,
        }}
      >
  {/* Ultra-compact status dots */}
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: connected ? "#4ade80" : "#ef4444",
        boxShadow: connected
          ? "0 0 4px rgba(74,222,128,0.8)"
          : "0 0 4px rgba(239,68,68,0.8)",
      }}
    />
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: isReceivingAudio ? "#4ade80" : "#ef4444",
        boxShadow: isReceivingAudio
          ? "0 0 4px rgba(74,222,128,0.8)"
          : "0 0 4px rgba(239,68,68,0.8)",
      }}
    />
  </div>

  {/* Buttons */}
  <div style={{ display: "flex", gap: 4 }}>
    <button onClick={connectWebSocket} disabled={connected} style={{ padding: "2px 6px" }}>
      Start
    </button>
    <button onClick={disconnectWebSocket} disabled={!connected} style={{ padding: "2px 6px" }}>
      Stop
    </button>
    <button onClick={askAI} disabled={!connected} style={{ padding: "2px 6px" }}>
      Ask
    </button>
  </div>
</div>

        {/* Panels */}
        <div style={{ flex: 1, display: "flex", gap: 12, overflow: "hidden" }}>
          <div style={{ flexBasis: "35%" }}>
            <div
              ref={scrollRef}
              style={{
                height: "100%",
                overflowY: "auto",
                border: "1.5px solid white",
                borderRadius: 10,
                padding: 10,
                background: "rgba(255,255,255,0.06)",
              }}
            >
              {finalTranscript || partialTranscript
                ? `${finalTranscript} ${partialTranscript}`
                : "Waiting for audio..."}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                height: "100%",
                overflowY: "auto",
                border: "1.5px solid white",
                borderRadius: 10,
                padding: 10,
                background: "rgba(255,255,255,0.06)",
              }}
            >
              {aiResponse || "No AI answer yet."}
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            fontSize: 12,
            opacity: 0.8,
            pointerEvents: "none",   // allow underlying drag area to work
          }}
          >
        </div>

          <div
            onMouseDown={onResizeStart}
            style={{
              position: "absolute",
              bottom: 10,
              right: 18,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "white",
              boxShadow: "0 0 10px rgba(255,255,255,0.9)",
              cursor: "nwse-resize",
              WebkitAppRegion: "no-drag",
              pointerEvents: "auto",    // pill stays clickable
            }}
          />

      </div>
    </div>
  );
}
