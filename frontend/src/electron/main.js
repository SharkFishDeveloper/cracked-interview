import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: { preload: path.join(__dirname, "preload.js"), },
  });
  mainWindow.loadURL("http://localhost:5173");
};
app.whenReady().then(createWindow);

