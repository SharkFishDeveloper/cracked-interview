import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getUnderlayCropInfo: () => ipcRenderer.invoke("get-underlay-crop-info"),
  saveShot: (dataUrl) => ipcRenderer.invoke("save-shot", dataUrl),
  resizeWindow: (w, h) => ipcRenderer.invoke("resize-window", { w, h }),
});
