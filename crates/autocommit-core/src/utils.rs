/// Maximum diff size before truncation (8000 characters)
pub const MAX_DIFF_SIZE: usize = 8000;

/// Lock files to exclude from diffs and file lists
pub const EXCLUDED_LOCK_FILES: &[&str] = &[
    "package-lock.json",
    "bun.lock",
    "bun.lockb",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Gemfile.lock",
    "Cargo.lock",
    "poetry.lock",
    "composer.lock",
    "go.sum",
    "Pipfile.lock",
    "npm-shrinkwrap.json",
    "deno.lock",
    "flake.lock",
    "pdm.lock",
    "uv.lock",
];

/// Generate git pathspec exclusions for lock files
///
/// Returns a vector of strings in the format `:!filename` that can be
/// passed to git commands to exclude lock files from diffs.
pub fn get_lock_file_exclusions() -> Vec<String> {
    EXCLUDED_LOCK_FILES
        .iter()
        .map(|file| format!(":!{}", file))
        .collect()
}

/// Filter out lock files from a list of file paths
///
/// Removes any files whose basename matches one of the excluded lock files.
pub fn filter_lock_files(files: Vec<String>) -> Vec<String> {
    files
        .into_iter()
        .filter(|file| {
            let basename = file.rsplit('/').next().unwrap_or(file);
            !EXCLUDED_LOCK_FILES.contains(&basename)
        })
        .collect()
}

/// Truncate a diff if it exceeds the maximum size
///
/// Returns a tuple of (truncated_diff, was_truncated)
pub fn truncate_diff(diff: &str, max_size: usize) -> (String, bool) {
    if diff.len() <= max_size {
        (diff.to_string(), false)
    } else {
        let truncated = format!(
            "{}\n\n... (diff truncated, {} characters omitted)",
            &diff[..max_size],
            diff.len() - max_size
        );
        (truncated, true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_lock_file_exclusions() {
        let exclusions = get_lock_file_exclusions();
        assert!(!exclusions.is_empty());
        assert!(exclusions.contains(&":!package-lock.json".to_string()));
        assert!(exclusions.contains(&":!Cargo.lock".to_string()));
        assert_eq!(exclusions.len(), EXCLUDED_LOCK_FILES.len());
    }

    #[test]
    fn test_filter_lock_files_removes_lock_files() {
        let files = vec![
            "src/main.rs".to_string(),
            "package-lock.json".to_string(),
            "Cargo.lock".to_string(),
            "src/lib.rs".to_string(),
            "yarn.lock".to_string(),
        ];

        let filtered = filter_lock_files(files);
        assert_eq!(filtered, vec!["src/main.rs", "src/lib.rs"]);
    }

    #[test]
    fn test_filter_lock_files_with_paths() {
        let files = vec![
            "src/main.rs".to_string(),
            "frontend/package-lock.json".to_string(),
            "backend/Cargo.lock".to_string(),
            "src/lib.rs".to_string(),
        ];

        let filtered = filter_lock_files(files);
        assert_eq!(filtered, vec!["src/main.rs", "src/lib.rs"]);
    }

    #[test]
    fn test_filter_lock_files_preserves_non_lock_files() {
        let files = vec![
            "src/main.rs".to_string(),
            "README.md".to_string(),
            "config.json".to_string(),
        ];

        let filtered = filter_lock_files(files.clone());
        assert_eq!(filtered, files);
    }

    #[test]
    fn test_truncate_diff_no_truncation() {
        let diff = "This is a short diff";
        let (truncated, was_truncated) = truncate_diff(diff, 100);
        assert_eq!(truncated, diff);
        assert!(!was_truncated);
    }

    #[test]
    fn test_truncate_diff_with_truncation() {
        let diff = "a".repeat(1000);
        let (truncated, was_truncated) = truncate_diff(&diff, 100);
        assert!(was_truncated);
        assert!(truncated.starts_with(&"a".repeat(100)));
        assert!(truncated.contains("900 characters omitted"));
    }

    #[test]
    fn test_truncate_diff_exact_size() {
        let diff = "a".repeat(100);
        let (truncated, was_truncated) = truncate_diff(&diff, 100);
        assert_eq!(truncated, diff);
        assert!(!was_truncated);
    }
}
