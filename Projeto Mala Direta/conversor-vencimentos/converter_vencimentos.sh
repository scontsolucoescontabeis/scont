#!/bin/bash
#
# Script para converter PDF de vencimentos para Excel
# 
# Uso: ./converter_vencimentos.sh arquivo.pdf [saida.xlsx]
#

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para mostrar erro
error() {
    echo -e "${RED}❌ Erro: $1${NC}" >&2
    exit 1
}

# Função para mostrar aviso
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Função para mostrar sucesso
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Função para mostrar info
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Função para exibir uso
show_usage() {
    cat << EOF
${BLUE}=== Conversor de PDF de Vencimentos para Excel ===${NC}

Uso: $0 <arquivo_pdf> [arquivo_saida.xlsx]

Exemplos:
    $0 vencimentos.pdf
    $0 vencimentos.pdf meu_relatorio.xlsx

Requisitos:
    - Python 3.7+
    - Pacotes: openpyxl, pypdf

Instalar dependências:
    pip install openpyxl pypdf

${NC}
EOF
}

# Verifica argumentos
if [ $# -lt 1 ]; then
    show_usage
    exit 1
fi

PDF_INPUT="$1"
PDF_NAME=$(basename "$PDF_INPUT" .pdf)

# Define arquivo de saída
if [ -z "$2" ]; then
    XLSX_OUTPUT="${PDF_NAME}_vencimentos.xlsx"
else
    XLSX_OUTPUT="$2"
fi

# Verifica se arquivo PDF existe
if [ ! -f "$PDF_INPUT" ]; then
    error "Arquivo '$PDF_INPUT' não encontrado"
fi

info "Iniciando conversão..."
echo "  Entrada:  $PDF_INPUT"
echo "  Saída:    $XLSX_OUTPUT"
echo ""

# Verifica se Python está instalado
if ! command -v python3 &> /dev/null; then
    error "Python 3 não encontrado. Instale Python 3.7 ou superior."
fi

# Verifica se os pacotes necessários estão instalados
echo "Verificando dependências..."
if ! python3 -c "import openpyxl" 2>/dev/null; then
    warning "Pacote 'openpyxl' não encontrado"
    info "Instalando: pip install openpyxl"
    pip install openpyxl || error "Falha ao instalar openpyxl"
fi

if ! python3 -c "import pypdf" 2>/dev/null; then
    warning "Pacote 'pypdf' não encontrado"
    info "Instalando: pip install pypdf"
    pip install pypdf || error "Falha ao instalar pypdf"
fi

success "Dependências OK"
echo ""

# Detecta localização do script Python
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/pdf_to_excel_vencimentos.py"

# Se script não estiver no mesmo diretório, procura no PATH
if [ ! -f "$PYTHON_SCRIPT" ]; then
    PYTHON_SCRIPT="pdf_to_excel_vencimentos.py"
fi

# Executa o script Python
info "Processando PDF..."
if python3 "$PYTHON_SCRIPT" "$PDF_INPUT" "$XLSX_OUTPUT"; then
    echo ""
    success "Conversão concluída com sucesso!"
    success "Arquivo salvo: $XLSX_OUTPUT"
    
    # Mostra estatísticas
    if [ -f "$XLSX_OUTPUT" ]; then
        FILE_SIZE=$(du -h "$XLSX_OUTPUT" | cut -f1)
        success "Tamanho do arquivo: $FILE_SIZE"
    fi
else
    error "Falha durante a conversão"
fi
