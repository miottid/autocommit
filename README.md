# autocommit

[![CI](https://github.com/miottid/autocommit/workflows/CI/badge.svg)](https://github.com/miottid/autocommit/actions)

CLI tools that use Claude to automatically generate git commit messages and pull request descriptions.

Written in Rust for fast startup, small binaries, and zero runtime dependencies.

## Tools

- **autocommit** - Generate commit messages from staged changes
- **autopr** - Generate PR titles and descriptions from branch changes

## Requirements

- Rust toolchain (for building from source)
- `ANTHROPIC_API_KEY` environment variable
- `gh` CLI (for autopr) - [GitHub CLI](https://cli.github.com)

## Installation

### From source

```bash
git clone https://github.com/miottid/autocommit.git
cd autocommit
cargo build --release
cp target/release/autocommit target/release/autopr /usr/local/bin/
```

### Install with cargo

```bash
cargo install --path crates/autocommit
cargo install --path crates/autopr
```

### Set up development environment

If you're contributing to the project, install the git hooks to ensure code quality:

```bash
# Using just
just install-hooks

# Or manually
./scripts/install-hooks.sh
```

This installs two hooks:
- **Pre-commit**: Automatically formats code with `cargo fmt` and re-stages files
- **Pre-push**: Runs `cargo clippy` to catch linting issues before pushing (use `git push --no-verify` to skip if needed)

### Build for multiple platforms

Using [just](https://github.com/casey/just):

```bash
# Install just if you don't have it
cargo install just

# Build for current platform
just build

# Cross-compile for other platforms
just build-linux        # Linux x86_64
just build-macos-intel  # macOS Intel
just build-macos-arm    # macOS Apple Silicon
just build-windows      # Windows x86_64

# Run tests
just test

# Format and lint
just fmt
just lint
```

## Usage

### autocommit

Generates a commit message based on staged changes and commits automatically.

```bash
# Stage your changes
git add .

# Generate commit message and commit
autocommit

# Dry run mode (generate message but don't commit)
autocommit --dry-run
```

### autopr

Generates a PR title and description, then creates the PR via GitHub CLI.

```bash
# From a feature branch
autopr

# Skip confirmation prompt
autopr --yes

# Dry run mode (generate PR content but don't create it)
autopr --dry-run
```

## Why Rust?

- **Fast startup**: ~10ms (no runtime overhead)
- **Small binaries**: ~2-5MB (stripped, optimized)
- **Low memory usage**: ~5-10MB (no GC or runtime)
- **No runtime dependency**: Statically linked, runs anywhere
- **Cross-platform**: Single codebase for Linux, macOS, Windows

## Configuration

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

Or add it to a `.env` file (loaded automatically).

Optionally customize the model:

```bash
export AUTOCOMMIT_MODEL=claude-sonnet-4-20250514  # default
```

### Git Aliases

Set up git aliases to use `git autocommit` and `git autopr`:

```bash
git config --global alias.autocommit '!autocommit'
git config --global alias.autopr '!autopr'
```

Then use:

```bash
git add .
git autocommit

# or for PRs
git autopr
```

## Architecture

The project is structured as a Cargo workspace with three crates:

- **autocommit-core** - Shared library with core functionality
  - Error handling
  - Config management
  - Git/GitHub CLI operations
  - Anthropic API client
  - Utility functions (lock file filtering, diff truncation)

- **autocommit** - Binary for commit message generation
- **autopr** - Binary for PR generation with interactive feedback loop

## Features

- Automatically excludes lock files from diffs (package-lock.json, Cargo.lock, etc.)
- Truncates large diffs to stay within API limits
- Interactive clarification loop for PRs
- Iterative PR content adjustment based on user feedback
- Automatically pushes branches before creating PRs
- Supports PR templates from `.github/PULL_REQUEST_TEMPLATE.md`

## CI/CD

The project uses GitHub Actions for continuous integration:

- **Test**: Runs `cargo test` on Linux, macOS, and Windows
- **Lint**: Runs `cargo fmt --check` and `cargo clippy` to ensure code quality
- **Build**: Creates release binaries for all platforms and uploads them as artifacts

**Note:** The CI will fail if code is not properly formatted. Run `cargo fmt --all` before pushing or install the pre-commit hook to check automatically.

## License

MIT
