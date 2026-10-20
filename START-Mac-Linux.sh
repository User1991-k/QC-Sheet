#!/bin/sh
cd "$(dirname "$0")"
URL="http://127.0.0.1:8262/index.html?open=drone&release=287"
(sleep 1; command -v xdg-open >/dev/null && xdg-open "$URL" >/dev/null 2>&1 || command -v open >/dev/null && open "$URL") &
python3 serve.py 8262
