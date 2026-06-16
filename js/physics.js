/* Lightweight physics layer for RPGAtlas — initial prototype
   Provides: world builder from tilemap, simple AABB tests, broadphase
   and a move-with-slide helper. Non-invasive: doesn't alter existing engine
   flow until explicitly wired in. */
"use strict";

(function (global) {
  const Physics = {};

  function aabbIntersect(a, b) {
    return !(
      a.x + a.w <= b.x ||
      b.x + b.w <= a.x ||
      a.y + a.h <= b.y ||
      b.y + b.h <= a.y
    );
  }

  // SpatialGrid: broadphase acceleration for tile lookups.
  // Cell-based grid that maps AABB queries to candidate items.
  function SpatialGrid(cellSize) {
    this.cellSize = cellSize || 192;
    this._cells = {};
  }
  SpatialGrid.prototype = {
    _key: function (cx, cy) { return cx + "," + cy; },
    insert: function (item, x1, y1, x2, y2) {
      const cs = this.cellSize;
      const minCX = Math.floor(x1 / cs), maxCX = Math.floor(x2 / cs);
      const minCY = Math.floor(y1 / cs), maxCY = Math.floor(y2 / cs);
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const k = this._key(cx, cy);
          if (!this._cells[k]) this._cells[k] = [];
          if (!this._cells[k].includes(item)) this._cells[k].push(item);
        }
      }
    },
    query: function (x1, y1, x2, y2) {
      const cs = this.cellSize;
      const minCX = Math.floor(x1 / cs), maxCX = Math.floor(x2 / cs);
      const minCY = Math.floor(y1 / cs), maxCY = Math.floor(y2 / cs);
      const seen = new Set();
      const result = [];
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const arr = this._cells[this._key(cx, cy)];
          if (!arr) continue;
          for (let i = 0; i < arr.length; i++) {
            if (!seen.has(arr[i])) { seen.add(arr[i]); result.push(arr[i]); }
          }
        }
      }
      return result;
    },
    clear: function () { this._cells = {}; },
  };

  // Build a world object from a map. Tiles that are non-passable become static
  // bodies. Tile coordinates are converted to pixel-space using tileSize.
  Physics.buildWorld = function (map, assets, tileSize) {
    tileSize = tileSize || (assets && assets.TILE) || 48;
    const world = { tileBodies: [], dynamicBodies: [] };
    if (!map || !map.width) return world;

    // ---- Phase 5 — Grid-free physics world ----
    if (map.gridFree && map.tilePlacements) {
      const layers = ["ground", "decor", "decor2", "over"];
      for (const ln of layers) {
        const arr = map.tilePlacements[ln] || [];
        for (const p of arr) {
          const tile = assets.tiles[p.tileId];
          if (!tile || tile.pass !== false) continue;
          if (tile.collision && tile.collision.type === "box") {
            const c = tile.collision;
            world.tileBodies.push({
              x: p.x + (c.x || 0),
              y: p.y + (c.y || 0),
              w: c.w || tileSize,
              h: c.h || tileSize,
            });
          } else {
            world.tileBodies.push({ x: p.x, y: p.y, w: tileSize, h: tileSize });
          }
        }
      }
      // ---- Phase 6 — free-form collision masks ----
      if (map.collision && map.collision.masks) {
        for (const mk of map.collision.masks) {
          if (mk && mk.w > 0 && mk.h > 0) {
            world.tileBodies.push({ x: mk.x, y: mk.y, w: mk.w, h: mk.h });
          }
        }
      }
      world.addDynamic = function (b) { this.dynamicBodies.push(b); };
      world.removeDynamic = function (b) {
        const i = this.dynamicBodies.indexOf(b);
        if (i >= 0) this.dynamicBodies.splice(i, 1);
      };
      return world;
    }

    if (!map.layers) return world;
    const w = map.width,
      h = map.height;
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const idx = ty * w + tx;
        const collisionMask =
          map.collision && Array.isArray(map.collision.tiles)
            ? map.collision.tiles[idx]
            : null;
        if (collisionMask && collisionMask.w > 0 && collisionMask.h > 0) {
          world.tileBodies.push({
            x: tx * tileSize + (collisionMask.x || 0),
            y: ty * tileSize + (collisionMask.y || 0),
            w: collisionMask.w,
            h: collisionMask.h,
          });
          continue;
        }
        const ov = map.passOv ? map.passOv[idx] : 0;
        if (ov === 1) continue; // forced pass
        if (ov === 2) {
          world.tileBodies.push({
            x: tx * tileSize,
            y: ty * tileSize,
            w: tileSize,
            h: tileSize,
          });
          continue;
        }
        // check decor2, decor, ground in order like engine.tilePassable
        const d2 = map.layers.decor2 && map.layers.decor2[idx];
        if (
          d2 &&
          assets.tiles &&
          assets.tiles[d2] &&
          assets.tiles[d2].pass === false
        ) {
          const def = assets.tiles[d2];
          if (def.collision && def.collision.type === "box") {
            const c = def.collision;
            world.tileBodies.push({
              x: tx * tileSize + (c.x || 0),
              y: ty * tileSize + (c.y || 0),
              w: c.w || tileSize,
              h: c.h || tileSize,
            });
          } else {
            world.tileBodies.push({
              x: tx * tileSize,
              y: ty * tileSize,
              w: tileSize,
              h: tileSize,
            });
          }
          continue;
        }
        const d = map.layers.decor && map.layers.decor[idx];
        if (
          d &&
          assets.tiles &&
          assets.tiles[d] &&
          assets.tiles[d].pass === false
        ) {
          const def = assets.tiles[d];
          if (def.collision && def.collision.type === "box") {
            const c = def.collision;
            world.tileBodies.push({
              x: tx * tileSize + (c.x || 0),
              y: ty * tileSize + (c.y || 0),
              w: c.w || tileSize,
              h: c.h || tileSize,
            });
          } else {
            world.tileBodies.push({
              x: tx * tileSize,
              y: ty * tileSize,
              w: tileSize,
              h: tileSize,
            });
          }
          continue;
        }
        const g = map.layers.ground && map.layers.ground[idx];
        if (!g) {
          // empty ground = non-passable by original engine semantics
          world.tileBodies.push({
            x: tx * tileSize,
            y: ty * tileSize,
            w: tileSize,
            h: tileSize,
          });
          continue;
        }
        if (assets.tiles && assets.tiles[g] && assets.tiles[g].pass === false) {
          const def = assets.tiles[g];
          if (def.collision && def.collision.type === "box") {
            const c = def.collision;
            world.tileBodies.push({
              x: tx * tileSize + (c.x || 0),
              y: ty * tileSize + (c.y || 0),
              w: c.w || tileSize,
              h: c.h || tileSize,
            });
          } else {
            world.tileBodies.push({
              x: tx * tileSize,
              y: ty * tileSize,
              w: tileSize,
              h: tileSize,
            });
          }
          continue;
        }
      }
    }
    // ---- Phase 6 — free-form collision masks ----
    if (map.collision && map.collision.masks) {
      for (const mk of map.collision.masks) {
        if (mk && mk.w > 0 && mk.h > 0) {
          world.tileBodies.push({ x: mk.x, y: mk.y, w: mk.w, h: mk.h });
        }
      }
    }
    world.addDynamic = function (b) {
      this.dynamicBodies.push(b);
    };
    world.removeDynamic = function (b) {
      const i = this.dynamicBodies.indexOf(b);
      if (i >= 0) this.dynamicBodies.splice(i, 1);
    };
    return world;
  };

  Physics.aabbIntersect = aabbIntersect;

  // wouldCollide: checks if body moved by dx,dy would collide any static tile
  Physics.wouldCollide = function (body, dx, dy, world) {
    const moved = { x: body.x + dx, y: body.y + dy, w: body.w, h: body.h };
    // broadphase: only test tileBodies that overlap expanded AABB
    for (const t of world.tileBodies) {
      if (aabbIntersect(moved, t)) return true;
    }
    for (const d of world.dynamicBodies) {
      if (d === body || d.blocking === false) continue;
      if (aabbIntersect(moved, d)) return true;
    }
    return false;
  };

  // moveWithSlide: try dx+dy, then dx, then dy.
  Physics.moveWithSlide = function (body, dx, dy, world) {
    if (!this.wouldCollide(body, dx, dy, world)) {
      body.x += dx;
      body.y += dy;
      return { x: dx, y: dy };
    }
    if (!this.wouldCollide(body, dx, 0, world)) {
      body.x += dx;
      return { x: dx, y: 0 };
    }
    if (!this.wouldCollide(body, 0, dy, world)) {
      body.y += dy;
      return { x: 0, y: dy };
    }
    return { x: 0, y: 0 };
  };

  Physics.SpatialGrid = SpatialGrid;

  global.Physics = Physics;
})(window);
