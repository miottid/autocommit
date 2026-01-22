use crate::errors::{Error, Result};
use crate::utils::{filter_lock_files, get_lock_file_exclusions};
use regex::Regex;
use tokio::process::Command;

/// Run a git command and return its stdout
///
/// # Errors
///
/// Returns `Error::Git` if the command fails
async fn run_git(args: &[&str]) -> Result<String> {
    let output = Command::new("git")
        .args(args)
        .output()
        .await
        .map_err(|e| Error::Io(e))?;

    if !output.status.success() {
        let command = format!("git {}", args.join(" "));
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(Error::Git { command, stderr });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Run a GitHub CLI command and return its stdout
///
/// # Errors
///
/// Returns `Error::Git` if the command fails
async fn run_gh(args: &[&str]) -> Result<String> {
    let output = Command::new("gh")
        .args(args)
        .output()
        .await
        .map_err(|e| Error::Io(e))?;

    if !output.status.success() {
        let command = format!("gh {}", args.join(" "));
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(Error::Git { command, stderr });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Get the current branch name
pub async fn get_current_branch() -> Result<String> {
    run_git(&["branch", "--show-current"]).await
}

/// Get the default branch name (usually "main" or "master")
///
/// Attempts to detect from remote, falls back to "main"
pub async fn get_default_branch() -> Result<String> {
    match run_git(&["remote", "show", "origin"]).await {
        Ok(remote) => {
            let re = Regex::new(r"HEAD branch: (.+)").unwrap();
            if let Some(captures) = re.captures(&remote) {
                if let Some(branch) = captures.get(1) {
                    return Ok(branch.as_str().trim().to_string());
                }
            }
            Ok("main".to_string())
        }
        Err(_) => Ok("main".to_string()),
    }
}

/// Check if the current branch exists on the remote
pub async fn remote_branch_exists() -> Result<bool> {
    let branch = get_current_branch().await?;
    match run_git(&["ls-remote", "--exit-code", "--heads", "origin", &branch]).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Check if there are unpushed commits on the current branch
pub async fn check_unpushed_commits() -> Result<bool> {
    match run_git(&["status", "-sb"]).await {
        Ok(status) => Ok(status.contains("ahead")),
        Err(_) => Ok(false),
    }
}

/// Push the current branch to the remote
pub async fn push_branch() -> Result<()> {
    let branch = get_current_branch().await?;
    println!("Pushing branch {}...", branch);
    run_git(&["push", "-u", "origin", &branch]).await?;
    Ok(())
}

/// Get the staged diff, excluding lock files
pub async fn get_staged_diff() -> Result<String> {
    let exclusions = get_lock_file_exclusions();
    let exclusion_refs: Vec<&str> = exclusions.iter().map(|s| s.as_str()).collect();

    let mut args = vec!["diff", "--staged", "--", "."];
    args.extend(&exclusion_refs);

    run_git(&args).await
}

/// Get the list of staged files, excluding lock files
pub async fn get_staged_files() -> Result<Vec<String>> {
    let output = run_git(&["diff", "--staged", "--name-only"]).await?;
    let files: Vec<String> = output
        .lines()
        .filter(|line| !line.is_empty())
        .map(|s| s.to_string())
        .collect();
    Ok(filter_lock_files(files))
}

/// Commit staged changes with the given message
pub async fn git_commit(message: &str) -> Result<String> {
    run_git(&["commit", "-m", message]).await
}

/// Get commits from base branch to HEAD
///
/// Falls back to last 10 commits if base branch comparison fails
pub async fn get_commits(base_branch: &str) -> Result<String> {
    let range = format!("{}..HEAD", base_branch);
    match run_git(&["log", &range, "--pretty=format:%s%n%b", "--reverse"]).await {
        Ok(output) => Ok(output),
        Err(_) => run_git(&["log", "-10", "--pretty=format:%s%n%b", "--reverse"]).await,
    }
}

/// Get diff from base branch to HEAD, excluding lock files
///
/// Falls back to last 5 commits if base branch comparison fails
pub async fn get_diff(base_branch: &str) -> Result<String> {
    let exclusions = get_lock_file_exclusions();
    let exclusion_refs: Vec<&str> = exclusions.iter().map(|s| s.as_str()).collect();

    let range = format!("{}...HEAD", base_branch);
    let mut args = vec!["diff", range.as_str(), "--", "."];
    args.extend(&exclusion_refs);

    match run_git(&args).await {
        Ok(output) => Ok(output),
        Err(_) => {
            let mut fallback_args = vec!["diff", "HEAD~5", "HEAD", "--", "."];
            fallback_args.extend(&exclusion_refs);
            run_git(&fallback_args).await
        }
    }
}

/// Get list of changed files from base branch to HEAD, excluding lock files
///
/// Falls back to last 5 commits if base branch comparison fails
pub async fn get_changed_files(base_branch: &str) -> Result<Vec<String>> {
    let range = format!("{}...HEAD", base_branch);

    let output = match run_git(&["diff", "--name-only", &range]).await {
        Ok(output) => output,
        Err(_) => run_git(&["diff", "--name-only", "HEAD~5", "HEAD"]).await?,
    };

    let files: Vec<String> = output
        .lines()
        .filter(|line| !line.is_empty())
        .map(|s| s.to_string())
        .collect();
    Ok(filter_lock_files(files))
}

/// Get the URL of an existing PR for the current branch
///
/// Returns None if no PR exists
pub async fn get_existing_pr() -> Result<Option<String>> {
    match run_gh(&["pr", "view", "--json", "url", "--jq", ".url"]).await {
        Ok(url) if !url.is_empty() => Ok(Some(url)),
        _ => Ok(None),
    }
}

/// Create a new pull request
pub async fn create_pr(
    title: &str,
    body: &str,
    base_branch: &str,
    head_branch: &str,
) -> Result<String> {
    run_gh(&[
        "pr",
        "create",
        "--title",
        title,
        "--body",
        body,
        "--base",
        base_branch,
        "--head",
        head_branch,
    ])
    .await
}
