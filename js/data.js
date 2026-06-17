/* RPGAtlas — data.js
   Project schema, defaults, and the bundled sample game.
   Copyright (C) 2026 RPGAtlas contributors — GPL-3.0-or-later (see LICENSE). */
"use strict";

(() => {
  const t = (k, v) => window.RPGAtlasI18n ? window.RPGAtlasI18n.t(k, v) : k;

  const RA = {
    MAX_SWITCHES: 1000,
    MAX_VARIABLES: 1000,
    TRAIT_TYPES: [
      { v: "param", l: t("data.param_modifier") },
      { v: "element", l: t("data.element_resistance") },
      { v: "state", l: t("data.state_resistance") },
      { v: "skill", l: t("data.skill_type_bonus") },
      { v: "equip", l: t("data.equip_permission") },
      { v: "special", l: t("data.special_combat") },
    ],
    TRAIT_ELEMENTS: [
      { v: "physical", l: t("data.physical") },
      { v: "fire", l: t("data.fire") },
      { v: "ice", l: t("data.ice") },
      { v: "thunder", l: t("data.thunder") },
      { v: "poison", l: t("data.poison") },
      { v: "magic", l: t("data.other_magic") },
    ],
    TRAIT_SPECIALS: [
      { v: "critChance", l: t("data.crit_chance") },
      { v: "mpCost", l: t("data.mp_cost") },
      { v: "guardDamage", l: t("data.guard_damage") },
      { v: "damageTaken", l: t("data.damage_taken") },
    ],
    // Default category names seeded into proj.system.types (the Database ▸ Types tab).
    WEAPON_TYPE_NAMES: [
      "Dagger",
      "Sword",
      "Axe",
      "Spear",
      "Bow",
      "Staff",
      "Wand",
      "Claw",
    ],
    ARMOR_TYPE_NAMES: [
      "General Armor",
      "Magic Armor",
      "Light Armor",
      "Heavy Armor",
      "Shield",
    ],
    EQUIP_TYPE_NAMES: [t("data.weapon"), t("data.shield"), t("data.head"), t("data.body"), t("data.accessory")],
    // Elements and skill types keep a stable string key (referenced by skills,
    // class traits and the combat engine) plus an editable display name. Weapon,
    // armor and equipment types are referenced by numeric id like the other lists.
    defaultTypes() {
      return {
        elements: this.TRAIT_ELEMENTS.map((e) => ({ key: e.v, name: e.l })),
        skillTypes: [
          { key: "phys", name: t("data.physical") },
          { key: "magic", name: t("data.magical") },
          { key: "heal", name: t("data.heal") },
        ],
        weaponTypes: this.WEAPON_TYPE_NAMES.map((n, i) => ({
          id: i + 1,
          name: n,
        })),
        armorTypes: this.ARMOR_TYPE_NAMES.map((n, i) => ({ id: i + 1, name: n })),
        equipTypes: this.EQUIP_TYPE_NAMES.map((n, i) => ({ id: i + 1, name: n })),
      };
    },
    // Read one type list from a project, falling back to the defaults so older
    // saves (and the combat engine) keep working before a migration runs.
    typeList(p, kind) {
      const types = p && p.system && p.system.types;
      if (types && Array.isArray(types[kind]) && types[kind].length)
        return types[kind];
      return this.defaultTypes()[kind];
    },
    byId(arr, id) {
      return arr ? arr.find((e) => e && e.id === id) || null : null;
    },
    nextId(arr) {
      return arr.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    },
    clone(o) {
      return JSON.parse(JSON.stringify(o));
    },
    traitsOf(cls, type, key) {
      return ((cls && cls.traits) || []).filter(
        (t) =>
          t && t.type === type && (key == null || String(t.key) === String(key)),
      );
    },
    traitRate(cls, type, key, fallback) {
      const list = this.traitsOf(cls, type, key);
      if (!list.length) return fallback == null ? 1 : fallback;
      return list.reduce(
        (rate, t) => (rate * Math.max(0, Number(t.value) || 0)) / 100,
        1,
      );
    },
    traitSum(cls, type, key, fallback) {
      const list = this.traitsOf(cls, type, key);
      if (!list.length) return fallback == null ? 0 : fallback;
      return list.reduce((sum, t) => sum + (Number(t.value) || 0), 0);
    },
    canEquip(cls, kind, itemId) {
      if (!itemId) return true;
      const rules = this.traitsOf(cls, "equip", kind);
      return (
        !rules.length || rules.some((t) => Number(t.value) === Number(itemId))
      );
    },
    elementOfSkill(skill) {
      if (!skill || skill.type === "phys") return "physical";
      if (skill.element) return skill.element;
      const name = String(skill.name || "").toLowerCase();
      if (name.includes("fire") || name.includes("ember")) return "fire";
      if (name.includes("ice")) return "ice";
      if (name.includes("thunder") || name.includes("static")) return "thunder";
      if (name.includes("venom") || name.includes("spore") || skill.stateId === 1)
        return "poison";
      return "magic";
    },
    // copyright-safe font stacks offered by the System tab (generic CSS families only)
    FONTS: [
      { v: '"Segoe UI", system-ui, sans-serif', l: "Default (system sans)" },
      { v: 'Georgia, "Times New Roman", serif', l: "Serif (Georgia)" },
      {
        v: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
        l: "Book serif (Palatino)",
      },
      { v: '"Trebuchet MS", Verdana, sans-serif', l: "Rounded sans (Trebuchet)" },
      { v: 'Consolas, "Courier New", monospace', l: "Monospace (Consolas)" },
      { v: '"Comic Sans MS", "Segoe Print", cursive', l: "Casual (Comic Sans)" },
      { v: '"Arial Black", Impact, sans-serif', l: "Display (Arial Black)" },
      { v: "fantasy", l: "Fantasy (browser pick)" },
    ],
    // logical UI sounds the engine plays; each maps to any procedural SE name
    SYSTEM_SOUNDS: [
      { key: "cursor", label: "Cursor move", def: "cursor" },
      { key: "ok", label: "Confirm / OK", def: "ok" },
      { key: "cancel", label: "Cancel", def: "cancel" },
      { key: "buzzer", label: "Buzzer (invalid)", def: "buzzer" },
      { key: "equip", label: "Equip / buy item", def: "item" },
      { key: "heal", label: "Use recovery item", def: "heal" },
      { key: "save", label: "Save / load game", def: "save" },
      { key: "encounter", label: "Battle start", def: "encounter" },
      { key: "escape", label: "Escape battle", def: "escape" },
      { key: "levelup", label: "Level up / victory", def: "levelup" },
      { key: "gameover", label: "Game over", def: "gameover" },
    ],
    defaultSounds() {
      const o = {};
      for (const s of this.SYSTEM_SOUNDS) o[s.key] = s.def;
      return o;
    },
    defaultMusic() {
      return { title: "title", battle: "battle" };
    },
    defaultStates() {
      return [
        {
          id: 1,
          name: "Poison",
          icon: 12,
          color: "#a050d8",
          restrict: "none",
          hpTurn: -12,
          minTurns: 3,
          maxTurns: 5,
          removeAtEnd: true,
        },
        {
          id: 2,
          name: "Stun",
          icon: 10,
          color: "#e8d44f",
          restrict: "act",
          hpTurn: 0,
          minTurns: 1,
          maxTurns: 2,
          removeAtEnd: true,
        },
        {
          id: 3,
          name: "Regen",
          icon: 11,
          color: "#70e090",
          restrict: "none",
          hpTurn: 8,
          minTurns: 3,
          maxTurns: 4,
          removeAtEnd: true,
        },
      ];
    },
    // upgrade older projects in place (adds the decor2 layer, shadows,
    // passability overrides, plugins and custom characters)
    migrateProject(p) {
      if (!p || !p.meta) return p;
      p.meta.engine = "rpgatlas"; // also adopts pre-rebrand "driftwood" projects
      p.meta.version = 3;
      p.plugins = p.plugins || [];
      p.quests = p.quests || [];
      p.customChars = p.customChars || [];
      p.commandPresets = Array.isArray(p.commandPresets) ? p.commandPresets : [];
      p.assets = p.assets || {};
      p.assets.tiles = p.assets.tiles || {};
      p.tilesets = p.tilesets || {};
      p.system = p.system || {};
      if (!Array.isArray(p.system.switches)) p.system.switches = [];
      if (!Array.isArray(p.system.variables)) p.system.variables = [];
      // v3 system options (screen, UI, fonts, sounds, transparency, battle view)
      const sys = p.system;
      if (sys.startTransparent == null) sys.startTransparent = false;
      if (!sys.battleView) sys.battleView = "side";
      if (!sys.screenWidth) sys.screenWidth = 816;
      if (!sys.screenHeight) sys.screenHeight = 624;
      if (sys.uiWidth == null) sys.uiWidth = 0;
      if (sys.uiHeight == null) sys.uiHeight = 0;
      if (!sys.screenScale) sys.screenScale = 1.6;
      if (!sys.fontText) sys.fontText = RA.FONTS[0].v;
      if (!sys.fontMenu) sys.fontMenu = RA.FONTS[0].v;
      if (!sys.fontSize) sys.fontSize = 15;
      if (sys.windowOpacity == null) sys.windowOpacity = 93;
      if (sys.pixelMovement == null) sys.pixelMovement = true;
      sys.sounds = Object.assign(RA.defaultSounds(), sys.sounds || {});
      sys.music = Object.assign(RA.defaultMusic(), sys.music || {});
      // v3 element/skill/weapon/armor/equipment type lists (Database ▸ Types)
      const defTypes = RA.defaultTypes();
      sys.types = sys.types || {};
      for (const k of Object.keys(defTypes)) {
        if (!Array.isArray(sys.types[k]) || !sys.types[k].length)
          sys.types[k] = defTypes[k];
      }
      if (!Array.isArray(p.states)) p.states = RA.defaultStates();
      p.quests = (p.quests || []).filter((q) => q && typeof q === "object").map((q) => {
        const next = Object.assign({
          name: "Quest",
          shortDesc: "",
          desc: "",
          category: "side",
          visible: true,
          objectives: [],
          startReqs: [],
          failConditions: [],
          rewards: [],
          failEffects: [],
          failText: "",
          nextQuestIds: [],
          autoStartNext: false,
          allowRestartOnFail: false,
          canAbandon: false,
        }, q);
        next.objectives = (next.objectives || []).filter((obj) => obj && typeof obj === "object").map((obj) => Object.assign({
          kind: "event",
          label: "",
          count: 1,
          enemyId: 0,
          itemKind: "item",
          id: 0,
          targetMapId: 0,
          targetEventId: 0,
          consumeOnComplete: false,
        }, obj));
        next.failConditions = (next.failConditions || []).filter((fc) => fc && typeof fc === "object").map((fc) => Object.assign({
          kind: "manual",
          id: 0,
          val: true,
          cmp: ">=",
          troopId: 0,
          enemyId: 0,
          count: 1,
        }, fc));
        if (!Array.isArray(next.startReqs)) next.startReqs = [];
        if (!Array.isArray(next.failConditions)) next.failConditions = [];
        if (!Array.isArray(next.rewards)) next.rewards = [];
        if (!Array.isArray(next.failEffects)) next.failEffects = [];
        if (!Array.isArray(next.nextQuestIds)) next.nextQuestIds = [];
        return next;
      });
      for (const c of p.classes || []) {
        if (!Array.isArray(c.traits)) c.traits = [];
        c.traits = c.traits
          .filter((t) => t && typeof t === "object")
          .map((t) => ({
            type: String(t.type || "param"),
            key: String(t.key || "atk"),
            value: Number(t.value == null ? 100 : t.value),
          }));
      }
      for (const skill of p.skills || []) {
        if (!skill.element) skill.element = RA.elementOfSkill(skill);
      }
      const iconDefaults = {
        classes: [0, 1, 2, 3],
        skills: [8, 11, 9, 18, 10, 15],
        items: [24, 27, 25, 31],
        weapons: [48, 49, 51, 52],
        armors: [56, 57, 58, 61],
      };
      for (const [key, defaults] of Object.entries(iconDefaults)) {
        for (let i = 0; i < (p[key] || []).length; i++) {
          if (p[key][i].icon == null)
            p[key][i].icon = defaults[i % defaults.length];
        }
      }
      // v4 migration: convert tilesets from object to RMMV array format
      if (p.tilesets && !Array.isArray(p.tilesets)) {
        const obj = p.tilesets;
        const arr = [null];
        let idx = 1;
        for (const key of Object.keys(obj)) {
          const entry = obj[key];
          // Build RMMV-style tileset entry from old format
          const tilesetNames = ["","","","","","","","",""];
          const catOrder = ["A1","A2","A3","A4","A5","B","C","D","E"];
          const catIdx = catOrder.indexOf(entry.category || "B");
          if (catIdx >= 0) tilesetNames[catIdx] = (entry.file || key).replace(/\.png$/i, "");
          arr[idx] = {
            id: idx,
            name: key,
            mode: 1,
            note: "",
            tilesetNames: tilesetNames,
            flags: entry.tileFlags || new Array(2048).fill(0x0010),
          };
          idx++;
        }
        p.tilesets = arr;
      }

      for (const m of p.maps || []) {
        const n = m.width * m.height;
        // v4 migration: convert old layers[] + gridFree format to RMMV data[]
        if (m.layers && !m.data) {
          const oldLayers = m.layers;
          const dataLen = n * 4;
          const data = new Array(dataLen).fill(0);
          const layerKeys = ["ground","decor","decor2","over"];
          for (let li = 0; li < 4; li++) {
            const lk = layerKeys[li];
            const src = oldLayers[lk];
            if (!src || src.length !== n) continue;
            for (let i = 0; i < n; i++) {
              // Convert old global tile IDs to RMMV tile IDs.
              // Old IDs were indexes into Assets.tiles[] — we convert by taking
              // the tile's tilesetX/Y and computing the RMMV ID.
              // Fallback: use 2048 (A1 base) for ground, 0 for others.
              const oldId = src[i];
              data[i * 4 + li] = oldId ? oldId + 2048 : (li === 0 ? 2048 : 0);
            }
          }
          m.data = data;
          delete m.layers;
          delete m.shadows;
          delete m.passOv;
          delete m.heights;
          delete m.collision;
          delete m.gridFree;
          delete m.tilePlacements;
          delete m.music;
          // Ensure RMMV fields
          m.tilesetId = m.tilesetId || 1;
          m.autoplayBgm = m.autoplayBgm || false;
          m.autoplayBgs = m.autoplayBgs || false;
          m.battleback1Name = m.battleback1Name || "";
          m.battleback2Name = m.battleback2Name || "";
          m.bgm = m.bgm || {name:"",pan:0,pitch:100,volume:90};
          m.bgs = m.bgs || {name:"",pan:0,pitch:100,volume:90};
          m.disableDashing = m.disableDashing || false;
          m.displayName = m.displayName || "";
          m.encounterList = m.encounterList || [];
          m.encounterStep = m.encounterStep || 30;
          m.note = m.note || "";
          m.parallaxLoopX = m.parallaxLoopX || false;
          m.parallaxLoopY = m.parallaxLoopY || false;
          m.parallaxName = m.parallaxName || "";
          m.parallaxShow = m.parallaxShow || false;
          m.parallaxSx = m.parallaxSx || 0;
          m.parallaxSy = m.parallaxSy || 0;
          m.scrollType = m.scrollType || 0;
          m.specifyBattleback = m.specifyBattleback || false;
        }
      }
      // Pre-rebrand projects carry Drift_* built-ins: rename them to Atlas_* and
      // refresh their engine-maintained code (Atlas_Core keeps a window.Drift
      // alias so old Script commands keep working).
      if (typeof AtlasBuiltins !== "undefined") {
        for (const pl of p.plugins) {
          if (!pl || typeof pl.key !== "string" || pl.key.indexOf("Drift_") !== 0)
            continue;
          const spec = AtlasBuiltins.specByKey(
            pl.key.replace("Drift_", "Atlas_"),
          );
          if (!spec) continue;
          if (pl.name === pl.key) pl.name = spec.key;
          pl.key = spec.key;
          if (pl.builtin) pl.code = AtlasBuiltins.bodyOf(spec.fn);
        }
      }
      // Install the engine's bundled plugins once, so existing projects gain them
      // too. We only seed missing ones, and only the first time — a deliberately
      // removed built-in stays removed.
      if (!p.meta.builtinsSeeded && typeof AtlasBuiltins !== "undefined") {
        let nextId =
          (p.plugins.reduce((mx, pl) => Math.max(mx, pl.id || 0), 0) || 0) + 1;
        for (const spec of AtlasBuiltins.missingFor(p.plugins)) {
          p.plugins.push(AtlasBuiltins.make(spec.key, nextId++));
        }
        p.meta.builtinsSeeded = true;
      }
      return p;
    },
    // Convert a legacy grid-based map (map.layers[]) to grid-free (map.tilePlacements[]).
    // Returns true if conversion happened, false if already grid-free or no map given.
    migrateToGridFree(map) {
      if (!map || map.gridFree || !map.layers) return false;
      const n = map.width * map.height;
      const placeholders = { ground: [], decor: [], decor2: [], over: [] };
      for (const ln of ["ground", "decor", "decor2", "over"]) {
        const arr = map.layers[ln] || [];
        for (let ty = 0; ty < map.height; ty++) {
          for (let tx = 0; tx < map.width; tx++) {
            const tileId = arr[ty * map.width + tx];
            if (tileId && tileId > 0) {
              placeholders[ln].push({
                id: crypto.randomUUID ? crypto.randomUUID() : "p_" + (ty * map.width + tx) + "_" + ln,
                tileId: tileId,
                x: tx * 48,
                y: ty * 48,
              });
            }
          }
        }
      }
      map.tilePlacements = placeholders;
      map.gridFree = true;
      return true;
    },
  };

  const DataDefaults = (() => {
    const T = (typeof Assets !== "undefined" ? Assets.T : {});

    function newMap(id, name, width, height) {
      const n = width * height;
      const dataLen = n * 4;
      const data = new Array(dataLen).fill(0);
      // Preencher layer 0 (ground) com tile A1 base (2048) por default
      for (let i = 0; i < n; i++) data[i * 4] = 2048;
      return {
        id,
        name,
        width,
        height,
        tilesetId: 1,
        data,
        events: [],
        autoplayBgm: false,
        autoplayBgs: false,
        battleback1Name: "",
        battleback2Name: "",
        bgm: { name: "", pan: 0, pitch: 100, volume: 90 },
        bgs: { name: "", pan: 0, pitch: 100, volume: 90 },
        disableDashing: false,
        displayName: "",
        encounterList: [],
        encounterStep: 30,
        note: "",
        parallaxLoopX: false,
        parallaxLoopY: false,
        parallaxName: "",
        parallaxShow: false,
        parallaxSx: 0,
        parallaxSy: 0,
        scrollType: 0,
        specifyBattleback: false,
      };
    }

    function newProject() {
      return {
        meta: { engine: "rpgatlas", version: 3, builtinsSeeded: true },
        system: {
          title: "Untitled RPG",
          startMapId: 1,
          startX: 10,
          startY: 10,
          startDir: 3,
          party: [1],
          startGold: 100,
          currency: "G",
          switches: [""],
          variables: [""],
          startTransparent: false,
          battleView: "side",
          screenWidth: 816,
          screenHeight: 624,
          uiWidth: 0,
          uiHeight: 0,
          screenScale: 1.6,
          fontText: "\"Segoe UI\", system-ui, sans-serif",
          fontMenu: "\"Segoe UI\", system-ui, sans-serif",
          fontSize: 15,
          windowOpacity: 93,
          pixelMovement: true,
          sounds: {
            cursor: "cursor",
            ok: "ok",
            cancel: "cancel",
            buzzer: "buzzer",
            equip: "item",
            heal: "heal",
            save: "save",
            encounter: "encounter",
            escape: "escape",
            levelup: "levelup",
            gameover: "gameover"
          },
          music: {
            title: "title",
            battle: "battle"
          },
          types: RA.defaultTypes()
        },
        plugins: [],
        quests: [],
        customChars: [],
        commandPresets: [],
        assets: { tiles: {} },
        tilesets: [null]
      };
    }

    function newPage() {
      return {
        name: "",
        cond: {
          switchId: 0, varId: 0, varVal: 0, selfSw: "",
          questId: 0, questStatus: "active",
          objectiveQuestId: 0, objectiveIndex: 0, objectiveStatus: "completed",
        },
        charset: "", dir: 0,
        moveType: "fixed", trigger: "action", priority: "same", through: false,
        commands: [],
      };
    }

    function newEvent(id, x, y, name) {
      return {
        id,
        name: name || "EV" + String(id).padStart(3, "0"),
        x,
        y,
        pages: [newPage()],
      };
    }

    // ---- map building helpers (sample game) ----
    function L(map, layer) {
      return map.layers ? map.layers[layer] : null;
    }
    function set(map, layer, x, y, t) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
      if (map.data) {
        var li = 0;
        if (layer === "ground") li = 0;
        else if (layer === "decor") li = 1;
        else if (layer === "decor2") li = 2;
        else if (layer === "over") li = 3;
        map.data[(y * map.width + x) * 4 + li] = t;
      } else {
        L(map, layer)[y * map.width + x] = t;
      }
    }
    function fillRect(map, layer, x1, y1, x2, y2, t) {
      for (let y = y1; y <= y2; y++)
        for (let x = x1; x <= x2; x++) set(map, layer, x, y, t);
    }
    function shadowCol(map, x, y1, y2, mask) {
      for (let y = y1; y <= y2; y++) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        map.shadows[y * map.width + x] |= mask;
      }
    }
    function ev(map, x, y, name, pageSetup) {
      const e = newEvent(RA.nextId(map.events), x, y, name);
      pageSetup(e);
      map.events.push(e);
      return e;
    }
    function page(opts, commands) {
      const p = newPage();
      Object.assign(p, opts);
      if (opts.cond) p.cond = Object.assign(newPage().cond, opts.cond);
      p.commands = commands || [];
      return p;
    }

    // ---------- sample maps ----------
    function buildVillage() {
      const m = newMap(1, "Meridian Village", 24, 17, T.grass);
      m.music = "town";
      // scattered flora
      const r = (() => {
        let s = 99;
        return () => {
          s = (s * 1664525 + 1013904223) >>> 0;
          return s / 4294967296;
        };
      })();
      for (let y = 0; y < 17; y++)
        for (let x = 0; x < 24; x++) {
          const v = r();
          if (v < 0.06) set(m, "ground", x, y, T.flowers);
          else if (v < 0.12) set(m, "ground", x, y, T.tallgrass);
        }
      // tree border
      for (let x = 0; x < 24; x++) {
        set(m, "decor", x, 0, T.tree);
        set(m, "decor", x, 16, T.tree);
      }
      for (let y = 0; y < 17; y++) {
        set(m, "decor", 0, y, T.tree);
        set(m, "decor", 23, y, T.tree);
      }
      set(m, "decor", 12, 0, 0); // north gap → cave
      // pond
      fillRect(m, "ground", 3, 11, 7, 14, T.water);
      fillRect(m, "ground", 4, 12, 6, 13, T.deepwater);
      fillRect(m, "ground", 3, 10, 7, 10, T.sand);
      // paths
      fillRect(m, "ground", 12, 0, 12, 16, T.path);
      fillRect(m, "ground", 1, 9, 22, 9, T.path);
      // house A (red roof, enterable)
      fillRect(m, "ground", 15, 3, 20, 6, T.dirt);
      fillRect(m, "decor", 15, 3, 20, 4, T.roof_red);
      fillRect(m, "decor", 15, 5, 20, 6, T.wall_wood);
      set(m, "decor", 17, 6, T.door);
      set(m, "decor", 19, 6, T.window);
      // house B (blue roof, locked)
      fillRect(m, "ground", 4, 2, 8, 4, T.dirt);
      fillRect(m, "decor", 4, 2, 8, 2, T.roof_blue);
      fillRect(m, "decor", 4, 3, 8, 4, T.wall_brick);
      set(m, "decor", 6, 4, T.door);
      set(m, "decor", 7, 4, T.window);
      // soft shadows along the east walls of the houses (left half of the next tile)
      shadowCol(m, 21, 4, 6, 1 | 4);
      shadowCol(m, 9, 3, 4, 1 | 4);
      // dressing
      set(m, "decor", 14, 7, T.fence);
      set(m, "decor", 15, 7, T.fence);
      set(m, "decor", 16, 7, T.fence);
      set(m, "decor", 21, 6, T.barrel);
      set(m, "decor", 2, 6, T.bush);
      set(m, "decor", 10, 3, T.rock);
      set(m, "decor", 18, 12, T.tree);
      set(m, "decor", 19, 13, T.tree);
      set(m, "decor", 17, 14, T.pine);
      set(m, "decor", 9, 12, T.pine);

      // HD-2D config (enable PIXI rendering path)
      m.hd2d = {
        enabled: true,
        tilt: 50,
        bloom: false,
        dof: false,
        fog: false,
        lights: true,
        ambient: 0.45,
      };
      // Light test
      m.lights = [{ rx: 12, ry: 8, color: "#FFFF00", radius: 64 }];

      // ---- events ----
      ev(m, 13, 8, "Elder", (e) => {
        e.pages[0] = page({ charset: "elder", moveType: "fixed", trigger: "action" }, [
          { t: "text", name: "Elder Rowan", text: "Welcome to \\c[2]Meridian Village\\c[0], traveler.\nBefore you head north, would you greet our merchant\nand make sure his supply crates arrived?" },
          { t: "questStart", questId: 1 },
          { t: "text", name: "", text: "Started quest: Market Introduction" },
          { t: "text", name: "Elder Rowan", text: "Press [b]Z[/b] or [b]Enter[/b] to talk and confirm.\nPress [b]X[/b] or [b]Esc[/b] to open the menu." },
        ]);
        e.pages.push(page({ cond: { questId: 1, questStatus: "active" }, charset: "elder", moveType: "fixed", trigger: "action" }, [
          { t: "text", name: "Elder Rowan", text: "Please check in with our merchant by the crossroads.\nHe has supplies waiting for the village." },
        ]));
        e.pages.push(page({ cond: { questId: 1, questStatus: "completed" }, charset: "elder", moveType: "fixed", trigger: "action" }, [
          { t: "text", name: "Elder Rowan", text: "You've already helped the village settle in.\nTilda has been asking after you as well." },
        ]));
        e.pages.push(page({ cond: { questId: 4, questStatus: "active" }, charset: "elder", moveType: "fixed", trigger: "action" }, [
          { t: "text", name: "Elder Rowan", text: "So Vale sent you with the news? I appreciate the honesty." },
          { t: "questAdvanceObj", questId: 4, objIndex: 0, amount: 1 },
          { t: "questComplete", questId: 4 },
        ]));
      });
      ev(m, 10, 11, "Hunter Vale", (e) => {
        e.pages[0] = page({ charset: "villager_m", moveType: "random", trigger: "action" }, [
          { t: "text", name: "Hunter Vale", text: "The pond is lovely this time of year.\nJust don't fall in \\i[15]!" },
        ]);
        e.pages.push(page({ cond: { questId: 3, questStatus: "active" }, charset: "villager_m", moveType: "random", trigger: "action" }, [
          { t: "text", name: "Hunter Vale", text: "Have you dealt with two dusk wolves in the cave yet?" },
        ]));
        e.pages.push(page({ cond: { questId: 3, questStatus: "active", objectiveQuestId: 3, objectiveIndex: 0, objectiveStatus: "completed" }, charset: "villager_m", moveType: "random", trigger: "action" }, [
          { t: "text", name: "Hunter Vale", text: "You really did it? Excellent work.\nI'll pay you right away." },
          { t: "questComplete", questId: 3 },
        ]));
        e.pages.push(page({ cond: { questId: 3, questStatus: "completed" }, charset: "villager_m", moveType: "random", trigger: "action" }, [
          { t: "text", name: "Hunter Vale", text: "Those dusk wolves won't trouble the road for a while.\nYou have my thanks." },
        ]));
        e.pages.push(page({ cond: { questId: 3, questStatus: "failed" }, charset: "villager_m", moveType: "random", trigger: "action" }, [
          { t: "if", cond: { kind: "quest", questId: 4, status: "completed" }, then: [
            { t: "text", name: "Hunter Vale", text: "Elder Rowan took the news better than I expected.\nThank you for smoothing things over." },
          ], else: [
            { t: "if", cond: { kind: "quest", questId: 4, status: "active" }, then: [
              { t: "text", name: "Hunter Vale", text: "Please tell Elder Rowan I had to hire another sword.\nI hate leaving him in the dark." },
            ], else: [
              { t: "text", name: "Hunter Vale", text: "I had to hire another hunter after those defeats.\nWould you at least carry the news back to Elder Rowan?" },
              { t: "questStart", questId: 4 },
            ] },
          ] },
        ]));
      });
      ev(m, 11, 8, "Sign", (e) => {
        e.pages[0] = page(
          { charset: "sign", trigger: "action", priority: "same" },
          [
            {
              t: "text",
              name: "",
              text: "— Meridian Village —\nNorth: Whispering Cave",
            },
          ],
        );
      });
      ev(m, 21, 4, "Chest", (e) => {
        e.pages[0] = page({ charset: "chest", trigger: "action" }, [
          { t: "se", name: "chest" },
          { t: "item", kind: "item", id: 1, op: "add", val: 2 },
          { t: "text", name: "", text: "Found 2 Potions!" },
          { t: "selfsw", key: "A", val: true },
        ]);
        e.pages.push(
          page(
            { cond: { selfSw: "A" }, charset: "chest_open", trigger: "action" },
            [{ t: "text", name: "", text: "The chest is empty." }],
          ),
        );
      });
      ev(m, 16, 8, "Merchant", (e) => {
        e.pages[0] = page({ charset: "merchant", trigger: "action" }, [
          { t: "if", cond: { kind: "quest", questId: 1, status: "active" }, then: [
            { t: "text", name: "Merchant", text: "Ah, Elder Rowan sent you? Good timing.\nThe supply crates made it in before sundown." },
            { t: "questAdvanceObj", questId: 1, objIndex: 0, amount: 1 },
            { t: "questComplete", questId: 1 },
            { t: "text", name: "Merchant", text: "If you see Tilda in the cottage, tell her I'm still selling Potions.\nShe looked worried earlier." },
          ], else: [] },
          { t: "text", name: "Merchant", text: "Welcome! Take a look at my wares." },
          { t: "shop", goods: [
            { kind: "item", id: 1 }, { kind: "item", id: 2 }, { kind: "item", id: 3 },
            { kind: "weapon", id: 1 }, { kind: "weapon", id: 2 }, { kind: "weapon", id: 3 },
            { kind: "armor", id: 1 }, { kind: "armor", id: 2 }, { kind: "armor", id: 3 },
          ] },
        ]);
      });
      ev(m, 6, 6, "Bren", (e) => {
        e.pages[0] = page({ charset: "cleric", trigger: "action" }, [
          {
            t: "text",
            name: "Bren",
            text: "I'm Bren, a wandering cleric.\nYou look like you could use a healer.",
          },
          {
            t: "choices",
            options: ["Join us!", "Not now"],
            branches: [
              [
                { t: "party", op: "add", actorId: 3 },
                { t: "se", name: "levelup" },
                { t: "text", name: "", text: "Bren joined the party!" },
                { t: "selfsw", key: "A", val: true },
              ],
              [
                {
                  t: "text",
                  name: "Bren",
                  text: "I'll be here if you change your mind.",
                },
              ],
            ],
          },
        ]);
        e.pages.push(
          page({ cond: { selfSw: "A" }, charset: "", trigger: "action" }, []),
        );
      });
      ev(m, 14, 10, "Save Crystal", (e) => {
        e.pages[0] = page(
          { charset: "savepoint", trigger: "action", priority: "below" },
          [
            { t: "se", name: "heal" },
            { t: "heal", full: true },
            { t: "text", name: "", text: "The party rests. HP and MP restored!" },
            { t: "save" },
          ],
        );
      });
      ev(m, 17, 6, "Door A", (e) => {
        e.pages[0] = page(
          { charset: "", trigger: "touch", priority: "below", through: true },
          [
            { t: "se", name: "door" },
            { t: "transfer", mapId: 3, x: 4, y: 6, dir: 3 },
          ],
        );
      });
      ev(m, 6, 4, "Door B", (e) => {
        e.pages[0] = page(
          { charset: "", trigger: "touch", priority: "below", through: true },
          [{ t: "text", name: "", text: "The door is locked." }],
        );
      });
      ev(m, 12, 0, "To Cave", (e) => {
        e.pages[0] = page(
          { charset: "", trigger: "touch", priority: "below", through: true },
          [
            // Atlas_Transitions: an iris wipe into the cave; Atlas_Weather adds fog there.
            { t: "script", code: "if (window.Atlas) Atlas.transition = 'iris';" },
            { t: "transfer", mapId: 2, x: 8, y: 10, dir: 3 },
          ],
        );
      });
      return m;
    }

    function buildCave() {
      const m = newMap(2, "Whispering Cave", 16, 12, T.cavefloor);
      m.music = "cave";
      m.encounters = { troops: [1, 2, 5, 6, 7, 8, 9, 10, 11], rate: 14 };
      // walls
      fillRect(m, "decor", 0, 0, 15, 0, T.cavewall);
      fillRect(m, "decor", 0, 11, 15, 11, T.cavewall);
      fillRect(m, "decor", 0, 0, 0, 11, T.cavewall);
      fillRect(m, "decor", 15, 0, 15, 11, T.cavewall);
      set(m, "decor", 8, 11, 0); // south exit
      // formations
      fillRect(m, "decor", 3, 3, 4, 4, T.cavewall);
      fillRect(m, "decor", 11, 6, 13, 7, T.cavewall);
      set(m, "decor", 5, 8, T.rock);
      set(m, "decor", 12, 2, T.rock);
      fillRect(m, "ground", 1, 9, 3, 10, T.lava);
      set(m, "ground", 6, 2, T.mushroom);
      set(m, "ground", 10, 9, T.mushroom);

      ev(m, 8, 2, "Guardian", (e) => {
        e.pages[0] = page({ charset: "flame", trigger: "action" }, [
          {
            t: "text",
            name: "???",
            text: "A hulking orc blocks the way\nto the glowing crystal!",
          },
          { t: "se", name: "encounter" },
          { t: "battle", troopId: 3, escape: false, lose: false },
          { t: "selfsw", key: "A", val: true },
          { t: "text", name: "", text: "The guardian has been defeated!" },
        ]);
        e.pages.push(
          page({ cond: { selfSw: "A" }, charset: "", trigger: "action" }, []),
        );
      });
      ev(m, 8, 1, "Crystal", (e) => {
        e.pages[0] = page({ charset: "crystal", trigger: "action" }, [
          {
            t: "if",
            cond: { kind: "selfsw", key: "A" },
            then: [{ t: "text", name: "", text: "The crystal hums softly." }],
            else: [
              { t: "se", name: "magic" },
              {
                t: "text",
                name: "",
                text: "You touch the Whispering Crystal...\nA warm light fills the party!",
              },
              { t: "heal", full: true },
              { t: "gold", op: "add", val: 200 },
              { t: "text", name: "", text: "Received 200 G!" },
              { t: "selfsw", key: "A", val: true },
              { t: "switch", id: 1, val: true },
            ],
          },
        ]);
      });
      ev(m, 8, 11, "To Village", (e) => {
        e.pages[0] = page(
          { charset: "", trigger: "touch", priority: "below", through: true },
          [
            // back to a plain fade for the village (its perMap entry clears the fog)
            { t: "script", code: "if (window.Atlas) Atlas.transition = 'fade';" },
            { t: "transfer", mapId: 1, x: 12, y: 1, dir: 0 },
          ],
        );
      });
      return m;
    }

    function buildInterior() {
      const m = newMap(3, "Cottage", 10, 8, T.woodfloor);
      m.music = "town";
      fillRect(m, "decor", 0, 0, 9, 1, T.wall_wood);
      fillRect(m, "decor", 0, 2, 0, 7, T.wall_wood);
      fillRect(m, "decor", 9, 2, 9, 7, T.wall_wood);
      fillRect(m, "decor", 1, 7, 8, 7, T.wall_wood);
      set(m, "decor", 4, 7, 0); // doorway
      set(m, "decor", 3, 1, T.window);
      set(m, "decor", 6, 1, T.window);
      set(m, "decor", 2, 3, T.table);
      set(m, "decor", 1, 3, T.chair);
      set(m, "decor", 3, 3, T.chair);
      set(m, "decor", 7, 2, T.bed);
      set(m, "decor", 1, 2, T.shelf);
      set(m, "decor", 8, 5, T.pot);
      fillRect(m, "ground", 4, 3, 5, 5, T.carpet);

      ev(m, 5, 4, "Resident", (e) => {
        e.pages[0] = page({ charset: "villager_f", moveType: "random", trigger: "action" }, [
          { t: "if", cond: { kind: "quest", questId: 2, status: "completed" }, then: [
            { t: "text", name: "Tilda", text: "That Potion did the trick.\nThank you again for hurrying it over." },
          ], else: [
            { t: "if", cond: { kind: "quest", questId: 2, status: "active" }, then: [
              { t: "if", cond: { kind: "item", itemKind: "item", id: 1 }, then: [
                { t: "text", name: "Tilda", text: "You found a Potion? Oh, wonderful!" },
                { t: "questComplete", questId: 2 },
              ], else: [
                { t: "text", name: "Tilda", text: "If you're heading through the village, could you bring me just one Potion?\nThe merchant should have plenty." },
              ] },
            ], else: [
              { t: "if", cond: { kind: "quest", questId: 1, status: "completed" }, then: [
                { t: "text", name: "Tilda", text: "Since you're helping everyone... could you fetch me a Potion?\nI'd pay you back, of course." },
                { t: "questStart", questId: 2 },
                { t: "text", name: "", text: "Started quest: Tilda's Tonic" },
              ], else: [
                { t: "text", name: "Tilda", text: "Make yourself at home!\nThe bed is free if you need a rest." },
              ] },
            ] },
          ] },
        ]);
      });
      ev(m, 7, 2, "Bed", (e) => {
        e.pages[0] = page(
          { charset: "", trigger: "action", priority: "below", through: true },
          [
            {
              t: "choices",
              options: ["Rest", "Leave it"],
              branches: [
                [
                  { t: "se", name: "heal" },
                  { t: "heal", full: true },
                  {
                    t: "text",
                    name: "",
                    text: "You take a short nap.\nHP and MP fully restored!",
                  },
                ],
                [],
              ],
            },
          ],
        );
      });
      ev(m, 4, 7, "Exit", (e) => {
        e.pages[0] = page(
          { charset: "", trigger: "touch", priority: "below", through: true },
          [
            { t: "se", name: "door" },
            { t: "transfer", mapId: 1, x: 17, y: 7, dir: 0 },
          ],
        );
      });
      return m;
    }

    return { newProject, newMap, newEvent, newPage };
  })();

  if (typeof window !== "undefined") {
    window.RA = RA;
    window.DataDefaults = DataDefaults;
  }
})();
