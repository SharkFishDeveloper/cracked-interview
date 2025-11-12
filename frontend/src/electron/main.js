import { app, BrowserWindow ,ipcMain} from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
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
}

app.whenReady().then(createWindow);

ipcMain.on("resize-window", (e, { width, height }) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.setSize(width, height);
});