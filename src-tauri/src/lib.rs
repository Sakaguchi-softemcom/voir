mod markdown;
mod watcher;
mod explorer;

use clap::Parser as ClapParser;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use walkdir::WalkDir;

// ─── CLI ─────────────────────────────────────────────────────────────────────

#[derive(ClapParser, Debug, Clone)]
#[command(name = "voir", about = "A fast Markdown viewer for Windows")]
pub struct CliArgs {
    #[arg()]
    pub paths: Vec<String>,
    #[arg(long, default_value = "last")]
    pub open: String,
    #[arg(long, short)]
    pub directory: Option<String>,
}

// ─── App State ───────────────────────────────────────────────────────────────

pub struct AppState {
    pub current_file: Mutex<Option<PathBuf>>,
    pub current_dir: Mutex<Option<PathBuf>>,
    pub project_root: Mutex<Option<PathBuf>>,
    pub watcher: Mutex<Option<watcher::FileWatcher>>,
    pub cli_args: Mutex<CliArgs>,
}

// ─── Data Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderResult {
    pub html: String,
    pub toc: Vec<TocEntry>,
    pub title: String,
    pub frontmatter: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TocEntry { pub level: u32, pub text: String, pub id: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode { pub name: String, pub path: String, pub is_dir: bool, pub children: Option<Vec<FileNode>> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch { pub line: usize, pub column: usize, pub length: usize, pub context: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark { pub path: String, pub name: String, pub is_dir: bool }

/// A single match in project-wide search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSearchResult {
    pub file_path: String,
    pub file_name: String,
    pub matches: Vec<SearchMatch>,
    pub match_count: usize,
}

// ─── Config Helpers ──────────────────────────────────────────────────────────

fn config_dir() -> PathBuf {
    dirs::config_dir().unwrap_or_else(|| PathBuf::from(".")).join("voir")
}
fn ensure_config_dir() -> Result<PathBuf, String> {
    let dir = config_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}
fn read_json_file<T: serde::de::DeserializeOwned>(filename: &str) -> Option<T> {
    let path = config_dir().join(filename);
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}
fn write_json_file<T: Serialize>(filename: &str, data: &T) -> Result<(), String> {
    let dir = ensure_config_dir()?;
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(dir.join(filename), json).map_err(|e| e.to_string())
}

fn is_markdown_ext(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_lowercase().as_str(), "md" | "markdown" | "mdown" | "mkdn" | "mkd" | "mdwn"))
        .unwrap_or(false)
}

fn should_skip_dir(name: &str) -> bool {
    matches!(name, "node_modules" | "target" | ".git" | "__pycache__" | "dist" | "build" | ".next" | ".cache" | ".vscode" | ".idea")
}

/// Search for `query` in `line` and return matches as (char_offset, char_length).
/// This correctly handles multi-byte characters (Japanese, etc.) so JS substring() works.
fn find_matches_char_pos(line: &str, query: &str, case_sensitive: bool) -> Vec<(usize, usize)> {
    let line_chars: Vec<char> = if case_sensitive {
        line.chars().collect()
    } else {
        line.to_lowercase().chars().collect()
    };
    let query_chars: Vec<char> = if case_sensitive {
        query.chars().collect()
    } else {
        query.to_lowercase().chars().collect()
    };

    let mut results = Vec::new();
    if query_chars.is_empty() || query_chars.len() > line_chars.len() {
        return results;
    }

    let mut i = 0;
    while i + query_chars.len() <= line_chars.len() {
        if line_chars[i..i + query_chars.len()] == query_chars[..] {
            results.push((i, query_chars.len()));
            i += 1; // allow overlapping matches
        } else {
            i += 1;
        }
    }
    results
}

// ─── Core Commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn render_markdown(path: String) -> Result<RenderResult, String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Failed to read: {e}"))?;
    let (frontmatter, body) = markdown::extract_frontmatter(&content);
    let (html, toc) = markdown::render_to_html(body);
    let title = toc.first().map(|t| t.text.clone())
        .unwrap_or_else(|| path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default());
    Ok(RenderResult { html, toc, title, frontmatter })
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read: {e}"))
}

#[tauri::command]
fn list_directory(path: String, depth: Option<u32>) -> Result<Vec<FileNode>, String> {
    explorer::list_dir(&PathBuf::from(path), depth.unwrap_or(3)).map_err(|e| e.to_string())
}

#[tauri::command]
fn watch_file(path: String, state: State<'_, AppState>, handle: AppHandle) -> Result<(), String> {
    let path = PathBuf::from(&path);
    *state.current_file.lock().unwrap() = Some(path.clone());
    if let Some(parent) = path.parent() {
        *state.current_dir.lock().unwrap() = Some(parent.to_path_buf());
    }
    let mut watcher_lock = state.watcher.lock().unwrap();
    *watcher_lock = None;
    let h = handle.clone();
    let new_watcher = watcher::FileWatcher::new(path, move |_| { let _ = h.emit("file-changed", ()); })
        .map_err(|e| format!("Watch failed: {e}"))?;
    *watcher_lock = Some(new_watcher);
    Ok(())
}

#[tauri::command]
fn unwatch_file(state: State<'_, AppState>) -> Result<(), String> {
    *state.watcher.lock().unwrap() = None;
    Ok(())
}

// ─── Project Root ────────────────────────────────────────────────────────────

#[tauri::command]
fn set_project_root(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }
    *state.project_root.lock().unwrap() = Some(p);
    Ok(())
}

#[tauri::command]
fn get_project_root(state: State<'_, AppState>) -> Option<String> {
    state.project_root.lock().unwrap().as_ref().map(|p| p.to_string_lossy().to_string())
}

// ─── Project-Wide Search ─────────────────────────────────────────────────────

#[tauri::command]
fn search_project(
    root: String,
    query: String,
    case_sensitive: bool,
    max_results: Option<usize>,
) -> Result<Vec<ProjectSearchResult>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {}", root));
    }

    let max = max_results.unwrap_or(100);
    let mut results: Vec<ProjectSearchResult> = Vec::new();
    let mut total_matches = 0usize;

    for entry in WalkDir::new(&root_path)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            // Skip hidden/known dirs
            if e.file_type().is_dir() {
                let name = e.file_name().to_string_lossy();
                if name.starts_with('.') || should_skip_dir(&name) {
                    return false;
                }
            }
            true
        })
        .filter_map(|e| e.ok())
    {
        if total_matches >= max { break; }
        let path = entry.path();
        if !path.is_file() || !is_markdown_ext(path) { continue; }

        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut file_matches: Vec<SearchMatch> = Vec::new();

        for (line_idx, line) in content.lines().enumerate() {
            if total_matches >= max { break; }
            let matches = find_matches_char_pos(line, &query, case_sensitive);
            for (char_col, char_len) in matches {
                file_matches.push(SearchMatch {
                    line: line_idx + 1,
                    column: char_col,
                    length: char_len,
                    context: line.to_string(),
                });
                total_matches += 1;
                if total_matches >= max { break; }
            }
        }

        if !file_matches.is_empty() {
            let mc = file_matches.len();
            results.push(ProjectSearchResult {
                file_path: path.to_string_lossy().to_string(),
                file_name: path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                matches: file_matches,
                match_count: mc,
            });
        }
    }

    Ok(results)
}

// ─── Scroll Position Memory ──────────────────────────────────────────────────

#[tauri::command]
fn save_scroll_position(path: String, position: f64) -> Result<(), String> {
    let mut positions: HashMap<String, f64> =
        read_json_file("scroll_positions.json").unwrap_or_default();
    positions.insert(path, position);
    // Keep only last 200 entries
    if positions.len() > 200 {
        // Remove oldest (just truncate — order doesn't matter much)
        let keys: Vec<String> = positions.keys().take(positions.len() - 200).cloned().collect();
        for k in keys { positions.remove(&k); }
    }
    write_json_file("scroll_positions.json", &positions)
}

#[tauri::command]
fn get_scroll_position(path: String) -> f64 {
    read_json_file::<HashMap<String, f64>>("scroll_positions.json")
        .and_then(|m| m.get(&path).copied())
        .unwrap_or(0.0)
}

// ─── Recent Files ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_recent_files() -> Vec<String> {
    read_json_file::<Vec<String>>("recent.json").unwrap_or_default()
}

#[tauri::command]
fn add_recent_file(path: String) -> Result<(), String> {
    let mut files = get_recent_files();
    files.retain(|f| f != &path);
    files.insert(0, path);
    files.truncate(20);
    write_json_file("recent.json", &files)
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

#[tauri::command]
fn get_bookmarks() -> Vec<Bookmark> {
    read_json_file::<Vec<Bookmark>>("bookmarks.json").unwrap_or_default()
}

#[tauri::command]
fn add_bookmark(path: String, name: String, is_dir: bool) -> Result<(), String> {
    let mut bookmarks = get_bookmarks();
    bookmarks.retain(|b| b.path != path);
    bookmarks.push(Bookmark { path, name, is_dir });
    write_json_file("bookmarks.json", &bookmarks)
}

#[tauri::command]
fn remove_bookmark(path: String) -> Result<(), String> {
    let mut bookmarks = get_bookmarks();
    bookmarks.retain(|b| b.path != path);
    write_json_file("bookmarks.json", &bookmarks)
}

// ─── Settings ────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_settings() -> serde_json::Value {
    read_json_file::<serde_json::Value>("settings.json")
        .unwrap_or_else(|| serde_json::json!({
            "fontSize": 16, "theme": "auto", "language": "ja",
            "sidebarVisible": false, "tocVisible": false
        }))
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    write_json_file("settings.json", &settings)
}

// ─── Search in File ──────────────────────────────────────────────────────────

#[tauri::command]
fn search_in_file(path: String, query: String, case_sensitive: bool) -> Result<Vec<SearchMatch>, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Read failed: {e}"))?;
    let mut matches = Vec::new();
    for (line_idx, line) in content.lines().enumerate() {
        let line_matches = find_matches_char_pos(line, &query, case_sensitive);
        for (char_col, char_len) in line_matches {
            matches.push(SearchMatch { line: line_idx + 1, column: char_col, length: char_len, context: line.to_string() });
        }
    }
    Ok(matches)
}

#[tauri::command]
fn get_source_line(path: String, heading_id: String) -> Result<usize, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Read failed: {e}"))?;
    let slug = heading_id.replace('-', " ").to_lowercase();
    for (idx, line) in content.lines().enumerate() {
        if line.to_lowercase().contains(&slug) && line.trim_start().starts_with('#') {
            return Ok(idx + 1);
        }
    }
    Ok(1)
}

// ─── External & Dialog ───────────────────────────────────────────────────────

#[tauri::command]
fn check_file_exists(path: String) -> bool {
    let p = PathBuf::from(&path);
    p.is_file() && is_markdown_ext(&p)
}

#[tauri::command]
fn open_external(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed: {e}"))
}

#[tauri::command]
async fn show_open_file_dialog(handle: AppHandle) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let paths = handle.dialog().file()
        .add_filter("Markdown", &["md", "markdown", "mdown", "mkdn", "mkd", "mdwn"])
        .blocking_pick_files();
    match paths {
        Some(files) => Ok(files.iter().filter_map(|f| f.as_path().map(|p| p.to_string_lossy().to_string())).collect()),
        None => Ok(vec![]),
    }
}

#[tauri::command]
async fn show_open_folder_dialog(handle: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = handle.dialog().file().blocking_pick_folder();
    match path {
        Some(p) => Ok(p.as_path().map(|p| p.to_string_lossy().to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
fn get_cli_args(state: State<'_, AppState>) -> serde_json::Value {
    let args = state.cli_args.lock().unwrap();
    serde_json::json!({ "paths": args.paths, "open": args.open, "directory": args.directory })
}

// ─── App Bootstrap ───────────────────────────────────────────────────────────

pub fn run() {
    let cli = CliArgs::parse();
    let initial_paths = cli.paths.clone();
    let initial_dir = cli.directory.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let _ = app.emit("single-instance-args", argv);
            if let Some(w) = app.get_webview_window("main") { let _ = w.set_focus(); }
        }))
        .manage(AppState {
            current_file: Mutex::new(None),
            current_dir: Mutex::new(initial_dir.as_ref().map(PathBuf::from)),
            project_root: Mutex::new(initial_dir.as_ref().map(PathBuf::from)),
            watcher: Mutex::new(None),
            cli_args: Mutex::new(cli),
        })
        .invoke_handler(tauri::generate_handler![
            render_markdown, read_file, list_directory, watch_file, unwatch_file,
            set_project_root, get_project_root, search_project,
            save_scroll_position, get_scroll_position,
            get_recent_files, add_recent_file,
            get_bookmarks, add_bookmark, remove_bookmark,
            get_settings, save_settings,
            search_in_file, get_source_line,
            check_file_exists, open_external, show_open_file_dialog, show_open_folder_dialog,
            get_cli_args,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let paths = initial_paths.clone();
            let dir = initial_dir.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(400));
                if let Some(d) = &dir {
                    if PathBuf::from(d).is_dir() {
                        let _ = handle.emit("open-directory", d.clone());
                    }
                }
                for p in &paths {
                    let path = PathBuf::from(p);
                    if path.is_dir() { let _ = handle.emit("open-directory", p.clone()); }
                    else if path.is_file() { let _ = handle.emit("open-file", p.clone()); }
                    // Skip non-existent paths silently
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Voir");
}
