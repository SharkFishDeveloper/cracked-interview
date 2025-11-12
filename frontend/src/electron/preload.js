import { ipcRenderer} from "electron";

ipcRenderer.send("resize-window", { width, height });