/* RPGAtlas — rmmv-tileid.js
   RPG Maker MV/MZ tile ID encoding/decoding.
   GPL-3.0-or-later (see LICENSE). */

// Engine-compatible tile ID bases (matching Tilemap.TILE_ID_* constants)
var TILE_ID_BASES = {
  A1: 2048,
  A2: 2816,
  A3: 4352,
  A4: 5888,
  A5: 1536,
  B:  0,
  C:  256,
  D:  512,
  E:  768,
};

var TILE_ID_MAX = 8192;

var SLOT_NAMES = ["A1","A2","A3","A4","A5","B","C","D","E"];

// Slot base tile IDs in engine order (B=0 → E=768 → A5=1536 → A1=2048 → A4=5888)
// But stored in tilesetNames order: A1(0)..A5(4)..B(5)..E(8)
var SLOT_BASES = [
  TILE_ID_BASES.A1, // 0: A1
  TILE_ID_BASES.A2, // 1: A2
  TILE_ID_BASES.A3, // 2: A3
  TILE_ID_BASES.A4, // 3: A4
  TILE_ID_BASES.A5, // 4: A5
  TILE_ID_BASES.B,  // 5: B
  TILE_ID_BASES.C,  // 6: C
  TILE_ID_BASES.D,  // 7: D
  TILE_ID_BASES.E,  // 8: E
];

// Engine tile ID ranges per category (matching Tilemap constants)
var ENGINE_RANGES = [
  { slotIdx: 5, name: "B",  start: 0,     end: 256   },
  { slotIdx: 6, name: "C",  start: 256,   end: 512   },
  { slotIdx: 7, name: "D",  start: 512,   end: 768   },
  { slotIdx: 8, name: "E",  start: 768,   end: 1536  },
  { slotIdx: 4, name: "A5", start: 1536,  end: 2048  },
  { slotIdx: 0, name: "A1", start: 2048,  end: 2816  },
  { slotIdx: 1, name: "A2", start: 2816,  end: 4352  },
  { slotIdx: 2, name: "A3", start: 4352,  end: 5888  },
  { slotIdx: 3, name: "A4", start: 5888,  end: 8192  },
];

function decodeTileId(tileId) {
  if (!tileId || tileId < 0 || tileId >= TILE_ID_MAX) return null;
  for (var i = 0; i < ENGINE_RANGES.length; i++) {
    var r = ENGINE_RANGES[i];
    if (tileId >= r.start && tileId < r.end) {
      return {
        slot: r.slotIdx,
        subPos: tileId - r.start,
        slotName: r.name,
      };
    }
  }
  return null;
}

function encodeTileId(slot, subPos) {
  if (slot < 0 || slot >= SLOT_BASES.length) return 0;
  if (subPos < 0) subPos = 0;
  return SLOT_BASES[slot] + subPos;
}

function baseTileId(slotName) {
  return TILE_ID_BASES[slotName] || 0;
}

function isAutotileTile(tileId) {
  var d = decodeTileId(tileId);
  return d && d.slot <= 4;
}

function slotOfTile(tileId) {
  var d = decodeTileId(tileId);
  return d ? d.slot : -1;
}

function subPosToGrid(subPos) {
  return {
    col: subPos % 8,
    row: Math.floor(subPos / 8),
  };
}
