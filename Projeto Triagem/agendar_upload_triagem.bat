@echo off
chcp 65001 >nul
echo ============================================
echo  Agendador — Upload Triagem para Supabase
echo ============================================
echo.

set SCRIPT=%~dp0upload_triagem.py
set TASK_NAME=UploadTriagemSupabase

echo Registrando tarefa agendada: %TASK_NAME%
echo Frequência: a cada 30 minutos
echo Script: %SCRIPT%
echo.

schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "python \"%SCRIPT%\"" ^
  /sc MINUTE ^
  /mo 30 ^
  /f ^
  /rl HIGHEST

if %errorlevel% equ 0 (
    echo.
    echo [OK] Tarefa agendada com sucesso!
    echo      O upload será feito automaticamente a cada 30 minutos.
    echo.
    echo Para cancelar o agendamento:
    echo   schtasks /delete /tn "%TASK_NAME%" /f
) else (
    echo.
    echo [ERRO] Falha ao agendar. Tente executar como Administrador.
)

echo.
pause
