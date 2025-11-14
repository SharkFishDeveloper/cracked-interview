import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
  globalShortcut,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let isHiddenState = false; // our stealth toggle

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    backgroundColor: "#00000001",

    alwaysOnTop: true,
    skipTaskbar: true,   // hides from taskbar (and from Alt+Tab on Windows) :contentReference[oaicite:0]{index=0}
    show: false,         // we will show it manually
    focusable: true,     // must be focusable when visible so you can click

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 🛡️ Prevent screen capture / screen sharing / OBS capturing this window
  mainWindow.setContentProtection(true); // WDA_EXCLUDEFROMCAPTURE on Windows :contentReference[oaicite:1]{index=1}

  // Keep floating above everything
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setMenuBarVisibility(false);

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // Vite dev server
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // Built React app
    mainWindow.loadFile(path.join(__dirname, "../dist-react/index.html"));
  }

  // Show without stealing focus
  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;
    mainWindow.showInactive();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // ---------------- GLOBAL SHORTCUT: Ctrl+Space = toggle stealth ----------------
  const ok = globalShortcut.register("CommandOrControl+Space", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    isHiddenState = !isHiddenState;

    if (isHiddenState) {
      // 🔒 ENTER STEALTH MODE
      mainWindow.setIgnoreMouseEvents(true, { forward: false });
      mainWindow.setOpacity(0.01);   // almost invisible
      mainWindow.setFocusable(false); // don't grab focus while hidden
      mainWindow.webContents.send("toggle-visibility", true);
    } else {
      // 🔓 EXIT STEALTH MODE
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setOpacity(1);
      mainWindow.setFocusable(true);  // clickable again
      mainWindow.webContents.send("toggle-visibility", false);
    }
  });

  if (!ok) {
    console.warn("⚠️ Failed to register Ctrl+Space global shortcut");
  }

  // ---------------- IPC: resize-window ----------------
  ipcMain.handle("resize-window", (_evt, { width, height }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const W = Math.max(200, Number(width));
    const H = Math.max(150, Number(height));
    const currentBounds = mainWindow.getBounds();

    mainWindow.setBounds(
      {
        x: currentBounds.x,
        y: currentBounds.y,
        width: W,
        height: H,
      },
      true
    );
  });

  // ---------------- IPC: capture-underlay (screenshot behind overlay) ----------------
  ipcMain.handle("capture-underlay", async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;

    const previousOpacity = mainWindow.getOpacity();

    // Temporarily hide overlay so it doesn't appear in capture
    mainWindow.setOpacity(0);
    await new Promise((resolve) => setTimeout(resolve, 1));

    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const scale = display.scaleFactor || 1;
    const { width, height } = display.bounds;

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      },
    });

    const screenSource =
      sources.find((s) => s.display_id === String(display.id)) || sources[0];

    const img = screenSource.thumbnail;

    const crop = {
      x: Math.round(bounds.x * scale),
      y: Math.round(bounds.y * scale),
      width: Math.round(bounds.width * scale),
      height: Math.round(bounds.height * scale),
    };

    const cropped = img.crop(crop);

    // Restore previous opacity (respects hidden/visible state)
    mainWindow.setOpacity(previousOpacity);

    return cropped.toDataURL();
  });

  // ---------------- IPC: get-window-size ----------------
  ipcMain.handle("get-window-size", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    return mainWindow.getBounds();
  });

  // ---------------- IPC: move-window (Ctrl+Alt+Arrows) ----------------
  ipcMain.handle("move-window", (_evt, { dx, dy }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const { x, y, width, height } = mainWindow.getBounds();

    mainWindow.setBounds({
      x: x + dx,
      y: y + dy,
      width,
      height,
    });
  });
}

// ---------------- APP LIFECYCLE ----------------

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit on all windows closed (normal Windows behavior)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
