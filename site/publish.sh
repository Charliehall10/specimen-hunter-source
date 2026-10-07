#!/usr/bin/env bash
# Publish the portfolio site to GitHub Pages.
#   bash site/publish.sh [repo-name]        (default repo name: specimen-hunter)
# Needs the GitHub CLI logged in (gh auth login). Creates <you>/<repo-name> as a PUBLIC repo holding ONLY the
# built site (landing page, playable demo, media) - never the source code, simulator or PAR sheet.
# Running it again updates the site with a normal commit (history is kept, nothing is force-pushed).
set -euo pipefail
REPO_NAME="${1:-specimen-hunter}"
export PATH="$HOME/.local/bin:$PATH"
cd "$(dirname "$0")/.."

gh auth status >/dev/null 2>&1 || { echo "Not logged in to GitHub. Run: gh auth login"; exit 1; }
GH_USER=$(gh api user -q .login)
GH_ID=$(gh api user -q .id)
GH_NAME=$(gh api user -q '.name // .login')
gh auth setup-git

bash site/build.sh

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
if gh repo view "$GH_USER/$REPO_NAME" >/dev/null 2>&1; then
  gh repo clone "$GH_USER/$REPO_NAME" "$WORK/repo" -- -q
else
  gh repo create "$REPO_NAME" --public \
    --description "Specimen Hunter: playable demo of an original UK carp-fishing slot (demo money only)"
  mkdir -p "$WORK/repo" && git -C "$WORK/repo" init -q -b main
  git -C "$WORK/repo" remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
fi

# Replace the published files with the new build (keep the .git folder)
find "$WORK/repo" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r site/dist/. "$WORK/repo/"
git -C "$WORK/repo" add -A
if git -C "$WORK/repo" diff --cached --quiet; then
  echo "No changes to publish."
else
  git -C "$WORK/repo" -c user.name="$GH_NAME" -c user.email="$GH_ID+$GH_USER@users.noreply.github.com" \
    commit -q -m "Publish Specimen Hunter demo site ($(date +%F))"
  git -C "$WORK/repo" push -q -u origin main
fi

# Turn on GitHub Pages from the main branch (ignored if it is already on)
gh api -X POST "repos/$GH_USER/$REPO_NAME/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true
echo
echo "Published: https://$GH_USER.github.io/$REPO_NAME/   (the first publish can take a minute or two to appear)"
