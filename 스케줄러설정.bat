@echo off
echo 매일 오전 7시에 뉴스를 자동 수집하도록 설정합니다...

schtasks /create /tn "글로벌뉴스다이제스트" ^
  /tr "python \"C:\Users\LG\OneDrive - 서울과학고등학교\바탕 화면\CLAuDE\news-digest\run.py\"" ^
  /sc daily ^
  /st 07:00 ^
  /f

echo.
echo 완료! 매일 오전 7시에 자동으로 뉴스가 업데이트됩니다.
echo 확인: 작업 스케줄러 앱에서 "글로벌뉴스다이제스트" 항목을 찾으세요.
pause
