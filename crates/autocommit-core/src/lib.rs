//! Core library for autocommit and autopr tools
//!
//! This library provides the core functionality for generating commit messages
//! and pull request descriptions using Claude (Anthropic AI).
//!
//! # Modules
//!
//! - `errors`: Error types and handling
//! - `config`: Configuration from environment variables
//! - `utils`: Utility functions for file filtering and diff truncation
//! - `git`: Git and GitHub CLI subprocess operations
//! - `anthropic`: Anthropic API client

pub mod anthropic;
pub mod config;
pub mod errors;
pub mod git;
pub mod utils;

// Re-export commonly used types
pub use anthropic::{AnthropicClient, PRContent};
pub use config::Config;
pub use errors::{exit_with_error, Error, Result};
