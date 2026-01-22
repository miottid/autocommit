#!/bin/bash
# Install git hooks for the autocommit project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_DIR="$(git rev-parse --git-dir)"

echo "Installing git hooks..."

# Install pre-commit hook
cp "$SCRIPT_DIR/pre-commit" "$GIT_DIR/hooks/pre-commit"
chmod +x "$GIT_DIR/hooks/pre-commit"

echo "✅ Pre-commit hook installed successfully!"
echo ""
echo "The hook will automatically run 'cargo fmt' before each commit."
echo "Formatted files will be re-staged automatically."
