/* RPGAtlas — rmmv-tileid.js
   RPG Maker MV/MZ tile ID encoding/decoding.
   GPL-3.0-or-later (see LICENSE). */

// Base tile IDs for each tilesheet slot in RMMV
var TILE_ID_BASES = {
  A1: 2048,
  A2: 2816,
  A3: 4352,
  A4: 5888,
  A5: 8192,
  B:  8704,
  C:  9216,
  D:  9728,
  E:  10240,
};

var TILE_ID_MAX = 10752;

var SLOT_NAMES = ["A1","A2","A3","A4","A5","B","C","D","E"];

var SLOT_BASES = [
  TILE_ID_BASES.A1, TILE_ID_BASES.A2, TILE_ID_BASES.A3,
  TILE_ID_BASES.A4, TILE_ID_BASES.A5,
  TILE_ID_BASES.B, TILE_ID_BASES.C, TILE_ID_BASES.D, TILE_ID_BASES.E,
];

function decodeTileId(tileId) {
  if (!tileId || tileId < 2048 || tileId >= TILE_ID_MAX) return null;
  var offset = tileId - 2048;
  var slot = Math.floor(offset / 256);
  if (slot < 0 || slot >= SLOT_BASES.length) return null;
  return {
    slot: slot,
    subPos: offset % 256,
    slotName: SLOT_NAMES[slot],
  };
}

function encodeTileId(slot, subPos) {
  if (slot < 0 || slot >= SLOT_BASES.length) return 0;
  if (subPos < 0 || subPos > 255) subPos = 0;
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
