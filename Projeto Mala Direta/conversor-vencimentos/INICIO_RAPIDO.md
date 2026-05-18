# 📦 Conversor PDF para Excel - Kit Completo

## 📂 Arquivos Incluídos

```
conversor-vencimentos/
├── 🐍 pdf_to_excel_vencimentos.py    [7.4K]  Script principal (Python)
├── 🐧 converter_vencimentos.sh        [2.9K]  Script para macOS/Linux
├── 🪟 converter_vencimentos.bat       [2.9K]  Script para Windows
├── ⚙️  setup.py                       [3.9K]  Instalador de dependências
├── 📋 requirements.txt                [29B]   Lista de pacotes
├── 📖 README.md                       [6.2K]  Documentação completa
├── 📚 EXEMPLOS.md                     [7.2K]  Exemplos práticos
└── 📋 INICIO_RAPIDO.md               (este arquivo)
```

---

## 🚀 Início Rápido (5 minutos)

### 1️⃣ Instale as Dependências

**Primeira vez apenas!**

```bash
# Opção A: Script automático
python setup.py

# Opção B: Manualmente
pip install -r requirements.txt

# Opção C: Pacotes individuais
pip install openpyxl pypdf
```

---

### 2️⃣ Execute a Conversão

Escolha conforme seu sistema operacional:

#### 🪟 Windows (PowerShell/CMD)
```batch
converter_vencimentos.bat seu_arquivo.pdf
```

#### 🐧 macOS / Linux (Terminal)
```bash
chmod +x converter_vencimentos.sh
./converter_vencimentos.sh seu_arquivo.pdf
```

#### 🐍 Qualquer Sistema (Python)
```bash
python pdf_to_excel_vencimentos.py seu_arquivo.pdf
```

---

### 3️⃣ Pronto! 

Seu arquivo Excel foi criado: `seu_arquivo_vencimentos.xlsx`

---

## 📋 Arquivos em Detalhes

### 📦 Scripts Executáveis

#### `pdf_to_excel_vencimentos.py` (Principal)
- **Linguagem:** Python 3.7+
- **Descrição:** Script principal que faz a conversão
- **Uso:** `python pdf_to_excel_vencimentos.py arquivo.pdf [saida.xlsx]`
- **Funciona em:** Windows, macOS, Linux

#### `converter_vencimentos.sh` (Recomendado para Unix)
- **Plataforma:** macOS, Linux, Unix
- **Descrição:** Wrapper automático que instala dependências
- **Uso:** `./converter_vencimentos.sh arquivo.pdf [saida.xlsx]`
- **Vantagem:** Checa e instala dependências automaticamente

#### `converter_vencimentos.bat` (Recomendado para Windows)
- **Plataforma:** Windows (CMD, PowerShell)
- **Descrição:** Script batch com interface colorida
- **Uso:** `converter_vencimentos.bat arquivo.pdf [saida.xlsx]`
- **Vantagem:** Fácil de usar, mensagens de erro claras

### 📚 Documentação

#### `README.md` (Documentação Completa)
- Instalação passo a passo
- Requisitos do sistema
- Guia completo de uso
- Solução de problemas
- Dicas de personalização

#### `EXEMPLOS.md` (Casos de Uso)
- 15+ exemplos práticos
- Automação com cron/Task Scheduler
- Processamento em lote
- Uso em scripts próprios
- Troubleshooting detalhado

### 🔧 Configuração

#### `setup.py`
- Instalador automático
- Verifica ambiente Python
- Instala dependências
- Valida arquivos necessários
- **Uso:** `python setup.py`

#### `requirements.txt`
- Lista de dependências Python
- **Uso:** `pip install -r requirements.txt`
- Versões mínimas garantidas

---

## ✅ Checklist de Instalação

- [ ] Python 3.7+ instalado (`python --version`)
- [ ] pip funcionando (`pip --version`)
- [ ] Dependências instaladas (`pip install -r requirements.txt`)
- [ ] Scripts no mesmo diretório
- [ ] Arquivo PDF pronto para converter
- [ ] Espaço em disco disponível (~10MB por conversão)

---

## 🎯 Próximos Passos

### Para Começar Agora
1. Execute `python setup.py`
2. Coloque seu PDF no mesmo diretório
3. Execute o script conversor para seu SO

### Para Personalizar
1. Abra `README.md` para conhecer todas as opções
2. Edite cores em `pdf_to_excel_vencimentos.py`
3. Veja exemplos em `EXEMPLOS.md`

### Para Automatizar
1. Leia a seção "Automação" em `EXEMPLOS.md`
2. Configure cron (Linux/macOS) ou Task Scheduler (Windows)
3. Agende conversões diárias/semanais

---

## 📊 Saída Esperada

Seu arquivo Excel incluirá:

| Coluna | Conteúdo |
|--------|----------|
| Empresa | Nome + ID da empresa |
| CNPJ | CNPJ ou CPF |
| Empregado | Nome completo |
| Tipo | Tipo de aviso |
| Vencimento | Data ou período |

**Recursos especiais:**
- ✅ Código de cores por tipo de evento
- ✅ Cabeçalho congelado
- ✅ Filtros automáticos
- ✅ Formatação profissional
- ✅ Bordas e alinhamento

---

## 🐛 Problema? Consulte Aqui

| Erro | Solução |
|------|---------|
| "Python não encontrado" | Instale Python de python.org |
| "módulo não encontrado" | Execute `pip install -r requirements.txt` |
| "arquivo PDF não encontrado" | Verifique caminho e nome do arquivo |
| "permissão negada" (Unix) | Execute `chmod +x converter_vencimentos.sh` |
| "script não roda" (Windows) | Tente `python pdf_to_excel_vencimentos.py` |

**Mais detalhes:** Veja `README.md` seção "Solução de Problemas"

---

## 💡 Dicas Pro

1. **Atalho de desktop (Windows):** Crie atalho para `.bat`, arraste PDF sobre ele
2. **Alias (Unix):** `alias converter='~/Scripts/converter_vencimentos.sh'`
3. **Automatização:** Use cron/Task Scheduler para conversões diárias
4. **Integração:** Importe os dados Excel em seu CRM/ERP favorito
5. **Backup:** Mantenha cópias dos PDFs originais

---

## 🔗 Recursos Rápidos

```bash
# Instalar tudo
python setup.py

# Converter um arquivo
./converter_vencimentos.sh vencimentos.pdf

# Ver ajuda
python pdf_to_excel_vencimentos.py

# Instalar manualmente
pip install openpyxl pypdf

# Atualizar pacotes
pip install --upgrade openpyxl pypdf
```

---

## 📞 FAQ Rápido

**P: Funciona offline?**
R: Sim! Completamente offline, sem conexão necessária.

**P: Preciso do Excel instalado?**
R: Não! Cria arquivos compatíveis que abrem em qualquer leitor.

**P: Posso usar em produção?**
R: Sim! Scripts foram testados e são estáveis.

**P: É seguro?**
R: Sim! Código aberto, sem conectividade externa, sem coleta de dados.

---

## 🎉 Sucesso!

Você está pronto para converter PDFs de vencimentos para Excel!

**Próxima etapa:** Execute `python setup.py` e comece a converter.

---

### 📖 Leitura Recomendada (Nesta Ordem)

1. **Este arquivo** - Visão geral e início rápido
2. **README.md** - Documentação completa
3. **EXEMPLOS.md** - Casos de uso e automação
4. **Código-fonte** - Personalizações avançadas

---

*Conversor PDF para Excel - v1.0*  
*Última atualização: Maio 2026*  
*Compatível com: Python 3.7+, Windows, macOS, Linux*
