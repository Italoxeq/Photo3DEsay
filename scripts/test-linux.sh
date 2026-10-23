#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

printf '\n== Python worker tests ==\n'
PYTHONPATH=worker python3 -m unittest discover -s worker/tests -v

printf '\n== Frontend production bundle ==\n'
npm run build

printf '\n== Rust tests ==\n'
cd src-tauri
cargo test --workspace
