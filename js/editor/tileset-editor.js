/* RPGAtlas — tileset-editor.js
   Database ▸ Tilesets tab: viewer, flag editor, file slots.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */

const TILE = 48;
const CATEGORIES = ["A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"];
const CATEGORY_LABELS = {
  A1: "tileset.tab_a1",
  A2: "tileset.tab_a2",
  A3: "tileset.tab_a3",
  A4: "tileset.tab_a4",
  A5: "tileset.tab_a5",
  B: "tileset.tab_b",
  C: "tileset.tab_c",
  D: "tileset.tab_d",
  E: "tileset.tab_e",
};

const RMMV_PREFIX = "rmmv:";
const CATEGORY_SLOT_MAP = {
  A1: 0,
  A2: 1,
  A3: 2,
  A4: 3,
  A5: 4,
  B: 5,
  C: 6,
  D: 7,
  E: 8,
};
const RMMV_FLAG_OFFSETS = {
  A1: 2048, A2: 2816, A3: 4352, A4: 5888, A5: 1536,
  B: 0, C: 256, D: 512, E: 768,
};

function rmmvTilesetKey(tsi) {
  return RMMV_PREFIX + tsi;
}
function isRmmvTilesetKey(k) {
  return typeof k === "string" && k.indexOf(RMMV_PREFIX) === 0;
}
function parseRmmvKey(k) {
  return parseInt(k.slice(RMMV_PREFIX.length), 10);
}

const TOOLS = [
  ["passage",     "tileset.tool_passage",     "○"],
  ["passage4dir", "tileset.tool_passage4dir", "⇅"],
  ["ladder",      "tileset.tool_ladder",       "⬆"],
  ["bush",        "tileset.tool_bush",         "🌿"],
  ["counter",     "tileset.tool_counter",      "▤"],
  ["damage",      "tileset.tool_damage",       "⚡"],
  ["terrain",     "tileset.tool_terrain",      "#"],
];

/**
 * Mapeia o índice do visualizador (8 colunas) para a coordenada física no arquivo (16 colunas).
 */
function getPhysicalCoordinates(index, category) {
  if (category === "A5") {
    // A5 é nativamente 8 colunas, sem mapeamento complexo
    return { x: (index % 8) * TILE, y: Math.floor(index / 8) * TILE, col: index % 8, row: Math.floor(index / 8) };
  }
  // Para A1-A4 e B-E (que têm 16 colunas físicas no arquivo)
  const displayCol = index % 8;
  const displayRow = Math.floor(index / 8);
  const physicalRow = Math.floor(displayRow / 2);
  const physicalCol = displayCol + (displayRow % 2 === 1 ? 8 : 0);
  return {
    x: physicalCol * TILE,
    y: physicalRow * TILE,
    col: physicalCol,
    row: physicalRow,
  };
}

export function buildTilesetTab(proj, Assets, t, h, touch, modal) {
  let curTilesetKey = null;
  let curTool = "passage";
  let viewerZoom = 1.0;
  let showOverlay = true;
  let curTab = "A2"; // Aba de exibição (A, B, C, D, E)
  let isPainting = false;
  let dragFlagState = -1;

  const container = h("div", { class: "dbtab" });

  // --- sidebar: tileset list ---
  const side = h("div", { class: "dbside" });
  const listBtns = h("div", { class: "dbbtns" },
    h("button", {
      onclick() { createNewTileset(); }
    }, "+ " + t("btn.new")),
    h("button", {
      onclick() { deleteTileset(); }
    }, t("btn.delete")),
  );
  const listEl = h("ul", { class: "dblist" });
  side.appendChild(listBtns);
  side.appendChild(listEl);
  container.appendChild(side);

  // --- main form area ---
  const form = h("div", { class: "dbform rmmv-style" });
  container.appendChild(form);

  // --- state ---
  let viewerWrap, viewerCanvas, viewerCtx;

  function isRmmvProject() {
    return Array.isArray(proj.tilesets);
  }

  function tsKeys() {
    var legacy = Object.keys(Assets.tilesets || {}).sort();
    var rmmv = [];
    if (isRmmvProject()) {
      for (var i = 1; i < proj.tilesets.length; i++) {
        if (proj.tilesets[i]) rmmv.push(rmmvTilesetKey(i));
      }
    }
    return legacy.concat(rmmv);
  }

  function getTilesetData() {
    if (!curTilesetKey) return null;
    if (isRmmvTilesetKey(curTilesetKey)) {
      return proj.tilesets[parseRmmvKey(curTilesetKey)];
    }
    return Assets.tilesets[curTilesetKey];
  }

  function rebuildList() {
    listEl.innerHTML = "";
    const keys = tsKeys();
    if (!keys.length) {
      listEl.appendChild(h("li", { class: "dim" }, "(no tilesets loaded)"));
      return;
    }
    for (const k of keys) {
      let name = "";
      let prefix = "";
      if (isRmmvTilesetKey(k)) {
        const id = parseRmmvKey(k);
        prefix = id.toString().padStart(4, "0");
        name = proj.tilesets[id] ? proj.tilesets[id].name : "Tileset " + id;
      } else {
        name = k;
      }
      const li = h(
        "li",
        {
          class: k === curTilesetKey ? "sel" : "",
          onclick() {
            selectTileset(k);
          },
        },
        h("span", { class: "db-entry-id" }, prefix),
        h("span", null, name),
      );
      listEl.appendChild(li);
    }
  }

  function selectTileset(k) {
    curTilesetKey = k;
    rebuildList();
    rebuildForm();
  }

  function createNewTileset() {
    if (!isRmmvProject()) {
      alert("Can only create tilesets in RMMV project format.");
      return;
    }
    const id = proj.tilesets.length;
    const ts = {
      id: id,
      name: "New Tileset",
      mode: 0,
      note: "",
      tilesetNames: ["", "", "", "", "", "", "", "", ""],
      flags: new Uint16Array(8192),
    };
    proj.tilesets.push(ts);
    touch();
    selectTileset(rmmvTilesetKey(id));
  }

  function deleteTileset() {
    if (!curTilesetKey || !isRmmvTilesetKey(curTilesetKey)) return;
    const ts = getTilesetData();
    if (!ts) return;
    modal({
      title: "dialog.confirm",
      content: h("div", null, t("status.confirm_delete_entry", { name: ts.name || "this tileset" })),
      buttons: [
        { label: "btn.ok", primary: true, onClick(c) { c(); doDelete(); } },
        { label: "btn.cancel" },
      ],
    });
    function doDelete() {
      const id = parseRmmvKey(curTilesetKey);
      proj.tilesets[id] = null;
      // update tileset that use this index to point to the next valid one
      const keys = tsKeys();
      curTilesetKey = keys.length > 0 ? keys[0] : null;
      touch();
      rebuildList();
      rebuildForm();
    }
  }

  // --- rendering logic ---

  function redrawViewer() {
    if (!viewerCanvas || !viewerCtx) return;
    const g = viewerCtx;
    const ts = getTilesetData();
    if (!ts) return;

    // Configurar o tamanho do canvas baseado no zoom
    // O visualizador RMMV sempre mostra 8 colunas de tiles
    const cols = 8;
    const rows = 32; // Mostramos 32 linhas por padrão
    viewerCanvas.width = cols * TILE * viewerZoom;
    viewerCanvas.height = rows * TILE * viewerZoom;
    g.setTransform(viewerZoom, 0, 0, viewerZoom, 0, 0);

    g.fillStyle = "#1c1c1c";
    g.fillRect(0, 0, cols * TILE, rows * TILE);

    // Determinar qual arquivo de imagem carregar baseado na aba ativa
    const category = resolveCategoryForTab(curTab);
    const slotIdx = CATEGORY_SLOT_MAP[category];
    const filename = ts.tilesetNames ? ts.tilesetNames[slotIdx] : (ts.file || "");

    if (filename) {
      const img = Assets.getRmmvSheet ? Assets.getRmmvSheet(category, filename) : null;
      if (img && img.complete) {
        g.imageSmoothingEnabled = false;
        // Desenhar os tiles mapeados
        for (let i = 0; i < cols * rows; i++) {
          const phys = getPhysicalCoordinates(i, category);
          const rect = { x: (i % 8) * TILE, y: Math.floor(i / 8) * TILE };
          // Verifica se as coordenadas físicas estão dentro da imagem
          if (phys.x < img.width && phys.y < img.height) {
            g.drawImage(img, phys.x, phys.y, TILE, TILE, rect.x, rect.y, TILE, TILE);
          }
        }
      } else {
        console.log("TilesetEditor: Carregando via Assets.loadRmmvSheet:", category, filename);
        if (Assets.loadRmmvSheet) Assets.loadRmmvSheet(category, filename).then(redrawViewer);
      }
    }

    // Grid
    g.strokeStyle = "rgba(255,255,255,0.1)";
    g.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      g.beginPath(); g.moveTo(c * TILE, 0); g.lineTo(c * TILE, rows * TILE); g.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      g.beginPath(); g.moveTo(0, r * TILE); g.lineTo(cols * TILE, r * TILE); g.stroke();
    }

    // Overlays (Flags)
    if (showOverlay) {
      drawFlags(g, ts, category, cols * rows);
    }
  }

  function resolveCategoryForTab(tab) {
    // With 9 tabs (A1..A5,B..E), the tab IS the category
    return tab;
  }

  function getFlagOffset(category) {
    return RMMV_FLAG_OFFSETS[category] || 0;
  }

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
        const isBlocked = (flag & 0x000F) === 0x000F;
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
        const blockedDown  = !!(flag & 0x0001);
        const blockedLeft  = !!(flag & 0x0002);
        const blockedRight = !!(flag & 0x0004);
        const blockedUp    = !!(flag & 0x0008);
        g.font = "bold 14px sans-serif";
        g.fillStyle = blockedDown  ? "#666" : "#4f4";
        g.fillText(blockedDown  ? "—" : "↓", cx, y + 40);
        g.fillStyle = blockedLeft  ? "#666" : "#4f4";
        g.fillText(blockedLeft  ? "—" : "←", x + 10, cy);
        g.fillStyle = blockedRight ? "#666" : "#4f4";
        g.fillText(blockedRight ? "—" : "→", x + 38, cy);
        g.fillStyle = blockedUp    ? "#666" : "#4f4";
        g.fillText(blockedUp    ? "—" : "↑", cx, y + 10);
      } else if (curTool === "ladder" && (flag & 0x0020)) {
        g.fillStyle = "#5fc8e8";
        g.font = "bold 12px sans-serif";
        g.fillText("ESC", cx, cy);
      } else if (curTool === "bush" && (flag & 0x0040)) {
        g.fillStyle = "#6ab84a";
        g.font = "bold 12px sans-serif";
        g.fillText("ARB", cx, cy);
      } else if (curTool === "counter" && (flag & 0x0080)) {
        g.fillStyle = "#f0a030";
        g.font = "bold 12px sans-serif";
        g.fillText("BAL", cx, cy);
      } else if (curTool === "damage" && (flag & 0x0100)) {
        g.fillStyle = "#f06060";
        g.font = "bold 11px sans-serif";
        g.fillText("DNO", cx, cy);
      } else if (curTool === "terrain") {
        const tag = (flag >> 12) & 0x0F;
        const displayTag = tag > 7 ? 7 : tag;
        g.fillStyle = "#ffd86a";
        g.font = "bold 16px sans-serif";
        g.fillText(String(displayTag), cx, cy);
      }
    }
  }

  // --- interaction ---

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
    const current = (ts.flags || [])[flagIdx] || 0;

    isPainting = true;

    if (curTool === "passage4dir") {
      const tileX = lx - col * TILE;
      const tileY = ly - row * TILE;
      const margin = 12;
      let newFlag = current;
      if (tileY >= TILE - margin) newFlag ^= 0x0001; // down
      if (tileX < margin)         newFlag ^= 0x0002; // left
      if (tileX >= TILE - margin) newFlag ^= 0x0004; // right
      if (tileY < margin)         newFlag ^= 0x0008; // up
      dragFlagState = newFlag;
    } else {
      dragFlagState = calculateNextFlagState(current, category);
    }

    applyFlag(ts, flagIdx, dragFlagState);
    redrawViewer();
  }

  function onCanvasMove(e) {
    if (!isPainting) return;
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

    if ((ts.flags || [])[flagIdx] !== dragFlagState) {
      applyFlag(ts, flagIdx, dragFlagState);
      redrawViewer();
    }
  }

  function onCanvasUp() {
    isPainting = false;
  }

  function calculateNextFlagState(current, category) {
    const canStar = category ? !["A1","A2","A3","A4","A5"].includes(category) : true;
    switch (curTool) {
      case "passage": {
        const isBlocked = (current & 0x000F) === 0x000F;
        const isStar = !!(current & 0x0010);
        if (isBlocked && canStar)
          return (current & ~0x001F) | 0x0010;
        if (isBlocked)
          return (current & ~0x001F) | 0x0000;
        if (isStar)
          return (current & ~0x001F) | 0x0000;
        return (current & ~0x001F) | 0x000F;
      }
      case "passage4dir":
        return current ^ 0x000F;
      case "ladder": return current ^ 0x0020;
      case "bush":   return current ^ 0x0040;
      case "counter": return current ^ 0x0080;
      case "damage":  return current ^ 0x0100;
      case "terrain": {
        let tag = (current >> 12) & 0x0F;
        tag = (tag + 1) % 8;
        return (current & 0x0FFF) | (tag << 12);
      }
    }
    return current;
  }

  function applyFlag(ts, idx, state) {
    if (!ts.flags) ts.flags = new Uint16Array(8192);
    ts.flags[idx] = state;
    touch();
  }

  // --- UI building ---

  function rebuildForm() {
    form.innerHTML = "";
    const ts = getTilesetData();
    if (!ts) {
      form.appendChild(h("div", { class: "dim" }, t("tileset.no_selection")));
      return;
    }

    // ── TOP: name + mode + image slots ──
    const top = h("div", { class: "rmmv-top" });

    const nameFld = h("div", { class: "frow" },
      h("label", null, t("tileset.name"), h("br"),
        h("input", {
          type: "text",
          value: ts.name || "",
          oninput(e) { ts.name = e.target.value; touch(); rebuildList(); }
        })
      ),
      h("label", null, t("tileset.mode"), h("br"),
        h("select", {
          onchange(e) { ts.mode = Number(e.target.value); touch(); },
        },
          h("option", { value: 0, selected: ts.mode === 0 ? "selected" : null }, t("tileset.mode_world")),
          h("option", { value: 1, selected: ts.mode === 1 ? "selected" : null }, t("tileset.mode_area")),
        )
      )
    );
    top.appendChild(nameFld);

    // Slots A1..E
    const slots = h("div", { class: "tileset-slots" });
    CATEGORIES.forEach((cat, i) => {
      const val = ts.tilesetNames ? ts.tilesetNames[i] : (ts.category === cat ? ts.file : "");
      const row = h("div", { class: "slot-row" },
        h("span", { class: "slot-label" }, cat + ":"),
        h("input", {
          type: "text",
          value: val || "",
          onchange(e) {
            if (!ts.tilesetNames) ts.tilesetNames = new Array(9).fill("");
            ts.tilesetNames[i] = e.target.value;
            touch();
            redrawViewer();
          }
        }),
        h("button", {
          class: "mini",
          onclick: () => openFilePicker(i)
        }, "...")
      );
      slots.appendChild(row);
    });
    top.appendChild(slots);
    form.appendChild(top);

    // ── MIDDLE: tabs + canvas + tools ──
    const middle = h("div", { class: "rmmv-middle" });

    // Center: tabs + canvas
    const center = h("div", { class: "dbform-center" });
    const tabs = h("div", { class: "dbform-tabs" });
    CATEGORIES.forEach(cat => {
      tabs.appendChild(h("button", {
        class: curTab === cat ? "sel" : "",
        onclick() { curTab = cat; redrawViewer(); rebuildForm(); }
      }, cat));
    });
    center.appendChild(tabs);

    viewerWrap = h("div", { class: "tse-viewer-wrap rmmv-viewer" });
    viewerCanvas = h("canvas", { class: "tse-canvas" });
    viewerCtx = viewerCanvas.getContext("2d");
    viewerCanvas.addEventListener("mousedown", onCanvasDown);
    viewerCanvas.addEventListener("mousemove", onCanvasMove);
    window.addEventListener("mouseup", onCanvasUp);
    viewerWrap.appendChild(viewerCanvas);
    center.appendChild(viewerWrap);
    middle.appendChild(center);

    // Side panel: tools
    const sidePanel = h("div", { class: "dbform-side" });
    const tools = h("div", { class: "tse-tools-vert" });
    TOOLS.forEach(([id, labelKey, icon]) => {
      tools.appendChild(h("button", {
        class: curTool === id ? "sel" : "",
        title: t(labelKey),
        onclick() {
          curTool = id;
          redrawViewer();
          tools.querySelectorAll("button").forEach(b => b.classList.remove("sel"));
          this.classList.add("sel");
        }
      },
        h("span", { class: "tool-icon" }, icon),
        h("span", { class: "tool-label" }, t(labelKey))
      ));
    });
    sidePanel.appendChild(tools);
    middle.appendChild(sidePanel);
    form.appendChild(middle);

    // ── BOTTOM: note (full width) ──
    const bottom = h("div", { class: "rmmv-bottom" });
    bottom.appendChild(
      h("div", { class: "note-area" },
        h("label", null, t("tileset.note")),
        h("textarea", {
          oninput(e) { ts.note = e.target.value; touch(); }
        }, ts.note || "")
      )
    );
    form.appendChild(bottom);

    redrawViewer();
  }

  async function openFilePicker(slotIdx) {
    const ts = getTilesetData();
    const filename = ts.tilesetNames ? ts.tilesetNames[slotIdx] : "";

    let files = [];
    try {
        const response = await fetch("img/tilesets/");
        if (response.ok) {
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'));
            files = links.map(a => a.innerText).filter(f => f.endsWith('.png'));
        }
    } catch (e) {
        console.warn("Não foi possível listar arquivos via fetch, usando fallback.", e);
    }

    if (files.length === 0) {
        files = Object.values(Assets.tilesets || {}).map(ts => ts.file + ".png");
    }

    if (files.length === 0) {
        alert(t("tileset.gallery_empty"));
        return;
    }

    // Filtra arquivos que contenham o Tile especificado no nome (ex: "TileA2")
    const filteredFiles = files.filter(f => f.includes(filename.replace("Tile", "")));
    const finalFiles = filteredFiles.length > 0 ? filteredFiles : files;

    const list = h("div", { class: "tileset-file-list" });
    const modalInstance = modal({
        title: t("tileset.select_file"),
        content: list,
        buttons: [{ label: t("btn.cancel"), onClick: (c) => c() }]
    });

    finalFiles.forEach(f => {
        const name = f.replace(/\.png$/i, "");
        list.appendChild(h("div", {
            class: "minirow",
            onclick() {
                if (!ts.tilesetNames) ts.tilesetNames = new Array(9).fill("");
                ts.tilesetNames[slotIdx] = name;
                touch();
                redrawViewer();
                rebuildForm();
                modalInstance.close();
            }
        }, name));
    });
  }


  // --- init ---
  const keys = tsKeys();
  if (keys.length) selectTileset(keys[0]);
  else rebuildForm();

  return container;
}

const MZ_TILESET_SPECS = {
  A1: { cols: 16, rows: 12, w: 768, h: 576 },
  A2: { cols: 16, rows: 12, w: 768, h: 576 },
  A3: { cols: 16, rows: 8, w: 768, h: 384 },
  A4: { cols: 16, rows: 15, w: 768, h: 720 },
  A5: { cols: 8, rows: 16, w: 384, h: 768 },
  B: { cols: 16, rows: 16, w: 768, h: 768 },
  C: { cols: 16, rows: 16, w: 768, h: 768 },
  D: { cols: 16, rows: 16, w: 768, h: 768 },
  E: { cols: 16, rows: 16, w: 768, h: 768 },
};
