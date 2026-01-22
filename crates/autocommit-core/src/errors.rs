use std::process;
use thiserror::Error;

/// Custom error types for autocommit operations
#[derive(Error, Debug)]
pub enum Error {
    /// User-facing errors (no staged changes, not on branch, etc.)
    #[error("{0}")]
    User(String),

    /// Git command failures
    #[error("Git command failed: {command}\n{stderr}")]
    Git { command: String, stderr: String },

    /// Anthropic API errors
    #[error("Anthropic API error: {0}")]
    Api(String),

    /// File system I/O errors
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// JSON parsing errors
    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),

    /// HTTP request errors
    #[error("HTTP request error: {0}")]
    Http(#[from] reqwest::Error),

    /// Environment variable errors
    #[error("Environment variable error: {0}")]
    Env(String),
}

/// Helper function to print error and exit with code 1
pub fn exit_with_error(error: Error) -> ! {
    eprintln!("Error: {}", error);
    process::exit(1);
}

/// Result type alias for autocommit operations
pub type Result<T> = std::result::Result<T, Error>;
