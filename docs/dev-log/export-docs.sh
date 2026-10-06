#!/usr/bin/env bash
# Converts every session log (20*.md) to Word (.docx) and LibreOffice (.odt)
cd "$(dirname "$0")"
mkdir -p word libreoffice
for f in 20*.md; do
  b="${f%.md}"
  pandoc -f gfm "$f" -o "word/$b.docx"
  pandoc -f gfm "$f" -o "libreoffice/$b.odt"
  echo "converted $b"
done
