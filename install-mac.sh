#!/bin/bash
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/OutlineToText"
rm -rf "$DEST"; mkdir -p "$DEST"; cp -R "$(dirname "$0")/OutlineToText/." "$DEST"
for v in 9 10 11 12 13; do defaults write com.adobe.CSXS.$v PlayerDebugMode 1; done
echo "Installed. Restart Illustrator, then open Window > Extensions > Outline to Text."
