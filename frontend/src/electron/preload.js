import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  resizeWindow: (width, height) => {
    ipcRenderer.send("resize-window", { width, height });
  },
});
