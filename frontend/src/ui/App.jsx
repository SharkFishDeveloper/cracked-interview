import { useState, useEffect, useRef } from "react";

const WS_URL = "ws://localhost:8080/ui";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const scrollRef = useRef(null);
  const audioTimer = useRef(null);
  const wsRef = useRef(null);

  // ---- Function to connect ----
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ Connected to WebSocket");
      setConnected(true);
      setTranscripts([]); // clear previous logs
    };

    ws.onclose = () => {
      console.log("🔌 WebSocket closed");
      setConnected(false);
      setIsReceivingAudio(false);
    };

    ws.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
      setConnected(false);
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      // --- Transcript handling ---
      if (msg.type === "transcript") {
        setTranscripts((prev) => {
          const updated = [...prev];

          // Update last entry
          if (msg.isPartial) {
            if (updated.length > 0 && updated[updated.length - 1].startsWith("🗣️"))
              updated[updated.length - 1] = "🗣️ " + msg.transcript;
            else updated.push("🗣️ " + msg.transcript);
          } else {
            if (updated.length > 0 && updated[updated.length - 1].startsWith("🗣️"))
              updated[updated.length - 1] = "✅ " + msg.transcript;
            else updated.push("✅ " + msg.transcript);
          }

          // ---- ⏬ Limit to last 100 words ----
          const allWords = updated.join(" ").split(/\s+/);
          const last100Words = allWords.slice(-100).join(" ");

          // Rebuild transcript array (split lines back for display)
          return last100Words.split(/(?<=✅|🗣️)/).map((s) => s.trim()).filter(Boolean);
        });
      }

      // --- Audio activity ---
      if (msg.type === "audio_status") {
        setIsReceivingAudio(true);
        clearTimeout(audioTimer.current);
        audioTimer.current = setTimeout(() => setIsReceivingAudio(false), 2000);
      }

      if (msg.type === "status" || msg.type === "info") {
        console.log("ℹ️", msg.message);
      }
    };
  };

  // ---- Disconnect ----
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setIsReceivingAudio(false);
    setTranscripts([]);
    console.log("🛑 Disconnected manually");
  };

  // ---- Auto-scroll transcript ----
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [transcripts]);

  const statusColor = connected ? "#4ade80" : "#ef4444";
  const audioColor = isReceivingAudio ? "#4ade80" : "#9ca3af";

  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        background: "#0b0f17",
        color: "white",
        minHeight: "100vh",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 700,
          background: "#111827",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 0 20px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ marginBottom: 10 }}>🎧 Live Transcriber Dashboard</h2>

        {/* Status bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
            marginBottom: 16,
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
              {isReceivingAudio ? "Receiving 🎙️" : "Idle ⏸️"}
            </strong>
          </span>
        </div>

        {/* Buttons */}
        <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
          <button
            onClick={connectWebSocket}
            disabled={connected}
            style={{
              flex: 1,
              padding: "10px 0",
              background: connected ? "#374151" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: connected ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            ▶️ Start
          </button>
          <button
            onClick={disconnectWebSocket}
            disabled={!connected}
            style={{
              flex: 1,
              padding: "10px 0",
              background: !connected ? "#374151" : "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: !connected ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            ⏹ Stop
          </button>
        </div>

        {/* Transcripts */}
        <h3 style={{ marginBottom: 8 }}>🗒️ Live Transcription</h3>
        <div
          ref={scrollRef}
          style={{
            background: "#000",
            color: "#0f0",
            padding: 16,
            borderRadius: 8,
            height: 350,
            overflowY: "auto",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          {transcripts.length === 0
            ? "Waiting for audio..."
            : transcripts.join("\n")}
        </div>
      </div>
    </div>
  );
}
