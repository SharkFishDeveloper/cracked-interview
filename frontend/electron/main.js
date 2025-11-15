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
    skipTaskbar: true, // hides from taskbar and Alt+Tab on Windows
    show: false, // we will show it manually
    focusable: true, // must be focusable when visible so you can click

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 🛡️ SECURITY/STEALTH FEATURE 1: Attempt to prevent screen capture/sharing
  // This is kept, but the hide/show logic below is more reliable.
  mainWindow.setContentProtection(true); // WDA_EXCLUDEFROMCAPTURE on Windows

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

  // ---------------- CLOSING/STEALTH LOGIC ----------------
  // 😈 SECURITY/STEALTH FEATURE 2: Prevent Alt+F4, Task Switcher "Close Window"
  mainWindow.on("close", (event) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Intercept the close event (blocks Alt+F4 and context menu closure)
    event.preventDefault();

    // Instead of closing, force the window into absolute stealth mode.
    if (!isHiddenState) {
      // If it wasn't already hidden by Ctrl+Space, force hide
      isHiddenState = true;
      mainWindow.setIgnoreMouseEvents(true, { forward: false });
      mainWindow.setFocusable(false);
      mainWindow.hide(); // <-- ABSOLUTE HIDE
      mainWindow.webContents.send("toggle-visibility", true);
      console.log("Alt+F4 intercepted. Entering stealth mode.");
    }
    // If it was already hidden, do nothing, just prevent closure.
  });

  mainWindow.on("closed", () => {
    // This event only fires if the window is truly destroyed (e.g., app quit).
    mainWindow = null;
  });
  // ---------------- END CLOSING/STEALTH LOGIC ----------------


  // ---------------- GLOBAL SHORTCUT: Ctrl+Space = toggle stealth ----------------
  const ok = globalShortcut.register("CommandOrControl+Space", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    isHiddenState = !isHiddenState;

    if (isHiddenState) {
      // 🔒 ENTER STEALTH MODE (Absolute hide from everything)
      mainWindow.setIgnoreMouseEvents(true, { forward: false });
      mainWindow.setFocusable(false);
      mainWindow.setSkipTaskbar(true);
      mainWindow.hide(); // <-- The definitive command for absolute invisibility
      mainWindow.webContents.send("toggle-visibility", true);
    } else {
      // 🔓 EXIT STEALTH MODE (Visible to User only)
      // Using show() and focus() ensures the window is fully responsive immediately.
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.setOpacity(1); // Ensure full visibility
      mainWindow.setFocusable(true);
      mainWindow.setSkipTaskbar(true);
      mainWindow.show(); // <-- Use show() for better restoration
      mainWindow.focus(); // <-- Force focus for responsiveness

      // setContentProtection(true) remains active.
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

    const previousHiddenState = isHiddenState;
    const wasVisible = !previousHiddenState;

    // Ensure window is hidden for capture to avoid capturing itself
    if (wasVisible) {
        mainWindow.hide();
        await new Promise((resolve) => setTimeout(resolve, 50)); // Short wait for hide to process
    }

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

    // Restore previous state (show if it was visible before capture)
    if (wasVisible) {
        // Use show and focus to ensure responsiveness is immediately restored after capture.
        mainWindow.show();
        mainWindow.focus();
    }

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