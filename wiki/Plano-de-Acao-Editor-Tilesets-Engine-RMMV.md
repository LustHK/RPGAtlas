# Plano de Ação — Editor de Tilesets + Engine RMMV + StorageService

> **Data:** 17 de Junho de 2026
> **Contexto:** Refatoração do editor de tilesets, substituição do engine customizado pelo RMMV v1.6.2 no playtest, e criação de uma camada de abstração de I/O (StorageService).

---

## Sumário Executivo

O projeto RPGAtlas possui atualmente um engine de jogo customizado (`engine.js`, `renderer.js`, PIXI v8) e um editor de tilesets com funcionalidades incompletas. Precisamos:

1. **Substituir o engine do playtest** pelo RMMV v1.6.2 padrão (código já presente em `NewData/js/`)
2. **Refatorar o editor de tilesets** para ter layout, ferramentas e overlays idênticos ao RPG Maker MV/MZ
3. **Criar o StorageService** como camada de abstração de I/O (Tauri ↔ Web)
4. **Manter compatibilidade total** com o formato de dados RMMV

---

## Arquitetura Alvo

```
                    ┌─────────────────────────────────────┐
                    │            StorageService           │
                    │  (js/services/StorageService.js)    │
                    │                                     │
                    │  listFiles()  readJson()  saveJson()│
                    │  loadImage()                        │
                    └──────────┬──────────────────────────┘
                               │
              ┌────────────────┼────────────────────┐
              │ Tauri (fs)     │ Web (fetch/Blob)   │
              │ invoke()       │ fetch / download   │
              └────────────────┴────────────────────┘

┌─────────────────────┐   ┌──────────────────────────────┐
│   Editor (index.html)│   │    Playtest (play.html)      │
│                     │   │                              │
│  tileset-editor.js  │   │  js/rpg/rpg_core.js         │
│  (refatorado)       │   │  js/rpg/rpg_managers.js     │
│                     │   │  js/rpg/rpg_objects.js      │
│  StorageService     │   │  js/rpg/rpg_scenes.js       │
│                     │   │  js/rpg/rpg_sprites.js      │
│  Dados → localStorage│  │  js/rpg/rpg_windows.js      │
│         → arquivo   │   │  js/rpg/rpgatlas-bridge.js  │
└─────────┬───────────┘   └────────────┬─────────────────┘
          │                            │
          └───────── dados (JSON) ─────┘
```

---

## Fase 1: StorageService (Abstração de I/O)

### 1.1 Arquivo: `js/services/StorageService.js`

Camada única para operações de arquivo que funciona em Tauri e Web.

**Métodos:**

| Método | Tauri | Web (fallback) |
|---|---|---|
| `listFiles(dir)` | `invoke("list_directory")` → `fs::read_dir()` | `fetch(dir + "/")` → parser de HTML |
| `readJson(path)` | `invoke("read_text_file")` → `fs::read_to_string()` | `fetch(path)` → `res.json()` |
| `saveJson(path, data)` | `invoke("write_text_file")` → `fs::write()` | `downloadBlob()` (dispara download) |
| `loadImage(path)` | `invoke("read_file_base64")` → base64 data URL | `path` (URL relativa direta) |

### 1.2 Comandos Rust a adicionar em `src-tauri/src/lib.rs`

```rust
#[tauri::command]
fn list_directory(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        names.push(entry.file_name().to_string_lossy().to_string());
    }
    Ok(names)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}
```

Adicionar `base64 = "0.22"` ao `Cargo.toml`.

### 1.3 Uso no editor

```js
import { StorageService } from "./services/StorageService.js";
const storage = new StorageService();
// Passar para buildTilesetTab(proj, Assets, t, h, touch, storage)
```

---

## Fase 2: Engine RMMV no Playtest

### 2.1 Copiar arquivos do RMMV

| Ação | Origem (NewData) | Destino |
|---|---|---|
| Criar diretório | — | `js/rpg/libs/` |
| Copiar | `NewData/js/libs/pixi.js` | `js/rpg/libs/pixi.js` |
| Copiar | `NewData/js/libs/pixi-tilemap.js` | `js/rpg/libs/pixi-tilemap.js` |
| Copiar | `NewData/js/libs/pixi-picture.js` | `js/rpg/libs/pixi-picture.js` |
| Copiar | `NewData/js/libs/fpsmeter.js` | `js/rpg/libs/fpsmeter.js` |
| Copiar | `NewData/js/libs/lz-string.js` | `js/rpg/libs/lz-string.js` |
| Copiar | `NewData/js/libs/iphone-inline-video.browser.js` | `js/rpg/libs/iphone-inline-video.browser.js` |
| Copiar | `NewData/js/rpg_core.js` | `js/rpg/rpg_core.js` |
| Copiar | `NewData/js/rpg_managers.js` | `js/rpg/rpg_managers.js` |
| Copiar | `NewData/js/rpg_objects.js` | `js/rpg/rpg_objects.js` |
| Copiar | `NewData/js/rpg_scenes.js` | `js/rpg/rpg_scenes.js` |
| Copiar | `NewData/js/rpg_sprites.js` | `js/rpg/rpg_sprites.js` |
| Copiar | `NewData/js/rpg_windows.js` | `js/rpg/rpg_windows.js` |

### 2.2 Bridge: `js/rpg/rpgatlas-bridge.js` (NOVO)

Este script substitui o `plugins.js` + `main.js` do RMMV vanilla. Ele:

1. Lê o projeto do editor de `window.RPGATLAS_PLAYTEST_DATA` (setado pelo editor antes de abrir o playtest)
2. Converte arrays 0-indexed do editor para arrays 1-indexed do RMMV
3. Injeta nos globais `$dataActors`, `$dataTilesets`, etc.
4. Chama `PluginManager.setup()` com os plugins do projeto
5. Inicia `SceneManager.run(Scene_Boot)`

```js
// js/rpg/rpgatlas-bridge.js
(function() {
  function getProjectData() {
    if (window.RPGATLAS_PLAYTEST_DATA) return window.RPGATLAS_PLAYTEST_DATA;
    try {
      var raw = localStorage.getItem("rpgatlas_playtest_data");
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
  }

  function to1Indexed(arr) {
    if (!Array.isArray(arr)) return [null];
    return [null].concat(arr);
  }

  var proj = getProjectData();
  if (!proj) {
    console.error("RPGAtlas Bridge: No project data found.");
    return;
  }

  window.$dataActors       = to1Indexed(proj.actors);
  window.$dataClasses      = to1Indexed(proj.classes);
  window.$dataSkills       = to1Indexed(proj.skills);
  window.$dataItems        = to1Indexed(proj.items);
  window.$dataWeapons      = to1Indexed(proj.weapons);
  window.$dataArmors       = to1Indexed(proj.armors);
  window.$dataEnemies      = to1Indexed(proj.enemies);
  window.$dataTroops       = to1Indexed(proj.troops);
  window.$dataStates       = to1Indexed(proj.states);
  window.$dataAnimations   = to1Indexed(proj.animations || []);
  window.$dataTilesets     = to1Indexed(proj.tilesets);
  window.$dataCommonEvents = to1Indexed(proj.commonEvents);
  window.$dataSystem       = proj.system || {};
  window.$dataMapInfos     = proj.mapInfos || {};

  // Notificar DataManager que os dados estão carregados
  for (var i = 0; i < DataManager._databaseFiles.length; i++) {
    var name = DataManager._databaseFiles[i].name;
    if (window[name]) DataManager.onLoad(window[name]);
  }

  // PluginManager com os plugins do projeto
  if (typeof PluginManager !== "undefined") {
    PluginManager.setup(proj.plugins || []);
  }

  // Iniciar jogo
  SceneManager.run(Scene_Boot);
})();
```

### 2.3 `play.html` atualizado

Substituir todo o conteúdo por:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="viewport" content="user-scalable=no">
  <link rel="icon" href="img/system/rpgatlas-logo.svg" type="image/svg+xml">
  <link rel="stylesheet" type="text/css" href="js/rpg/libs/gamefont.css">
  <title>RPGAtlas — Playtest</title>
  <style>
    body { margin: 0; background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script>
    // Suporte para projeto via parâmetro URL
    (function() {
      var params = new URLSearchParams(window.location.search);
      var projectPath = params.get("projectPath");
      if (projectPath) window.RPGATLAS_PROJECT_PATH = projectPath;
    })();
  </script>
  <!-- PixiJS v4 + plugins RMMV -->
  <script src="js/rpg/libs/pixi.js"></script>
  <script src="js/rpg/libs/pixi-tilemap.js"></script>
  <script src="js/rpg/libs/pixi-picture.js"></script>
  <script src="js/rpg/libs/fpsmeter.js"></script>
  <script src="js/rpg/libs/lz-string.js"></script>
  <!-- RMMV Core Engine -->
  <script src="js/rpg/rpg_core.js"></script>
  <script src="js/rpg/rpg_managers.js"></script>
  <script src="js/rpg/rpg_objects.js"></script>
  <script src="js/rpg/rpg_scenes.js"></script>
  <script src="js/rpg/rpg_sprites.js"></script>
  <script src="js/rpg/rpg_windows.js"></script>
  <!-- Bridge: injeta dados do editor e inicia o jogo -->
  <script src="js/rpg/rpgatlas-bridge.js"></script>
</body>
</html>
```

### 2.4 Atualizar botão Play no editor (`editor.js`)

```js
act("play", {
  label: "Playtest",
  icon: "play",
  tip: "Save and run the game",
  run() {
    saveNow();
    // Exportar dados do projeto para o playtest ler
    var playtestData = exportProjectForPlaytest();
    if (host.isTauri) {
      localStorage.setItem("rpgatlas_playtest_data", JSON.stringify(playtestData));
      host.openPlaytest().catch(function(e) {
        alert("Could not open play-test window: " + e.message);
      });
    } else {
      // Abrir nova aba com os dados
      var w = window.open("play.html", "rpgatlas_play");
      if (w) {
        w.RPGATLAS_PLAYTEST_DATA = playtestData;
      } else {
        // Fallback: salvar no localStorage (popup blocker)
        localStorage.setItem("rpgatlas_playtest_data", JSON.stringify(playtestData));
        window.open("play.html", "rpgatlas_play");
      }
    }
  },
});
```

> **Nota:** A função `exportProjectForPlaytest()` precisa converter o formato interno do projeto (0-indexed, estrutura plana) para o formato esperado pelo RMMV (arrays 1-indexed, nomes de arquivos RMMV).

---

## Fase 3: Refatoração do Editor de Tilesets

### 3.1 Layout — 5 Colunas

**Estado atual** (`js/editor/tileset-editor.js` + `css/editor.css`):

```
┌─────────┬──────────────┬──────────────────┬──────────────┐
│ dbside  │ dbform-head  │ dbform-center    │ dbform-side  │
│ (190px) │ (250px)      │ (flex: 1)        │ (120px)      │
│         │              │                  │              │
│ Lista   │ Name+Mode    │ Tabs A-E         │ Tools (2-col)│
│ de      │ File slots   │ Canvas viewer    │ Notes        │
│ tilesets│ A1..E        │ (8×32 tiles)     │              │
└─────────┴──────────────┴──────────────────┴──────────────┘
```

**Estado desejado:**

```
┌─────────┬──────────────┬──────────────────┬──────────────────┐
│ dbside  │ dbform-head  │ dbform-center    │ dbform-side      │
│ (190px) │ (250px)      │ (flex: 1)        │ (180px)          │
│         │              │                  │                  │
│ Lista   │ Name+Mode    │ Tabs A-E         │ Tools (vertical) │
│ de      │ File slots   │ Canvas viewer    │ [Passagem]       │
│ tilesets│ A1..E        │ (8×32 tiles)     │ [Passagem 4dir]  │
│         │              │                  │ [Escada]         │
│         │              │                  │ [Arbusto]        │
│         │              │                  │ [Balcão]         │
│         │              │                  │ [Dano]           │
│         │              │                  │ [Tag Terreno]    │
│         │              │                  │ ───────────      │
│         │              │                  │ Nota:            │
│         │              │                  │ [textarea]       │
└─────────┴──────────────┴──────────────────┴──────────────────┘
```

#### 3.1.1 CSS a alterar (`css/editor.css`)

```css
.dbform-side {
  flex: 0 0 180px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tse-tools-vert {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tse-tools-vert button {
  text-align: left;
  padding: 7px 10px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-left: 3px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.tse-tools-vert button .tool-icon {
  display: inline-block;
  width: 20px;
  text-align: center;
  font-size: 14px;
  flex: 0 0 auto;
}

.tse-tools-vert button .tool-label {
  flex: 1;
  white-space: nowrap;
}

.tse-tools-vert button.sel {
  background: var(--accent);
  border-color: var(--gold);
  color: #fff;
}

.tse-tools-vert button:hover {
  background: #2a2d40;
}

.tse-tools-vert button.sel:hover {
  background: var(--accent);
}

/* Note area */
.note-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.note-area label {
  font-size: 11px;
  color: #aeb2c8;
  margin-bottom: 4px;
}

.note-area textarea {
  width: 100%;
  min-height: 120px;
  flex: 1;
  font-size: 12px;
  font-family: Consolas, monospace;
  resize: vertical;
  background: #1c1e2a;
  color: #e8eaf2;
  border: 1px solid #3a3d52;
  border-radius: 4px;
  padding: 6px 8px;
}
```

#### 3.1.2 Código do layout (`tileset-editor.js` — função `rebuildForm()`)

Substituir a seção "Right Panel: Tools & Notes" (linhas 484-507) por:

```js
// Right Panel: Tools & Notes (5th column)
const sidePanel = h("div", { class: "dbform-side" });

// Tools — vertical stack with labels
const tools = h("div", { class: "tse-tools-vert" });
TOOLS.forEach(([id, labelKey, icon]) => {
  tools.appendChild(h("button", {
    class: curTool === id ? "sel" : "",
    title: t(labelKey),
    onclick() {
      curTool = id;
      redrawViewer();
      // Atualizar classe sel sem rebuild completo
      tools.querySelectorAll("button").forEach(b => b.classList.remove("sel"));
      this.classList.add("sel");
    }
  },
    h("span", { class: "tool-icon" }, icon),
    h("span", { class: "tool-label" }, t(labelKey))
  ));
});
sidePanel.appendChild(tools);

// Note section
const notes = h("div", { class: "note-area" },
  h("label", null, t("tileset.note")),
  h("textarea", {
    oninput(e) { ts.note = e.target.value; touch(); }
  }, ts.note || "")
);
sidePanel.appendChild(notes);
form.appendChild(sidePanel);
```

### 3.2 Constantes TOOLS atualizadas

```js
const TOOLS = [
  ["passage",     "tileset.tool_passage",      "○"],
  ["passage4dir", "tileset.tool_passage4dir",  "⇅"],
  ["ladder",      "tileset.tool_ladder",       "⬆"],
  ["bush",        "tileset.tool_bush",         "🌿"],
  ["counter",     "tileset.tool_counter",      "▤"],
  ["damage",      "tileset.tool_damage",       "⚡"],
  ["terrain",     "tileset.tool_terrain",      "#"],
];
```

### 3.3 Overlays do Canvas

#### 3.3.1 Passage (○ → × → ★)

**Lógica de `calculateNextFlagState`** — modificar para aceitar `category`:

```js
function calculateNextFlagState(current, category) {
  const canStar = !["A1","A2","A3","A4","A5"].includes(category);
  switch (curTool) {
    case "passage": {
      const isBlocked = (current & 0x0F00) === 0x0F00;
      const isStar = !!(current & 0x0010);
      if (isBlocked && canStar)
        return (current & ~0x0F1F) | 0x0010; // → Star
      if (isBlocked)
        return (current & ~0x0F1F) | 0x0000; // → Open (no star for A)
      if (isStar)
        return (current & ~0x0F1F) | 0x0000; // → Open
      return (current & ~0x0F1F) | 0x0F00;   // → Blocked
    }
    case "passage4dir":
      return current ^ 0x0F00; // será refinado na Fase 3.4
    case "ladder":   return current ^ 0x1000;
    case "bush":     return current ^ 0x2000;
    case "counter":  return current ^ 0x4000;
    case "damage":   return current ^ 0x8000;
    case "terrain": {
      let tag = current & 0x000F;
      tag = (tag + 1) % 8;
      return (current & ~0x000F) | tag;
    }
  }
  return current;
}
```

#### 3.3.2 Renderização em `drawFlags()`

| Ferramenta | Símbolo | Cor | Posição |
|---|---|---|---|
| Passage (○) | Círculo | `#44ff44` | Centro |
| Passage (×) | X | `#ff4444` | Centro |
| Passage (★) | ★ | `#ffd86a` | Centro |
| Passage 4 dir | ↓ → ← ↑ | `#ffffff` / `#666` | Bordas |
| Ladder | ESC | `#5fc8e8` | Centro-esquerda |
| Bush | ARB | `#6ab84a` | Centro-esquerda |
| Counter | BAL | `#f0a030` | Centro-esquerda |
| Damage | DNO | `#f06060` | Centro-esquerda |
| Terrain | 0-7 | `#ffd86a` | Centro |

Código de renderização (substituir o `drawFlags` atual):

```js
function drawFlags(g, ts, category, count) {
  const offset = getFlagOffset(category);
  const flags = ts.flags || [];
  g.textAlign = "center";
  g.textBaseline = "middle";

  for (let i = 0; i < count; i++) {
    const phys = getPhysicalCoordinates(i, category);
    const flagIdx = offset + (phys.row * (category === "A5" ? 8 : 16) + phys.col);
    const flag = flags[flagIdx] || 0;
    const x = (i % 8) * TILE;
    const y = Math.floor(i / 8) * TILE;
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;

    if (curTool === "passage") {
      const isStar = !!(flag & 0x0010);
      const isBlocked = (flag & 0x0F00) === 0x0F00;
      if (isStar) {
        g.fillStyle = "#ffd86a";
        g.font = "bold 20px sans-serif";
        g.fillText("★", cx, cy);
      } else if (isBlocked) {
        g.strokeStyle = "#ff4444";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x + 14, y + 14); g.lineTo(x + 34, y + 34);
        g.moveTo(x + 34, y + 14); g.lineTo(x + 14, y + 34);
        g.stroke();
      } else {
        g.strokeStyle = "#44ff44";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(cx, cy, 10, 0, Math.PI * 2);
        g.stroke();
      }
    } else if (curTool === "passage4dir") {
      const blockedDown  = !!(flag & 0x0100);
      const blockedLeft  = !!(flag & 0x0200);
      const blockedRight = !!(flag & 0x0400);
      const blockedUp    = !!(flag & 0x0800);
      if (blockedDown)  { g.fillStyle = "#666"; } else { g.fillStyle = "#4f4"; }
      g.font = "bold 14px sans-serif";
      g.fillText(blockedDown  ? "—" : "↓", cx, y + 40);
      g.fillText(blockedLeft  ? "—" : "←", x + 10, cy);
      g.fillText(blockedRight ? "—" : "→", x + 38, cy);
      g.fillText(blockedUp    ? "—" : "↑", cx, y + 10);
    } else if (curTool === "ladder" && (flag & 0x1000)) {
      g.fillStyle = "#5fc8e8";
      g.font = "bold 12px sans-serif";
      g.fillText("ESC", cx, cy);
    } else if (curTool === "bush" && (flag & 0x2000)) {
      g.fillStyle = "#6ab84a";
      g.font = "bold 12px sans-serif";
      g.fillText("ARB", cx, cy);
    } else if (curTool === "counter" && (flag & 0x4000)) {
      g.fillStyle = "#f0a030";
      g.font = "bold 12px sans-serif";
      g.fillText("BAL", cx, cy);
    } else if (curTool === "damage" && (flag & 0x8000)) {
      g.fillStyle = "#f06060";
      g.font = "bold 11px sans-serif";
      g.fillText("DNO", cx, cy);
    } else if (curTool === "terrain") {
      const tag = flag & 0x000F;
      g.fillStyle = "#ffd86a";
      g.font = "bold 16px sans-serif";
      g.fillText(String(tag > 7 ? 7 : tag), cx, cy);
    }
  }
}
```

### 3.4 Clique Direcional (Passagem 4 dir.)

Modificar `onCanvasDown()` para detectar em qual zona do tile o clique ocorreu:

```js
function onCanvasDown(e) {
  if (e.button !== 0) return;
  const rect = viewerCanvas.getBoundingClientRect();
  const lx = (e.clientX - rect.left) / viewerZoom;
  const ly = (e.clientY - rect.top) / viewerZoom;
  const col = Math.floor(lx / TILE);
  const row = Math.floor(ly / TILE);
  if (col < 0 || col >= 8 || row < 0 || row >= 32) return;

  const index = row * 8 + col;
  const ts = getTilesetData();
  const category = resolveCategoryForTab(curTab);
  const phys = getPhysicalCoordinates(index, category);
  const flagIdx = getFlagOffset(category) + (phys.row * (category === "A5" ? 8 : 16) + phys.col);
  const current = ts.flags[flagIdx] || 0;

  isPainting = true;

  if (curTool === "passage4dir") {
    // Detectar zona de clique dentro do tile
    const tileX = lx - col * TILE;
    const tileY = ly - row * TILE;
    const margin = 12;
    let newFlag = current;

    if (tileY >= TILE - margin) newFlag ^= 0x0100; // ↓  baixo
    if (tileX < margin)         newFlag ^= 0x0200; // ←  esquerda
    if (tileX >= TILE - margin) newFlag ^= 0x0400; // →  direita
    if (tileY < margin)         newFlag ^= 0x0800; // ↑  cima

    dragFlagState = newFlag;
  } else {
    dragFlagState = calculateNextFlagState(current, category);
  }

  applyFlag(ts, flagIdx, dragFlagState);
  redrawViewer();
}
```

### 3.5 Ajustes no `onCanvasMove` (drag painting)

Para tools que não sejam `passage4dir`, manter o comportamento de drag painting pintando o mesmo estado em tiles adjacentes:

```js
function onCanvasMove(e) {
  if (!isPainting || curTool === "passage4dir") return;
  // ... mesmo código atual, sem mudanças
}
```

---

## Fase 4: i18n e Locales

### 4.1 Chaves a adicionar em TODOS os 5 locales

| Chave | en.json (source) | pt.json | es.json | fr.json | de.json |
|---|---|---|---|---|---|
| `tileset.note` | Note | Nota | Nota | Note | Notiz |
| `tileset.tool_passage4dir` | Passage (4 dir.) | Passagem (4 Direções) | Pasaje (4 dir.) | Passage (4 dir.) | Passage (4 Richt.) |
| `tileset.mode_world` | World Map | Mapa Mundi | Mapa del Mundo | Carte du Monde | Weltkarte |

### 4.2 `tileset.tool_passage4dir` — juntar com as demais tools

A chave `tileset.tool_passage4dir` já existe em `pt.json:573` mas está faltando em `en.json`, `es.json`, `fr.json`, `de.json`. Adicionar em todas.

---

## Fase 5: Patch Notes

Adicionar ao topo de `PATCH_NOTES` em `js/patch-notes.js`:

```js
{
  date: "June 17, 2026",
  title: "Tileset Editor + Engine RMMV + StorageService",
  summary: "Editor de tilesets refatorado com layout RMMV, playtest agora usa o engine RMMV v1.6.2, e nova camada de abstração de I/O.",
  items: [
    "Nova coluna de ferramentas à direita com 7 botões: Passagem, Passagem (4 dir.), Escada, Arbusto, Balcão, Dano no Terreno, Tag de Terreno",
    "Campo de notas (textarea) para cada tileset",
    "Overlays dinâmicos no visualizador conforme ferramenta selecionada (○, ×, ★, ESC, ARB, BAL, DNO)",
    "Clique direcional na ferramenta Passagem (4 dir.) para alternar direções individuais",
    "Restrição de estrela (★) para abas B-E apenas",
    "Playtest agora usa o engine RPG Maker MV v1.6.2 (rpg_core.js, rpg_managers.js, etc.)",
    "StorageService: nova abstração de I/O que funciona em Tauri (fs nativo) e Web (fetch/download)",
    "Compatibilidade total com o formato de flags RMMV (bits 8-11 direções, 12-14 ladder/bush/counter)"
  ],
}
```

---

## Fase 6: Ajustes no Tauri

### 6.1 Comandos Rust novos

Adicionar ao `src-tauri/src/lib.rs`:

| Comando | Args | Retorno | Descrição |
|---|---|---|---|
| `list_directory` | `path: String` | `Vec<String>` | Lista nomes de arquivos em um diretório |
| `read_text_file` | `path: String` | `String` | Lê arquivo de texto |
| `write_text_file` | `path, contents: String` | `()` | Escreve arquivo de texto |
| `read_file_base64` | `path: String` | `String` | Lê arquivo binário como base64 |

### 6.2 Cargo.toml

Adicionar dependência:
```toml
base64 = "0.22"
```

### 6.3 Capacidades

Adicionar permissões de fs em `src-tauri/capabilities/default.json`:
```json
{
  "windows": ["main", "playtest"],
  "permissions": [
    "core:default",
    "dialog:default"
  ]
}
```

> **Nota:** As permissões de fs são implícitas via comandos Rust personalizados (`list_directory`, `read_text_file`, `write_text_file`, `read_file_base64`). Não precisamos de `@tauri-apps/plugin-fs`.

---

## Dependências entre Fases

```
Fase 1 (StorageService)
  └── não bloqueia ninguém

Fase 2 (Engine RMMV)
  └── requer Fase 1? Não, é independente
  └── requer Fase 4? Sim, se quisermos i18n no bridge

Fase 3 (Tileset Editor)
  └── pode usar StorageService na Fase 3.1 (file picker)
  └── Fase 3.5 requer compatibilidade com flags RMMV (já implementada)

Fase 4 (i18n)
  └── independente

Fase 5 (Patch Notes)
  └── requer Fases 2 e 3 completas

Fase 6 (Tauri)
  └── requer Fase 1 (StorageService)
```

---

## Ordem de Implementação Sugerida

```
1. Fase 4 (i18n)         ~5 min  — Adicionar chaves nos JSONs
2. Fase 1 (StorageService) ~30 min — Criar classe + comandos Rust
3. Fase 6 (Tauri cmds)   ~15 min — 4 comandos Rust + Cargo.toml
4. Fase 3 (Tileset Editor) ~2h   — CSS + JS (layout, overlays, clique)
5. Fase 2 (Engine RMMV)  ~1h    — Copiar arquivos, criar bridge, atualizar play.html
6. Fase 5 (Patch Notes)  ~5 min  — Adicionar entrada
--------------------------------------------
Total estimado: ~4h de trabalho
```

---

## Perguntas em Aberto (para discussão antes da execução)

1. **Engine RMMV**: A bridge simples (injetar `$data*` globais, sem XHR) é suficiente, ou você quer que o DataManager carregue via XHR de `data/` real (exigindo salvar o projeto como pasta)?

2. **StorageService**: Devo implementar os 4 comandos Rust agora, ou apenas a interface JS com fallback web por enquanto?

3. **Arquivos custom antigos** (`engine.js`, `renderer.js`, etc.): Remover ou manter como fallback para projetos legados?

4. **Ordem de implementação**: Prefere fase por fase linear, ou posso paralelizar fases independentes?

---

## Registro de Implementação

### Tudo o que foi feito (sessão 1)

#### 🔧 Correção do sistema de flags RMMV

O bit layout dos flags foi redefinido para corresponder **exatamente** ao engine RMMV (`rpg_objects.js`):

| Flag | Bit (antigo) | Bit (corrigido) |
|---|---|---|
| Direções | 0x0F00 (bits 8-11) | 0x000F (bits 0-3) |
| Star | 0x0010 (bit 4) | 0x0010 (bit 4) — *igual* |
| Ladder | 0x1000 (bit 12) | 0x0020 (bit 5) |
| Bush | 0x2000 (bit 13) | 0x0040 (bit 6) |
| Counter | 0x4000 (bit 14) | 0x0080 (bit 7) |
| Damage | 0x8000 (bit 15) | 0x0100 (bit 8) |
| Terrain tag | 0x000F (bits 0-3) | 0xF000 (bits 12-15, >> 12) |

**Arquivos alterados:**
- `js/rmmv-flags.js` — constantes redefinidas
- `js/rmmv-tileid.js` — TILE_ID_BASES alinhado com engine (A1=2048, A2=2816, A3=4352, A4=5888, A5=1536, B=0, C=256, D=512, E=768)
- `js/editor/tileset-editor.js` — RMMV_FLAG_OFFSETS corrigidos, drawFlags/calculateNextFlagState/onCanvasDown corrigidos, expandido de 5 para 9 abas
- `js/assets.js` — getRmmvTileFlags/setRmmvTileFlags indexam por tileId diretamente
- `js/editor.js` — rmmvToLegacyFlag/legacyMaskToRmmv convertem com novo bit layout
- `js/engine.js` — passage checks corrigidos (0x000F para direções)
- `js/physics.js` — rmmvTileIsBlocked corrigido

#### 🔧 Correção de 3 erros ativos

1. **404 TileA2.png** — `loadRmmvSheet` usa filename direto quando Data_Tilesets não existe (editor mode)
2. **`Cannot read properties of undefined (reading '2817')`** — guard `(ts.flags || [])[flagIdx]` adicionado
3. **`modal is not defined`** — `modal` passado como parâmetro para `buildTilesetTab()`

#### 🏗️ Layout reestruturado (top → middle → bottom)

O layout mudou de 4 colunas horizontais para 3 fileiras verticais, igual ao RMMV:

```
┌───────────────────────────────────────────────────────────────┐
│  TOP: Name + Mode + Image Slots (grid 3 colunas)              │
├──────────────────────┬──────────────────────┬─────────────────┤
│  MIDDLE              │  MIDDLE              │  MIDDLE          │
│  Tabs A1..E          │  Canvas viewer        │  Tools (vertical)│
│                      │  (8×32 tiles)        │  ○ Passagem      │
│                      │                       │  ⇅ Passagem 4dir│
│                      │                       │  ⬆ Escada       │
│                      │                       │  🌿 Arbusto     │
│                      │                       │  ▤ Balcão       │
│                      │                       │  ⚡ Dano        │
│                      │                       │  # Tag Terreno  │
├──────────────────────┴──────────────────────┴─────────────────┤
│  BOTTOM: Note (textarea, largura total)                        │
└───────────────────────────────────────────────────────────────┘
```

**Arquivos:** `css/editor.css` (seção `.rmmv-style` → `.rmmv-top`/`.rmmv-middle`/`.rmmv-bottom`), `js/editor/tileset-editor.js` (`rebuildForm()`)

#### 📦 StorageService

Arquivo `js/services/StorageService.js` criado com 4 métodos:
- `listFiles(dir)` — Tauri: `invoke("list_directory")` | Web: fetch HTML parser
- `readJson(path)` — Tauri: `invoke("read_text_file")` | Web: fetch → res.json()
- `saveJson(path, data)` — Tauri: `invoke("write_text_file")` | Web: downloadBlob()
- `loadImage(path)` — Tauri: `invoke("read_file_base64")` | Web: URL relativa

#### 🎮 Engine RMMV no Playtest

- Engine RMMV v1.6.2 copiado para `js/rpg/` (rpg_core.js, rpg_managers.js, rpg_objects.js, rpg_scenes.js, rpg_sprites.js, rpg_windows.js + libs/)
- Bridge `js/rpg/rpgatlas-bridge.js` criado — injeta $data* (1-indexed) e chama SceneManager.run(Scene_Boot)
- `play.html` refatorado — carrega engine RMMV local + bridge
- `exportProjectForPlaytest()` criada em `editor.js:492` — exporta projeto no formato da bridge
- Botão Play atualizado para passar dados via `window.RPGATLAS_PLAYTEST_DATA` (ou localStorage como fallback)

#### 🔘 Sidebar com botões New/Delete

Adicionado `dbbtns` na sidebar do editor de tilesets:
- **"+ New"** — cria novo tileset com `{ id, name: "New Tileset", mode: 0, note: "", tilesetNames: ["",...x9], flags: new Uint16Array(8192) }`
- **"Delete"** — confirma com modal, remove setando `proj.tilesets[id] = null` (preserva IDs estáveis)

**Arquivos:** `js/editor/tileset-editor.js` (linhas 90-97, 171-212), `locales/*.json` (chave `btn.new`)

#### 🌐 i18n

Chaves adicionadas em todos os 5 locales (en, pt, es, fr, de):
- `tileset.note` — Note / Nota / Nota / Note / Notiz
- `tileset.tool_passage4dir` — Passage (4 dir.) / Passagem (4 Direções) / Pasaje (4 dir.) / Passage (4 dir.) / Passage (4 Richt.)
- `tileset.mode_world` — World Map / Mapa Mundi / Mapa del Mundo / Carte du Monde / Weltkarte
- `btn.new` — New / Novo / Nuevo / Nouveau / New

#### 🐛 Bug fix

`PATCH_NOTES.forEach` → `getPatchNotes(t).forEach` em `editor.js:9717` — a variável `PATCH_NOTES` não existia (era `getPatchNotes(t)` importada de `js/patch-notes.js`).

#### 🦀 Comandos Rust Tauri

4 comandos adicionados em `src-tauri/src/lib.rs`:
- `list_directory(path)` → `Vec<String>`
- `read_text_file(path)` → `String`
- `write_text_file(path, contents)` → `()`
- `read_file_base64(path)` → `String`

Dependência `base64 = "0.22"` adicionada ao `Cargo.toml`.

---

*Documento atualizado em 17 de Junho de 2026 — RPGAtlas*
