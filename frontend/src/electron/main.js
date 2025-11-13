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
    backgroundColor: "#00000001",
    alwaysOnTop: true,
    skipTaskbar: true,

    // IMPORTANT TO HIDE FROM ALT+TAB
    show: false,
    focusable: true,  

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Keeps it off task switcher (Windows magic)
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true);

  // Show without becoming a real OS window
  mainWindow.once("ready-to-show", () => {
    mainWindow.showInactive();
  });

  mainWindow.setContentProtection(false);
  mainWindow.setIgnoreMouseEvents(false, { forward: true });

  mainWindow.loadURL("http://localhost:5173");

  // ---------------------------------------- RESIZE
  ipcMain.handle("resize-window", (_evt, { width, height }) => {
    if (!mainWindow) return;

    const W = Math.max(200, Number(width));
    const H = Math.max(150, Number(height));

    const currentBounds = mainWindow.getBounds();

    mainWindow.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: W,
      height: H
    }, true);
  });

  // ---------------------------------------- CAPTURE UNDERLAY
  ipcMain.handle("capture-underlay", async () => {
    if (!mainWindow) return null;

    mainWindow.setOpacity(0);
    await new Promise(resolve => setTimeout(resolve, 1));

    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const scale = display.scaleFactor || 1;
    const { width, height } = display.bounds;

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: Math.round(width * scale),
        height: Math.round(height * scale)
      }
    });

    const screenSource =
      sources.find(s => s.display_id === String(display.id)) || sources[0];

    const img = screenSource.thumbnail;

    const crop = {
      x: Math.round(bounds.x * scale),
      y: Math.round(bounds.y * scale),
      width: Math.round(bounds.width * scale),
      height: Math.round(bounds.height * scale)
    };

    const cropped = img.crop(crop);
    mainWindow.setOpacity(1);

    return cropped.toDataURL();
  });

  ipcMain.handle("get-window-size", () => {
    return mainWindow.getBounds();
  });
}

app.whenReady().then(createWindow);
