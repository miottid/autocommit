# Build all binaries in release mode
build:
    cargo build --release

# Build for Linux x86_64
build-linux:
    cargo build --release --target x86_64-unknown-linux-gnu

# Build for macOS Intel
build-macos-intel:
    cargo build --release --target x86_64-apple-darwin

# Build for macOS ARM (Apple Silicon)
build-macos-arm:
    cargo build --release --target aarch64-apple-darwin

# Build for Windows
build-windows:
    cargo build --release --target x86_64-pc-windows-gnu

# Install binaries to cargo bin directory
install:
    cargo install --path crates/autocommit
    cargo install --path crates/autopr

# Run all tests
test:
    cargo test --workspace

# Run linter
lint:
    cargo clippy --workspace -- -D warnings
    cargo fmt --all -- --check

# Format code
fmt:
    cargo fmt --all

# Clean build artifacts
clean:
    cargo clean

# Check if code compiles without building
check:
    cargo check --workspace

# Install git hooks
install-hooks:
    ./scripts/install-hooks.sh
