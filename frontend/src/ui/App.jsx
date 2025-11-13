import { useState, useEffect, useRef } from "react";
import { runOCRRequest } from "./ocr";

const WS_URL = "ws://localhost:8080/ui";
const btn = {
  padding: "2px 6px",
  fontSize: "10px",
  borderRadius: "4px",
  background: "rgba(255,255,255,0.15)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.3)",
  cursor: "pointer",
  whiteSpace: "nowrap", // prevents breaking words
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [shots, setShots] = useState([]);

  // Buttons
  const [isHidden, setIsHidden] = useState(false); // Used for visibility toggle

  const [ocrLoading, setOcrLoading] = useState(false);
  const ocrAbortRef = useRef(null);

  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const audioTimer = useRef(null);

  // ------------------- KEYBOARD TOGGLE LOGIC (NEW) -------------------
  useEffect(() => {
    if (window.electronAPI?.onToggleVisibility) {
      // The callback receives the event and any arguments (which we ignore here)
      window.electronAPI.onToggleVisibility(() => {
        setIsHidden(prev => !prev);
      });
    }
  }, []); // Empty dependency array means this runs once on mount


  // -----------MOVEMENT--------------
  useEffect(() => {
  const step = 15;

  const handler = (e) => {
    if (!e.ctrlKey || !e.altKey) return;

    if (e.key === "ArrowUp") {
      window.electronAPI.moveWindow(0, -step);
    } else if (e.key === "ArrowDown") {
      window.electronAPI.moveWindow(0, step);
    } else if (e.key === "ArrowLeft") {
      window.electronAPI.moveWindow(-step, 0);
    } else if (e.key === "ArrowRight") {
      window.electronAPI.moveWindow(step, 0);
    }
  };

  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);

  useEffect(() => {
  const step = 20;

  const handler = async (e) => {
    if (!e.ctrlKey || !e.shiftKey) return; // resize combo

    const size = await window.electronAPI.getWindowSize();
    let { width, height } = size;

    if (e.key === "ArrowRight") width += step;
    else if (e.key === "ArrowLeft") width -= step;
    else if (e.key === "ArrowDown") height += step;
    else if (e.key === "ArrowUp") height -= step;
    else return;

    window.electronAPI.resizeWindow(width, height);
  };

  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);


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
        setAiResponse(msg.text || "No response");
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
      // alert("WS not connected");
      return;
    }
    const full = `${finalTranscript} ${partialTranscript}`.trim();
    wsRef.current.send(JSON.stringify({ type: "ask_ai", text: full }));
    setAiResponse("Thinking...");
  };

  // Scroll transcript as text grows
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [finalTranscript, partialTranscript, shots, ocrLoading]);

  // ------------------- Screen Capture -------------------
  const captureUnderlay = async () => {
    try {
      if (!window.electronAPI?.captureUnderlay) return;

      const dataUrl = await window.electronAPI.captureUnderlay();
      setShots((prev) => [dataUrl, ...prev]);
    } catch (err) {
      console.error("Capture failed:", err);
    }
  };

  const handleStartPause = () => {
    if (!connected) connectWebSocket();
    else disconnectWebSocket();
  };

  const handleOCRToggle = () => {
    if (!shots[0]) return;
    if (!ocrLoading) runOCR();
    else cancelOCR();
  };

  // ------------------- Remove Screenshot -------------------
  const removeScreenshot = () => {
    setShots([]); // removes all screenshots
  };

  // ------------------- Clear Transcript History -------------------
  const clearHistory = () => {
    setFinalTranscript("");
    setPartialTranscript("");
  };

  // ------------------- OCR Logic -------------------
  const runOCR = async () => {
    if (!shots[0]) return alert("Capture first!");

    if (ocrAbortRef.current) ocrAbortRef.current.abort();

    const controller = new AbortController();
    ocrAbortRef.current = controller;
    setOcrLoading(true);

    try {
      const text = await runOCRRequest(shots[0], controller.signal);

      if (text) {
        setFinalTranscript((p) => (p + "\n" + text).trim());
      }
    } catch (err) {
      if (err.name !== "AbortError") console.error("OCR error:", err);
    }

    ocrAbortRef.current = null;
    setOcrLoading(false);
  };

  const cancelOCR = () => {
    if (ocrAbortRef.current) {
      ocrAbortRef.current.abort();
      ocrAbortRef.current = null;
      setOcrLoading(false);
    }
  };

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
    startSize.current = { w: size.width, h: size.height };

    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeEnd);
  };

  const onResizeMove = (e) => {
    if (!resizing.current) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;

    const w = Math.max(200, startSize.current.w + dx);
    const h = Math.max(150, startSize.current.h + dy);

    if (window.electronAPI?.resizeWindow) window.electronAPI.resizeWindow(w, h);
    else window.resizeTo(w, h);
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
        display: isHidden ? 'none' : 'flex', // Apply visibility here
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
        padding: 4,
        userSelect: "none",
      }}
    >
      {/* Drag bar */}
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


        {/* Top Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 4,
            gap: 0, // No space between dots and buttons
          }}
        >
          {/* Status Dots */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4, // Spacing only between the dots
              marginRight: 4, // VERY tiny space so dots do not visually merge with the button
            }}
          >
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

          {/* Buttons — Touching dots, compact, responsive */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              maxWidth: "100%",
              justifyContent: "flex-start",
            }}
          >
            {/* Start / Pause Toggle */}
            <button style={btn} onClick={handleStartPause}>
              {connected ? "Pause" : "Start"}
            </button>

            {/* Capture */}
            <button style={btn} onClick={captureUnderlay}>
              Capture
            </button>

            {/* Remove screenshot */}
            <button style={btn} onClick={removeScreenshot} disabled={!shots.length}>
              Remove Img
            </button>

            {/* OCR Toggle */}
            <button
              style={btn}
              onClick={handleOCRToggle}
              disabled={!shots[0]}
            >
              {ocrLoading ? "Stop OCR" : "OCR"}
            </button>

            {/* Clear all transcripts */}
            <button style={btn} onClick={clearHistory}>
              Clear
            </button>

            {/* Ask AI */}
            <button style={btn} onClick={askAI} disabled={!connected}>
              Ask
            </button>
          </div>
        </div>


        {/* Two Panels */}
        <div style={{ flex: 1, display: "flex", gap: 8, overflow: "hidden" }}>
          {/* LEFT PANEL */}
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
              {shots[0] && (
                <img
                  src={shots[0]}
                  style={{
                    width: "100%",
                    borderRadius: 6,
                    marginBottom: 8,
                    pointerEvents: "none",
                  }}
                />
              )}

              {(finalTranscript || partialTranscript) && (
                <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                  {finalTranscript}
                  {partialTranscript && " " + partialTranscript}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                height: "100%",
                overflowY: "auto",
                border: "1.5px solid white",
                borderRadius: 8,
                padding: 6,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
                background: "rgba(255,255,255,0.08)",
              }}
            >
              {aiResponse || "No AI answer yet."}
            </div>
          </div>
        </div>

        {/* Resize handle */}
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
          }}
        />
      </div>
    </div>
  );
}