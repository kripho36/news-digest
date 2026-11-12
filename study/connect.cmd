@echo off
pushd "%~dp0" || exit /b 1
python -B connect.py
set "result=%errorlevel%"
popd
pause
exit /b %result%
