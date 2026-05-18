# Exemplos de Uso - Conversor PDF para Excel

## 🎯 Instalação Inicial (Execute Uma Vez)

```bash
# Instalar dependências
python setup.py

# Ou manualmente
pip install openpyxl pypdf
```

---

## 📖 Exemplos Práticos

### 1️⃣ Uso Básico - Conversão Simples

#### Windows
```batch
converter_vencimentos.bat vencimentos.pdf
```
✅ Cria: `vencimentos_vencimentos.xlsx`

#### macOS/Linux
```bash
./converter_vencimentos.sh vencimentos.pdf
```
✅ Cria: `vencimentos_vencimentos.xlsx`

#### Python (Qualquer SO)
```bash
python pdf_to_excel_vencimentos.py vencimentos.pdf
```

---

### 2️⃣ Especificar Nome do Arquivo de Saída

#### Windows
```batch
converter_vencimentos.bat vencimentos.pdf relatorio_maiohacendo.xlsx
```
✅ Cria: `relatorio_maiohacendo.xlsx`

#### macOS/Linux
```bash
./converter_vencimentos.sh vencimentos.pdf relatorio_maiohacendo.xlsx
```
✅ Cria: `relatorio_maiohacendo.xlsx`

#### Python
```bash
python pdf_to_excel_vencimentos.py vencimentos.pdf relatorio_maiohacendo.xlsx
```

---

### 3️⃣ Com Caminhos Completos

#### Windows
```batch
converter_vencimentos.bat "C:\Users\usuario\Downloads\vencimentos.pdf" "C:\Users\usuario\Desktop\relatorio.xlsx"
```

#### macOS/Linux
```bash
./converter_vencimentos.sh ~/Downloads/vencimentos.pdf ~/Desktop/relatorio.xlsx
```

---

### 4️⃣ Múltiplas Conversões em Sequência

#### Windows (PowerShell)
```powershell
foreach ($file in Get-ChildItem "*.pdf") {
    converter_vencimentos.bat $file.FullName
}
```

#### macOS/Linux (Bash)
```bash
for pdf in *.pdf; do
    ./converter_vencimentos.sh "$pdf"
done
```

---

### 5️⃣ Com Nomes Automáticos por Data

#### macOS/Linux
```bash
DATE=$(date +%Y%m%d)
./converter_vencimentos.sh vencimentos.pdf "relatorio_vencimentos_$DATE.xlsx"
```
✅ Cria: `relatorio_vencimentos_20260517.xlsx`

#### Windows (PowerShell)
```powershell
$date = Get-Date -Format "yyyyMMdd"
converter_vencimentos.bat vencimentos.pdf "relatorio_vencimentos_$date.xlsx"
```

---

## 🔄 Automação (Agendado)

### Linux/macOS - Cron Job

1. Abra o editor cron:
```bash
crontab -e
```

2. Adicione a linha (executa diariamente às 2 da manhã):
```cron
0 2 * * * cd /caminho/para/scripts && ./converter_vencimentos.sh /caminho/para/vencimentos.pdf
```

3. Exemplo com data:
```cron
0 2 * * * cd /home/usuario/scripts && /home/usuario/scripts/converter_vencimentos.sh /home/usuario/arquivos/vencimentos.pdf "/home/usuario/relatorios/vencimentos_$(date +\%Y\%m\%d).xlsx"
```

### Windows - Task Scheduler

1. Abra Task Scheduler (Agendador de Tarefas)
2. Clique em "Create Basic Task"
3. Configure:
   - **Nome:** Conversão de Vencimentos
   - **Gatilho:** Diariamente às 2:00 AM
   - **Ação:** Iniciar programa
   - **Programa:** `converter_vencimentos.bat`
   - **Argumentos:** `C:\caminho\para\vencimentos.pdf`

---

## 💾 Processamento em Lote (Batch)

### Converter Todos os PDFs de Uma Pasta

#### Windows
```batch
@echo off
for %%f in (*.pdf) do (
    echo Convertendo %%f...
    converter_vencimentos.bat "%%f"
)
pause
```

#### macOS/Linux
```bash
#!/bin/bash
for pdf in *.pdf; do
    echo "Convertendo $pdf..."
    ./converter_vencimentos.sh "$pdf"
done
```

---

## 🐍 Uso Avançado com Python

### Integrar em Seu Próprio Script

```python
from pathlib import Path
import subprocess
import sys

pdf_file = "vencimentos.pdf"
xlsx_file = "relatorio.xlsx"

# Executa conversão
resultado = subprocess.run(
    [sys.executable, "pdf_to_excel_vencimentos.py", pdf_file, xlsx_file],
    capture_output=True,
    text=True
)

if resultado.returncode == 0:
    print(f"✅ Conversão bem-sucedida: {xlsx_file}")
else:
    print(f"❌ Erro: {resultado.stderr}")
```

### Com Tratamento de Erros

```python
from pathlib import Path
from openpyxl import load_workbook

def processar_pdf(pdf_path, xlsx_path):
    """Processa PDF e retorna informações"""
    try:
        import subprocess
        import sys
        
        # Converte
        resultado = subprocess.run(
            [sys.executable, "pdf_to_excel_vencimentos.py", pdf_path, xlsx_path],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if resultado.returncode != 0:
            raise Exception(f"Erro na conversão: {resultado.stderr}")
        
        # Valida resultado
        if not Path(xlsx_path).exists():
            raise Exception(f"Arquivo de saída não criado: {xlsx_path}")
        
        # Carrega e verifica
        wb = load_workbook(xlsx_path)
        ws = wb.active
        
        linhas = ws.max_row - 1  # Exclui cabeçalho
        print(f"✅ Sucesso: {linhas} registros processados")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

# Uso
processar_pdf("vencimentos.pdf", "relatorio.xlsx")
```

---

## 🛠️ Troubleshooting

### Script não encontrado (macOS/Linux)

```bash
# Torne executável
chmod +x converter_vencimentos.sh
./converter_vencimentos.sh vencimentos.pdf
```

### "Permission denied" (macOS/Linux)

```bash
# Opção 1: Usar bash explicitamente
bash converter_vencimentos.sh vencimentos.pdf

# Opção 2: Usar Python diretamente
python pdf_to_excel_vencimentos.py vencimentos.pdf
```

### Erro de módulo (Windows/macOS/Linux)

```bash
# Reinstale dependências
pip install --upgrade openpyxl pypdf

# Ou use requirements.txt
pip install -r requirements.txt
```

### Arquivo PDF não encontrado

```bash
# Verifique o caminho
# Opção 1: Use caminho completo (absolute path)
python pdf_to_excel_vencimentos.py /Users/seu_usuario/Desktop/vencimentos.pdf

# Opção 2: Coloque o PDF na mesma pasta e use apenas o nome
# C:\Scripts\
#   ├── converter_vencimentos.bat
#   ├── pdf_to_excel_vencimentos.py
#   └── vencimentos.pdf  <-- aqui
converter_vencimentos.bat vencimentos.pdf
```

---

## 📊 Resultado Esperado

Após a conversão, você receberá um arquivo Excel com:

✅ **416 linhas** de dados (exemplo)
✅ **Formatação colorida** por tipo de evento
✅ **Cabeçalho congelado** para navegação fácil
✅ **Filtros automáticos** em todas as colunas
✅ **Largura otimizada** para cada coluna

### Colunas:
| # | Nome | Descrição |
|---|------|-----------|
| 1 | Empresa | Nome e ID da empresa |
| 2 | CNPJ | CNPJ ou CPF |
| 3 | Empregado | Nome completo |
| 4 | Tipo | Tipo de aviso/evento |
| 5 | Vencimento | Data de vencimento |

---

## 📞 Dúvidas Frequentes

**P: Posso usar em produção?**
R: Sim, os scripts foram testados e são seguros. Faça backup de seus PDFs.

**P: Funciona com arquivos grandes (100+ MB)?**
R: Sim, mas pode demorar alguns minutos. Paciência! ☕

**P: Posso modificar o script?**
R: Sim! É Python simples. Edite conforme necessário.

**P: Posso automatizar isso diariamente?**
R: Sim! Veja a seção "Automação" acima.

**P: Posso adicionar mais colunas?**
R: Sim! Edite `pdf_to_excel_vencimentos.py` e modifique:
```python
headers = ["Empresa", "CNPJ", "Empregado", "Tipo", "Vencimento", "Sua Coluna"]
```

---

## 🎉 Sucesso!

Pronto! Agora você está equipado para converter PDFs de vencimentos para Excel.

**Dica final:** Coloque os scripts em uma pasta no seu PATH ou use atalhos de desktop para acesso rápido.

---

*Última atualização: Maio 2026*
