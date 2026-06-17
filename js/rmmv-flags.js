/* RPGAtlas — rmmv-flags.js
   RPG Maker MV/MZ tileset flag constants and helpers.
   GPL-3.0-or-later (see LICENSE). */

// RMMV flag bit layout (matching $dataTilesets[id].flags[tileId])
var RMMV_FLAGS = {
  TERRAIN_TAG_MASK: 0x000F,
  AUTOTILE_ANIM: 0x0010,
  WATERFALL: 0x0020,
  WALL: 0x0040,
  GROUND: 0x0080,
  PASS_DOWN:  0x0100,
  PASS_LEFT:  0x0200,
  PASS_RIGHT: 0x0400,
  PASS_UP:    0x0800,
  PASS_DIR_MASK: 0x0F00,
  LADDER: 0x1000,
  BUSH: 0x2000,
  COUNTER: 0x4000,
  TERRAIN_TAG_HIGH_MASK: 0xFFFF0000,
};

var RMMV_PASSAGE = {
  O: 0,
  X: 1,
  STAR: 2,
};

function decodeFlag(flag) {
  var terrainTag = flag & RMMV_FLAGS.TERRAIN_TAG_MASK;
  var isAnim = !!(flag & RMMV_FLAGS.AUTOTILE_ANIM);
  var blockedDirs = [];
  if (flag & RMMV_FLAGS.PASS_DOWN)  blockedDirs.push("down");
  if (flag & RMMV_FLAGS.PASS_LEFT)  blockedDirs.push("left");
  if (flag & RMMV_FLAGS.PASS_RIGHT) blockedDirs.push("right");
  if (flag & RMMV_FLAGS.PASS_UP)    blockedDirs.push("up");

  var passage;
  if (isAnim) {
    passage = RMMV_PASSAGE.O;
  } else if (terrainTag === 0x0F) {
    passage = RMMV_PASSAGE.STAR;
  } else if (blockedDirs.length === 4) {
    passage = RMMV_PASSAGE.X;
  } else if (blockedDirs.length > 0) {
    passage = RMMV_PASSAGE.X;
  } else {
    passage = RMMV_PASSAGE.O;
  }

  return {
    passage: passage,
    blockedDirs: blockedDirs,
    terrainTag: terrainTag,
    ladder: !!(flag & RMMV_FLAGS.LADDER),
    bush: !!(flag & RMMV_FLAGS.BUSH),
    counter: !!(flag & RMMV_FLAGS.COUNTER),
    isAnim: isAnim,
  };
}

function encodeFlag(passage, extra) {
  extra = extra || {};
  var flag = 0;

  if (passage === RMMV_PASSAGE.STAR) {
    flag |= 0x000F;
  } else if (passage === RMMV_PASSAGE.X) {
    if (extra.dirN) flag |= RMMV_FLAGS.PASS_UP;
    if (extra.dirS) flag |= RMMV_FLAGS.PASS_DOWN;
    if (extra.dirE) flag |= RMMV_FLAGS.PASS_RIGHT;
    if (extra.dirW) flag |= RMMV_FLAGS.PASS_LEFT;
    if (!extra.dirN && !extra.dirS && !extra.dirE && !extra.dirW) {
      flag |= RMMV_FLAGS.PASS_DOWN |
              RMMV_FLAGS.PASS_LEFT |
              RMMV_FLAGS.PASS_RIGHT |
              RMMV_FLAGS.PASS_UP;
    }
  }

  if (extra.ladder) flag |= RMMV_FLAGS.LADDER;
  if (extra.bush)   flag |= RMMV_FLAGS.BUSH;
  if (extra.counter) flag |= RMMV_FLAGS.COUNTER;
  flag |= (extra.terrainTag || 0) & RMMV_FLAGS.TERRAIN_TAG_MASK;

  return flag;
}

function defaultFlagForCategory(category) {
  if (category === "A1") return RMMV_FLAGS.AUTOTILE_ANIM;
  return 0x0000;
}
