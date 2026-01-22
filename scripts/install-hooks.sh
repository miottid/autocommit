#!/bin/bash
# Install git hooks for the autocommit project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_DIR="$(git rev-parse --git-dir)"

echo "Installing git hooks..."

# Install pre-commit hook
cp "$SCRIPT_DIR/pre-commit" "$GIT_DIR/hooks/pre-commit"
chmod +x "$GIT_DIR/hooks/pre-commit"
echo "✅ Pre-commit hook installed"

# Install pre-push hook
cp "$SCRIPT_DIR/pre-push" "$GIT_DIR/hooks/pre-push"
chmod +x "$GIT_DIR/hooks/pre-push"
echo "✅ Pre-push hook installed"

echo ""
echo "Git hooks installed successfully!"
echo ""
echo "Pre-commit hook:"
echo "  - Automatically runs 'cargo fmt' before each commit"
echo "  - Formatted files are re-staged automatically"
echo ""
echo "Pre-push hook:"
echo "  - Runs 'cargo clippy' before pushing to remote"
echo "  - Catches linting issues early (same checks as CI)"
echo "  - Use 'git push --no-verify' to skip if needed"
