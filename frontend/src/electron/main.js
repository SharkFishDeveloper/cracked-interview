import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    height: 300,
    width: 400,
    minHeight: 200,
    minWidth: 300,
    transparent: true,
    useContentSize: true,
    frame: false,
    resizable: true,
    titleBarStyle: "hidden",
    thickFrame: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL("http://localhost:5173");

  // FIXED: correct argument names
  ipcMain.handle("resize-window", (_evt, { width, height }) => {
    if (!mainWindow) return;
    const W = Math.max(100, Number(width) || 300);
    const H = Math.max(100, Number(height) || 200);
    mainWindow.setSize(W, H, true);
  });

  // FIXED: correct crop information (logical → physical pixels)
  ipcMain.handle("get-underlay-crop-info", async () => {
    if (!mainWindow) throw new Error("No window");
    const overlayBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(overlayBounds);
    const scale = display.scaleFactor || 1;

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1, height: 1 },
    });

    const match =
      sources.find((s) => s.display_id === String(display.id)) || sources[0];

    const crop = {
      x: Math.round(overlayBounds.x * scale),
      y: Math.round(overlayBounds.y * scale),
      width: Math.round(overlayBounds.width * scale),
      height: Math.round(overlayBounds.height * scale),
    };

    return { sourceId: match.id, crop };
  });

}

app.whenReady().then(createWindow);
