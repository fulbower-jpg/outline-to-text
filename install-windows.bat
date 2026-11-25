@echo off
set DEST=%APPDATA%\Adobe\CEP\extensions\OutlineToText
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy /E /I /Y "%~dp0OutlineToText" "%DEST%" >nul
for %%V in (9 10 11 12 13) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo Installed. Restart Illustrator, then open Window ^> Extensions ^> Outline to Text.
pause
