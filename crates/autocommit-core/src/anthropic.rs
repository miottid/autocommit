use crate::config::Config;
use crate::errors::{Error, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// Anthropic API client
pub struct AnthropicClient {
    client: Client,
    config: Config,
}

/// Message in a conversation
#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
    pub role: String,
    pub content: String,
}

/// Request to the Anthropic API
#[derive(Serialize, Debug)]
struct MessageRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<Message>,
}

/// Content block in the API response
#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
}

/// Response from the Anthropic API
#[derive(Deserialize, Debug)]
struct MessageResponse {
    content: Vec<ContentBlock>,
}

/// Pull request content
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PRContent {
    pub title: String,
    pub body: String,
    #[serde(rename = "needsClarification")]
    pub needs_clarification: Option<bool>,
    #[serde(rename = "clarificationQuestion")]
    pub clarification_question: Option<String>,
}

impl AnthropicClient {
    /// Create a new Anthropic API client
    pub fn new(config: Config) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Send a message to the Anthropic API
    async fn send_message(&self, messages: Vec<Message>, max_tokens: u32) -> Result<String> {
        let request = MessageRequest {
            model: self.config.model.clone(),
            max_tokens,
            messages,
        };

        let response = self
            .client
            .post(API_URL)
            .header("x-api-key", &self.config.anthropic_api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| String::from("Unknown error"));
            return Err(Error::Api(format!(
                "API request failed with status {}: {}",
                status, error_text
            )));
        }

        let message_response: MessageResponse = response.json().await?;

        // Extract text from first content block
        match message_response.content.first() {
            Some(ContentBlock::Text { text }) => Ok(text.trim().to_string()),
            None => Err(Error::Api("Empty response from API".to_string())),
        }
    }

    /// Generate a commit message from a diff
    pub async fn generate_commit_message(&self, diff: &str) -> Result<String> {
        let prompt = format!(
            "Generate a concise git commit message for the following diff. The message should:
- Start with a type prefix (feat, fix, docs, style, refactor, test, chore)
- Be written in imperative mood
- Be a single line, max 72 characters
- Not include any explanation, just the commit message

Diff:
{}",
            diff
        );

        let messages = vec![Message {
            role: "user".to_string(),
            content: prompt,
        }];

        self.send_message(messages, 256).await
    }

    /// Generate PR content from commits and diff
    pub async fn generate_pr_content(
        &self,
        commits: &str,
        diff: &str,
        changed_files: &[String],
        template: Option<&str>,
        additional_context: Option<&str>,
        existing_pr: Option<&PRContent>,
    ) -> Result<PRContent> {
        let prompt = if let Some(pr) = existing_pr {
            // Update existing PR
            let context = additional_context.unwrap_or("");
            format!(
                "Update the following GitHub Pull Request based on the user's feedback.

Current PR:
Title: {}
Body:
{}

User feedback: {}

Respond in JSON format:
{{
  \"title\": \"Updated PR title (concise, max 72 chars)\",
  \"body\": \"Updated PR description\",
  \"needsClarification\": false,
  \"clarificationQuestion\": null
}}

Only output valid JSON, no markdown code blocks.",
                pr.title, pr.body, context
            )
        } else {
            // Generate new PR
            let template_instructions = if let Some(tmpl) = template {
                format!(
                    "Use this PR template as a guide for the body structure. IMPORTANT: Remove any sections from the template that are not relevant to the changes (e.g., if there are no breaking changes, remove the breaking changes section; if there are no migrations, remove the migration section).\n\nTemplate:\n{}\n\n",
                    tmpl
                )
            } else {
                "Structure the PR body with these sections (only include sections relevant to the changes):
## Summary
Brief description of changes

## Changes
- Bullet points of specific changes

## Testing
How to test these changes
"
                .to_string()
            };

            let context_info = if let Some(ctx) = additional_context {
                format!("\nAdditional context from user: {}\n", ctx)
            } else {
                String::new()
            };

            // Truncate diff to 8000 characters
            let truncated_diff = if diff.len() > 8000 {
                &diff[..8000]
            } else {
                diff
            };

            format!(
                "Generate a GitHub Pull Request title and description based on the following information.
{}
{}
Changed files:
{}

Commits:
{}

Diff (truncated if too long):
{}

Respond in JSON format:
{{
  \"title\": \"PR title (concise, max 72 chars)\",
  \"body\": \"PR description following the template\",
  \"needsClarification\": false,
  \"clarificationQuestion\": null
}}

If the changes are unclear or you need more context to write a good PR description, set needsClarification to true and provide a specific clarificationQuestion.

Only output valid JSON, no markdown code blocks.",
                context_info,
                template_instructions,
                changed_files.join("\n"),
                commits,
                truncated_diff
            )
        };

        let messages = vec![Message {
            role: "user".to_string(),
            content: prompt,
        }];

        let response_text = self.send_message(messages, 1024).await?;

        // Parse JSON response
        serde_json::from_str::<PRContent>(&response_text).map_err(|e| {
            Error::Api(format!(
                "Failed to parse API response as JSON: {}\nResponse: {}",
                e, response_text
            ))
        })
    }
}
