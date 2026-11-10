#!/bin/bash
# 无头 Chrome 截图 QA：用法 ./shot.sh <name> "<query>"
set -e
NAME="${1:-shot}"
Q="${2:-}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="/Users/lihuiqin/www/spaceboat2/shots/${NAME}.png"
mkdir -p /Users/lihuiqin/www/spaceboat2/shots
URL="file:///Users/lihuiqin/www/spaceboat2/starforge-7.html?still=1&${Q}"
"$CHROME" --headless=new \
  --use-angle=swiftshader --enable-unsafe-swiftshader --disable-gpu-sandbox \
  --hide-scrollbars --window-size=1600,1000 \
  --screenshot="$OUT" --virtual-time-budget=9000 \
  --enable-logging=stderr --v=0 \
  "$URL" 2>&1 | grep -iE "error|exception|uncaught|console" | grep -viE "gl_utils|WebGL-0x|WidgetHost|externally_managed|GPU stall|Failed to install" | head -20 || true
echo "→ $OUT"
