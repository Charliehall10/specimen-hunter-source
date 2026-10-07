#!/usr/bin/env bash
# Build the static portfolio site into site/dist: landing page + playable demo (/play) + media.
# The demo runs the engine in the browser (no server), so GitHub Pages can host it.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf site/dist
mkdir -p site/dist/media
(cd client && npx vite build --base ./ --outDir ../site/dist/play --emptyOutDir)
cp site/index.html site/dist/index.html
cp docs/media/*.jpg docs/media/*.mp4 site/dist/media/
touch site/dist/.nojekyll
echo "built site/dist"
