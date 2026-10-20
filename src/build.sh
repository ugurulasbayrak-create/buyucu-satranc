#!/bin/sh
# Kaynak dosyalardan tek dosyalık oyunu üretir (CDN sürümü).
cd "$(dirname "$0")"
FILES="p0-diag.js p2-engine.js p3a-scene.js p3b-hall.js p3c-fx.js p3d-post.js p4n-pieces.js p5a-audio.js p5-game.js p5b-camera.js p6a-flow.js p6b-meta.js p6d-online.js p6c-loop.js"
{ cat p1.html; cat libs.txt; echo "<script>"; cat $FILES; echo "</script>"; } > ../wizard-chess.html
