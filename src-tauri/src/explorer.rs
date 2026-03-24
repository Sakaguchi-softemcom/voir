use crate::FileNode;
use std::io;
use std::path::PathBuf;

/// List directory contents recursively up to a given depth.
/// Only includes Markdown files and directories that contain Markdown files.
pub fn list_dir(path: &PathBuf, max_depth: u32) -> io::Result<Vec<FileNode>> {
    if !path.is_dir() {
        return Err(io::Error::new(io::ErrorKind::NotADirectory, "Not a directory"));
    }

    let mut entries: Vec<FileNode> = Vec::new();
    let mut dir_entries: Vec<_> = std::fs::read_dir(path)?
        .filter_map(|e| e.ok())
        .collect();

    // Sort: directories first, then files, alphabetically
    dir_entries.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    for entry in dir_entries {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs
        if name.starts_with('.') {
            continue;
        }

        // Skip common non-doc directories
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            if matches!(
                name.as_str(),
                "node_modules" | "target" | ".git" | "__pycache__" | "dist" | "build" | ".next"
            ) {
                continue;
            }
        }

        let full_path = entry.path();

        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            if max_depth > 0 {
                let children = list_dir(&full_path, max_depth - 1)?;
                // Only include directory if it has markdown-relevant content
                if !children.is_empty() {
                    entries.push(FileNode {
                        name,
                        path: full_path.to_string_lossy().to_string(),
                        is_dir: true,
                        children: Some(children),
                    });
                }
            }
        } else if is_markdown_file(&name) {
            entries.push(FileNode {
                name,
                path: full_path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }

    Ok(entries)
}

fn is_markdown_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".md")
        || lower.ends_with(".markdown")
        || lower.ends_with(".mdown")
        || lower.ends_with(".mkdn")
        || lower.ends_with(".mkd")
        || lower.ends_with(".mdwn")
}
