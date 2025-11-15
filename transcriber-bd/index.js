import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import {
  TextractClient,
  AnalyzeDocumentCommand,
} from "@aws-sdk/client-textract";
import OpenAI from "openai";
import { promptAi } from "./promptAi.js";

dotenv.config();

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const REGION = process.env.AWS_REGION || "ap-south-1";
const transcribeClient = new TranscribeStreamingClient({ region: REGION });
const textractClient = new TextractClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_OCR,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_OCR,
  },
});

// 🔵 NEW — GLOBAL MUTE FLAG
let muteAudio = false;

// ---------- Async queue ----------
class IncomingQueue {
  constructor() {
    this._buffers = [];
    this._resolvers = [];
    this._closed = false;
  }
  push(buf) {
    if (this._closed) return;
    if (this._resolvers.length > 0) this._resolvers.shift()({ value: buf, done: false });
    else this._buffers.push(buf);
  }
  close() {
    this._closed = true;
    while (this._resolvers.length)
      this._resolvers.shift()({ value: undefined, done: true });
  }
  [Symbol.asyncIterator]() {
    return {
      next: () =>
        this._buffers.length
          ? Promise.resolve({ value: this._buffers.shift(), done: false })
          : this._closed
          ? Promise.resolve({ value: undefined, done: true })
          : new Promise((resolve) => this._resolvers.push(resolve)),
    };
  }
}

async function* audioEventGenerator(queue) {
  for await (const chunk of queue)
    yield { AudioEvent: { AudioChunk: new Uint8Array(chunk) } };
}

// ---------- Servers ----------
const httpServer = http.createServer();
const wssTranscribe = new WebSocketServer({ noServer: true });
const wssUI = new WebSocketServer({ noServer: true });

let uiClients = new Set();

// Upgrade routing
httpServer.on("upgrade", (req, socket, head) => {
  if (req.url === "/transcribe")
    wssTranscribe.handleUpgrade(req, socket, head, (ws) =>
      wssTranscribe.emit("connection", ws)
    );
  else if (req.url === "/ui")
    wssUI.handleUpgrade(req, socket, head, (ws) => wssUI.emit("connection", ws));
  else socket.destroy();
});

// UI clients
wssUI.on("connection", (ws) => {
  uiClients.add(ws);
  ws.send(JSON.stringify({ type: "info", message: "UI connected" }));

  ws.on("close", () => uiClients.delete(ws));

  // ------------------ UI MESSAGE HANDLER ------------------
  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // 🔵 NEW: MUTE HANDLER
    if (msg.type === "set_mute") {
      muteAudio = !!msg.mute;
      console.log("🎚️ Mute toggled:", muteAudio);
      return;
    }

    // ------------------ ASK AI HANDLER ------------------
    if (msg.type === "ask_ai") {
      const userText = msg.text?.trim();
      if (!userText) return;

      try {
        const response = await openaiClient.responses.create({
          model: "gpt-4o-mini",
          input: [
            { role: "system", content: promptAi },
            { role: "user", content: userText },
          ],
        });

        const answer = response.output_text || "No answer";

        ws.send(
          JSON.stringify({
            type: "ai_answer",
            text: answer,
          })
        );
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: "ai_answer",
            text: "AI failed: " + err.message,
          })
        );
      }
    }
  });
});

// Broadcast helper
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of uiClients)
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
}

// OBS audio stream
wssTranscribe.on("connection", async (ws) => {
  console.log("🎧 OBS audio stream connected");
  broadcast({ type: "status", message: "OBS stream connected" });

  const queue = new IncomingQueue();

  ws.on("message", (msg, isBinary) => {

    // 🔵 NEW: MUTE MODE — DROP AUDIO
    if (muteAudio) return;

    if (isBinary) queue.push(msg);
    broadcast({ type: "audio_status", status: "receiving" });
  });

  ws.on("close", () => {
    console.log("🔌 OBS stream disconnected");
    broadcast({ type: "status", message: "OBS stream disconnected" });
    queue.close();
  });

  const audioStream = audioEventGenerator(queue);
  const command = new StartStreamTranscriptionCommand({
    LanguageCode: "en-US",
    MediaEncoding: "pcm",
    MediaSampleRateHertz: 16000,
    EnablePartialResultsStabilization: true,
    PartialResultsStability: "medium",
    AudioStream: audioStream,
  });

  try {
    const response = await transcribeClient.send(command);
    for await (const evt of response.TranscriptResultStream) {
      if (!evt.TranscriptEvent) continue;

      const results = evt.TranscriptEvent.Transcript.Results ?? [];
      for (const r of results) {
        const text = r.Alternatives?.[0]?.Transcript?.trim();
        if (!text) continue;

        const payload = {
          type: "transcript",
          transcript: text,
          isPartial: r.IsPartial,
        };

        broadcast(payload);
      }
    }
  } catch (err) {
    console.error("❌ AWS Transcribe error:", err);
    broadcast({ type: "error", message: err.message });
  } finally {
    queue.close();
  }
});

// -------------- AWS TEXTRACT OCR ENDPOINT --------------
httpServer.on("request", async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  if (req.method === "POST" && req.url === "/ocr") {
    console.log("📩 OCR POST hit");

    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { image } = JSON.parse(body);

        if (!image) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Missing image" }));
        }

        const base64data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64data, "base64");

        const command = new AnalyzeDocumentCommand({
          Document: { Bytes: buffer },
          FeatureTypes: ["FORMS", "TABLES"],
        });

        const textractResponse = await textractClient.send(command);

        let extractedText = "";
        if (textractResponse?.Blocks) {
          extractedText = textractResponse.Blocks
            .filter((b) => b.BlockType === "LINE")
            .map((b) => b.Text)
            .join("\n");
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });

        return res.end(JSON.stringify({ text: extractedText || "" }));
      } catch (err) {
        console.error("❌ Textract error:", err);

        res.writeHead(500, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });

        return res.end(
          JSON.stringify({
            error: "Textract failed",
            details: err.message,
          })
        );
      }
    });
  }
});

const PORT = 8080;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server ready:
  ws://localhost:${PORT}/transcribe
  ws://localhost:${PORT}/ui`)
);
