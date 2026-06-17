import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function importBrowserModule(relativePath) {
  const source = await fs.readFile(path.join(root, relativePath), "utf8");
  // Wrap in a fake window object to simulate the browser environment
  const wrappedSource = `
    const window = {
      RA: {},
      DataDefaults: {},
      Assets: { T: { grass: 1 } },
      RPGAtlasI18n: { t: (k) => k }
    };
    ${source.replace(/window\.RA/g, "window.RA").replace(/window\.DataDefaults/g, "window.DataDefaults")}
    export const DataDefaults = window.DataDefaults;
    export const RA = window.RA;
  `;
  return import("data:text/javascript;base64," + Buffer.from(wrappedSource).toString("base64"));
}

const { DataDefaults } = await importBrowserModule("js/data.js");

const proj = DataDefaults.newProject();
assert.ok(proj, "newProject should return a project object");
assert.equal(proj.meta.engine, "rpgatlas");
assert.equal(proj.system.title, "Untitled RPG");
console.log("DataDefaults.newProject() test passed.");
