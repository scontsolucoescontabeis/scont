# Conversor de PDF para Excel - Avisos de Vencimento

Scripts para converter relatórios de avisos de vencimento de PDF para formato Excel com formatação profissional.

## 📋 Conteúdo

- `pdf_to_excel_vencimentos.py` - Script Python principal
- `converter_vencimentos.sh` - Script para macOS/Linux
- `converter_vencimentos.bat` - Script para Windows
- `README.md` - Este arquivo

## 🚀 Início Rápido

### macOS / Linux

```bash
chmod +x converter_vencimentos.sh
./converter_vencimentos.sh arquivo.pdf
```

### Windows

```bash
converter_vencimentos.bat arquivo.pdf
```

### Diretamente com Python

```bash
python pdf_to_excel_vencimentos.py arquivo.pdf [saida.xlsx]
```

## 📋 Requisitos

### Sistema
- **Python 3.7+** instalado
- **pip** (gerenciador de pacotes Python)

### Pacotes Python

```bash
pip install openpyxl pypdf
```

Ou instale tudo de uma vez:

```bash
pip install openpyxl pypdf
```

## 💻 Instalação Detalhada

### 1. Instalar Python

#### Windows
- Baixe em: https://www.python.org/downloads/
- Durante a instalação, **marque "Add Python to PATH"**
- Abra PowerShell/CMD e verifique:
  ```bash
  python --version
  ```

#### macOS
```bash
brew install python3
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install python3 python3-pip
```

### 2. Instalar Dependências

Abra terminal/PowerShell e execute:

```bash
pip install openpyxl pypdf
```

### 3. Baixe os Scripts

Coloque os 3 arquivos (`.py`, `.sh` ou `.bat`) na mesma pasta.

## 📖 Modo de Uso

### Opção 1: Script Automático (Recomendado)

#### macOS / Linux
```bash
./converter_vencimentos.sh vencimentos.pdf
./converter_vencimentos.sh vencimentos.pdf meu_relatorio.xlsx
```

#### Windows
```bash
converter_vencimentos.bat vencimentos.pdf
converter_vencimentos.bat vencimentos.pdf meu_relatorio.xlsx
```

### Opção 2: Python Direto

```bash
# Usa nome automático (vencimentos_vencimentos.xlsx)
python pdf_to_excel_vencimentos.py vencimentos.pdf

# Define nome customizado
python pdf_to_excel_vencimentos.py vencimentos.pdf meu_output.xlsx
```

## 🎨 Recursos

A planilha gerada inclui:

✅ **Formatação Profissional**
- Cabeçalho com fundo azul escuro e texto branco
- Bordas em todas as células
- Linhas de altura ajustadas

✅ **Código de Cores por Tipo de Evento**
- 🟢 Verde: Aniversário de colaboradores
- 🟠 Laranja: Certificado digital
- 🔵 Azul claro: Contrato experiência
- 🟡 Amarelo: Vencimento de férias
- 🔴 Rosa/Vermelho: Avisos de rescisão
- 🩵 Azul pálido: Monitoramento de saúde
- 🟣 Lilás: Retorno de afastamento

✅ **Funcionalidades**
- Cabeçalho congelado (freeze panes)
- Filtro automático em todas as colunas
- Largura de coluna otimizada
- Suporte a múltiplas linhas de texto

✅ **Colunas**
1. Empresa
2. CNPJ/CPF
3. Empregado
4. Tipo
5. Vencimento

## 🔧 Personalização

### Modificar Cores

Abra `pdf_to_excel_vencimentos.py` e localize a seção `tipo_fills`:

```python
tipo_fills = {
    "Aniversário colaboradores": PatternFill("solid", start_color="E2EFDA"),
    # ... adicione ou modifique aqui
}
```

Códigos de cor em formato hexadecimal (RGB).

### Adicionar Novos Tipos

Na mesma seção, adicione uma nova entrada:

```python
"Novo Tipo": PatternFill("solid", start_color="HEXCOLOR"),
```

### Modificar Largura de Colunas

Procure por `col_widths`:

```python
col_widths = [55, 22, 50, 45, 38]
#              Empresa, CNPJ, Empregado, Tipo, Vencimento
```

Valores em caracteres (aproximado).

## 🐛 Solução de Problemas

### "Python não encontrado"
**Windows:** Reinstale Python marcando "Add Python to PATH"
**Mac/Linux:** Tente `python3` em vez de `python`

### "Módulo não encontrado (openpyxl/pypdf)"
```bash
pip install --upgrade pip
pip install openpyxl pypdf
```

### "Arquivo PDF não encontrado"
- Verifique o caminho do arquivo
- Use caminho relativo (mesma pasta) ou caminho absoluto
- Exemplo: `./converter_vencimentos.sh ./documentos/vencimentos.pdf`

### "PDF vazio ou sem dados extraíveis"
- Verifique se o PDF tem texto (não é apenas imagem scaneada)
- Tente abrir o PDF no seu leitor e copiar texto manualmente

### Permissão negada (Mac/Linux)

```bash
chmod +x converter_vencimentos.sh
./converter_vencimentos.sh vencimentos.pdf
```

## 📊 Exemplo de Saída

```
| Empresa                      | CNPJ              | Empregado                | Tipo                      | Vencimento           |
|------------------------------|-------------------|--------------------------|---------------------------|----------------------|
| CACAU CAFE CHOCOLATERIA      | 23.724.189/0001-60| CACAU CAFE CHOCOLATERIA  | Certificado digital       | 17/01/2024          |
| NUTRI ACAI                   | 23.792.463/0001-39| GABRIEL VINICIUS         | Contrato experiência...   | 29/06/2026          |
```

## 🤖 Processamento Automático

Para automatizar conversões regulares:

### Linux/macOS (Cron)
```bash
crontab -e
# Adicione: 0 2 * * * /caminho/para/converter_vencimentos.sh /caminho/para/relatorio.pdf
```

### Windows (Task Scheduler)
1. Abra Task Scheduler
2. Crie tarefa básica
3. Gatilho: conforme desejado
4. Ação: Executar script `converter_vencimentos.bat`

## 📝 Customização Avançada

### Adicionar Mais Colunas

Edite a seção de headers:

```python
headers = ["Empresa", "CNPJ", "Empregado", "Tipo", "Vencimento", "Sua_Nova_Coluna"]
col_widths = [55, 22, 50, 45, 38, 30]  # Adicione largura
```

### Alterar Nome da Aba

```python
ws.title = "Novo Nome"
```

### Exportar em Outros Formatos

O script gera `.xlsx`. Para converter:
```bash
pip install openpyxl
python -c "from openpyxl import load_workbook; wb = load_workbook('arquivo.xlsx'); wb.save('arquivo.csv')"
```

## 📞 Suporte

### Verificar Versão do Python
```bash
python --version
```

### Verificar Versão dos Pacotes
```bash
pip show openpyxl pypdf
```

### Atualizar Pacotes
```bash
pip install --upgrade openpyxl pypdf
```

## 📄 Licença

Estes scripts são fornecidos como-são para uso pessoal e profissional.

## 🔄 Changelog

### v1.0
- ✅ Conversão PDF para Excel
- ✅ Formatação com cores
- ✅ Cabeçalho congelado
- ✅ Filtros automáticos
- ✅ Scripts para Windows, Mac e Linux

---

**Última atualização:** Maio 2026
**Compatibilidade:** Python 3.7+
