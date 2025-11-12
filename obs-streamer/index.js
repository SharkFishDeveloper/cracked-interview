// media-server.js
const NodeMediaServer = require("node-media-server");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");
const WebSocket = require("ws");

const TRANSCRIBE_WS_URL = "ws://127.0.0.1:8080/transcribe"; // local transcriber

// ----------------------
// NodeMediaServer config
// ----------------------
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 4096,
    gop_cache: false,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    allow_origin: "*",
  },
};

const nms = new NodeMediaServer(config);
nms.run();

console.log("🎧 Node-Media-Server running on rtmp://localhost:1935/live");

// ---------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------
function safeKill(proc) {
  if (proc && !proc.killed) {
    try {
      proc.kill("SIGINT");
    } catch (e) {
      console.error("⚠️ Failed to kill process:", e.message);
    }
  }
}

function safeClose(sock) {
  if (sock && sock.readyState === WebSocket.OPEN) {
    try {
      sock.close();
    } catch (e) {
      console.error("⚠️ Failed to close socket:", e.message);
    }
  }
}

// backoff delay (1 s → 2 s → 4 s → 8 s → max 10 s)
function getDelay(attempt) {
  const delay = Math.min(10000, 1000 * 2 ** Math.min(attempt, 6));
  console.log(`⏳ Reconnecting in ${(delay / 1000).toFixed(1)} s...`);
  return delay;
}

// ---------------------------------------------------------
// Robust WebSocket connector with auto-retry
// ---------------------------------------------------------
function connectToTranscriber(inputUrl) {
  let attempt = 1;
  let ws;
  let ff;

  const tryConnect = () => {
    console.log(`🔁 [Attempt ${attempt}] Connecting to ${TRANSCRIBE_WS_URL} ...`);
    ws = new WebSocket(TRANSCRIBE_WS_URL);

    // ---- On successful connection ----
    ws.on("open", () => {
      console.log("🌐 Connected to /transcribe WebSocket ✅");
      attempt = 1; // reset backoff on success

      // start ffmpeg only once WS is ready
      ff = spawn(ffmpegPath, [
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-i",
        inputUrl,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "s16le",
        "pipe:1",
      ]);

      ff.stdout.on("data", (chunk) => {
        if (ws.readyState === ws.OPEN) ws.send(chunk);
      });

      ff.stderr.on("data", (d) => process.stdout.write(d.toString()));

      ff.on("close", () => {
        console.log("🛑 FFmpeg stopped, closing WebSocket.");
        safeClose(ws);
      });

      ws.on("close", () => {
        console.log("🔌 WebSocket closed, killing FFmpeg and reconnecting...");
        safeKill(ff);
        scheduleReconnect();
      });

      ws.on("error", (err) => {
        console.error("❌ WS runtime error:", err.message);
        safeKill(ff);
        scheduleReconnect();
      });
    });

    // ---- If initial connection fails (e.g., server not ready) ----
    ws.on("error", (err) => {
      console.error(`❌ WS connection failed: ${err.message}`);
      scheduleReconnect();
    });
  };

  function scheduleReconnect() {
    safeClose(ws);
    safeKill(ff);
    const delay = getDelay(attempt++);
    setTimeout(tryConnect, delay);
  }

  tryConnect();
}

// ---------------------------------------------------------
// OBS stream publish event
// ---------------------------------------------------------
nms.on("postPublish", (session) => {
  try {
    const actualPath = session.streamPath;
    console.log(`🔗 Incoming RTMP stream: ${actualPath}`);

    const inputUrl = `rtmp://127.0.0.1:1935${actualPath}`;
    console.log("🎥 Capturing live audio from:", inputUrl);

    connectToTranscriber(inputUrl);
  } catch (err) {
    console.error("❌ Error in postPublish handler:", err);
  }
});
