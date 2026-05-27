@echo off
:: ============================================================
::  agendar_gestta.bat
::  Registra a tarefa no Task Scheduler para rodar a cada 5min
::  EXECUTE ESTE ARQUIVO COMO ADMINISTRADOR (clique direito -> Executar como administrador)
:: ============================================================

SET SCRIPT=%USERPROFILE%\Desktop\atendimentos\gestta_chat_extractor.py
SET PYTHON=python

echo Registrando tarefa no Task Scheduler...

schtasks /create /tn "GestaChatExtractor" ^
  /tr "%PYTHON% \"%SCRIPT%\"" ^
  /sc MINUTE /mo 5 ^
  /ru "%USERNAME%" ^
  /f

IF %ERRORLEVEL% EQU 0 (
    echo.
    echo Tarefa registrada com sucesso!
    echo A extracao rodara automaticamente a cada 5 minutos.
    echo.
    echo Para verificar: abra o Agendador de Tarefas e procure por "GestaChatExtractor"
    echo Para parar    : schtasks /delete /tn "GestaChatExtractor" /f
) ELSE (
    echo.
    echo ERRO ao registrar. Tente executar como Administrador.
)

pause
