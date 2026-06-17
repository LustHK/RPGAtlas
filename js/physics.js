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
    _key: function (cx, cy) {
      return cx + "," + cy;
    },
    insert: function (item, x1, y1, x2, y2) {
      const cs = this.cellSize;
      const minCX = Math.floor(x1 / cs),
        maxCX = Math.floor(x2 / cs);
      const minCY = Math.floor(y1 / cs),
        maxCY = Math.floor(y2 / cs);
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
      const minCX = Math.floor(x1 / cs),
        maxCX = Math.floor(x2 / cs);
      const minCY = Math.floor(y1 / cs),
        maxCY = Math.floor(y2 / cs);
      const seen = new Set();
      const result = [];
      for (let cy = minCY; cy <= maxCY; cy++) {
        for (let cx = minCX; cx <= maxCX; cx++) {
          const arr = this._cells[this._key(cx, cy)];
          if (!arr) continue;
          for (let i = 0; i < arr.length; i++) {
            if (!seen.has(arr[i])) {
              seen.add(arr[i]);
              result.push(arr[i]);
            }
          }
        }
      }
      return result;
    },
    clear: function () {
      this._cells = {};
    },
  };

  // Build a world object from a map. Tiles that are non-passable become static
  // bodies. Tile coordinates are converted to pixel-space using tileSize.
  Physics.buildWorld = function (map, assets, tileSize) {
    tileSize = tileSize || (assets && assets.TILE) || 48;
    const world = { tileBodies: [], dynamicBodies: [] };
    if (!map || !map.width) return world;

    function tileIsBlocked(tile) {
      if (!tile) return true;
      if (tile.tileset && typeof assets.getTileFlags === "function") {
        const ts = assets.tilesets[tile.tileset];
        const si = tile.tilesetY * (ts ? ts.cols : 16) + tile.tilesetX;
        const flags = assets.getTileFlags(tile.tileset, si);
        if (flags !== assets.TF_PASS_DEFAULT) {
          const pass = flags & assets.TF_PASS_MASK;
          return pass === assets.TF_PASS_X;
        }
      }
      return tile.pass === false;
    }
    function rmmvTileIsBlocked(tileId) {
      if (typeof assets.getRmmvTileFlags !== "function") return false;
      var f = assets.getRmmvTileFlags(tileId);
      if (f == null) return false;
      // Star bit (bit 4) → passable (no effect on passage)
      if (f & 0x0010) return false;
      // Any direction blocker (bits 0-3) → blocked
      if (f & 0x000F) return true;
      return false;
    }

    // 1. Tile collisions
    if (map.data) {
      const w = map.width,
        h = map.height;
      for (let ty = 0; ty < h; ty++) {
        for (let tx = 0; tx < w; tx++) {
          const idx = ty * w + tx;
          // check decor2, decor, ground in order like engine.tilePassable
          const check = (tid) => {
            if (!tid) return false;
            if (tid >= 2048) return rmmvTileIsBlocked(tid);
            if (assets.tiles && assets.tiles[tid])
              return tileIsBlocked(assets.tiles[tid]);
            return false;
          };
          const d2 = map.data[idx * 4 + 2];
          const d = map.data[idx * 4 + 1];
          const g = map.data[idx * 4];
          if (check(d2) || check(d) || check(g)) {
            world.tileBodies.push({
              x: tx * tileSize,
              y: ty * tileSize,
              w: tileSize,
              h: tileSize,
            });
          }
        }
      }
    } else if (map.layers) {
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
          function checkTileBody(tid) {
            if (tid >= 2048) return rmmvTileIsBlocked(tid);
            if (assets.tiles && assets.tiles[tid])
              return tileIsBlocked(assets.tiles[tid]);
            return false;
          }
          var d2 = map.layers.decor2 && map.layers.decor2[idx];
          if (d2 && checkTileBody(d2)) {
            world.tileBodies.push({
              x: tx * tileSize,
              y: ty * tileSize,
              w: tileSize,
              h: tileSize,
            });
            continue;
          }
          var d = map.layers.decor && map.layers.decor[idx];
          if (d && checkTileBody(d)) {
            world.tileBodies.push({
              x: tx * tileSize,
              y: ty * tileSize,
              w: tileSize,
              h: tileSize,
            });
            continue;
          }
          var g = map.layers.ground && map.layers.ground[idx];
          if (!g || checkTileBody(g)) {
            world.tileBodies.push({
              x: tx * tileSize,
              y: ty * tileSize,
              w: tileSize,
              h: tileSize,
            });
            continue;
          }
        }
      }
    }

    // ---- Phase 6 — free-form collision masks ----
    if (map.collision && map.collision.masks) {
      for (const mk of map.collision.masks) {
        if (mk && mk.w > 0 && mk.h > 0) {
          world.tileBodies.push({
            x: mk.x,
            y: mk.y,
            w: mk.w,
            h: mk.h,
          });
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
    const moved = {
      x: body.x + dx,
      y: body.y + dy,
      w: body.w,
      h: body.h,
    };
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
      return {
        x: dx,
        y: dy,
      };
    }
    if (!this.wouldCollide(body, dx, 0, world)) {
      body.x += dx;
      return {
        x: dx,
        y: 0,
      };
    }
    if (!this.wouldCollide(body, 0, dy, world)) {
      body.y += dy;
      return {
        x: 0,
        y: dy,
      };
    }
    return {
      x: 0,
      y: 0,
    };
  };

  Physics.SpatialGrid = SpatialGrid;

  global.Physics = Physics;
})(window);
