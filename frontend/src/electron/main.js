import { app, BrowserWindow ,ipcMain} from "electron";
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
    skipTaskbar: true,       // ← never show in taskbar
    focusable: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL("http://localhost:5173");
  ipcMain.handle("resize-window", (_evt, { w, h }) => {
    if (!mainWindow) return;
    const minW = 100;
    const minH = 100;
    const W = Math.max(minW, Math.floor(Number(w) || 0));
    const H = Math.max(minH, Math.floor(Number(h) || 0));
    mainWindow.setSize(W, H, true);
  });
}

app.whenReady().then(createWindow);

