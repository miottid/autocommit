use autocommit_core::{
    anthropic::AnthropicClient, exit_with_error, git, utils, Config, Error, Result,
};
use clap::Parser;

/// Generate commit messages from staged changes using AI
#[derive(Parser)]
#[command(name = "autocommit")]
#[command(about = "Generate commit messages from staged changes using AI")]
struct Cli {
    /// Dry run mode - generate message but don't commit
    #[arg(long)]
    dry_run: bool,
}

async fn run() -> Result<()> {
    // Load .env file if it exists
    dotenvy::dotenv().ok();

    // Parse CLI arguments
    let cli = Cli::parse();

    // Load configuration
    let config = Config::from_env()?;

    // Get staged files
    let staged_files = git::get_staged_files().await?;
    if staged_files.is_empty() {
        return Err(Error::User(
            "No staged changes found. Stage your changes with 'git add' first.".to_string(),
        ));
    }

    println!("Staged files:\n  {}\n", staged_files.join("\n  "));

    // Get the staged diff
    let raw_diff = git::get_staged_diff().await?;
    if raw_diff.trim().is_empty() {
        return Err(Error::User(
            "No diff content found in staged changes.".to_string(),
        ));
    }

    // Truncate large diffs
    let (diff, was_truncated) = utils::truncate_diff(&raw_diff, utils::MAX_DIFF_SIZE);
    if was_truncated {
        println!(
            "\nNote: Diff was truncated ({} chars -> {} chars)",
            raw_diff.len(),
            utils::MAX_DIFF_SIZE
        );
    }

    // Generate commit message
    let client = AnthropicClient::new(config);
    let commit_message = client.generate_commit_message(&diff).await?;

    println!("\nGenerated commit message:\n{}\n", commit_message);

    // Exit if dry-run
    if cli.dry_run {
        println!("[dry-run] Would commit with the above message.");
        return Ok(());
    }

    // Commit with the generated message
    let output = git::git_commit(&commit_message).await?;
    println!("{}", output);

    Ok(())
}

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        exit_with_error(e);
    }
}
