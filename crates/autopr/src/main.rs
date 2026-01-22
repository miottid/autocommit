use autocommit_core::{anthropic::AnthropicClient, exit_with_error, git, Config, Error, Result};
use clap::Parser;
use dialoguer::Input;
use tokio::fs;

/// Generate PR title and description from branch changes
#[derive(Parser)]
#[command(name = "autopr")]
#[command(about = "Generate PR title and description from branch changes")]
struct Cli {
    /// Skip confirmation prompt and create PR immediately
    #[arg(short, long)]
    yes: bool,

    /// Dry run mode - generate PR content but don't create it
    #[arg(long)]
    dry_run: bool,
}

/// Get the PR template from the repository
async fn get_pr_template() -> Result<Option<String>> {
    let template_paths = [
        ".github/PULL_REQUEST_TEMPLATE.md",
        ".github/pull_request_template.md",
        "PULL_REQUEST_TEMPLATE.md",
        "pull_request_template.md",
    ];

    for path in &template_paths {
        match fs::read_to_string(path).await {
            Ok(content) => return Ok(Some(content)),
            Err(_) => continue,
        }
    }

    Ok(None)
}

async fn run() -> Result<()> {
    // Load .env file if it exists
    dotenvy::dotenv().ok();

    // Parse CLI arguments
    let cli = Cli::parse();

    // Load configuration
    let config = Config::from_env()?;

    // Get current and base branches
    let current_branch = git::get_current_branch().await?;
    if current_branch.is_empty() {
        return Err(Error::User(
            "Not on a branch. Please checkout a branch first.".to_string(),
        ));
    }

    let base_branch = git::get_default_branch().await?;
    println!("Current branch: {}", current_branch);
    println!("Base branch: {}", base_branch);

    if current_branch == base_branch {
        return Err(Error::User(format!(
            "You are on the base branch ({}). Create a feature branch first.",
            base_branch
        )));
    }

    // Check if PR already exists
    if let Some(existing_pr_url) = git::get_existing_pr().await? {
        println!("A PR already exists for this branch: {}", existing_pr_url);
        return Ok(());
    }

    // Push branch if needed (skip in dry-run mode)
    if !cli.dry_run {
        let remote_exists = git::remote_branch_exists().await?;
        let has_unpushed = git::check_unpushed_commits().await?;

        if !remote_exists || has_unpushed {
            git::push_branch().await?;
        }
    }

    // Gather PR information in parallel
    println!("\nGathering commit information...");
    let (commits, diff, changed_files, template) = tokio::join!(
        git::get_commits(&base_branch),
        git::get_diff(&base_branch),
        git::get_changed_files(&base_branch),
        get_pr_template()
    );

    let commits = commits?;
    let diff = diff?;
    let changed_files = changed_files?;
    let template = template?;

    if changed_files.is_empty() {
        return Err(Error::User(
            "No changes found compared to base branch.".to_string(),
        ));
    }

    println!("\nChanged files ({}):", changed_files.len());
    for file in changed_files.iter().take(10) {
        println!("  {}", file);
    }
    if changed_files.len() > 10 {
        println!("  ... and {} more", changed_files.len() - 10);
    }

    // Generate PR content
    println!("\nGenerating PR description...");
    let client = AnthropicClient::new(config);
    let mut pr_content = client
        .generate_pr_content(
            &commits,
            &diff,
            &changed_files,
            template.as_deref(),
            None,
            None,
        )
        .await?;

    // Handle clarification if needed
    while pr_content.needs_clarification.unwrap_or(false) {
        if let Some(question) = &pr_content.clarification_question {
            println!("\nClarification needed:");
            let answer: String = Input::new()
                .with_prompt(question)
                .allow_empty(true)
                .interact_text()
                .map_err(|e| Error::User(format!("Failed to read input: {}", e)))?;

            if answer.is_empty() {
                println!("Proceeding without additional context...");
                pr_content.needs_clarification = Some(false);
            } else {
                pr_content = client
                    .generate_pr_content(
                        &commits,
                        &diff,
                        &changed_files,
                        template.as_deref(),
                        Some(&answer),
                        None,
                    )
                    .await?;
            }
        } else {
            break;
        }
    }

    // Show preview
    println!("\n{}", "=".repeat(60));
    println!("PR PREVIEW");
    println!("{}", "=".repeat(60));
    println!("\nTitle: {}", pr_content.title);
    println!("\nBody:\n{}", pr_content.body);
    println!("\n{}", "=".repeat(60));

    // Exit if dry-run
    if cli.dry_run {
        println!("\n[dry-run] Would create PR with the above content.");
        return Ok(());
    }

    // Interactive adjustment loop unless --yes flag is passed
    if !cli.yes {
        loop {
            let response: String = Input::new()
                .with_prompt("Is this PR ready to create? (Y/n/comment)")
                .allow_empty(true)
                .interact_text()
                .map_err(|e| Error::User(format!("Failed to read input: {}", e)))?;

            let response_lower = response.trim().to_lowercase();

            if response_lower == "y" || response_lower == "yes" || response.is_empty() {
                break;
            } else if response_lower == "n" || response_lower == "no" {
                println!("PR creation cancelled.");
                return Ok(());
            } else {
                // User provided feedback - update existing PR
                println!("\nAdjusting PR based on your feedback...");

                pr_content = client
                    .generate_pr_content(
                        &commits,
                        &diff,
                        &changed_files,
                        template.as_deref(),
                        Some(&response),
                        Some(&pr_content),
                    )
                    .await?;

                // Show updated preview
                println!("\n{}", "=".repeat(60));
                println!("UPDATED PR PREVIEW");
                println!("{}", "=".repeat(60));
                println!("\nTitle: {}", pr_content.title);
                println!("\nBody:\n{}", pr_content.body);
                println!("\n{}", "=".repeat(60));
            }
        }
    }

    // Create PR
    println!("\nCreating PR...");
    let pr_url = git::create_pr(
        &pr_content.title,
        &pr_content.body,
        &base_branch,
        &current_branch,
    )
    .await?;
    println!("{}", pr_url);

    Ok(())
}

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        exit_with_error(e);
    }
}
