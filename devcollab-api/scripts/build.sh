#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON=${PYTHON:-python3}
rm -rf build dist
mkdir -p build/deps dist
"$PYTHON" -m pip install -r requirements.txt --target build/deps --upgrade --quiet --no-compile

for fn in utilisateurs projets pull_requests reviews activite; do
  name="devcollab-${fn//_/-}"
  dir="build/$fn"
  mkdir -p "$dir"
  cp -r build/deps/. "$dir/"
  cp -r common "$dir/common"
  cp "functions/$fn/lambda_function.py" "$dir/"
  find "$dir" -name "__pycache__" -type d -prune -exec rm -rf {} +
  (cd "$dir" && zip -qr "../../dist/$name.zip" .)
  echo "dist/$name.zip"
done
