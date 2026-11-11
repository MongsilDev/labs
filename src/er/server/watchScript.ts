import "server-only";

// 운영자 PC에서 도는 감시 창. Windows 기본 명령(curl.exe, fc, ping)만 씀. cmd는 LF만 있으면 goto 라벨을 놓칠 수 있어 CRLF로 내보냄
const TEMPLATE = String.raw`@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem 시작 프로그램 폴더에서 뜨면 작업 표시줄에 최소화해 다시 띄움. 토큰을 붙여 넣어야 하면 입력 창이 숨지 않게 그대로 둠
if /i "%~dp0"=="%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\" if not "{{TOKEN}}"=="" if not defined LABS_MIN (set "LABS_MIN=1" & start "Labs" /min "%~f0" & exit /b)
chcp 65001 >nul
title Labs 결과 자동 업로드
rem 토큰은 Labs 내 정보에서 폐기할 수 있음
if not defined LABS_TOKEN set "LABS_TOKEN={{TOKEN}}"
if not defined LABS_TOKEN set /p "LABS_TOKEN=Labs 토큰을 붙여 넣어주세요: "
if not defined LABS_TOKEN exit /b 1
if not defined LABS_URL set "LABS_URL={{URL}}"
if not defined LABS_CSV set "LABS_CSV=C:\Program Files (x86)\Steam\steamapps\common\Eternal Return\GameResult_.csv"
if not defined LABS_CURL set "LABS_CURL=curl.exe"
set "CSV=%LABS_CSV%"
set "DIR=%TEMP%\labs-watch"
if not exist "%DIR%" mkdir "%DIR%"
set "LAST=%DIR%\last.csv"
set "SNAP=%DIR%\snap.csv"
rem 창을 연 시점의 파일은 지난 경기라 보내지 않고 기준으로만 둠
if exist "%CSV%" (copy /y "%CSV%" "%LAST%" >nul) else (if exist "%LAST%" del "%LAST%")
echo 감시 중입니다: %CSV%
set "WAIT=4"

:loop
ping -n !WAIT! 127.0.0.1 >nul
set "WAIT=4"
if not exist "%CSV%" goto loop
if exist "%LAST%" (fc /b "%CSV%" "%LAST%" >nul 2>&1 && goto loop)
rem 게임이 쓰는 중이면 크기가 바뀌므로 2초 동안 그대로일 때만 보냄
for %%F in ("%CSV%") do set "S1=%%~zF"
ping -n 3 127.0.0.1 >nul
for %%F in ("%CSV%") do set "S2=%%~zF"
if not "!S1!"=="!S2!" goto loop
copy /y "%CSV%" "%SNAP%" >nul 2>&1 || goto loop
fc /b "%CSV%" "%SNAP%" >nul 2>&1 || goto loop
set "CODE=000"
if exist "%DIR%\resp.txt" del "%DIR%\resp.txt"
"%LABS_CURL%" -s -o "%DIR%\resp.txt" -w "%%{http_code}" -H "x-upload-token: %LABS_TOKEN%" -H "accept: text/plain" --data-binary "@%SNAP%" "%LABS_URL%" > "%DIR%\code.txt" 2>nul
set /p CODE=<"%DIR%\code.txt"
if exist "%DIR%\resp.txt" (type "%DIR%\resp.txt" & echo.)
if "!CODE!"=="401" (pause & exit /b 1)
rem 2xx와 4xx는 같은 파일을 다시 보내도 결과가 같아 다시 보내지 않음. 429, 5xx, 연결 실패는 30초 뒤 다시 보냄
set "DONE="
set "C1=!CODE:~0,1!"
if "!C1!"=="2" set "DONE=1"
if "!C1!"=="4" if not "!CODE!"=="429" set "DONE=1"
if defined DONE (move /y "%SNAP%" "%LAST%" >nul) else (echo 전송 실패 !CODE!, 30초 뒤 다시 보냅니다. & set "WAIT=31")
goto loop
`;

// token이 빈 문자열이면 창을 열 때 붙여 넣게 함
export function watchScript(opts: { token: string; url: string }): string {
  return TEMPLATE.replaceAll("{{TOKEN}}", opts.token).replace("{{URL}}", opts.url).replace(/\r?\n/g, "\r\n");
}
