@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0" || exit /b 1
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $dir=(Get-Location).Path; $python=(& python -c 'import sys; print(sys.executable)'); if ($LASTEXITCODE -ne 0 -or -not $python) { throw 'Python 실행 파일을 찾을 수 없습니다.' }; $action=New-ScheduledTaskAction -Execute $python.Trim() -Argument 'run.py' -WorkingDirectory $dir; $trigger=New-ScheduledTaskTrigger -Daily -At '07:00'; $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; Register-ScheduledTask -TaskName '글로벌뉴스다이제스트' -Action $action -Trigger $trigger -Settings $settings -Force -ErrorAction Stop | Out-Null"
set "result=%errorlevel%"
if "%result%"=="0" echo 매일 오전 7시 뉴스 발행 작업을 설정했습니다.
popd
pause
exit /b %result%
