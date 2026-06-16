# RPGAtlas AI Contribution Memory

## Patch Notes Requirement

Every AI-assisted feature addition or substantial project change must include a short, descriptive
entry in `js/patch-notes.js`.

- Prepend the new entry to the top of the `PATCH_NOTES` array so the newest update appears first.
- Never overwrite, remove, reorder, or summarize away previous patch notes.
- Include the date, a concise title, a one-sentence summary, and a short list of notable user-facing
  additions or changes.
- Keep entries easily digestible. Name new commands, buttons, tools, or major behaviors explicitly.
- Small bug fixes, formatting-only edits, and internal maintenance do not require an entry unless
  they materially affect users.

## Grid-Free Mapping — Reference

The project has a multi-phase plan to replace the fixed 48×48 tile grid with a freeform
pixel-position system. Key documents:

- `wiki/Grid-Free-Mapping-Plan.md` — Complete implementation plan with 6 phases
- `wiki/rpg-maker-mz-mapping-spec.md` — Official RPG Maker MZ tileset sheet specs
- `wiki/Pixel-Movement-and-Grid-Free.md` — Original pixel movement and collision documentation

### Tileset Sheet Dimensions (RPG Maker MZ)

| Sheet | Resolution | Grid | Kinds | Autotile |
|-------|-----------|------|-------|----------|
| TileA1.png | 768×576 | 16×12 | 5 blocks | Animated |
| TileA2.png | 768×576 | 16×12 | 32 (8×4) | Quarter-system, 48 shapes |
| TileA3.png | 768×384 | 16×8 | 8 groups | Group pattern |
| TileA4.png | 768×720 | 16×15 | 48 (3 bands) | Top (48) + Side (16) |
| TileA5.png | 384×768 | 8×16 | 128 none | — |
| TileB–E.png | 768×768 | 16×16 | 256 each | — |

### Autotile System

- Quarter-units: Q = 24px (T/2)
- FLOOR_AUTOTILE_TABLE: 48 entries (A2, A4 wall-top)
- WALL_AUTOTILE_TABLE: 16 entries (A4 wall-side)
- Shape solver uses 8-neighbor bitmask for floor, 4-cardinal for wall
- Grid-free adjacency: spatial overlap instead of array index
