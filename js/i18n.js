/* RPGAtlas - i18n.js
   Interface localization with persistent locale selection and English fallback.
   Supports Engine and Game specific translations with cascade search.
   GPL-3.0-or-later (see LICENSE). */
"use strict";

class RPGAtlasI18n {
  constructor() {
    this.engineTranslations = {};
    this.engineFallback = {};
    this.gameTranslations = {};
    this.gameFallback = {};

    this.currentLanguage = "en";
    this.fallbackLanguage = "en";
    this.projectPath = null;
    this.storage = null;
    this.document = null;

    this.EDITOR_LOCALE_STORAGE_KEY = "rpgatlas_editor_locale";
    this.LOCALE_META = {
      en: "English",
      pt: "Português (Brasil)",
      es: "Español",
      fr: "Français",
      de: "Deutsch",
    };

    this.aliases = {
      "Cursor move": "data.se_cursor",
      "Confirm / OK": "data.se_ok",
      "Cancel": "data.se_cancel",
      "Buzzer (invalid)": "data.se_buzzer",
      "Equip / buy item": "data.se_equip",
      "Use recovery item": "data.se_heal",
      "Save / load game": "data.se_save",
      "Battle start": "data.se_encounter",
      "Escape battle": "data.se_escape",
      "Level up / victory": "data.se_levelup",
      "Game over": "data.se_gameover",
      "Title theme": "data.se_title",
      "Battle theme": "data.se_battle",
      "tileset.name": "tileset.name",
      "tileset.mode": "tileset.mode",
      "tileset.mode_world": "tileset.mode_world",
      "tileset.mode_area": "tileset.mode_area",
      "tileset.tool_passage": "tileset.tool_passage",
      "tileset.tool_passage4dir": "tileset.tool_passage4dir",
      "tileset.tool_ladder": "tileset.tool_ladder",
      "tileset.tool_bush": "tileset.tool_bush",
      "tileset.tool_counter": "tileset.tool_counter",
      "tileset.tool_damage": "tileset.tool_damage",
      "tileset.tool_terrain": "tileset.tool_terrain",
      "tileset.note": "tileset.note",
    };
  }

  /**
   * Resolve nested keys like "menu.items.heal" in objects.
   */
  resolveKey(obj, path) {
    if (!obj) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
    return path.split(".").reduce((prev, curr) => prev && prev[curr], obj);
  }

  /**
   * Replace dynamic variables in strings, e.g.: "Hello, {name}"
   */
  interpolate(string, variables) {
    if (typeof string !== "string") return string;
    return string.replace(/\{(\w+)\}/g, (match, key) => {
      return typeof variables[key] !== "undefined"
        ? String(variables[key])
        : match;
    });
  }

  /**
   * Helper function to load JSON files.
   */
  async loadJson(url) {
    try {
      const response = await fetch(url + "?v=" + Date.now());
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  /**
   * Initializes the i18n system for the Engine.
   */
  async init(options = {}) {
    this.storage = options.storage || null;
    this.document = options.document || null;

    let storedLocale = "";
    try {
      storedLocale = this.storage
        ? this.storage.getItem(this.EDITOR_LOCALE_STORAGE_KEY)
        : "";
    } catch {
      storedLocale = "";
    }

    const browserLocale = options.browserLocale || "";
    this.currentLanguage = this.normalizeLocale(
      storedLocale || browserLocale || "en",
    );

    // 1. Load Engine primary language
    this.engineTranslations =
      (await this.loadJson(`locales/${this.currentLanguage}.json`)) || {};

    // 2. Load Engine fallback
    if (this.currentLanguage !== this.fallbackLanguage) {
      this.engineFallback =
        (await this.loadJson(`locales/${this.fallbackLanguage}.json`)) || {};
    }

    this.applyDocumentLanguage();
    return this;
  }

  normalizeLocale(locale) {
    const language = String(locale || "")
      .trim()
      .toLowerCase()
      .replace("_", "-")
      .split("-")[0];
    return Object.prototype.hasOwnProperty.call(this.LOCALE_META, language)
      ? language
      : "en";
  }

  applyDocumentLanguage() {
    if (this.document && this.document.documentElement) {
      this.document.documentElement.lang = this.currentLanguage;
    }
  }

  /**
   * Sets the current locale and reloads translations.
   */
  async setLocale(nextLocale) {
    this.currentLanguage = this.normalizeLocale(nextLocale);
    try {
      if (this.storage) {
        this.storage.setItem(this.EDITOR_LOCALE_STORAGE_KEY, this.currentLanguage);
      }
    } catch {}

    this.engineTranslations =
      (await this.loadJson(`locales/${this.currentLanguage}.json`)) || {};
    if (this.currentLanguage !== this.fallbackLanguage) {
      this.engineFallback =
        (await this.loadJson(`locales/${this.fallbackLanguage}.json`)) || {};
    } else {
      this.engineFallback = {};
    }

    // Also reload project locales if path exists
    if (this.projectPath) {
      await this.loadProjectLocales(this.projectPath, this.currentLanguage);
    }

    this.applyDocumentLanguage();
    return this.currentLanguage;
  }

  /**
   * Loads game translations when a project is opened.
   */
  async loadProjectLocales(projectPath, lang) {
    this.projectPath = projectPath;
    const currentLang = lang || this.currentLanguage;

    // Path to locales folder inside project
    const basePath = `${projectPath}/locales`.replace(/\/+$/, "");

    this.gameTranslations = (await this.loadJson(`${basePath}/${currentLang}.json`)) || {};

    if (currentLang !== this.fallbackLanguage) {
      this.gameFallback =
        (await this.loadJson(`${basePath}/${this.fallbackLanguage}.json`)) || {};
    } else {
      this.gameFallback = {};
    }
  }

  /**
   * Main translation function with search cascade.
   */
  t(key, variables = {}) {
    const aliasKey = this.aliases[key] || key;
    let text;

    // 1. Try Game current language
    text = this.resolveKey(this.gameTranslations, aliasKey);
    if (text !== undefined) return this.interpolate(text, variables);

    // 2. Try Game fallback (en)
    text = this.resolveKey(this.gameFallback, aliasKey);
    if (text !== undefined) return this.interpolate(text, variables);

    // 3. Try Engine current language
    text = this.resolveKey(this.engineTranslations, aliasKey);
    if (text !== undefined) return this.interpolate(text, variables);

    // 4. Try Engine fallback (en)
    text = this.resolveKey(this.engineFallback, aliasKey);
    if (text !== undefined) return this.interpolate(text, variables);

    // 5. Return raw key if nothing found and log warning for real i18n keys only
    if (aliasKey.includes(".")) console.warn(`i18n: missing key "${aliasKey}" (requested: "${key}")`);
    return key;
  }

  /**
   * Updates a translation value in memory and saves to disk.
   */
  setTranslation(key, value) {
    const keys = key.split(".");
    let current = this.gameTranslations;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k]) {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
    this.saveGameLocale();
  }

  /**
   * Persists game translations to the locales folder.
   */
  async saveGameLocale() {
    if (!this.projectPath) return;
    const filePath = `${this.projectPath}/locales/${this.currentLanguage}.json`;

    // Try host-provided saving or window.fs
    if (window.fs && window.fs.writeFile) {
      await window.fs.writeFile(
        filePath,
        JSON.stringify(this.gameTranslations, null, 2),
      );
    } else {
      // Dispatch event for host/editor to handle persistent write
      window.dispatchEvent(
        new CustomEvent("rpgatlas-save-locale", {
          detail: { path: filePath, data: this.gameTranslations },
        }),
      );
    }
  }

  /**
   * Localizes static elements with [data-i18n] and [data-i18n-title] attributes.
   */
  localizeStatic(root = this.document) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = this.t(element.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = this.t(element.getAttribute("data-i18n-title"));
    });
  }

  get locale() {
    return this.currentLanguage;
  }
  
  get locales() {
    return Object.entries(this.LOCALE_META).map(([id, label]) => ({
      id,
      label,
    }));
  }
}

// Global instance and exports
const instance = new RPGAtlasI18n();
window.RPGAtlasI18n = {
  instance,
  create: (options) => instance.init(options),
  normalizeLocale: (l) => instance.normalizeLocale(l),
  get t() {
    return (key, vars) => instance.t(key, vars);
  },
};
window.t = (key, variables) => instance.t(key, variables);
