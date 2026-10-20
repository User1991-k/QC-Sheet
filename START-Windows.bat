@echo off
cd /d "%~dp0"
start "" "http://127.0.0.1:8262/index.html?open=drone&release=287"
py -3 serve.py 8262 2>nul || python serve.py 8262
pause
