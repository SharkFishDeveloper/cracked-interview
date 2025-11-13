import { contextBridge, ipcRenderer } from "electron";

console.log("🔥 PRELOAD EXECUTED");

contextBridge.exposeInMainWorld("electronAPI", {
  captureUnderlay: () => ipcRenderer.invoke("capture-underlay"),

  resizeWindow: (w, h) => ipcRenderer.invoke("resize-window", {
    width: w, height: h
  })
});
