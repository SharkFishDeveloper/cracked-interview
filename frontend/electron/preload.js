import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getWindowSize: () => ipcRenderer.invoke("get-window-size"),
  resizeWindow: (width, height) =>
    ipcRenderer.invoke("resize-window", { width, height }),
  captureUnderlay: () => ipcRenderer.invoke("capture-underlay"),
  moveWindow: (dx, dy) =>
    ipcRenderer.invoke("move-window", { dx, dy }),
  onToggleVisibility: (callback) =>
    ipcRenderer.on("toggle-visibility", callback)
});
