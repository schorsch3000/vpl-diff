#!/usr/bin/env bash
# Regenerate index.json from every .vpl file in this directory.
#
# Usage: run from anywhere — the script operates on its own directory.
#   ./palettes/build-index.sh
set -euo pipefail

# Directory this script lives in (the palettes directory).
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v jq >/dev/null 2>&1 || { echo "error: jq is required but not installed." >&2; exit 1; }

# List *.vpl filenames (basename only), sort them, and turn the lines into a
# JSON array of strings. Palette filenames don't contain newlines, so
# splitting on "\n" is safe here.
find "$dir" -maxdepth 1 -type f -name '*.vpl' -printf '%f\n' \
  | sort \
  | jq -R -s 'split("\n") | map(select(length > 0))' \
  > "$dir/index.json"

count="$(jq 'length' "$dir/index.json")"
echo "Wrote $dir/index.json ($count palette(s))."
