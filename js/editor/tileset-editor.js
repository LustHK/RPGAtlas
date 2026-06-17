/* RPGAtlas — tileset-editor.js
   Database ▸ Tilesets tab: viewer, flag editor, file slots.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */

const TILE = 48;
const CATEGORIES = ["A1","A2","A3","A4","A5","B","C","D","E"];
const CATEGORY_LABELS = {
  A1: "tileset.tab_a1", A2: "tileset.tab_a2", A3: "tileset.tab_a3",
  A4: "tileset.tab_a4", A5: "tileset.tab_a5", B: "tileset.tab_b",
  C: "tileset.tab_c", D: "tileset.tab_d", E: "tileset.tab_e",
};

const MZ_TILESET_SPECS = {
  A1: { cols: 16, rows: 12, passDefault: false, terrain: false },
  A2: { cols: 16, rows: 12, passDefault: true,  terrain: true },
  A3: { cols: 16, rows: 8,  passDefault: false, terrain: false },
  A4: { cols: 16, rows: 15, passDefault: true,  terrain: true },
  A5: { cols: 8,  rows: 16, passDefault: true,  terrain: true },
  B:  { cols: 16, rows: 16, passDefault: false, terrain: false },
  C:  { cols: 16, rows: 16, passDefault: false, terrain: false },
  D:  { cols: 16, rows: 16, passDefault: false, terrain: false },
  E:  { cols: 16, rows: 16, passDefault: false, terrain: false },
};

const TOOLS = [
  ["passage",  "tileset.tool_passage",  "P"],
  ["dir-n",    "tileset.tool_dir_n",    "↑"],
  ["dir-s",    "tileset.tool_dir_s",    "↓"],
  ["dir-e",    "tileset.tool_dir_e",    "→"],
  ["dir-w",    "tileset.tool_dir_w",    "←"],
  ["ladder",   "tileset.tool_ladder",   "L"],
  ["bush",     "tileset.tool_bush",     "B"],
  ["counter",  "tileset.tool_counter",  "C"],
  ["damage",   "tileset.tool_damage",   "D"],
  ["terrain",  "tileset.tool_terrain",  "T"],
];

export function buildTilesetTab(proj, Assets, t, h, touch) {
  let curTilesetKey = null;
  let curTool = "passage";
  let viewerZoom = 1.0;
  let showOverlay = true;
  let isPainting = false;
  let lastPaintedIdx = -1;

  const container = h("div", { class: "dbtab" });

  // --- sidebar: tileset list ---
  const side = h("div", { class: "dbside" });
  const listEl = h("ul", { class: "dblist" });
  side.appendChild(listEl);
  container.appendChild(side);

  // --- main form area ---
  const form = h("div", { class: "dbform" });
  container.appendChild(form);

  // --- state ---
  let viewerWrap, viewerCanvas, viewerCtx;

  function tsKeys() {
    return Object.keys(Assets.tilesets || {}).sort();
  }

  function rebuildList() {
    listEl.innerHTML = "";
    const keys = tsKeys();
    if (!keys.length) {
      listEl.appendChild(h("li", { class: "dim" }, "(no tilesets loaded)"));
      return;
    }
    for (const k of keys) {
      const reg = Assets.tilesets[k];
      const li = h("li", {
        class: k === curTilesetKey ? "sel" : "",
        onclick() { selectTileset(k); },
      },
        h("span", { class: "db-entry-id" }, reg.category + ":"),
        h("span", null, k),
      );
      listEl.appendChild(li);
    }
  }

  function selectTileset(k) {
    curTilesetKey = k;
    rebuildList();
    rebuildForm();
  }

  function getReg() {
    return curTilesetKey ? (Assets.tilesets[curTilesetKey] || null) : null;
  }

  function getSpec() {
    const reg = getReg();
    if (!reg) return null;
    const specs = MZ_TILESET_SPECS;
    return specs ? (specs[reg.category] || null) : null;
  }

  function tileSubIndex(tile) {
    if (!tile || !tile.tileset) return -1;
    const ts = Assets.tilesets[tile.tileset];
    if (!ts) return -1;
    return tile.tilesetY * ts.cols + tile.tilesetX;
  }

  function tileIdxToId(spec, cols, row, col) {
    const reg = getReg();
    if (!reg || !reg.tileIds) return -1;
    const idx = row * cols + col;
    if (idx < 0 || idx >= reg.tileIds.length) return -1;
    return reg.tileIds[idx];
  }

  function paintFlag(tileId, fromPropagation) {
    const reg = getReg();
    if (!reg) return;
    const tile = Assets.tiles ? Assets.tiles[tileId] : null;
    if (!tile || !tile.tileset) return;
    const si = tileSubIndex(tile);
    if (si < 0) return;
    const tsKey = tile.tileset;
    let flags = Assets.getTileFlags(tsKey, si);

    switch (curTool) {
      case "passage": {
        const cur = flags & Assets.TF_PASS_MASK;
        let next;
        if (cur === Assets.TF_PASS_O) next = Assets.TF_PASS_X;
        else if (cur === Assets.TF_PASS_X) {
          const cat = reg.category || "";
          if (cat[0] === "A") next = Assets.TF_PASS_O;
          else next = Assets.TF_PASS_STAR;
        } else next = Assets.TF_PASS_O;
        flags = (flags & ~Assets.TF_PASS_MASK) | next;
        break;
      }
      case "dir-n": flags ^= Assets.TF_DIR_N; break;
      case "dir-s": flags ^= Assets.TF_DIR_S; break;
      case "dir-e": flags ^= Assets.TF_DIR_E; break;
      case "dir-w": flags ^= Assets.TF_DIR_W; break;
      case "ladder": flags ^= Assets.TF_LADDER; break;
      case "bush":   flags ^= Assets.TF_BUSH; break;
      case "counter": flags ^= Assets.TF_COUNTER; break;
      case "damage":  flags ^= Assets.TF_DAMAGE; break;
      case "terrain": {
        const cur = (flags & Assets.TF_TERRAIN_MASK) >> Assets.TF_TERRAIN_SHIFT;
        const next = (cur + 1) % 8;
        flags = (flags & ~Assets.TF_TERRAIN_MASK) | (next << Assets.TF_TERRAIN_SHIFT);
        break;
      }
    }

    _applyFlag(tsKey, si, flags);

    // Propagate to all sub-tiles in the same autotile kind group
    if (!fromPropagation) {
      const cat = reg.category || "";
      if (/^A[1-4]$/.test(cat) && reg.autotile) {
        const kindIdx = tile.kindIndex;
        if (kindIdx != null) {
          for (const otherId of reg.tileIds) {
            if (otherId === tileId) continue;
            const otherTile = Assets.tiles[otherId];
            if (!otherTile || otherTile.kindIndex !== kindIdx) continue;
            const otherSi = tileSubIndex(otherTile);
            if (otherSi >= 0) _applyFlag(tsKey, otherSi, flags);
          }
        }
      }
    }

    touch();
    redrawViewer();
  }

  function _applyFlag(tsKey, si, flags) {
    Assets.setTileFlags(tsKey, si, flags);
  }

  function paintAt(row, col) {
    const spec = getSpec();
    const reg = getReg();
    if (!spec || !reg) return;
    const cols = spec.cols;
    const tileId = tileIdxToId(spec, cols, row, col);
    if (tileId < 0) return;
    paintFlag(tileId, false);
  }

  // --- viewer drawing ---
  function redrawViewer() {
    if (!viewerCanvas || !viewerCtx) return;
    const g = viewerCtx;
    const reg = getReg();
    const spec = getSpec();

    let cols = 16, rows = 16;
    if (spec) { cols = spec.cols; rows = spec.rows; }

    const w = Math.round(cols * TILE * viewerZoom);
    const h2 = Math.round(rows * TILE * viewerZoom);
    viewerCanvas.width = w;
    viewerCanvas.height = h2;
    g.setTransform(viewerZoom, 0, 0, viewerZoom, 0, 0);

    g.fillStyle = "#15151d";
    g.fillRect(0, 0, cols * TILE, rows * TILE);

    if (reg && reg.image) {
      g.imageSmoothingEnabled = false;
      g.drawImage(reg.image, 0, 0, reg.image.width, reg.image.height, 0, 0, cols * TILE, rows * TILE);
    }

    // grid
    g.strokeStyle = "rgba(255,255,255,0.12)";
    g.lineWidth = 1;
    for (let col = 0; col <= cols; col++) {
      const x = col * TILE;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, rows * TILE); g.stroke();
    }
    for (let row = 0; row <= rows; row++) {
      const y = row * TILE;
      g.beginPath(); g.moveTo(0, y); g.lineTo(cols * TILE, y); g.stroke();
    }

    if (showOverlay && reg && reg.tileIds) {
      drawOverlay(g, reg, spec, cols, rows);
    }
  }

  function drawOverlay(g, reg, spec, cols, rows) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (idx >= reg.tileIds.length) continue;
        const tileId = reg.tileIds[idx];
        const tile = Assets.tiles ? Assets.tiles[tileId] : null;
        if (!tile || !tile.tileset) continue;
        const si = tileSubIndex(tile);
        if (si < 0) continue;
        const flags = Assets.getTileFlags(tile.tileset, si);
        if (!flags) continue;
        const cx = col * TILE, cy = row * TILE;

        const passage = flags & Assets.TF_PASS_MASK;
        if (passage === Assets.TF_PASS_X) {
          g.strokeStyle = "#ff4444";
          g.lineWidth = 3;
          const r = TILE * 0.2;
          g.beginPath();
          g.moveTo(cx + TILE/2 - r, cy + TILE/2 - r);
          g.lineTo(cx + TILE/2 + r, cy + TILE/2 + r);
          g.moveTo(cx + TILE/2 + r, cy + TILE/2 - r);
          g.lineTo(cx + TILE/2 - r, cy + TILE/2 + r);
          g.stroke();
        } else if (passage === Assets.TF_PASS_STAR) {
          g.fillStyle = "#ffd86a";
          g.font = "bold 14px monospace";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText("★", cx + TILE/2, cy + TILE/2);
        }

        if (flags & Assets.TF_DIR_N) {
          g.fillStyle = "#ff6644";
          g.fillRect(cx + 14, cy + 2, 20, 6);
        }
        if (flags & Assets.TF_DIR_S) {
          g.fillStyle = "#ff6644";
          g.fillRect(cx + 14, cy + TILE - 8, 20, 6);
        }
        if (flags & Assets.TF_DIR_W) {
          g.fillStyle = "#ff6644";
          g.fillRect(cx + 2, cy + 14, 6, 20);
        }
        if (flags & Assets.TF_DIR_E) {
          g.fillStyle = "#ff6644";
          g.fillRect(cx + TILE - 8, cy + 14, 6, 20);
        }

        let badge = 0;
        if (flags & Assets.TF_LADDER) badge++;
        if (flags & Assets.TF_BUSH) badge++;
        if (flags & Assets.TF_COUNTER) badge++;
        if (flags & Assets.TF_DAMAGE) badge++;
        if (badge) {
          g.font = "10px monospace";
          g.textAlign = "left";
          g.textBaseline = "top";
          let bx = cx + 2;
          if (flags & Assets.TF_LADDER) { g.fillStyle = "#8a6af0"; g.fillText("L", bx, cy + 2); bx += 10; }
          if (flags & Assets.TF_BUSH)   { g.fillStyle = "#6ab84a"; g.fillText("B", bx, cy + 2); bx += 10; }
          if (flags & Assets.TF_COUNTER){ g.fillStyle = "#f0a030"; g.fillText("C", bx, cy + 2); bx += 10; }
          if (flags & Assets.TF_DAMAGE) { g.fillStyle = "#f06060"; g.fillText("D", bx, cy + 2); }
        }

        const tag = (flags & Assets.TF_TERRAIN_MASK) >> Assets.TF_TERRAIN_SHIFT;
        if (tag) {
          g.fillStyle = "#80c0ff";
          g.font = "10px monospace";
          g.textAlign = "right";
          g.textBaseline = "bottom";
          g.fillText("T" + tag, cx + TILE - 2, cy + TILE - 2);
        }
      }
    }
  }

  // --- canvas mouse handlers ---
  function canvasCoords(e) {
    const rect = viewerCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / viewerZoom,
      y: (e.clientY - rect.top) / viewerZoom,
    };
  }

  function onCanvasDown(e) {
    if (e.button !== 0) return;
    const pos = canvasCoords(e);
    const spec = getSpec();
    if (!spec) return;
    const col = Math.floor(pos.x / TILE);
    const row = Math.floor(pos.y / TILE);
    if (col < 0 || col >= spec.cols || row < 0 || row >= spec.rows) return;
    isPainting = true;
    lastPaintedIdx = row * spec.cols + col;
    paintAt(row, col);
  }

  function onCanvasMove(e) {
    const pos = canvasCoords(e);
    const spec = getSpec();
    if (!spec) return;
    const col = Math.floor(pos.x / TILE);
    const row = Math.floor(pos.y / TILE);
    if (col < 0 || col >= spec.cols || row < 0 || row >= spec.rows) return;

    if (isPainting && e.buttons & 1) {
      const idx = row * spec.cols + col;
      if (idx !== lastPaintedIdx) {
        lastPaintedIdx = idx;
        paintAt(row, col);
      }
    }
    updateHover(col, row);
  }

  function onCanvasUp() {
    isPainting = false;
    lastPaintedIdx = -1;
  }

  function onCanvasWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    viewerZoom = Math.max(0.25, Math.min(4, viewerZoom + delta));
    updateZoomDisplay();
    redrawViewer();
  }

  let hoverCol = -1, hoverRow = -1;

  function updateHover(col, row) {
    if (col !== hoverCol || row !== hoverRow) {
      hoverCol = col;
      hoverRow = row;
      redrawViewer();
      drawHover();
    }
  }

  function drawHover() {
    if (!viewerCtx || hoverCol < 0 || hoverRow < 0) return;
    const g = viewerCtx;
    g.strokeStyle = "rgba(255,216,106,0.6)";
    g.lineWidth = 2 / viewerZoom;
    g.strokeRect(hoverCol * TILE, hoverRow * TILE, TILE, TILE);
  }

  // --- zoom ---
  function updateZoomDisplay() {
    const el = container.querySelector(".tse-zoom-label");
    if (el) el.textContent = Math.round(viewerZoom * 100) + "%";
  }

  function zoomIn() {
    viewerZoom = Math.min(4, viewerZoom + 0.5);
    updateZoomDisplay();
    redrawViewer();
  }
  function zoomOut() {
    viewerZoom = Math.max(0.25, viewerZoom - 0.5);
    updateZoomDisplay();
    redrawViewer();
  }
  function zoomReset() {
    viewerZoom = 1.0;
    updateZoomDisplay();
    redrawViewer();
  }

  // --- gallery modal ---
  function openGallery() {
    const cat = getReg() ? getReg().category : "B";
    // Remove existing overlay
    const old = container.querySelector(".tse-gallery-overlay");
    if (old) old.remove();

    const overlay = h("div", {
      class: "tse-gallery-overlay",
      onclick(e) { if (e.target === overlay) overlay.remove(); },
      style: "position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center",
    });

    const modal = h("div", {
      style: "background:#1c1c24;border:1px solid #3c3c44;border-radius:8px;max-width:90vw;max-height:85vh;overflow:auto;padding:16px",
    });

    const titleRow = h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px" });
    titleRow.appendChild(h("b", null, t("tileset.gallery")));
    const closeBtn = h("button", {
      class: "mini",
      onclick() { overlay.remove(); },
    }, "✕");
    titleRow.appendChild(closeBtn);
    modal.appendChild(titleRow);

    // Fetch manifest and build grid
    fetch("img/assets.json")
      .then(r => r.json())
      .then(manifest => {
        const items = manifest.tilesets || [];
        if (!items.length) {
          modal.appendChild(h("div", { class: "dim" }, t("tileset.gallery_empty")));
          return;
        }
        // Group by category
        const byCat = {};
        for (const fname of items) {
          const m = fname.match(/Tile(A[1-5]|[B-E])\.png$/);
          const c = m ? m[1] : "?";
          if (!byCat[c]) byCat[c] = [];
          byCat[c].push(fname);
        }

        // Sort categories
        const catOrder = CATEGORIES.filter(c => byCat[c]);
        for (const c of catOrder) {
          const group = h("div", { style: "margin-bottom:12px" });
          group.appendChild(h("div", { style: "font-size:12px;color:#888;margin-bottom:4px" }, t("tileset.gallery_category", { cat: c })));
          const grid = h("div", { style: "display:flex;flex-wrap:wrap;gap:6px" });

          for (const fname of byCat[c]) {
            const thumbSize = c[0] === "A" ? 96 : 64;
            const thumb = h("canvas", {
              width: thumbSize,
              height: Math.round(thumbSize * (c[0] === "A" ? 0.75 : 1)),
              style: "cursor:pointer;border:2px solid transparent;border-radius:4px;image-rendering:pixelated",
              onmouseenter(e) { e.target.style.borderColor = "#ffd86a"; },
              onmouseleave(e) { e.target.style.borderColor = "transparent"; },
              onclick() {
                overlay.remove();
                // Check if there's a tileset with this category
                const foundKey = Object.keys(Assets.tilesets).find(
                  k => Assets.tilesets[k].category === c
                );
                if (foundKey && foundKey !== curTilesetKey) {
                  selectTileset(foundKey);
                }
              },
            });
            grid.appendChild(thumb);

            // Load image for thumbnail
            const img = new Image();
            img.onload = () => {
              const ctx = thumb.getContext("2d");
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, 0, 0, thumb.width, thumb.height);
            };
            img.src = "img/tilesets/" + fname;
          }
          group.appendChild(grid);
          modal.appendChild(group);
        }
      })
      .catch(() => {
        modal.appendChild(h("div", { class: "dim" }, t("tileset.gallery_empty")));
      });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // --- rebuild form ---
  function rebuildForm() {
    form.innerHTML = "";
    if (!curTilesetKey) {
      form.appendChild(h("div", { class: "dim", style: "padding:40px;text-align:center" }, t("tileset.no_selection")));
      return;
    }

    const reg = getReg();
    if (!reg) {
      form.appendChild(h("div", { class: "dim", style: "padding:40px;text-align:center" }, "Tileset data not available"));
      return;
    }

    const cat = reg.category || "B";

    // info row
    const infoRow = h("div", { class: "frow", style: "align-items:center;gap:12px" });
    infoRow.appendChild(h("b", null, curTilesetKey));
    infoRow.appendChild(h("span", { class: "dim" }, t(CATEGORY_LABELS[cat]) + " — " + (reg.file || "")));
    infoRow.appendChild(h("span", { class: "dim" }, reg.cols + "×" + reg.rows + " tiles"));
    form.appendChild(infoRow);

    // category tabs (clickable — navigates to the tileset of that category)
    const tabBar = h("div", { class: "tse-tabs" });
    CATEGORIES.forEach(c => {
      const isActive = c === cat;
      tabBar.appendChild(h("button", {
        class: isActive ? "sel" : "",
        onclick() {
          const found = Object.values(Assets.tilesets).find(ts => ts.category === c);
          if (found) selectTileset(found.key);
        },
      }, t(CATEGORY_LABELS[c])));
    });
    form.appendChild(tabBar);

    // file slot display + gallery button
    const fileSlot = h("div", { class: "tse-file-row" });
    const fname = reg.file || "(no file)";
    fileSlot.appendChild(h("span", null, t("tileset.file_slot", { name: fname })));
    fileSlot.appendChild(h("button", {
      class: "mini",
      style: "margin-left:8px",
      onclick: openGallery,
    }, t("tileset.gallery_change")));
    form.appendChild(fileSlot);

    // tool bar
    const toolBar = h("div", { class: "tse-toolbar" });
    TOOLS.forEach(([id, labelKey, icon]) => {
      toolBar.appendChild(h("button", {
        class: id === curTool ? "sel" : "",
        title: t(labelKey),
        onclick() { curTool = id; rebuildForm(); },
      }, icon));
    });
    form.appendChild(toolBar);

    // viewer
    viewerWrap = h("div", { class: "tse-viewer-wrap" });
    viewerCanvas = h("canvas", { class: "tse-canvas" });
    viewerCtx = viewerCanvas.getContext("2d");
    viewerWrap.appendChild(viewerCanvas);

    viewerCanvas.addEventListener("mousedown", onCanvasDown);
    viewerCanvas.addEventListener("mousemove", onCanvasMove);
    viewerCanvas.addEventListener("mouseup", onCanvasUp);
    viewerCanvas.addEventListener("mouseleave", () => {
      isPainting = false;
      lastPaintedIdx = -1;
      hoverCol = -1; hoverRow = -1;
      redrawViewer();
    });
    viewerCanvas.addEventListener("wheel", onCanvasWheel, { passive: false });
    form.appendChild(viewerWrap);

    // zoom bar
    const zoomBar = h("div", { class: "tse-zoom-bar" });
    zoomBar.appendChild(h("button", { class: "mini", onclick: zoomIn, title: t("tileset.zoom_in") }, "+"));
    zoomBar.appendChild(h("button", { class: "mini", onclick: zoomOut, title: t("tileset.zoom_out") }, "−"));
    zoomBar.appendChild(h("button", { class: "mini", onclick: zoomReset, title: t("tileset.zoom_reset") }, "1:1"));
    zoomBar.appendChild(h("span", { class: "tse-zoom-label dim" }, Math.round(viewerZoom * 100) + "%"));

    const overlayChk = h("input", {
      type: "checkbox",
      checked: showOverlay ? "checked" : null,
      onchange(e) { showOverlay = e.target.checked; redrawViewer(); },
    });
    zoomBar.appendChild(h("label", null, overlayChk, " ", t("tileset.show_overlay")));
    form.appendChild(zoomBar);

    // action buttons
    const actionBar = h("div", { class: "frow", style: "margin-top:8px;gap:6px" });
    actionBar.appendChild(h("button", {
      class: "mini",
      onclick: exportJSON,
    }, t("tileset.export_json")));
    actionBar.appendChild(h("button", {
      class: "mini",
      onclick: importJSON,
    }, t("tileset.import_json")));
    form.appendChild(actionBar);

    redrawViewer();
  }

  // --- export / import ---
  function exportJSON() {
    if (!curTilesetKey) return;
    const reg = getReg();
    const flagArr = reg ? Assets.exportTileFlags(curTilesetKey) : [];
    const tsEntry = proj.tilesets ? proj.tilesets[curTilesetKey] : null;
    const data = {
      key: curTilesetKey,
      category: reg ? reg.category : "",
      file: reg ? reg.file : "",
      cols: reg ? reg.cols : 0,
      rows: reg ? reg.rows : 0,
      flags: flagArr,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: curTilesetKey + "_flags.json" });
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON() {
    const inp = h("input", { type: "file", accept: ".json",
      onchange(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!curTilesetKey) return;
            if (data.flags && Array.isArray(data.flags)) {
              Assets.loadTileFlags(curTilesetKey, data.flags);
            }
            touch();
            rebuildForm();
            redrawViewer();
          } catch (err) {
            alert("Invalid JSON: " + err.message);
          }
        };
        reader.readAsText(file);
      }
    });
    inp.click();
  }

  // --- init ---
  const keys = tsKeys();
  if (keys.length) selectTileset(keys[0]);
  else rebuildForm();

  return container;
}
