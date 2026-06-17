/* RPGAtlas desktop wrapper — native commands.
   GPL-3.0-or-later (see ../LICENSE).

   The editor is the existing static web app, embedded as the frontend. These
   commands give it the few things a browser tab cannot do well: native file
   dialogs for project save/load, folder picking, template-based project
   creation, and a dedicated window for play-testing. */

use std::fs;
use std::path::Path;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

/// Save the editor's project JSON to a user-chosen file. Returns the chosen
/// path, or `None` if the user cancelled the dialog.
#[tauri::command]
fn save_project(
    app: tauri::AppHandle,
    json: String,
    suggested: String,
) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("RPGAtlas project", &["json"])
        .set_file_name(format!("{suggested}.json"))
        .blocking_save_file();

    match picked {
        Some(file) => {
            let path = file.into_path().map_err(|e| e.to_string())?;
            fs::write(&path, json).map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

/// Write the project JSON straight to a known path (no dialog). Used by the
/// Save button once the project is bound to a file.
#[tauri::command]
fn save_project_to_path(path: String, json: String) -> Result<(), String> {
    fs::write(&path, json).map_err(|e| e.to_string())
}

/// Open a project file chosen by the user and return its contents.
#[tauri::command]
fn open_project(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("RPGAtlas project", &["json"])
        .blocking_pick_file();

    match picked {
        Some(file) => {
            let path = file.into_path().map_err(|e| e.to_string())?;
            let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            Ok(Some(contents))
        }
        None => Ok(None),
    }
}

/// Pick a folder using a native dialog. Returns the selected folder path, or
/// `None` if the user cancelled.
#[tauri::command]
fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let picked = app.dialog().folder().blocking_pick_folder();

    match picked {
        Some(folder) => {
            let path = folder.into_path().map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

/// Resolve the engine's template directory path.
/// In dev mode this is `<project_root>/resources/template/`.
/// In production (bundled) this is the resource directory + `/resources/template/`.
#[tauri::command]
fn get_engine_template_path(app: tauri::AppHandle) -> Result<String, String> {
    // Try bundled resource path first
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("resources").join("template");
        if bundled.exists() {
            return Ok(bundled.to_string_lossy().into_owned());
        }
    }

    // Fall back to dev-mode path relative to current working directory
    let dev_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("resources")
        .join("template");

    if dev_path.exists() {
        Ok(dev_path.to_string_lossy().into_owned())
    } else {
        Err("Template directory not found at resources/template/".to_string())
    }
}

/// Copy a directory recursively, preserving file structure.
fn copy_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if src.is_dir() {
        fs::create_dir_all(dst).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let file_type = entry.file_type().map_err(|e| e.to_string())?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            if file_type.is_dir() {
                copy_recursive(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    } else {
        Err(format!("Source is not a directory: {}", src.display()))
    }
}

/// Sanitize a project name for use as a folder name / npm package name.
fn sanitize_name(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>()
        .trim_matches(|c: char| c == '-' || c == '_')
        .to_string()
}

/// Create a new project folder by copying the RTP template and injecting
/// metadata. Returns the created project path.
#[tauri::command]
fn create_project_folder(
    app: tauri::AppHandle,
    project_name: String,
    game_title: String,
    destination_dir: String,
) -> Result<String, String> {
    let dest = Path::new(&destination_dir).join(&project_name);

    // Validate destination
    if dest.exists() {
        let mut has_entries = false;
        if let Ok(mut rd) = fs::read_dir(&dest) {
            has_entries = rd.next().is_some();
        }
        if has_entries {
            return Err(format!(
                "Folder '{}' already exists and is not empty.",
                dest.display()
            ));
        }
    }

    // Resolve template path
    let template_path = if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("resources").join("template");
        if bundled.exists() {
            bundled
        } else {
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join("resources")
                .join("template")
        }
    } else {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join("resources")
            .join("template")
    };

    if !template_path.exists() {
        return Err("Template not found at resources/template/".to_string());
    }

    // Copy template recursively
    copy_recursive(&template_path, &dest)?;

    // Inject metadata into package.json
    let package_path = dest.join("package.json");
    if package_path.exists() {
        let content = fs::read_to_string(&package_path).map_err(|e| e.to_string())?;
        if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
            json["name"] = serde_json::Value::String(sanitize_name(&project_name));
            if let Some(window) = json["window"].as_object_mut() {
                window.insert(
                    "title".to_string(),
                    serde_json::Value::String(game_title.clone()),
                );
            }
            let out = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
            fs::write(&package_path, out).map_err(|e| e.to_string())?;
        }
    }

    // Inject metadata into data/System.json
    let system_path = dest.join("data").join("System.json");
    if system_path.exists() {
        let content = fs::read_to_string(&system_path).map_err(|e| e.to_string())?;
        if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
            json["system"]["title"] = serde_json::Value::String(game_title.clone());
            json["meta"]["engine"] = serde_json::Value::String("rpgatlas".to_string());
            json["meta"]["version"] = serde_json::Value::Number(serde_json::Number::from(3));
            let out = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
            fs::write(&system_path, out).map_err(|e| e.to_string())?;
        }
    }

    // Inject metadata into Game.rpgproject
    let rpgproject_path = dest.join("Game.rpgproject");
    if rpgproject_path.exists() {
        let content = fs::read_to_string(&rpgproject_path).map_err(|e| e.to_string())?;
        if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
            json["gameTitle"] = serde_json::Value::String(game_title);
            json["created"] =
                serde_json::Value::String(format!("{:?}", std::time::SystemTime::now()));
            let out = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
            fs::write(&rpgproject_path, out).map_err(|e| e.to_string())?;
        }
    }

    Ok(dest.to_string_lossy().into_owned())
}

/// Load a project from a folder path. Reads all `data/*.json` files and
/// assembles them into a single project JSON object.
#[tauri::command]
fn load_project_folder(path: String) -> Result<String, String> {
    let project_dir = Path::new(&path);
    let data_dir = project_dir.join("data");

    if !data_dir.exists() {
        return Err("Project folder does not contain a 'data/' directory.".to_string());
    }

    let mut project = serde_json::Map::new();

    // Read System.json — contains meta, system, plugins, quests, etc.
    let system_path = data_dir.join("System.json");
    if system_path.exists() {
        let content = fs::read_to_string(&system_path).map_err(|e| e.to_string())?;
        let sys_val: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        if let Some(obj) = sys_val.as_object() {
            for (k, v) in obj {
                project.insert(k.clone(), v.clone());
            }
        }
    }

    // Map of data file names (without .json) to top-level project keys
    let data_files: &[(&str, &str)] = &[
        ("Actors", "actors"),
        ("Classes", "classes"),
        ("Skills", "skills"),
        ("Items", "items"),
        ("Weapons", "weapons"),
        ("Armors", "armors"),
        ("Enemies", "enemies"),
        ("Troops", "troops"),
        ("States", "states"),
        ("Animations", "animations"),
        ("Tilesets", "tilesets"),
        ("CommonEvents", "commonEvents"),
    ];

    for (file_name, proj_key) in data_files {
        let file_path = data_dir.join(format!("{}.json", file_name));
        if file_path.exists() {
            let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
            let value: serde_json::Value =
                serde_json::from_str(&content).map_err(|e| e.to_string())?;
            project.insert(proj_key.to_string(), value);
        }
    }

    // Read map files (MapXXX.json, excluding MapInfos.json)
    let mut maps: Vec<serde_json::Value> = Vec::new();
    if let Ok(entries) = fs::read_dir(&data_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("Map")
                && name.ends_with(".json")
                && name != "MapInfos.json"
            {
                // Extract numeric map ID from filename (e.g., "Map001.json" -> 1)
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    if let Ok(map_val) = serde_json::from_str::<serde_json::Value>(&content) {
                        maps.push(map_val);
                    }
                }
            }
        }
    }
    // Sort maps by ID
    maps.sort_by(|a, b| {
        let id_a = a.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        let id_b = b.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        id_a.cmp(&id_b)
    });
    project.insert("maps".to_string(), serde_json::Value::Array(maps));

    serde_json::to_string(&serde_json::Value::Object(project)).map_err(|e| e.to_string())
}

/// Save a project to a folder path. Splits the project JSON into individual
/// files in `data/` following the RPG Maker MZ convention.
#[tauri::command]
fn save_project_folder(path: String, project_json: String) -> Result<(), String> {
    let project_dir = Path::new(&path);
    let data_dir = project_dir.join("data");

    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

    let project: serde_json::Value =
        serde_json::from_str(&project_json).map_err(|e| e.to_string())?;

    if let Some(obj) = project.as_object() {
        // Write System.json — assemble meta, system, plugins, quests, etc.
        // NOTE: "tilesets" is NOT included here; it goes to its own Tilesets.json.
        let mut system_obj = serde_json::Map::new();
        for key in &[
            "meta", "system", "plugins", "quests", "customChars", "commandPresets", "assets",
        ] {
            if let Some(val) = obj.get(*key) {
                system_obj.insert(key.to_string(), val.clone());
            }
        }
        let system_json =
            serde_json::to_string_pretty(&serde_json::Value::Object(system_obj))
                .map_err(|e| e.to_string())?;
        fs::write(data_dir.join("System.json"), system_json).map_err(|e| e.to_string())?;

        // Write individual data files (including CommonEvents)
        let data_files: &[(&str, &str)] = &[
            ("Actors", "actors"),
            ("Classes", "classes"),
            ("Skills", "skills"),
            ("Items", "items"),
            ("Weapons", "weapons"),
            ("Armors", "armors"),
            ("Enemies", "enemies"),
            ("Troops", "troops"),
            ("States", "states"),
            ("Animations", "animations"),
            ("Tilesets", "tilesets"),
            ("CommonEvents", "commonEvents"),
        ];

        for (file_name, proj_key) in data_files {
            let file_path = data_dir.join(format!("{}.json", file_name));
            let value = obj.get(*proj_key).cloned().unwrap_or(serde_json::Value::Array(Vec::new()));
            let json_str =
                serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
            fs::write(&file_path, json_str).map_err(|e| e.to_string())?;
        }

        // Write MapInfos.json derived from the maps array
        if let Some(maps) = obj.get("maps").and_then(|v| v.as_array()) {
            let map_infos: Vec<serde_json::Value> = maps
                .iter()
                .filter_map(|m| {
                    let m_obj = m.as_object()?;
                    let id = m_obj.get("id")?;
                    let name = m_obj
                        .get("name")
                        .cloned()
                        .unwrap_or(serde_json::Value::String(format!("MAP{:04}", id.as_i64().unwrap_or(0))));
                    Some(serde_json::json!({
                        "id": id,
                        "name": name,
                        "parentId": 0,
                        "order": 1,
                    }))
                })
                .collect();
            fs::write(
                data_dir.join("MapInfos.json"),
                serde_json::to_string_pretty(&map_infos).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;

            // Write individual map files
            for map_val in maps {
                if let Some(map_obj) = map_val.as_object() {
                    let id = map_obj.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
                    let filename = format!("Map{:03}.json", id);
                    let map_json =
                        serde_json::to_string_pretty(map_val).map_err(|e| e.to_string())?;
                    fs::write(data_dir.join(filename), map_json).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    Ok(())
}

/// Open (or focus) the play-test window.
#[tauri::command]
fn open_playtest(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("playtest") {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "playtest", WebviewUrl::App("play.html".into()))
        .title("RPGAtlas — Playtest")
        .inner_size(816.0, 624.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// List entries in a directory.
#[tauri::command]
fn list_directory(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        names.push(entry.file_name().to_string_lossy().to_string());
    }
    Ok(names)
}

/// Read a text file from disk.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Write a text file to disk.
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Read a binary file and return it as a base64-encoded string.
#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_project,
            save_project_to_path,
            open_project,
            pick_folder,
            get_engine_template_path,
            create_project_folder,
            load_project_folder,
            save_project_folder,
            open_playtest,
            list_directory,
            read_text_file,
            write_text_file,
            read_file_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RPGAtlas");
}
