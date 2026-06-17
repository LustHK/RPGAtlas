/* RPGAtlas — rpgatlas-bridge.js
   Bridge between the editor's project data and the RMMV engine.
   Injects $data* globals and starts SceneManager.
   GPL-3.0-or-later (see LICENSE). */

(function() {
  function getProjectData() {
    if (window.RPGATLAS_PLAYTEST_DATA) return window.RPGATLAS_PLAYTEST_DATA;
    try {
      var raw = localStorage.getItem("rpgatlas_playtest_data");
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
  }

  function to1Indexed(arr) {
    if (!Array.isArray(arr)) return [null];
    return [null].concat(arr);
  }

  var proj = getProjectData();
  if (!proj) {
    console.error("RPGAtlas Bridge: No project data found.");
    return;
  }

  window.$dataActors       = to1Indexed(proj.actors);
  window.$dataClasses      = to1Indexed(proj.classes);
  window.$dataSkills       = to1Indexed(proj.skills);
  window.$dataItems        = to1Indexed(proj.items);
  window.$dataWeapons      = to1Indexed(proj.weapons);
  window.$dataArmors       = to1Indexed(proj.armors);
  window.$dataEnemies      = to1Indexed(proj.enemies);
  window.$dataTroops       = to1Indexed(proj.troops);
  window.$dataStates       = to1Indexed(proj.states);
  window.$dataAnimations   = to1Indexed(proj.animations || []);
  window.$dataTilesets     = to1Indexed(proj.tilesets);
  window.$dataCommonEvents = to1Indexed(proj.commonEvents);
  window.$dataSystem       = proj.system || {};
  window.$dataMapInfos     = proj.mapInfos || {};

  for (var i = 0; i < DataManager._databaseFiles.length; i++) {
    var name = DataManager._databaseFiles[i].name;
    if (window[name]) DataManager.onLoad(window[name]);
  }

  if (typeof PluginManager !== "undefined") {
    PluginManager.setup(proj.plugins || []);
  }

  SceneManager.run(Scene_Boot);
})();
