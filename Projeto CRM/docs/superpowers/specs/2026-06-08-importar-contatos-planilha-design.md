# Importação de Contatos via Planilha Excel

**Data:** 2026-06-08  
**Status:** Aprovado

## Resumo

Adicionar à tela de Contatos do CRM Messenger a capacidade de importar uma lista de contatos a partir de uma planilha `.xlsx` ou `.xls`, seguindo o modelo da plataforma.

## Entrada

O botão "Novo Contato" vira um split-button com seta `▾`. O clique na seta abre um dropdown:
- `+ Cadastrar manualmente` → `ModalContato` existente (sem alteração)
- `↑ Importar via planilha` → novo `ModalImportarPlanilha`

## Template da planilha

Gerado client-side com a biblioteca `xlsx` (já instalada). Colunas em ordem:

| Coluna | Obrigatório |
|---|---|
| nome | sim |
| telefone | sim |
| empresa | não |
| cargo | não |
| email | não |
| cpf_cnpj | não |
| observacoes | não |

O modal oferece um link "Baixar modelo .xlsx" que gera e faz download do arquivo.

## Fluxo do modal — 2 passos

### Passo 1: Upload
- Área drag & drop ou clique para selecionar `.xlsx` / `.xls`
- Link de download do modelo
- Ao selecionar o arquivo → parsing imediato e avanço automático para o passo 2

### Passo 2: Prévia
- Parsing client-side com `xlsx`
- Consulta Supabase para detectar conflitos: busca todos os pares `(telefone, empresa)` presentes na planilha que já existam na tabela `contatos`
- Exibe tabela com **todas as linhas** (scroll interno)
- Coluna Status por linha:
  - `✓ Novo` — par telefone+empresa inexistente na base
  - Toggle `Atualizar / Ignorar` — par já existe; padrão: Atualizar
  - `✗ Sem telefone` — campo obrigatório ausente; sempre ignorado
- Rodapé: contagem `X novos · Y conflitos · Z erros` + botão "Confirmar"

### Confirmação
- Bulk `insert` para linhas novas
- `update` individual para linhas marcadas como "Atualizar"
- Fecha modal e recarrega lista de contatos

## Regra de duplicata

Um contato é considerado duplicata quando o par **telefone + empresa** já existe na base. O mesmo telefone com empresa diferente é tratado como contato novo.

## Arquitetura

**Novo arquivo:**
- `src/components/ContatosImport/ModalImportarPlanilha.jsx`
  - Componente auto-contido: 2 passos, parsing, detecção de conflitos, operações Supabase

**Arquivo alterado:**
- `src/pages/ContatosPage.jsx`
  - Split-button no header (~15 linhas)
  - Renderização condicional do `ModalImportarPlanilha` (~5 linhas)

**Dependências:** nenhuma nova. `xlsx ^0.18.5` já está em `package.json`.
