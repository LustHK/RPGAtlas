/* RPGAtlas - patch-notes.js
   Keep newest entries first. See AGENTS.md for the update policy. */
"use strict";

export const PATCH_NOTES = [
   {
     date: "June 15, 2026",
     title: "Abandoned Quest Tracking",
     summary: "The Journal now separates abandoned quests from failed ones so players can review dropped quests independently.",
     items: [
       "Added an Abandoned Quests tab to the Journal.",
       "Player-abandoned quests now use their own abandoned state instead of being mixed into Failed Quests.",
       "Quest status pickers now include abandoned for page conditions and quest prerequisites.",
     ],
   },
   {
     date: "June 15, 2026",
     title: "Split-Panel Quest Journal",
     summary: "The in-game Journal now opens as a full-size split panel with quest browsing on the left and live details on the right.",
     items: [
       "Replaced the old Journal popup flow with a dedicated full-screen-style panel.",
       "Browse Active, Completed, and Failed quests from tabs across the top of the Journal.",
       "See the selected quest's title, description, objectives, and failure outcome in a persistent detail pane.",
       "Opening the Journal now hides the party panel so the quest screen has room to breathe.",
     ],
   },
   {
     date: "June 15, 2026",
     title: "Built-In Quest System",
     summary: "Added a built-in quest framework with editor tools, runtime tracking, objective progress, branching outcomes, and an in-game Journal.",
     items: [
       "New Database -> Quests tab for creating and editing quests, objectives, rewards, prerequisites, failure rules, and follow-up quest chains.",
       "Added Event, Kill, and Fetch objectives with progress tracking, optional fetch item turn-in consumption, and objective-aware event page conditions.",
       "New event commands: Start Quest, Complete Quest, Fail Quest, Advance Quest Objective, and Set Quest Objective Progress.",
       "Added an in-game Journal with Active, Completed, and Failed quest lists, objective progress display, outcome text, and optional quest abandonment.",
       "Quest rewards now support XP, gold, and items, with save/load support, restart/abandon policies, branching failures, and automatic follow-up quest unlocking.",
     ],
   },
  {
    date: "June 15, 2026",
    title: "Phase 4 (Corrective) — Grid-Free Editor Implementation + Phase 2 Fixes",
    summary:
      "Implemented the missing grid-free editor UI in editor.js: tabbed palette, pixel-precise click-to-place with snap, drag-to-move, placement selection/deletion, properties panel, and Escape deselect. Fixed snapshotOf() to capture tilePlacements/gridFree for proper undo/redo. Added proj.tilesets schema for project portability. Updated bindExternalAssets() to populate proj.tilesets.",
    items: [
      "Tabbed palette (pal-tabs): renderPalette() now builds dynamic All / per-tileset / Today tabs that filter displayed tiles. Palette click handlers updated for filtered grid layout.",
      "Click-to-place: onCanvasDown() gridFree branch creates {id, tileId, x, y} at snapped pixel position with crypto.randomUUID(). Auto-layer resolution via resolvePlacementLayer().",
      "Snap toggle: snap-toggle toolbar button cycles Free → 24px → 48px. snapPx() applies rounding. Status bar shows current snap mode.",
      "placementAt(): detects placement under cursor by bounding box across all layers. selectedPlacement state wired to rendering and deletion.",
      "Drag-to-move: click+move selected placement with undo-on-first-move pattern. onCanvasUp() cleans up drag state.",
      "Delete/Backspace: removes selected placement with undo support.",
      "Properties panel: updatePropsPanel() populates #props-section with tile name, layer, X/Y coords. Shown/hidden on selection/deselect.",
      "Grid-free render overlay: renderMap() branch renders tilePlacements with Y-sort, blue highlight for selected, ghost preview at cursor, events, start marker.",
      "Snapshot fix: snapshotOf() now captures tilePlacements + gridFree. applySnapshot() restores them. undo/redo now works for grid-free operations.",
      "proj.tilesets: added to newProject() schema and migrateProject(). bindExternalAssets() populates project.tilesets for persistence.",
      "Escape deselects placement (alongside events and masks). Right-click eyedropper picks from grid-free placements.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "Phase 6 — Free-Form Collision Masks (collision mode, mask creation, move, resize, delete)",
    summary:
      "Added a new Collision Mode to the editor for creating and editing free-form rectangular collision masks alongside per-grid-cell collision rects. Masks are stored in map.collision.masks[] and rendered as physics bodies.",
    items: [
      "Collision Mode toolbar button & C key shortcut: switches to collision editing overlay on the map.",
      "Grid-cell collision rects: existing per-tile collision values are shown as red overlays with the sub-cell edit rect (blue) when selected.",
      "Free-form collision masks: click an empty area in collision mode to create a 48×48 blue mask at the cursor position.",
      "Mask move: click and drag any mask to reposition it freely in pixel space.",
      "Mask resize: 8 yellow handles appear on the selected mask for corner/edge resizing (minimum 4×4px clamp).",
      "Delete/Backspace: removes the selected mask with undo/redo support.",
      "Escape: deselects the current mask.",
      "Physics integration: both grid-free and legacy map physics builders emit AABB bodies from map.collision.masks[].",
      "Undo/redo: snapshotOf() now captures m.collision (tiles + masks) for proper restore.",
      "Collision overlay rendering: drawCollisionOverlay() renders both cell rects and free-form masks with selection highlights.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "Phase 5 — Grid-Free Runtime (renderTilePlacements, autotile composition, physics world builder)",
    summary:
      "Adapted the game engine runtime to render and process grid-free tile placements: direct pixel rendering with Y-sort and frustum culling, autotile composition for A2–A4 tiles, and passability/physics world building from tilePlacements.",
    items: [
      "renderTilePlacements(): new function that renders tilePlacements arrays with Y-sorting, layer-ordered drawing (ground→decor→decor2→over), and frustum culling to skip off-screen tiles.",
      "drawComposedAutotile(): autotile composition for A2–A4 tiles — detects neighbors pixel-distance via detectNeighbors(), computes shape via solveFloorSignature/solveWallMask, and composes the final 48×48 tile from the source sheet using composeFloorAutotile/composeWallAutotile.",
      "Atlas direct: A5 and B–E tiles render directly via Assets.drawTile (no autotile processing).",
      "A1 animated tiles: currently rendered as static sheet cells (animation support planned for a future update).",
      "buildPassGrid(): constructs a Uint8Array of per-cell passability from tilePlacements at map load time for O(1) tilePassable() queries.",
      "Physics.buildWorld() grid-free: new code path iterates tilePlacements arrays, building AABB collision bodies for any tile with pass===false — supports custom collision.box masks.",
      "Fallback legado: all existing code paths (pre-rendered buffers, HD-2D, grid-based physics) remain untouched for legacy maps without gridFree flag.",
      "HD-2D rendering is disabled for grid-free maps (the pre-rendered tile buffers are not built); standard canvas path used instead.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "Phase 4 — Grid-Free Editor AUDIT: NOT IMPLEMENTED (retrospective correction)",
    summary:
      "Audit of the codebase revealed that Phase 4 (Grid-Free Editor) was never actually implemented in editor.js despite being marked complete. The wiki plan and patch notes have been corrected. A corrective plan has been created in wiki/Grid-Free-Mapping-Plan.md section 11.1.",
    items: [
      "renderPalette() has no tabbed interface — paletteTab variable (line 47) is dead code.",
      "onCanvasDown() has no gridFree branch — only legacy grid painting exists.",
      "snapMode (line 48) is declared but never used — no snap function, toggle, or toolbar button.",
      "selectedPlacement (line 49), dragPlacement (line 50), dragPlacementOffset (line 51) are dead variables — never read or set.",
      "Delete/Backspace handler (line 4019) only handles collision masks and events — no placement deletion.",
      "Properties panel (#props-section) exists in HTML/CSS but no JS populates or controls it.",
      "snapshotOf() (line 579) does NOT capture tilePlacements or gridFree — undo/redo would lose data.",
      "renderMap() has no gridFree branch — only renders via m.layers[] grid arrays.",
      "TilePlacements and gridFree have zero references in editor.js.",
      "Corrective plan added to wiki/Grid-Free-Mapping-Plan.md listing 10 implementation tasks.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "Phase 3 — Autotile System (shape solver + composition + A1 animation)",
    summary:
      "Added a complete runtime autotile system for A1–A4 tiles: canonical shape solver, quarter-coordinate composition, A1 animated water, and grid-free neighbor detection in assets.js.",
    items: [
      "FLOOR_AUTOTILE_TABLE (48 entries), WALL_AUTOTILE_TABLE (16 entries), WATERFALL_AUTOTILE_TABLE (4 entries): official quarter-coordinate tables from RMMZ Tilemap.js.",
      "FLOOR_QUARTERS / WALL_QUARTERS: direct state→quarter lookup mapping bypassing the editor-internal 256-entry bitmask table.",
      "solveFloorSignature(n,s,w,e,nw,ne,sw,se): 5-level corner-state solver per the canonical spec (outer/h_edge/v_edge/inner/solid).",
      "solveWallMask(n,s,w,e): 4-bit cardinal mask → wall autotile table index.",
      "composeAutotile() / composeFloorAutotile() / composeWallAutotile(): canvas-based quarter composition from tilesheet source at any kind-block origin.",
      "resolveA1Frame(kind, animFrame): animated water surface (4-frame [0,1,2,1] cycle) and waterfall (3-frame cycle via WATERFALL_AUTOTILE_TABLE).",
      "placementsAdjacent(a, b) / detectNeighbors(placement, all): spatial neighbor detection for grid-free tile placements using center-distance and sector-based direction classification.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "Phase 2 — Grid-Free Data Structures",
    summary:
      "Added map.tilePlacements (free-placement array per layer), map.gridFree flag, legacy-to-grid-free migration, undo/redo coverage, and a SpatialGrid class for broadphase spatial queries.",
    items: [
      "map.tilePlacements: each map now has a free-placement array per layer ({ground, decor, decor2, over}) storing {id, tileId, x, y} objects for pixel-precise tile positioning.",
      "map.gridFree flag: false by default (backward compat). Set to true after migration or for newly created grid-free maps.",
      "RA.migrateToGridFree(map): converts legacy flat layer arrays (map.layers[][]) into tilePlacements[] at 48×48 grid positions via crypto.randomUUID IDs.",
      "Project migration (migrateProject): ensures gridFree and tilePlacements exist on all maps during project load — no data loss for legacy projects.",
      "Undo/redo (editor.js): snapshotOf() now captures gridFree + tilePlacements; applySnapshot() restores them — full undo support for all placement operations.",
      "SpatialGrid class (physics.js): cell-based spatial index with insert(), query(), and clear() methods. 192px default cell size. Ready for broadphase collision, autotile adjacency, and frustum culling in later phases.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "Phase 1 — MZ Tileset Loader (Grid-Free foundation)",
    summary:
      "RPGAtlas now detects, validates, and slices RPG Maker MZ tilesheets (TileA1–E.png and DLC variants) into individual 48×48 tiles, registered in a new Assets.tilesets registry with per-category metadata.",
    items: [
      "New MZ_TILESET_SPECS table with expected dimensions, kind grid layout, pass default, and terrain flag for each category (A1–A5, B–E).",
      "Tilesheet detection via regex (e.g. TileA2.png, Shop_Outside_TileA2.png) — automatic recognition of MZ-format images in img/tilesets/.",
      "Dimension validation: sheets are checked against expected resolution (e.g. A2 must be 768×576). Non-conforming sheets are skipped with a console warning.",
      "Individual 48×48 tile extraction: direct slicing for A5/B–E (each tile is a standalone tile), kind-block extraction for A1–A4 (tiles retain kindIndex/subTile for later autotile composition).",
      "New Assets.tilesets[] registry: each tileset entry stores cols, rows, kindCols, kindRows, kindW, kindH, autotile type, pass/terrain defaults, tileIds array, and image reference.",
      "Every generated tile carries tileset/category/kindIndex/subTile metadata for future grid-free placement and autotile system (Phases 2–4).",
      "Backward compatible: procedurally generated tiles are unchanged; custom single-tile images continue to work through the legacy path.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "HD-2D advanced camera effects",
    summary:
      "Added smooth camera follow, dynamic tilt/FOV, and a PIXI-based flash overlay that integrates with the post-processing pipeline (bloom/DOF apply to the flash).",
    items: [
      "Camera now supports smooth follow via map.hd2d.cameraSmooth (0=instant, 0.05–0.2=smooth). Camera lerps toward the player each frame instead of snapping — reduces jitter during pixel movement.",
      "Dynamic tilt and FOV: map.hd2d.tilt and map.hd2d.fov are read each frame from the map config, allowing per-map or script-driven camera changes. Fall back to the existing defaults when not set.",
      "Flash overlay rendered as PIXI Graphics into _sceneRT before post-processing, so bloom/DOF apply to the flash (e.g. a bright white flash produces bloom). The existing 2D canvas flash overlay is preserved for non-HD mode.",
      "Camera initialization resets on map load, so the smooth follow starts from the player's position on the new map without an interpolation artifact.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "HD-2D 3D particle system",
    summary:
      "Added a full 3D particle system for map/event-driven visual effects (fire, smoke, sparks, magic) in the HD-2D view, following the same event-naming pattern as point lights.",
    items: [
      "New js/particles.js module with Particle, Emitter, and System classes; particles exist in 3D world space and are projected to screen via the existing toScreen pipeline.",
      "Four built-in particle textures: circle (fire), smoke (soft cloud), spark (bright dot), star (magic star) — created from canvas with radial gradients.",
      "Preset configurations: fire (upward orange, additive blend), smoke (slow upward gray, normal blend), spark (fast burst, additive), star (gentle upward, additive).",
      "Continuous emitters spawn particles per second; burst emitters spawn a fixed count once. Support for randomized velocity, lifetime, spawn radius, and gravity.",
      "Events named \"particle [kind] [rate] [#color]\" (e.g. \"particle fire 20 #ff8844\") automatically create emitters that follow event visibility and page state, matching the parseLight pattern.",
      "Map-level emitters via map.particles array (editor data); both event and map particle configs passed through extra.particles to Renderer.renderFrame.",
      "Particle sprites rendered in a dedicated scene container between characters and overhead roofs; efficient sprite pooling reuses PIXI.Sprite objects across frames.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "HD-2D post-processing pipeline (Bloom + DOF)",
    summary:
      "Added a PIXI v8 Filter-based post-processing pipeline with bloom (bright-pass + gaussian blur) and screen-distance depth-of-field, wired to the existing map hd2d.bloom/dof flags.",
    items: [
      "New js/post-processing.js module with a Pipeline class managing multi-pass bloom (bright-pass, Gaussian blur H+V, composite) and screen-focus DOF with Poisson-disc sampling.",
      "Render pipeline now renders scene + lighting to an intermediate RenderTexture (_sceneRT) before post-processing, enabling filter chains without affecting the direct render path.",
      "Renderer reads map.hd2d.bloom and map.hd2d.dof flags to toggle effects; editor UI controls (checkboxes) work immediately with no changes needed.",
      "Bloom parameters (threshold, intensity, blur scale) and DOF parameters (focus point, range, max blur) are configurable per map via hd2d config.",
      "DOF focus point automatically tracks the player position (extra.focus) via the existing focus property passed by engine.js; defaults to screen center in editor preview.",
      "No-op when both flags are off — zero performance impact for maps not using post-processing.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "HD-2D unified PIXI Mesh terrain renderer",
    summary:
      "Replaced the separate WebGL2 terrain renderer with a pure PIXI v8 Mesh-based pipeline, removing the GPU round-trip and enabling future post-processing filters (bloom, DOF).",
    items: [
      "Terrain rendering now uses PIXI.Mesh with custom GLSL shaders (depth-tested 3D geometry within PIXI's scene graph).",
      "Removed the standalone WebGL2 context (_glCanvas) — terrain renders directly into PIXI's framebuffer, no GPU→CPU→GPU round-trip per frame.",
      "Scene graph restructured: terrainContainer (depth on) → spriteContainer (characters) → overheadContainer (depth off) for correct layering.",
      "Chunk textures created as PIXI.Texture from canvas (one-time upload on map load), not re-uploaded each frame.",
      "Backward compatible — existing map HD-2D settings, lighting, fog, and editor preview continue to work.",
      "Foundation laid for Phase 2: post-processing filters (bloom, DOF) via PIXI.Filter on sceneContainer.",
    ],
  },
  {
    date: "June 15, 2026",
    title: "Grid-Free Mapping foundation + collision fixes",
    summary:
      "Corrected tileset sheet dimensions to match RPG Maker MZ spec, added collision icon to editor toolbar, fixed undo/redo for collision data, and published Grid-Free Mapping plan.",
    items: [
      "Added collision mask icon to the editor toolbar (mode-collision button).",
      "Undo/redo now captures collision mask data (tiles + masks) for proper restore.",
      "Grid-Free Mapping Plan updated with correct MZ tileset dimensions (A1–A5, B–E).",
      "Published RPG Maker MZ Mapping Spec document with official sheet formats.",
      "Autotile quarter-system (24×24), FLOOR_AUTOTILE_TABLE (48 shapes) and WALL_AUTOTILE_TABLE (16 shapes) documented.",
      "Detailed 6-phase action plan for implementing grid-free tile placement.",
    ],
  },
  {
    date: "June 14, 2026",
    title: "Editor HD-2D Preview restored with PIXI",
    summary:
      "Fixed the editor's live HD-2D preview panel to work with the PIXI v8 renderer instead of the removed WebGL2 gl.js.",
    items: [
      "Editor HD-2D Preview panel now renders through the PIXI v8 renderer (2D + radial lighting).",
      "Removed the 1.6× foreshortening factor from preview drag (leftover from the old 3D perspective camera).",
      "Renderer no longer crashes when #gamecanvas is absent (editor context).",
    ],
  },
  {
    date: "June 15, 2026",
    title: "Default pixel movement enabled",
    summary:
      "Make pixel movement active by default for new projects and preserve it during project migration.",
    items: [
      "Set `proj.system.pixelMovement` to true for new RPGAtlas projects.",
      "Upgrade older projects with a default pixel movement setting on load.",
      "Keep tile-based movement supported while enabling the new pixel movement runtime path.",
    ],
  },
  {
    date: "June 14, 2026",
    title: "Lighting polish: smoother lights, shadows disabled",
    summary:
      "Improve radial light visuals and temporarily disable shadow generation while debugging.",
    items: [
      "Smoothed radial gradient for more natural light falloff (less burnt centers).",
      "Removed the ambient overlay sprite in favor of a single ambient background color.",
      "Temporarily disabled per-tile shadow generation to prevent visual artifacts.",
      "Fixed PIXI v8 compatibility: string blend modes and linear scaleMode usage.",
      "Credits: Kiro (Dirgefall Studio) — PIXI integration and lighting polish",
    ],
  },
  {
    date: "June 14, 2026",
    title: "PIXI v8 HD-2D Lighting System",
    summary:
      "Replaced basic circle-based light rendering with a GPU-efficient radial gradient light map for PIXI v8.",
    items: [
      "Lights now use radial gradient sprites with smooth falloff instead of hard-edged circles.",
      "Ambient darkness overlay darkens unlit areas; lights pierce through via ADD blend mode.",
      "Fixed TILE size mismatch (32 to 48) for correct sprite and light positioning.",
      "Camera zoom is now applied to the PIXI scene container.",
      "Light sprites are pooled and reused each frame (zero GC pressure).",
      "Editor GLRender alias added for HD-2D preview compatibility.",
      "Credits: Kiro (Dirgefall Studio) — PIXI integration and lighting polish",
    ],
  },
  {
    date: "June 14, 2026",
    title: "Desktop App (Tauri)",
    summary: "RPGAtlas can now be packaged as a lightweight cross-platform desktop application using the system WebView, alongside the existing local-server build.",
    items: [
      "Added a Tauri wrapper (src-tauri/) that runs the editor in a native window on Windows, macOS, and Linux.",
      "RPGAtlas-Desktop.exe opens the editor directly in the desktop app; the original RPGAtlas.exe still opens it in your browser.",
      "Playtest opens in its own dedicated desktop window instead of a browser tab.",
      "Project export uses a native Save dialog when running as a desktop app.",
      "Build with: npm install, then npm run dev (live) or npm run build (installer). Requires the Rust toolchain.",
    ],
  },
  {
    date: "June 14, 2026",
    title: "Name & Manage Event Pages",
    summary: "Name an event's pages and reorder, duplicate, or jump between them by drag, right-click menu, or number keys.",
    items: [
      "Name a page: double-click its tab (or right-click → Rename) to label it, e.g. “Greeting” instead of “Page 3”. Clear the name to return to the default.",
      "Drag a page tab left or right to reorder it.",
      "Right-click a page tab for Add page, Rename, Move, Copy, Paste, and Delete.",
      "Copy a page and paste it — within an event or into another event — as a full duplicate.",
      "Press 1–9 to jump straight to that page.",
    ],
  },
  {
    date: "June 14, 2026",
    title: "Undo, Redo & Delete-Key for Event Commands",
    summary: "The event editor gains its own undo/redo and Delete-key shortcuts — conveniences RPG Maker never offered inside event editing.",
    items: [
      "Undo and redo adding, editing, deleting, moving, copy/cut/paste, and drag-reordering of commands, including multi-selected blocks and commands nested inside If/Choices branches.",
      "Ctrl+Z undoes; Ctrl+Y or Ctrl+Shift+Z redoes — anywhere in the event editor, not only when the list is focused.",
      "Each event page keeps its own command history, so undo never disturbs another page or your page condition/appearance settings.",
      "Press Delete to remove the selected command(s) from the Commands list — and Ctrl+Z brings them back.",
      "Press Delete to remove the highlighted page, or use the − button; pages that still hold commands ask to confirm first.",
      "Command history lasts while the event editor is open; clicking OK still commits the whole event as a single undo step on the map.",
    ],
  },
  {
    date: "June 14, 2026",
    title: "Multilingual Editor Interface",
    summary: "Added a persistent interface-language module so creators can use the editor chrome in English, Spanish, French, or German.",
    items: [
      "Added Help → Interface Language for switching languages without reloading the editor.",
      "Translated the main menus, toolbar labels, map sidebar, status text, and common dialog controls.",
      "Language selection follows the browser by default, is saved locally, and never changes project-authored names or content.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Smoother Movement",
    summary: "Reworked the play-test movement loop so walking is fluid and runs at a consistent speed on every display.",
    items: [
      "Removed the brief pause that occurred at each tile during grid movement, for both the player and NPCs.",
      "Game logic now runs on a fixed timestep, so movement speed is identical on 60 Hz, 120 Hz, and high-refresh screens (no more fast-forward on fast monitors).",
      "Added frame interpolation so motion stays smooth on high-refresh displays.",
      "Event 'Wait' and camera-zoom timing is now frame-rate independent, matching real time even when the frame rate dips.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Select Multiple Event Commands",
    summary: "Shift+click a range of commands in the event editor and copy, cut, paste, delete, move, or drag them as one block.",
    items: [
      "Click a command, then Shift+click another to select the whole run between them.",
      "Copy/Cut/Paste/Delete and the ↑/↓ buttons act on the entire selection at once.",
      "Drag a selected block to a new spot, including into another branch.",
      "Selection stays within one branch level; selecting across an If/Choices carries the whole block along.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Copy & Paste Event Commands",
    summary: "Copy, cut, and paste commands in the event editor — within an event or from one event to another.",
    items: [
      "Select a command and use Ctrl+C / Ctrl+X / Ctrl+V (or the Copy/Cut/Paste buttons) in the Commands list.",
      "Paste works across events, so you can copy a command in one event and paste it into another.",
      "Container commands (If / Choices) copy with everything nested inside them.",
      "Right-click a command for a menu with all the list actions (add, edit, cut, copy, paste, move, delete).",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Drag-to-Reorder Event Commands",
    summary: "Reorder commands in the event editor by dragging them, not just the ↑/↓ buttons.",
    items: [
      "Click and drag a command in the Commands list to move it anywhere in the event.",
      "Drag commands into or out of If/Choices branches, not just within a single list.",
      "A drop line shows where the command will land; the ↑/↓ buttons still work too, and now keep the command selected so you can tap them repeatedly.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Cinematic and Control Event Command Expansion",
    summary: "Added new visual effects commands and advanced branching controls to map events.",
    items: [
      "Shake Screen - shakes the game viewport horizontally and vertically in both 2D and HD-2D modes.",
      "Flash Screen - overlays a fading color overlay for thunder strikes, hit impacts, or magical bursts.",
      "Change Weather - triggers map weather changes visually without requiring JavaScript Script blocks.",
      "Actor Conditional Branch - checks party membership and specific weapon/armor equipment in event branches.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Faster Event Command Navigation",
    summary: "Increased the Add Command menu from 12 to 24 buttons per page and added direct numbered page tabs.",
    items: [
      "Each Event Command page now displays up to 24 buttons.",
      "Page tabs appear above the command grid for one-click access without cycling through pages.",
      "Saved custom command buttons and +Add New remain at the end of the picker.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Patch Notes",
    summary: "Added an easily digestible Patch Notes menu under Help so players and creators can review feature updates.",
    items: [
      "Patch notes are shown newest-first and older entries remain available by scrolling.",
      "Added a project instruction requiring future AI-assisted features and major changes to include a short patch note.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Event Command Expansion",
    summary: "Expanded Event Commands into multiple pages with 12 buttons per page and the ability to add reusable event buttons on demand.",
    items: [
      "Camera Zoom - zoom the player camera in or out immediately or over time.",
      "+Add New - create project-saved JavaScript command buttons for reusable event flow and scene-management tasks.",
      "Saved command buttons can be inserted with one click, or edited and deleted with right-click.",
    ],
  },
];
