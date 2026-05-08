# Design: Licenças — Campo Cliente + Importação Excel

**Data:** 2026-05-07  
**Projeto:** Portal Scont — Projeto Licenças (`Projeto Licenças/index.html`)  
**Status:** Aprovado

---

## 1. Renomeação da Seção

Substituir todas as referências a "Licenças e Alvarás" por "Licenças" na UI:
- Botão do menu lateral: `📄 Licenças`
- Título da seção `<main>` correspondente
- Qualquer outra label, heading ou aria-label que mencione "e Alvarás"

Os dados da tabela `alvaras` no banco **não são tocados**. Apenas a UI remove referências ao termo.

---

## 2. Campo Cliente no Formulário de Nova Licença

### Localização
Função `openNewDocumento()` em `index.html`, que injeta o HTML do formulário em `#modalBody`.

### Comportamento
- Ao abrir o modal, executa uma query: `supabaseClient.from('empresas').select('id, nome').eq('ativo', true).order('nome')`
- Renderiza o campo **antes** do campo "Estabelecimento" (primeiro campo do form)
- Campo não obrigatório (`required` ausente)

### Implementação do Autocomplete
```
<input type="text" id="clienteNome" placeholder="Buscar cliente (opcional)...">
<input type="hidden" id="clienteId">
<ul id="clienteDropdown"> <!-- lista de sugestões --> </ul>
```
- Evento `input` no campo de texto filtra o array em memória (`clientes`) por `nome.toLowerCase().includes(query)`)
- Máximo de 8 sugestões exibidas
- Ao clicar em uma sugestão: preenche `clienteNome.value = cliente.nome` e `clienteId.value = cliente.id`, oculta a lista
- Ao limpar o campo: reseta `clienteId.value = ''`
- Click fora da lista fecha a lista (listener `document.addEventListener('click', ...)`)

### Persistência
Em `saveDocumento()`:
```js
empresa_id: document.getElementById('clienteId').value || null
```

### Visualização (`viewRecord`)
Se `data.empresa_id` existir, exibir o nome do cliente buscando da tabela `empresas`:
```js
const { data: empresa } = await supabaseClient.from('empresas').select('nome').eq('id', data.empresa_id).single();
```
Exibir linha: `<p><strong>Cliente:</strong> ${empresa?.nome || '-'}</p>`

---

## 3. Importação em Massa via Excel

### Dependência
SheetJS via CDN, adicionado ao `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

### Botões de Importação
- Aba **Licenças**: botão `📥 Importar Excel` ao lado do botão "Nova Licença"
- Aba **Clientes**: botão `📥 Importar Excel` ao lado do botão "Novo Cliente"
- Cada botão aciona um `<input type="file" accept=".xlsx,.xls">` oculto correspondente

### Fluxo
1. Usuário clica em "Importar Excel" → abre seletor de arquivo
2. SheetJS lê a primeira aba da planilha → converte para array de objetos (usando cabeçalho da linha 1)
3. Modal de prévia exibe os primeiros 10 registros em tabela HTML
4. Modal mostra as colunas esperadas como referência
5. Usuário clica "Confirmar Importação"
6. Sistema processa em lote via `.insert([...])` no Supabase
7. Toast final: "X registros importados, Y falharam" (detalhes no console)

### Colunas Esperadas

**Licenças** (colunas do Excel → campo no banco):

| Coluna Excel | Campo banco | Obrigatório |
|---|---|---|
| estabelecimento | estabelecimento | Sim |
| tipo | tipo | Sim |
| numero | numero | Não |
| data_emissao | data_emissao | Não |
| data_validade | data_validade | Não |
| orgao_emissor | orgao_emissor | Não |
| responsavel | responsavel | Não |
| observacoes | observacoes | Não |
| cliente | empresa_id (lookup por nome) | Não |

- Datas aceitas nos formatos: `DD/MM/AAAA`, `YYYY-MM-DD`, número serial Excel
- Coluna `cliente`: lookup case-insensitive na tabela `empresas` por `nome`; se não encontrado, `empresa_id = null`
- Linhas sem `estabelecimento` ou sem `tipo` são puladas e contabilizadas como falha

**Clientes** (colunas do Excel → campo no banco `empresas`):

| Coluna Excel | Campo banco | Obrigatório |
|---|---|---|
| nome | nome | Sim |
| cnpj | cnpj | Não |
| contato | contato | Não |
| email | email | Não |
| telefone | telefone | Não |
| estabelecimentos | estabelecimentos | Não |

- Linhas sem `nome` são puladas

### Tratamento de Erros
- Arquivo inválido (não é Excel): alerta de erro, nenhum dado processado
- Falha em linha individual: linha é pulada, demais continuam
- Falha geral de rede/Supabase: rollback implícito do lote com mensagem de erro

---

## 4. Arquivos Afetados

| Arquivo | Mudanças |
|---|---|
| `Projeto Licenças/index.html` | Todas as alterações: renomeação, campo cliente, importação Excel |
| Banco (Supabase) | Nenhuma alteração de schema — `empresa_id` já existe em `licencas` |

---

## 5. Fora de Escopo

- Edição de licença existente para vincular/desvincular cliente (implementar futuramente se necessário)
- Validação de CNPJ no import
- Importação de processos ou andamentos via Excel
- Exportação de dados para Excel
