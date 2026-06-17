/* RPGAtlas — rmmv-flags.js
   RPG Maker MV/MZ tileset flag constants and helpers.
   GPL-3.0-or-later (see LICENSE). */

// Bit layout MATCHING the original RMMV engine (rpg_objects.js):
//   0-3:   direction blocked  — down(0x01) left(0x02) right(0x04) up(0x08)
//   4:     star (★) / autotile animation  (0x10)
//   5:     ladder   (0x20)
//   6:     bush     (0x40)
//   7:     counter  (0x80)
//   8:     damage floor  (0x100)
//   9-11:  vehicle bits   — boat(0x200) ship(0x400) airship(0x800)
//   12-15: terrain tag  (0xF000 >> 12)
var RMMV_FLAGS = {
  DIR_DOWN:  0x0001,
  DIR_LEFT:  0x0002,
  DIR_RIGHT: 0x0004,
  DIR_UP:    0x0008,
  DIR_MASK:  0x000F,
  STAR:      0x0010,
  LADDER:    0x0020,
  BUSH:      0x0040,
  COUNTER:   0x0080,
  DAMAGE:    0x0100,
  BOAT:      0x0200,
  SHIP:      0x0400,
  AIRSHIP:   0x0800,
  TERRAIN_TAG_SHIFT: 12,
  TERRAIN_TAG_MASK:  0xF000,
};

var RMMV_PASSAGE = {
  O:    0,  // ○  passable (no dirs blocked, no star)
  X:    1,  // ✕  blocked (all 4 dirs blocked, no star)
  STAR: 2,  // ★  no effect on passage (star bit set)
};

function decodeFlag(flag) {
  var dirs = [];
  if (flag & RMMV_FLAGS.DIR_DOWN)  dirs.push("down");
  if (flag & RMMV_FLAGS.DIR_LEFT)  dirs.push("left");
  if (flag & RMMV_FLAGS.DIR_RIGHT) dirs.push("right");
  if (flag & RMMV_FLAGS.DIR_UP)    dirs.push("up");
  var isStar = !!(flag & RMMV_FLAGS.STAR);
  var terrainTag = (flag & RMMV_FLAGS.TERRAIN_TAG_MASK) >> RMMV_FLAGS.TERRAIN_TAG_SHIFT;
  var passage;
  if (isStar) {
    passage = RMMV_PASSAGE.STAR;
  } else if (dirs.length === 4) {
    passage = RMMV_PASSAGE.X;
  } else if (dirs.length > 0) {
    passage = RMMV_PASSAGE.X;
  } else {
    passage = RMMV_PASSAGE.O;
  }
  return {
    passage: passage,
    blockedDirs: dirs,
    terrainTag: terrainTag,
    ladder: !!(flag & RMMV_FLAGS.LADDER),
    bush: !!(flag & RMMV_FLAGS.BUSH),
    counter: !!(flag & RMMV_FLAGS.COUNTER),
    damage: !!(flag & RMMV_FLAGS.DAMAGE),
    isStar: isStar,
  };
}

function encodeFlag(passage, extra) {
  extra = extra || {};
  var flag = 0;
  if (passage === RMMV_PASSAGE.STAR) {
    flag |= RMMV_FLAGS.STAR;
    // Star tiles leave directions clear — no effect on passage
  } else if (passage === RMMV_PASSAGE.X) {
    if (extra.dirS) flag |= RMMV_FLAGS.DIR_DOWN;
    if (extra.dirW) flag |= RMMV_FLAGS.DIR_LEFT;
    if (extra.dirE) flag |= RMMV_FLAGS.DIR_RIGHT;
    if (extra.dirN) flag |= RMMV_FLAGS.DIR_UP;
    // Block all 4 if none specified
    if (!extra.dirN && !extra.dirS && !extra.dirE && !extra.dirW) {
      flag |= RMMV_FLAGS.DIR_DOWN | RMMV_FLAGS.DIR_LEFT |
              RMMV_FLAGS.DIR_RIGHT | RMMV_FLAGS.DIR_UP;
    }
  }
  if (extra.ladder)  flag |= RMMV_FLAGS.LADDER;
  if (extra.bush)    flag |= RMMV_FLAGS.BUSH;
  if (extra.counter) flag |= RMMV_FLAGS.COUNTER;
  if (extra.damage)  flag |= RMMV_FLAGS.DAMAGE;
  var tag = (extra.terrainTag || 0) & 0x0F;
  flag |= (tag << RMMV_FLAGS.TERRAIN_TAG_SHIFT);
  return flag;
}

function defaultFlagForCategory(category) {
  // A1 autotiles get star/animation bit so they don't block passage
  if (category === "A1") return RMMV_FLAGS.STAR;
  return 0x0000;
}
