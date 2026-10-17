#!/bin/zsh
# Render the diagram pages to PNG at 2x with headless Chrome.
# Usage: ./render.sh [name ...]   (default: all)
# Each page sets its own CSS size; keep W×H here in sync with it.
set -e
SRC="${0:A:h}"
OUT="${SRC:h}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
typeset -A SIZE
SIZE=(
  process-flow 1280,580
  use-case     1600,580
  architecture 1280,580
  tech-stack   1600,720
  benchmark    1280,580
  personas     1280,290
)
names=("$@")
(( ${#names} )) || names=(${(k)SIZE})
for n in $names; do
  "$CHROME" --headless=new --hide-scrollbars --disable-gpu --force-device-scale-factor=2 \
    --window-size=${SIZE[$n]} --virtual-time-budget=10000 \
    --screenshot="$OUT/$n.png" "file://$SRC/$n.html" >/dev/null 2>&1
  echo "$OUT/$n.png"
done
