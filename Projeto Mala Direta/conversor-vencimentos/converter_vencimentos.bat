@echo off
REM Script para converter PDF de vencimentos para Excel (Windows)
REM
REM Uso: converter_vencimentos.bat arquivo.pdf [saida.xlsx]

setlocal enabledelayedexpansion

color 0A
title Conversor PDF para Excel - Vencimentos

if "%1"=="" (
    call :show_usage
    exit /b 1
)

set PDF_INPUT=%1
set PDF_NAME=%~n1

if "%2"=="" (
    set XLSX_OUTPUT=!PDF_NAME!_vencimentos.xlsx
) else (
    set XLSX_OUTPUT=%2
)

if not exist "%PDF_INPUT%" (
    echo.
    echo [ERRO] Arquivo "%PDF_INPUT%" nao encontrado
    echo.
    exit /b 1
)

cls
echo.
echo ====================================================
echo   Conversor de PDF de Vencimentos para Excel
echo ====================================================
echo.
echo Entrada:  %PDF_INPUT%
echo Saida:    %XLSX_OUTPUT%
echo.

REM Verifica se Python esta instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado no PATH
    echo.
    echo Por favor, instale Python 3.7 ou superior de:
    echo https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo [INFO] Verificando dependencias Python...

REM Verifica e instala openpyxl
python -c "import openpyxl" >nul 2>&1
if errorlevel 1 (
    echo [AVISO] Pacote 'openpyxl' nao encontrado
    echo [INFO] Instalando openpyxl...
    pip install openpyxl
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar openpyxl
        pause
        exit /b 1
    )
)

REM Verifica e instala pypdf
python -c "import pypdf" >nul 2>&1
if errorlevel 1 (
    echo [AVISO] Pacote 'pypdf' nao encontrado
    echo [INFO] Instalando pypdf...
    pip install pypdf
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar pypdf
        pause
        exit /b 1
    )
)

echo [OK] Dependencias OK
echo.
echo [INFO] Processando PDF...
echo.

REM Procura pelo script Python
if exist "pdf_to_excel_vencimentos.py" (
    set PYTHON_SCRIPT=pdf_to_excel_vencimentos.py
) else (
    set PYTHON_SCRIPT=pdf_to_excel_vencimentos.py
)

REM Executa o script
python "%PYTHON_SCRIPT%" "%PDF_INPUT%" "%XLSX_OUTPUT%"

if errorlevel 1 (
    echo.
    echo [ERRO] Falha durante a conversao
    pause
    exit /b 1
)

echo.
echo ====================================================
echo [OK] Conversao concluida com sucesso!
echo [OK] Arquivo: %XLSX_OUTPUT%
echo ====================================================
echo.
pause
exit /b 0

:show_usage
echo.
echo ====================================================
echo   Conversor de PDF de Vencimentos para Excel
echo ====================================================
echo.
echo Uso: %0 <arquivo_pdf> [arquivo_saida.xlsx]
echo.
echo Exemplos:
echo   %0 vencimentos.pdf
echo   %0 vencimentos.pdf meu_relatorio.xlsx
echo.
echo Requisitos:
echo   - Python 3.7 ou superior
echo   - Pacotes: openpyxl, pypdf
echo.
echo Para instalar Python:
echo   https://www.python.org/downloads/
echo.
echo Para instalar dependencias:
echo   pip install openpyxl pypdf
echo.
goto :eof
