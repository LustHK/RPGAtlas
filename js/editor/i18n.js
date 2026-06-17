/* RPGAtlas - editor/i18n.js
   Editor-interface localization with persistent locale selection and English fallback.
   Locale data is loaded on demand from /locales/{id}.json files. */
"use strict";

export const EDITOR_LOCALE_STORAGE_KEY = "rpgatlas_editor_locale";

const LOCALE_META = {
  en: "English",
  pt: "Português (Brasil)",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

const loadedMessages = {};

async function loadLocale(localeId) {
  if (loadedMessages[localeId]) return loadedMessages[localeId];
  try {
    const res = await fetch(
      "locales/" + encodeURIComponent(localeId) + ".json",
    );
    if (res.ok) {
      const data = await res.json();
      loadedMessages[localeId] = data;
      return data;
    }
  } catch {
    // ignore, fall back to English keys
  }
  loadedMessages[localeId] = {};
  return {};
}

export function normalizeEditorLocale(locale) {
  const language = String(locale || "")
    .trim()
    .toLowerCase()
    .replace("_", "-")
    .split("-")[0];
  return Object.prototype.hasOwnProperty.call(LOCALE_META, language)
    ? language
    : "en";
}

export async function createEditorI18n(options = {}) {
  const storage = options.storage || null;
  const documentRef = options.document || null;
  let storedLocale = "";
  try {
    storedLocale = storage ? storage.getItem(EDITOR_LOCALE_STORAGE_KEY) : "";
  } catch {
    storedLocale = "";
  }
  let locale = normalizeEditorLocale(
    storedLocale || options.browserLocale || "en",
  );
  await loadLocale(locale);

  function t(key, values) {
    const source = String(key == null ? "" : key);
    const messages = loadedMessages[locale] || {};
    const translated = messages[source] || source;
    if (!values) return translated;
    return translated.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name)
        ? String(values[name])
        : match,
    );
  }

  function applyDocumentLanguage() {
    if (documentRef && documentRef.documentElement)
      documentRef.documentElement.lang = locale;
  }

  async function setLocale(nextLocale) {
    locale = normalizeEditorLocale(nextLocale);
    try {
      if (storage) storage.setItem(EDITOR_LOCALE_STORAGE_KEY, locale);
    } catch {
      // Language switching still works when browser storage is unavailable.
    }
    await loadLocale(locale);
    applyDocumentLanguage();
    return locale;
  }

  function localizeStatic(root = documentRef) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = t(element.getAttribute("data-i18n-title"));
    });
  }

  applyDocumentLanguage();
  return {
    get locale() {
      return locale;
    },
    locales: () =>
      Object.entries(LOCALE_META).map(([id, label]) => ({ id, label })),
    localizeStatic,
    setLocale,
    t,
  };
}
