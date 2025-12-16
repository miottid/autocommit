# autocommit

CLI tools that use Claude to automatically generate git commit messages and pull request descriptions.

## Tools

- **autocommit** - Generate commit messages from staged changes
- **autopr** - Generate PR titles and descriptions from branch changes

## Requirements

- [Bun](https://bun.sh) runtime
- `ANTHROPIC_API_KEY` environment variable
- `gh` CLI (for autopr) - [GitHub CLI](https://cli.github.com)

## Installation

### From source

```bash
git clone https://github.com/miottid/autocommit.git
cd autocommit
bun install
bun run build
cp dist/autocommit dist/autopr /usr/local/bin/
```

### Run directly with Bun

```bash
bun autocommit.ts
bun autopr.ts
```

## Usage

### autocommit

Generates a commit message based on staged changes and commits automatically.

```bash
# Stage your changes
git add .

# Generate commit message and commit
autocommit
```

### autopr

Generates a PR title and description, then creates the PR via GitHub CLI.

```bash
# From a feature branch
autopr
```

## Configuration

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

Or add it to a `.env` file (Bun loads it automatically).

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

## License

MIT
