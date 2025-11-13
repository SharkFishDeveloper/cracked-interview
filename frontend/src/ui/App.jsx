import { useState, useEffect, useRef } from "react";

const WS_URL = "ws://localhost:8080/ui";


console.log("---- Overlay Debug ----");
console.log("window.electronAPI =", window.electronAPI);
console.log("typeof window.electronAPI =", typeof window.electronAPI);
export default function App() {
  const [connected, setConnected] = useState(false);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [shots, setShots] = useState([]);
  const overlayRef = useRef(null);

  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const audioTimer = useRef(null);

  // ------------------- WebSocket -------------------
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

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

  // Scroll the transcript as text grows
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [finalTranscript, partialTranscript, shots]);

  // ------------------- Screen Capture -------------------
const screenStreamRef = useRef(null);

  const getStream = async () => {
    if (screenStreamRef.current) return screenStreamRef.current;

    const { sourceId } = await window.electronAPI.getUnderlayCropInfo();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: sourceId,
        },
      },
    });

    screenStreamRef.current = stream;
    return stream;
  };

  const captureUnderlay = async () => {
  try {
    console.log("➡️ Calling captureUnderlay");

    if (!window.electronAPI) {
      console.error("❌ electronAPI missing");
      return;
    }

    if (!window.electronAPI.captureUnderlay) {
      console.error("❌ captureUnderlay not available");
      return;
    }

    const dataUrl = await window.electronAPI.captureUnderlay();
    console.log("Got screenshot:", dataUrl.substring(0, 80));

    setShots(prev => [dataUrl, ...prev]);
  } catch (err) {
    console.error("Screen capture failed:", err);
  }
};




  // ------------------- Resize Logic -------------------
 // ------------------- Resize Logic -------------------
  const resizing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ w: 0, h: 0 });

const onResizeStart = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  resizing.current = true;

  const size = await window.electronAPI.getWindowSize();

  startPos.current = { x: e.clientX, y: e.clientY };
  startSize.current = {
    w: size.width,
    h: size.height,
  };

  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", onResizeEnd);
};
  const onResizeMove = (e) => {
    if (!resizing.current) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    const MIN_W = 200;
    const MIN_H = 150;

    const w = Math.max(MIN_W, startSize.current.w + dx);
    const h = Math.max(MIN_H, startSize.current.h + dy);

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
        inset: 0,
        background: "transparent",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        padding: 4,
        userSelect: "none",
      }}
    >
      {/* Drag pill */}
      <div
        style={{
          WebkitAppRegion: "drag",
          width: "50%",
          height: 22,
          borderRadius: 12,
          border: "2px solid white",
          background: "rgba(255,255,255,0.1)",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "75%",
            height: 8,
            borderRadius: 4,
            background: "rgba(255,255,255,0.2)",
          }}
        />
      </div>

      {/* Main Box */}
      <div
        ref={overlayRef}
        style={{
          width: "95%",
          flex: 1,
          border: "1.5px solid white",
          borderRadius: 10,
          padding: 4,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          WebkitAppRegion: "no-drag",
        }}
      >
        {/* Status Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          {/* Status Dots */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "#4ade80" : "#ef4444",
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isReceivingAudio ? "#4ade80" : "#ef4444",
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 4 }}>
            <button style={{ padding: "2px 6px" }} onClick={captureUnderlay}>
              Capture sds
            </button>
            <button style={{ padding: "2px 6px" }} onClick={connectWebSocket} disabled={connected}>
              Start
            </button>
            <button style={{ padding: "2px 6px" }} onClick={disconnectWebSocket} disabled={!connected}>
              Stop
            </button>
            <button style={{ padding: "2px 6px" }} onClick={askAI} disabled={!connected}>
              Ask
            </button>
          </div>
        </div>

        {/* Panels */}
        <div style={{ flex: 1, display: "flex", gap: 8, overflow: "hidden" }}>
          {/* LEFT PANEL - Transcript + Captures */}
          <div style={{ flexBasis: "35%" }}>
            <div
              ref={scrollRef}
              style={{
                height: "100%",
                overflowY: "auto",
                border: "1.5px solid white",
                borderRadius: 8,
                padding: 6,
                fontFamily: "monospace",
                fontSize: 12,
                background: "rgba(255,255,255,0.08)",
              }}
            >
              {/* transcript text */}
              {(finalTranscript || partialTranscript) && (
                <div style={{ marginBottom: 6 }}>
                  {finalTranscript} {partialTranscript}
                </div>
              )}
              {shots[0] && (
                <div style={{ marginTop: 6 }}>
                  <img
                    src={shots[0]}
                    alt="underlay capture"
                    style={{ width: "100%", borderRadius: 6, display: "block", pointerEvents: "none" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL - AI Response */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                height: "100%",
                overflowY: "auto",
                border: "1.5px solid white",
                borderRadius: 8,
                padding: 6,
                fontSize: 13,
                background: "rgba(255,255,255,0.08)",
              }}
            >
              {aiResponse || "No AI answer yet."}
            </div>
          </div>
        </div>

        {/* Resize pill */}
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
