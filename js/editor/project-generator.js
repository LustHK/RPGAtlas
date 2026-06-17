/* RPGAtlas — editor/project-generator.js
   Project creation from template (RTP).
   Orchestrates copying the engine's template folder, injecting metadata,
   and returning the new project structure.
   GPL-3.0-or-later (see LICENSE). */

import * as host from "./host.js";

export function sanitizeProjectName(name, fallback) {
  return (name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9\-_ ]/g, "")
    .trim()
    .replace(/ +/g, "_") || "new_project";
}

export function sanitizeFileName(name, fallback) {
  return (name || fallback)
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/ +/g, "_") || "untitled";
}

export function defaultProjectData() {
  const switches = [""];
  const variables = [""];
  for (let i = 1; i < 50; i++) { switches.push(""); variables.push(""); }
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
      switches,
      variables,
      startTransparent: false,
      battleView: "side",
      screenWidth: 816,
      screenHeight: 624,
      uiWidth: 0,
      uiHeight: 0,
      screenScale: 1.6,
      fontText: '"Segoe UI", system-ui, sans-serif',
      fontMenu: '"Segoe UI", system-ui, sans-serif',
      fontSize: 15,
      windowOpacity: 93,
      pixelMovement: true,
      sounds: {
        cursor: "cursor", ok: "ok", cancel: "cancel", buzzer: "buzzer",
        equip: "item", heal: "heal", save: "save", encounter: "encounter",
        escape: "escape", levelup: "levelup", gameover: "gameover",
      },
      music: { title: "title", battle: "battle" },
      types: {
        elements: [
          { key: "physical", name: "Physical" },
          { key: "fire", name: "Fire" },
          { key: "ice", name: "Ice" },
          { key: "thunder", name: "Thunder" },
          { key: "poison", name: "Poison" },
          { key: "magic", name: "Other magic" },
        ],
        skillTypes: [
          { key: "phys", name: "Physical" },
          { key: "magic", name: "Magical" },
          { key: "heal", name: "Heal" },
        ],
        weaponTypes: [
          { id: 1, name: "Dagger" }, { id: 2, name: "Sword" },
          { id: 3, name: "Axe" }, { id: 4, name: "Spear" },
          { id: 5, name: "Bow" }, { id: 6, name: "Staff" },
          { id: 7, name: "Wand" }, { id: 8, name: "Claw" },
        ],
        armorTypes: [
          { id: 1, name: "General Armor" }, { id: 2, name: "Magic Armor" },
          { id: 3, name: "Light Armor" }, { id: 4, name: "Heavy Armor" },
          { id: 5, name: "Shield" },
        ],
        equipTypes: [
          { id: 1, name: "Weapon" }, { id: 2, name: "Shield" },
          { id: 3, name: "Head" }, { id: 4, name: "Body" },
          { id: 5, name: "Accessory" },
        ],
      },
    },
    plugins: [],
    quests: [],
    customChars: [],
    commandPresets: [],
    assets: { tiles: {} },
    tilesets: [null],
    actors: [],
    classes: [],
    skills: [],
    items: [],
    weapons: [],
    armors: [],
    enemies: [],
    troops: [],
    states: [],
    maps: [
      {
        id: 1,
        name: "MAP0001",
        tilesetId: 1,
        width: 20,
        height: 15,
        data: (() => { const a = new Array(1200).fill(0); for (let i=0;i<300;i++) a[i*4]=2048; return a; })(),
        events: [],
        autoplayBgm: false, autoplayBgs: false,
        battleback1Name: "", battleback2Name: "",
        bgm: {name:"",pan:0,pitch:100,volume:90},
        bgs: {name:"",pan:0,pitch:100,volume:90},
        disableDashing: false,
        displayName: "",
        encounterList: [],
        encounterStep: 30,
        note: "",
        parallaxLoopX: false, parallaxLoopY: false,
        parallaxName: "", parallaxShow: false,
        parallaxSx: 0, parallaxSy: 0,
        scrollType: 0,
        specifyBattleback: false,
      },
    ],
  };
}

/**
 * Validate that a destination path + project name would be usable.
 * Returns null if valid, or an error string if not.
 */
export function validateProjectDestination(destinationDir, projectName) {
  if (!destinationDir || !destinationDir.trim()) {
    return "Please select a destination folder.";
  }
  if (!projectName || !projectName.trim()) {
    return "Please enter a project name.";
  }
  const sanitized = sanitizeProjectName(projectName);
  if (sanitized.length < 1) {
    return "Project name contains only invalid characters. Use letters, numbers, hyphens or underscores.";
  }
  return null;
}

/**
 * Create a new project by copying the RTP template and injecting metadata.
 *
 * @param {string} projectName  - Folder name for the project (e.g. "my_rpg")
 * @param {string} gameTitle    - Display title (e.g. "My RPG Game")
 * @param {string} destinationDir - Parent folder path (e.g. "/Users/me/Documents")
 * @returns {Promise<{success: boolean, path?: string, error?: string, project?: object}>}
 */
export async function createNewProject(projectName, gameTitle, destinationDir) {
  const validationError = validateProjectDestination(destinationDir, projectName);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const cleanName = sanitizeProjectName(projectName);
  const projectPath = destinationDir.replace(/\\/g, "/").replace(/\/$/, "") + "/" + cleanName;
  const title = (gameTitle || projectName).trim();

  try {
    if (host.isTauri) {
      // Use native Tauri command
      const result = await host.createProject(cleanName, title, destinationDir);
      if (!result || result.error) {
        return { success: false, error: (result && result.error) || "Failed to create project folder." };
      }
      // Load the created project from the folder
      const project = await host.loadProjectFromFolder(result.path || projectPath);
      return { success: true, path: result.path || projectPath, project };
    }

    // Browser fallback: create project in memory (no filesystem copy)
    const project = defaultProjectData();
    project.system.title = title;
    project.meta.engine = "rpgatlas";
    project.meta.version = 3;
    return { success: true, path: null, project };
  } catch (error) {
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Fetch the template index.html contents with placeholders replaced.
 * Used for standalone project export.
 */
export async function generateProjectHtml(projectName, gameTitle) {
  try {
    const response = await fetch("resources/template/index.html", { cache: "no-store" });
    if (!response.ok) throw new Error("Template not found");
    let html = await response.text();
    html = html.replace(/RPGAtlas Player/g, gameTitle || projectName || "RPGAtlas Player");
    return html;
  } catch {
    return null;
  }
}

/**
 * Generate a minimal standalone package.json content for a new project.
 */
export function generatePackageJson(projectName, gameTitle) {
  return {
    name: sanitizeProjectName(projectName || "new-project"),
    description: gameTitle || "A game created with RPGAtlas",
    version: "1.0.0",
    private: true,
    window: {
      title: gameTitle || "Untitled RPG",
      width: 816,
      height: 624,
      resizable: true,
    },
    main: "index.html",
  };
}