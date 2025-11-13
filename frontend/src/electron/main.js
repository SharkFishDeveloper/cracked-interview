import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
const mainWindow = new BrowserWindow({
  width: 400,
  height: 300,
  frame: false,
  transparent: true,
  backgroundColor: "#00000001",   // <-- IMPORTANT
  alwaysOnTop: true,
  skipTaskbar: true,

  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false
  }
});

// Prevent window from being captured
mainWindow.setContentProtection(false);
mainWindow.setIgnoreMouseEvents(false, { forward: true });
  mainWindow.loadURL("http://localhost:5173");

  // FIXED: correct argument names
  ipcMain.handle("resize-window", (_evt, { width, height }) => {
    if (!mainWindow) return;
    const W = Math.max(100, Number(width) || 300);
    const H = Math.max(100, Number(height) || 200);
    mainWindow.setSize(W, H, true);
  });

  // FIXED: correct crop information (logical → physical pixels)
 ipcMain.handle("capture-underlay", async () => {
  if (!mainWindow) return null;

  mainWindow.hide();
  await new Promise(r => setTimeout(r, 16));

  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const scale = display.scaleFactor || 1;

  // Windows-safe fallback (display.size may be undefined)
  const { width, height } = display.bounds;

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    },
  });

  const screenSource =
    sources.find(s => s.display_id === String(display.id)) || sources[0];

  const img = screenSource.thumbnail;

  const crop = {
    x: Math.round(bounds.x * scale),
    y: Math.round(bounds.y * scale),
    width: Math.round(bounds.width * scale),
    height: Math.round(bounds.height * scale),
  };

  console.log("CROPPING", crop);

  const cropped = img.crop(crop);

  mainWindow.show();
  return cropped.toDataURL();
});

}

app.whenReady().then(createWindow);
