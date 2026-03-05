// Copyright (c) 2026 Debanjan Bhattacharya
// Project: vyasa-notetaking-app
// Licensed under the MIT License
// See LICENSE.txt for details

use std::fs;
use std::path::PathBuf;
use std::collections::BTreeSet;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

#[derive(Serialize, Deserialize, Clone)]
struct SessionTab {
    title: String,
    content: String,
    file_path: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct SessionData {
    tabs: Vec<SessionTab>,
    active_index: usize,
}

fn get_app_data_dir() -> Result<PathBuf, String> {
    let data_dir = dirs::data_local_dir()
        .ok_or_else(|| "Could not determine local data directory".to_string())?;
    let app_dir = data_dir.join("Vyasa");
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    Ok(app_dir)
}

fn get_session_path() -> Result<PathBuf, String> {
    Ok(get_app_data_dir()?.join("session.json"))
}

fn get_recent_files_path() -> Result<PathBuf, String> {
    Ok(get_app_data_dir()?.join("recent_files.json"))
}

#[tauri::command]
fn save_session(tabs: Vec<SessionTab>, active_index: usize) -> Result<(), String> {
    let session = SessionData { tabs, active_index };
    let json = serde_json::to_string_pretty(&session)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;
    let path = get_session_path()?;
    fs::write(&path, &json)
        .map_err(|e| format!("Failed to write session file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn load_session() -> Result<Option<(Vec<SessionTab>, usize)>, String> {
    let path = get_session_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;
    let session: SessionData = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse session file: {}", e))?;
    Ok(Some((session.tabs, session.active_index)))
}

const MAX_RECENT_FILES: usize = 10;

#[tauri::command]
fn save_recent_files(files: Vec<String>) -> Result<(), String> {
    let trimmed: Vec<String> = files.into_iter().take(MAX_RECENT_FILES).collect();
    let json = serde_json::to_string_pretty(&trimmed)
        .map_err(|e| format!("Failed to serialize recent files: {}", e))?;
    let path = get_recent_files_path()?;
    fs::write(&path, &json)
        .map_err(|e| format!("Failed to write recent files: {}", e))?;
    Ok(())
}

#[tauri::command]
fn load_recent_files() -> Result<Vec<String>, String> {
    let path = get_recent_files_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let json = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read recent files: {}", e))?;
    let files: Vec<String> = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse recent files: {}", e))?;
    Ok(files)
}

#[tauri::command]
fn get_system_fonts() -> Result<Vec<String>, String> {

    let collection = font_enumeration::Collection::new()
        .map_err(|e| format!("Failed to enumerate fonts: {:?}", e))?;
    let mut families: BTreeSet<String> = BTreeSet::new();
    for font in collection.all() {
        families.insert(font.family_name.clone());
    }
    Ok(families.into_iter().collect())
}

#[tauri::command]
fn show_in_explorer(path: String) -> Result<(), String> {
    let file_path = std::path::Path::new(&path);
    let folder = if file_path.is_file() {
        file_path.parent().unwrap_or(file_path)
    } else {
        file_path
    };
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(folder)
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

#[tauri::command]
fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory for '{}': {}", path, e))?;
    }
    fs::write(&path, &data).map_err(|e| format!("Failed to write binary file '{}': {}", path, e))
}

#[tauri::command]
fn get_pictures_dir() -> Result<String, String> {
    let pictures = dirs::picture_dir()
        .ok_or_else(|| "Could not determine Pictures directory".to_string())?;
    let vyasa_dir = pictures.join("Vyasa");
    Ok(vyasa_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn save_screenshot(folder: String, data: Vec<u8>) -> Result<String, String> {
    let dir = PathBuf::from(&folder);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create directory '{}': {}", folder, e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let filename = format!("Vyasa_Screenshot_{}.png", timestamp);
    let filepath = dir.join(&filename);

    fs::write(&filepath, &data)
        .map_err(|e| format!("Failed to save screenshot: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}

#[tauri::command]
fn get_cli_file_arg() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    // When a file is opened via "Open with" or file association,
    // Windows passes the file path as the last argument.
    // Skip the first arg (exe path) and any args starting with '-'
    for arg in args.iter().skip(1).rev() {
        if !arg.starts_with('-') && !arg.starts_with("--") {
            let path = std::path::Path::new(arg);
            if path.exists() && path.is_file() {
                return Some(arg.clone());
            }
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // When a second instance is launched, extract file path from args
            // and emit it to the existing window so it opens as a new tab.
            for arg in argv.iter().skip(1) {
                if !arg.starts_with('-') && !arg.starts_with("--") {
                    let path = std::path::Path::new(arg);
                    if path.exists() && path.is_file() {
                        // Emit event to frontend with the file path
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("open-file", arg.clone());
                            // Focus the existing window
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                        break;
                    }
                }
            }
        }))
        .invoke_handler(tauri::generate_handler![read_file, write_file, write_binary_file, get_system_fonts, get_pictures_dir, save_screenshot, get_cli_file_arg, save_session, load_session, save_recent_files, load_recent_files, show_in_explorer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
