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

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "transcript") {
        const text = msg.transcript.trim();
        if (msg.isPartial) {
          setPartialTranscript(text);
        } else {
          setFinalTranscript((prev) => {
            const newText = (prev + " " + text).trim();
            const words = newText.split(/\s+/);
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
        setAiResponse(msg.text || "⚠️ No AI response received.");
      }
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setIsReceivingAudio(false);
  };

  const askAI = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("WebSocket not connected yet!");
      return;
    }
    const fullText = (finalTranscript + " " + partialTranscript).trim();
    wsRef.current.send(JSON.stringify({ type: "ask_ai", text: fullText }));
    setAiResponse("🤔 Thinking...");
  };

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [finalTranscript, partialTranscript]);

  const statusColor = connected ? "#4ade80" : "#ef4444";
  const audioColor = isReceivingAudio ? "#4ade80" : "#9ca3af";

  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        background: "transparent",
        color: "white",
        height: "100%",
        width: "100%",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      {/* === Drag Pill === */}
      <div
        style={{
          WebkitAppRegion: "drag", // ✅ makes it draggable in Electron
          width: "120px",
          height: "20px",
          background: "rgba(255,255,255,0.2)",
          border: "2px solid white",
          borderRadius: "20px",
          marginBottom: "10px",
          cursor: "move",
        }}
      ></div>

      <div
        style={{
          width: "90%",
          maxWidth: 900,
          border: "1.5px solid white",
          borderRadius: 10,
          padding: "1rem",
          background: "transparent",
          WebkitAppRegion: "no-drag", // ✅ makes buttons & content clickable
        }}
      >
        <h3 style={{ marginBottom: 6, textAlign: "center", fontSize: "1rem" }}>
          Live Transcriber + AI Dashboard
        </h3>

        {/* Status bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            marginBottom: 10,
          }}
        >
          <span>
            WebSocket:{" "}
            <strong style={{ color: statusColor }}>
              {connected ? "Connected" : "Disconnected"}
            </strong>
          </span>
          <span>
            Audio:{" "}
            <strong style={{ color: audioColor }}>
              {isReceivingAudio ? "Receiving 🎙️" : "Idle"}
            </strong>
          </span>
        </div>

        {/* Buttons */}
        <div style={{ marginBottom: 12, display: "flex", gap: 6 }}>
          <button
            onClick={connectWebSocket}
            disabled={connected}
            style={{
              flex: 1,
              padding: "6px 0",
              background: "transparent",
              color: "white",
              border: "1.5px solid white",
              borderRadius: 6,
              cursor: connected ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Start
          </button>

          <button
            onClick={disconnectWebSocket}
            disabled={!connected}
            style={{
              flex: 1,
              padding: "6px 0",
              background: "transparent",
              color: "white",
              border: "1.5px solid white",
              borderRadius: 6,
              cursor: !connected ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Stop
          </button>

          <button
            onClick={askAI}
            disabled={!connected}
            style={{
              flex: 1,
              padding: "6px 0",
              background: "transparent",
              color: "white",
              border: "1.5px solid white",
              borderRadius: 6,
              cursor: !connected ? "not-allowed" : "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Ask AI
          </button>
        </div>

        {/* Split layout */}
        <div style={{ display: "flex", gap: 12 }}>
          {/* Left: Transcript */}
          <div style={{ flex: "0 0 30%" }}>
            <h4 style={{ marginBottom: 6, fontSize: "0.9rem" }}>User Transcript</h4>
            <div
              ref={scrollRef}
              style={{
                background: "transparent",
                color: "white",
                border: "1.5px solid white",
                borderRadius: 6,
                height: 250,
                overflowY: "auto",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                fontSize: 12,
                padding: 10,
              }}
            >
              {finalTranscript || partialTranscript
                ? `${finalTranscript} ${partialTranscript}`
                : "Waiting for audio..."}
            </div>
          </div>

          {/* Right: AI Response */}
          <div style={{ flex: "0 0 70%" }}>
            <h4 style={{ marginBottom: 6, fontSize: "0.9rem" }}>AI Response</h4>
            <div
              style={{
                background: "transparent",
                color: "white",
                border: "1.5px solid white",
                borderRadius: 6,
                height: 250,
                overflowY: "auto",
                fontFamily: "Inter, sans-serif",
                whiteSpace: "pre-wrap",
                fontSize: 13,
                padding: 10,
              }}
            >
              {aiResponse || "No AI answer yet."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
