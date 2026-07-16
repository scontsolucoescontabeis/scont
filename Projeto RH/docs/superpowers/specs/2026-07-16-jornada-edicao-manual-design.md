# Design: Edição Manual da Jornada de Trabalho (Administração)

**Data:** 2026-07-16
**Status:** Aprovado
**Arquivos principais:** `Projeto RH/admin.html`, `Projeto RH/admin.js`

---

## Contexto

A aba "Jornada de Trabalho" em Administração (`admin.html#jornada`) hoje é somente leitura: os dados vêm exclusivamente da importação do PDF "Horário de Trabalho", que **substitui todo o conteúdo** da tabela `rh_jornada_trabalho` a cada importação (snapshot completo).

A tabela é populada com uma linha por `(codigo_empresa, codigo_empregado, dia_semana)`. A tela agrupa por empregado e mostra os 7 dias da semana como colunas.

Este design adiciona a possibilidade de o usuário editar manualmente os horários de um empregado já existente na lista, sem depender de nova importação de PDF.

---

## Decisões (confirmadas com o usuário)

- **Escopo:** editar horários (entrada/intervalo/saída) dos dias em que o empregado já trabalha, e marcar/desmarcar um dia como "não trabalha" (folga). **Não** inclui cadastrar um empregado novo do zero — isso continua vindo só do PDF.
- **Interação com a importação:** o comportamento de snapshot é mantido. Uma nova importação de PDF apaga e recria toda a tabela, então edições manuais feitas anteriormente são perdidas se o empregado aparecer no próximo PDF importado. Aceito como tradeoff.

---

## UI

### Tabela (`#jornada`)

Nova coluna **Ações** ao final do cabeçalho (`admin.html` ~linha 335), com botão por linha:

```html
<td><button onclick="abrirModalEditarJornada('${j.codigo_empresa}','${j.codigo_empregado}')">✏️ Editar</button></td>
```

`colspan` dos estados vazios/carregando passa de 11 para 12.

### Modal `modalJornadaEdit`

Reaproveita o padrão `.modal` / `.modal-content` / `.modal-header` / `.modal-body` / `.modal-footer` já usado em `messageModal` (`styles.css` ~linha 957).

Cabeçalho: `Editar Jornada — {nome_empregado} ({codigo_empregado}) — {nome_empresa}`

Corpo: uma linha por dia da semana (`_DIAS_SEMANA_ORDEM`), cada uma com:

- Checkbox "Trabalha" — pré-marcado se já existe registro daquele dia para o empregado
- 4 campos `<input type="time">`: Entrada, Intervalo início, Intervalo fim, Saída — `disabled` quando o checkbox está desmarcado
- Intervalo início/fim são opcionais, mas devem ser preenchidos os dois juntos ou nenhum
- Entrada e Saída são obrigatórios quando "Trabalha" está marcado

Rodapé: botão "Cancelar" (fecha sem salvar) e "Salvar" (`salvarJornadaEdit()`).

---

## Lógica em `admin.js`

### `abrirModalEditarJornada(codigoEmpresa, codigoEmpregado)`

- Busca o registro agrupado em `_todaJornadaInfo` (já carregado em memória, sem nova consulta ao banco)
- Preenche o formulário: para cada dia em `_DIAS_SEMANA_ORDEM`, marca o checkbox e preenche os 4 campos de horário se `dias[dia]` existir; senão deixa desmarcado/vazio
- Guarda `codigo_empresa`/`codigo_empregado` em campos hidden (`jornadaEditEmpresa`, `jornadaEditEmpregado`)
- Abre o modal (`classList.add('active')`)

### `fecharModalJornadaEdit()`

Remove a classe `active` do modal.

### `salvarJornadaEdit()`

1. Lê os campos hidden de empresa/empregado
2. Para cada dia em `_DIAS_SEMANA_ORDEM`:
   - Valida: se "Trabalha" marcado, entrada e saída obrigatórios; se só um lado do intervalo estiver preenchido, erro de validação (interrompe o salvamento, mostra mensagem)
   - Se "Trabalha" desmarcado e o dia existia antes → adiciona à lista de exclusão (`delete`)
   - Se "Trabalha" marcado → adiciona à lista de upsert com `codigo_empresa`, `nome_empresa`, `codigo_empregado`, `nome_empregado`, `dia_semana`, `entrada`, `intervalo_inicio`, `intervalo_fim`, `saida`
3. Executa as exclusões (`.delete().eq(...).eq(...).eq('dia_semana', dia)` para cada dia marcado, ou uma única chamada com `.in('dia_semana', [...])`)
4. Executa o upsert dos dias marcados como trabalhados, com `onConflict: 'codigo_empresa,codigo_empregado,dia_semana'` (mesma constraint única já existente na tabela)
5. Em caso de sucesso: fecha o modal, mostra status de sucesso em `#statusJornadaInfo`, chama `carregarJornadaInfo()` para recarregar a tabela a partir do banco
6. Em caso de erro: mostra mensagem de erro, mantém o modal aberto

---

## O que NÃO muda

- Fluxo de importação de PDF (`processarPdfJornada`, `_salvarJornadaTrabalho`) — continua substituindo toda a tabela a cada importação
- Schema de `rh_jornada_trabalho` (`schema_rh_jornada_trabalho.sql`) — nenhuma coluna nova, a constraint única existente já serve para o upsert
- Agrupamento e paginação da tabela (`_agruparJornadaPorEmpregado`, `renderizarTabelaJornadaInfo`)

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `admin.html` | Coluna "Ações" na tabela de jornada; novo modal `modalJornadaEdit` |
| `admin.js` | `abrirModalEditarJornada`, `fecharModalJornadaEdit`, `salvarJornadaEdit`, `_toggleDiaJornadaEdit` (habilita/desabilita campos ao marcar/desmarcar checkbox) |
