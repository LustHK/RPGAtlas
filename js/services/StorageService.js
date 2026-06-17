/* RPGAtlas — services/StorageService.js
   Abstraction layer for file I/O that works in both Tauri and Web environments.
   GPL-3.0-or-later (see LICENSE). */

const tauri = typeof window !== "undefined" ? window.__TAURI__ : undefined;

export class StorageService {
  constructor() {
    this._isTauri = !!tauri;
  }

  get isTauri() {
    return this._isTauri;
  }

  _invoke(cmd, args) {
    if (!this._isTauri) throw new Error("Tauri not available");
    return tauri.core.invoke(cmd, args);
  }

  async listFiles(dir) {
    if (this._isTauri) {
      return this._invoke("list_directory", { path: dir });
    }
    const res = await fetch(dir + "/");
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");
    return Array.from(doc.querySelectorAll("a"))
      .map(a => a.innerText)
      .filter(n => n && n !== "../");
  }

  async readJson(path) {
    if (this._isTauri) {
      const text = await this._invoke("read_text_file", { path });
      return JSON.parse(text);
    }
    const res = await fetch(path);
    return res.json();
  }

  async saveJson(path, data) {
    const json = JSON.stringify(data, null, 1);
    if (this._isTauri) {
      await this._invoke("write_text_file", { path, contents: json });
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split("/").pop() || "data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async loadImage(path) {
    if (this._isTauri) {
      const b64 = await this._invoke("read_file_base64", { path });
      return `data:image/png;base64,${b64}`;
    }
    return path;
  }
}
