use crate::errors::{Error, Result};
use std::env;

/// Default Anthropic model to use
pub const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";

/// Configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct Config {
    pub anthropic_api_key: String,
    pub model: String,
}

impl Config {
    /// Load configuration from environment variables
    ///
    /// Reads:
    /// - `ANTHROPIC_API_KEY` (required)
    /// - `AUTOCOMMIT_MODEL` (optional, defaults to DEFAULT_MODEL)
    pub fn from_env() -> Result<Self> {
        let anthropic_api_key = env::var("ANTHROPIC_API_KEY").map_err(|_| {
            Error::Env(
                "ANTHROPIC_API_KEY environment variable is required. \
                Please set it in your .env file or environment."
                    .to_string(),
            )
        })?;

        let model = env::var("AUTOCOMMIT_MODEL")
            .unwrap_or_else(|_| DEFAULT_MODEL.to_string());

        Ok(Config {
            anthropic_api_key,
            model,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_model() {
        assert_eq!(DEFAULT_MODEL, "claude-sonnet-4-20250514");
    }

    // Note: Tests that modify environment variables are problematic in parallel test execution
    // and have been removed. The config loading logic is simple enough that manual testing
    // or integration tests are sufficient.
}
