---
description: Rust project instructions
globs: "*.rs, Cargo.toml, Justfile"
alwaysApply: true
---

This is a Rust project. Use cargo and standard Rust tooling.

## Build and Run

- Use `cargo build` for debug builds
- Use `cargo build --release` for optimized builds
- Use `cargo test` to run tests
- Use `cargo check` for fast compilation checking
- Use `cargo clippy` for linting
- Use `cargo fmt` for formatting

## Workspace Structure

This is a Cargo workspace with three crates:
- `crates/autocommit-core` - Shared library
- `crates/autocommit` - Binary for commit message generation
- `crates/autopr` - Binary for PR generation

## Running Binaries

- `cargo run --bin autocommit` - Run autocommit
- `cargo run --bin autopr` - Run autopr
- Or use the `just` recipes defined in `Justfile`

## Environment Variables

- Environment variables are loaded from `.env` files using the `dotenvy` crate
- Required: `ANTHROPIC_API_KEY`
- Optional: `AUTOCOMMIT_MODEL`
