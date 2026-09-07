#!/usr/bin/env bash
# Build a Chrome Web Store zip containing only the runtime files.
set -euo pipefail
cd "$(dirname "$0")"
version=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
out="dist/element-shot-$version.zip"
rm -f "$out"
zip -X -r "$out" manifest.json background.js content.js about.html about.js icons/ -x '*.DS_Store'
echo "wrote $out"
unzip -l "$out"
