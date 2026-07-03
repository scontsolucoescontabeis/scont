# Liberação Meio Expediente e Sábado Sempre Extra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o evento "Liberação Meio Expediente" no dropdown de Folga/Falta (mesmo cálculo do "Atestado de Comparecimento"), e adicionar o flag "Sábado Sempre Extra" (todas as horas do sábado contam como hora extra) nas duas telas de configuração de jornada, com persistência completa (tela de lançamento, salvamento em `rh_saves`, exportação TXT e modal de Configuração de Rubricas por empresa).

**Architecture:** Todas as mudanças de lógica estão em `Projeto RH/script.js` (função `calcularFolha` para o cálculo em tela, `_construirConteudoTXTExportacao` para o cálculo de exportação) e `Projeto RH/index.html` (novo `<option>` no dropdown, novos checkboxes nas duas telas de configuração). Não há framework de testes no projeto — cada task termina com uma verificação manual precisa no navegador em vez de testes automatizados, seguindo a convenção já usada nos planos anteriores deste projeto (ver `docs/superpowers/plans/2026-06-01-faltas-dias-frequencia.md`).

**Tech Stack:** JavaScript vanilla, HTML inline, Supabase (Postgres) via `supabaseClient`. Sem build step, sem framework de testes.

## Global Constraints

- Novo valor de flag no dropdown: `liberacao_meio_expediente`. Rótulo exibido: "Liberação Meio Expediente".
- Novo campo boolean: `sabado_sempre_extra` (tela de lançamento) e evento `sabado_sempre_extra` (modal de Configuração de Rubricas, tabela `rh_config_rubricas_txt`, já é EAV — não precisa de migração de schema).
- "Sábado Sempre Extra" é mutuamente exclusivo com "Jornada diferenciada para o Sábado" em cada uma das duas telas, independentemente.
- Nenhuma mudança em: cálculo de horas extras normais, DSR/feriado, flags manuais existentes (folga, falta, compensação, atestado médico, atestado de comparecimento).
- **IMPORTANTE:** os números de linha citados abaixo refletem o estado do arquivo ANTES de qualquer edição deste plano. Como as tasks são sequenciais e cada uma adiciona linhas, use sempre o bloco de código exato (`old_string`) para localizar o trecho a editar — não confie apenas no número da linha depois da Task 1.

---

## Arquivos Impactados

- Criar: `Projeto RH/schema_rh_sabado_sempre_extra.sql` (migração manual no Supabase)
- Modify: `Projeto RH/schema_rh.sql` (documentar a nova coluna no schema principal)
- Modify: `Projeto RH/index.html`
  - Seção "⚙️ Configurações" da tela de lançamento (~linha 148-159): novo checkbox "Sábado sempre extra"
  - Modal "Configuração de Rubricas" (~linha 707-716): novo checkbox "Sábado sempre extra"
- Modify: `Projeto RH/script.js`
  - `state` global (~linha 11-25): novo campo `sabadoSempreExtra`
  - `toggleJornadaSabado` (~linha 56-58): exclusão mútua
  - `selecionarEmpresa` (~linha 108-130): pré-preenchimento do flag a partir do config da empresa
  - Dropdown de Folga/Falta na tabela de lançamento (~linha 766-773): novo `<option>`
  - `calcularFolha` (~linha 1159-1330): novo flag `flagLiberacaoMeioExpediente`, override de `jornadaEfetiva` no sábado
  - Blocos de carregamento do lote (~linha 315-336 e ~462-483): carregar/preencher `sabadoSempreExtra`
  - `iniciarSalvamento` (~linha 941-953) e payload de salvamento (~linha 1030-1048): ler e persistir `sabado_sempre_extra`
  - Badges da tabela de resultados (~linha 1478-1502)
  - Texto de flags na exportação/impressão (~linha 1575-1582)
  - `_preencherCamposConfigRubricas` / `_limparCamposConfigRubricas` (~linha 1705-1740)
  - `salvarConfigRubricas` (~linha 1795-1823)
  - `_construirConteudoTXTExportacao` (~linha 2014-2077)

---

## Task 1: Migração de banco de dados

**Files:**
- Create: `Projeto RH/schema_rh_sabado_sempre_extra.sql`
- Modify: `Projeto RH/schema_rh.sql:71` (documentação, não executado automaticamente)

### Contexto

A tabela `rh_saves` tem colunas fixas (não é EAV). Hoje ela já tem `jornada_sabado_ativa BOOLEAN DEFAULT FALSE` (schema_rh.sql linha 70). Precisamos de uma coluna nova, `sabado_sempre_extra`, para persistir o novo flag junto com cada lote salvo.

A tabela `rh_config_rubricas_txt` (usada pelo modal "Configuração de Rubricas") é EAV (`codigo_empresa`, `evento`, `codigo_rubrica`, `tipo_valor`) — não precisa de migração, um novo `evento = 'sabado_sempre_extra'` já funciona com o schema atual.

- [ ] **Step 1: Criar o arquivo de migração**

Criar `Projeto RH/schema_rh_sabado_sempre_extra.sql`:

```sql
-- Migração: flag "Sábado Sempre Extra" em rh_saves
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_saves
  ADD COLUMN IF NOT EXISTS sabado_sempre_extra BOOLEAN DEFAULT FALSE;
```

- [ ] **Step 2: Documentar a coluna no schema principal**

Em `Projeto RH/schema_rh.sql`, localizar (linha 69-71):
```sql
    jornada_sabado              TEXT,               -- ex: "04:00" (jornada diferenciada do Sábado)
    jornada_sabado_ativa        BOOLEAN DEFAULT FALSE,
    rule_extra_100_opcional     BOOLEAN DEFAULT FALSE,
```
Substituir por:
```sql
    jornada_sabado              TEXT,               -- ex: "04:00" (jornada diferenciada do Sábado)
    jornada_sabado_ativa        BOOLEAN DEFAULT FALSE,
    sabado_sempre_extra         BOOLEAN DEFAULT FALSE, -- todas as horas do sábado contam como extra (exclusivo com jornada_sabado_ativa)
    rule_extra_100_opcional     BOOLEAN DEFAULT FALSE,
```

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/schema_rh_sabado_sempre_extra.sql" "Projeto RH/schema_rh.sql"
git commit -m "chore: adicionar coluna sabado_sempre_extra em rh_saves (migração)"
```

- [ ] **Step 4: Avisar o usuário**

Este é o único passo que requer ação manual fora do editor de código: peça ao usuário para rodar o conteúdo de `Projeto RH/schema_rh_sabado_sempre_extra.sql` no SQL Editor do Supabase (projeto correto — ver memória de multi-projeto Supabase) antes de testar o salvamento de lotes com o novo flag. Sem essa coluna, o `upsert` em `rh_saves` (script.js, função `processarFolhaComSalvamento`) vai falhar silenciosamente ignorando o campo extra ou gerar erro dependendo da config do Supabase.

---

## Task 2: Evento "Liberação Meio Expediente" — dropdown e cálculo em tela

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Adicionar a opção no dropdown**

Localizar em `script.js` (~linha 766-773), dentro da função que renderiza a tabela de lançamento:
```js
                    <select onchange="atualizarFlagFolga(${state.abaAtivaIndex}, '${dia.data}', this.value)" style="padding: 4px; border-radius: 4px; border: 1px solid #ced4da; font-size: 12px;">
                        <option value="">-</option>
                        ${!temEntrada ? `<option value="folga" ${flagFolga === 'folga' ? 'selected' : ''}>Folga</option>` : ''}
                        ${!temEntrada ? `<option value="falta" ${flagFolga === 'falta' ? 'selected' : ''}>Falta</option>` : ''}
                        ${!temEntrada ? `<option value="compensacao" ${flagFolga === 'compensacao' ? 'selected' : ''}>Compensação</option>` : ''}
                        <option value="atestado" ${flagFolga === 'atestado' ? 'selected' : ''}>Atestado Médico</option>
                        <option value="atestado_comparecimento" ${flagFolga === 'atestado_comparecimento' ? 'selected' : ''}>Atestado de Comparecimento</option>
                    </select>
```
Substituir por:
```js
                    <select onchange="atualizarFlagFolga(${state.abaAtivaIndex}, '${dia.data}', this.value)" style="padding: 4px; border-radius: 4px; border: 1px solid #ced4da; font-size: 12px;">
                        <option value="">-</option>
                        ${!temEntrada ? `<option value="folga" ${flagFolga === 'folga' ? 'selected' : ''}>Folga</option>` : ''}
                        ${!temEntrada ? `<option value="falta" ${flagFolga === 'falta' ? 'selected' : ''}>Falta</option>` : ''}
                        ${!temEntrada ? `<option value="compensacao" ${flagFolga === 'compensacao' ? 'selected' : ''}>Compensação</option>` : ''}
                        <option value="atestado" ${flagFolga === 'atestado' ? 'selected' : ''}>Atestado Médico</option>
                        <option value="atestado_comparecimento" ${flagFolga === 'atestado_comparecimento' ? 'selected' : ''}>Atestado de Comparecimento</option>
                        <option value="liberacao_meio_expediente" ${flagFolga === 'liberacao_meio_expediente' ? 'selected' : ''}>Liberação Meio Expediente</option>
                    </select>
```

- [ ] **Step 2: Adicionar o flag em `calcularFolha`**

Localizar (~linha 1183-1250):
```js
        let extra50 = 0, extra100 = 0, faltante = 0;
        let flagDSR = isDSRCustomizado;
        let flagFolga = false, flagFalta = false, flagAtestado = false, flagAtestadoComparecimento = false, flagSemRegistro = false, flagCompensacao = false;

        const flagFolgaData = folha.flagsFolga[dia.data];
        const isAtestadoMedico = flagFolgaData === 'atestado';
        const isAtestadoComp   = flagFolgaData === 'atestado_comparecimento';
        const isAtestado = isAtestadoMedico || isAtestadoComp;
        if (isAtestadoMedico) flagAtestado = true;
        if (isAtestadoComp)   flagAtestadoComparecimento = true;

        if (isAtestadoMedico) {
            // dia totalmente desconsiderado
        } else if (isAtestadoComp) {
            // isenção de metade da jornada: só conta faltante abaixo de jornada/2
            const metadeJornada = Math.floor(jornadaEfetiva / 2);
            const horasRef = minTrabalhados;
            if (horasRef < metadeJornada) {
                faltante = metadeJornada - horasRef;
            }
            totalTrabalhado += minTrabalhados;
        } else if (minTrabalhados > 0) {
```
Substituir por:
```js
        let extra50 = 0, extra100 = 0, faltante = 0;
        let flagDSR = isDSRCustomizado;
        let flagFolga = false, flagFalta = false, flagAtestado = false, flagAtestadoComparecimento = false, flagLiberacaoMeioExpediente = false, flagSemRegistro = false, flagCompensacao = false;

        const flagFolgaData = folha.flagsFolga[dia.data];
        const isAtestadoMedico = flagFolgaData === 'atestado';
        const isAtestadoComp   = flagFolgaData === 'atestado_comparecimento';
        const isLiberacaoMeioExpediente = flagFolgaData === 'liberacao_meio_expediente';
        const isAtestado = isAtestadoMedico || isAtestadoComp || isLiberacaoMeioExpediente;
        if (isAtestadoMedico) flagAtestado = true;
        if (isAtestadoComp)   flagAtestadoComparecimento = true;
        if (isLiberacaoMeioExpediente) flagLiberacaoMeioExpediente = true;

        if (isAtestadoMedico) {
            // dia totalmente desconsiderado
        } else if (isAtestadoComp || isLiberacaoMeioExpediente) {
            // isenção de metade da jornada: só conta faltante abaixo de jornada/2
            const metadeJornada = Math.floor(jornadaEfetiva / 2);
            const horasRef = minTrabalhados;
            if (horasRef < metadeJornada) {
                faltante = metadeJornada - horasRef;
            }
            totalTrabalhado += minTrabalhados;
        } else if (minTrabalhados > 0) {
```

- [ ] **Step 3: Ajustar o `else if` final do mesmo bloco**

Logo abaixo, no mesmo bloco de `calcularFolha` (~linha 1237-1250):
```js
        } else if (!isDiaDescanso) {
            // atestados já tratados acima; aqui só dias sem horas e sem atestado
            if (flagFolgaData === 'folga') {
                flagFolga = true;
            } else if (flagFolgaData === 'falta') {
                flagFalta = true;
                totalFaltas += 1;
            } else if (flagFolgaData === 'compensacao') {
                flagCompensacao = true;
                faltante = jornadaEfetiva;
            } else if (!isAtestado && !isAtestadoComp) {
                flagSemRegistro = true;
            }
        }
```
Substituir por:
```js
        } else if (!isDiaDescanso) {
            // atestados e liberação já tratados acima; aqui só dias sem horas e sem atestado
            if (flagFolgaData === 'folga') {
                flagFolga = true;
            } else if (flagFolgaData === 'falta') {
                flagFalta = true;
                totalFaltas += 1;
            } else if (flagFolgaData === 'compensacao') {
                flagCompensacao = true;
                faltante = jornadaEfetiva;
            } else if (!isAtestado) {
                flagSemRegistro = true;
            }
        }
```

- [ ] **Step 4: Incluir o novo flag no objeto retornado por dia**

Localizar (~linha 1280-1288):
```js
            isDiaDescanso: isDiaDescanso,
            flagDSR: flagDSR,
            flagFolga: flagFolga,
            flagFalta: flagFalta,
            flagAtestado: flagAtestado,
            flagAtestadoComparecimento: flagAtestadoComparecimento,
            flagSemRegistro: flagSemRegistro,
            flagCompensacao: flagCompensacao
        };
```
Substituir por:
```js
            isDiaDescanso: isDiaDescanso,
            flagDSR: flagDSR,
            flagFolga: flagFolga,
            flagFalta: flagFalta,
            flagAtestado: flagAtestado,
            flagAtestadoComparecimento: flagAtestadoComparecimento,
            flagLiberacaoMeioExpediente: flagLiberacaoMeioExpediente,
            flagSemRegistro: flagSemRegistro,
            flagCompensacao: flagCompensacao
        };
```

- [ ] **Step 5: Badge na tabela de resultados**

Localizar (~linha 1488-1493):
```js
            if (dia.flagAtestadoComparecimento) {
                flags += '<span style="background: #ede9fe; color: #5b21b6; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">AT. COMPARECIMENTO</span>';
            }
            if (dia.flagCompensacao) {
```
Substituir por:
```js
            if (dia.flagAtestadoComparecimento) {
                flags += '<span style="background: #ede9fe; color: #5b21b6; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">AT. COMPARECIMENTO</span>';
            }
            if (dia.flagLiberacaoMeioExpediente) {
                flags += '<span style="background: #fce7f3; color: #9d174d; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">LIB. MEIO EXPEDIENTE</span>';
            }
            if (dia.flagCompensacao) {
```

- [ ] **Step 6: Texto de flags na exportação/impressão**

Localizar (~linha 1576-1581):
```js
        if (dia.flagDSR) flagsStr += 'DSR ';
        if (dia.flagFolga) flagsStr += 'FOLGA ';
        if (dia.flagFalta) flagsStr += 'FALTA ';
        if (dia.flagAtestado) flagsStr += 'ATESTADO MÉDICO ';
        if (dia.flagAtestadoComparecimento) flagsStr += 'ATESTADO DE COMPARECIMENTO ';
        if (dia.flagSemRegistro) flagsStr += 'SEM REGISTRO ';
```
Substituir por:
```js
        if (dia.flagDSR) flagsStr += 'DSR ';
        if (dia.flagFolga) flagsStr += 'FOLGA ';
        if (dia.flagFalta) flagsStr += 'FALTA ';
        if (dia.flagAtestado) flagsStr += 'ATESTADO MÉDICO ';
        if (dia.flagAtestadoComparecimento) flagsStr += 'ATESTADO DE COMPARECIMENTO ';
        if (dia.flagLiberacaoMeioExpediente) flagsStr += 'LIBERAÇÃO MEIO EXPEDIENTE ';
        if (dia.flagSemRegistro) flagsStr += 'SEM REGISTRO ';
```

- [ ] **Step 7: Verificação manual**

Abrir a ferramenta no navegador (`Projeto RH/index.html`), selecionar uma empresa e competência com jornada 08:00. Em um dia útil sem batida de ponto, marcar "Liberação Meio Expediente" no dropdown Folga/Falta e processar a folha. Confirmar:
- Sem nenhuma hora trabalhada: "Horas Faltantes" do dia mostra `04:00` (metade de 08:00), badge "LIB. MEIO EXPEDIENTE" aparece na tabela de resultados.
- Registrando 4h ou mais de trabalho no mesmo dia (ex: entrada 08:00, saída 12:00): "Horas Faltantes" do dia mostra `00:00`.
- Comparar com o mesmo cenário usando "Atestado de Comparecimento" — os números devem ser idênticos, só o rótulo do badge muda.

- [ ] **Step 8: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: adicionar evento Liberação Meio Expediente na tela de lançamento"
```

---

## Task 3: Evento "Liberação Meio Expediente" — exportação TXT

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Replicar o tratamento em `_construirConteudoTXTExportacao`**

Localizar (~linha 2047-2077):
```js
            let ex50 = 0, ex100 = 0, dev = 0;
            const flag = flagsFolga[dia.data];
            const isAtestadoMedicoExp = flag === 'atestado';
            const isAtestadoCompExp   = flag === 'atestado_comparecimento';
            if (isAtestadoMedicoExp) {
                // dia totalmente desconsiderado
            } else if (isAtestadoCompExp) {
                // isenção de metade da jornada
                const metade = Math.floor(jornadaMinEfetiva / 2);
                if (minTrab < metade) dev = metade - minTrab;
            } else if (minTrab > 0) {
```
Substituir por:
```js
            let ex50 = 0, ex100 = 0, dev = 0;
            const flag = flagsFolga[dia.data];
            const isAtestadoMedicoExp = flag === 'atestado';
            const isAtestadoCompExp   = flag === 'atestado_comparecimento';
            const isLiberacaoMeioExpedienteExp = flag === 'liberacao_meio_expediente';
            if (isAtestadoMedicoExp) {
                // dia totalmente desconsiderado
            } else if (isAtestadoCompExp || isLiberacaoMeioExpedienteExp) {
                // isenção de metade da jornada
                const metade = Math.floor(jornadaMinEfetiva / 2);
                if (minTrab < metade) dev = metade - minTrab;
            } else if (minTrab > 0) {
```

Logo abaixo, no mesmo bloco (~linha 2069-2077):
```js
            } else if (!isDiaDescanso) {
                if (flag === 'falta') {
                    tFaltaDias++;
                    diasFaltaDetalhes.push({ data: dia.data, flagDSR: isDSR });
                } else if (flag === 'compensacao') {
                    dev = jornadaMinEfetiva;
                }
                // folga, atestado e sem registro não geram horas devidas nem faltas
            }
```
Substituir por:
```js
            } else if (!isDiaDescanso) {
                if (flag === 'falta') {
                    tFaltaDias++;
                    diasFaltaDetalhes.push({ data: dia.data, flagDSR: isDSR });
                } else if (flag === 'compensacao') {
                    dev = jornadaMinEfetiva;
                }
                // folga, atestado, liberação meio expediente e sem registro não geram horas devidas nem faltas
            }
```

- [ ] **Step 2: Verificação manual**

Com o mesmo lote usado na Task 2 (dia com "Liberação Meio Expediente" e sem batida), abrir o modal de exportação TXT, gerar a prévia e confirmar que o total de horas devidas exportado bate com o `totais.faltante` mostrado em tela (após compensação com extras, se houver).

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: replicar evento Liberação Meio Expediente na exportação TXT"
```

---

## Task 4: "Sábado Sempre Extra" — checkbox e cálculo na tela de lançamento

**Files:**
- Modify: `Projeto RH/index.html`
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Adicionar o checkbox em `index.html`**

Localizar (~linha 147-159):
```html
                    <div class="setting-card">
                        <h4>Jornada de Trabalho</h4>
                        <input type="text" id="jornada" value="08:00" maxlength="5" placeholder="HH:MM">
                        <small>Horas diárias de trabalho</small>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="jornadaSabadoAtiva" style="width: 16px; height: 16px; cursor: pointer;" onchange="toggleJornadaSabado(this.checked)">
                            <label for="jornadaSabadoAtiva" style="font-size: 12px; cursor: pointer; margin: 0;">Jornada diferenciada para o Sábado</label>
                        </div>
                        <div id="jornadaSabadoContainer" style="display: none; margin-top: 8px;">
                            <input type="text" id="jornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM">
                            <small>Horas no Sábado</small>
                        </div>
                    </div>
```
Substituir por:
```html
                    <div class="setting-card">
                        <h4>Jornada de Trabalho</h4>
                        <input type="text" id="jornada" value="08:00" maxlength="5" placeholder="HH:MM">
                        <small>Horas diárias de trabalho</small>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="jornadaSabadoAtiva" style="width: 16px; height: 16px; cursor: pointer;" onchange="toggleJornadaSabado(this.checked)">
                            <label for="jornadaSabadoAtiva" style="font-size: 12px; cursor: pointer; margin: 0;">Jornada diferenciada para o Sábado</label>
                        </div>
                        <div id="jornadaSabadoContainer" style="display: none; margin-top: 8px;">
                            <input type="text" id="jornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM">
                            <small>Horas no Sábado</small>
                        </div>
                        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="sabadoSempreExtra" style="width: 16px; height: 16px; cursor: pointer;" onchange="toggleSabadoSempreExtra(this.checked)">
                            <label for="sabadoSempreExtra" style="font-size: 12px; cursor: pointer; margin: 0;">Sábado sempre extra</label>
                        </div>
                    </div>
```

- [ ] **Step 2: Novo campo no `state` global**

Em `script.js`, localizar (~linha 19-22):
```js
    jornada: '08:00',
    jornadaSabado: '04:00',
    jornadaSabadoAtiva: false,
    ruleExtra100Optional: false,
```
Substituir por:
```js
    jornada: '08:00',
    jornadaSabado: '04:00',
    jornadaSabadoAtiva: false,
    sabadoSempreExtra: false,
    ruleExtra100Optional: false,
```

- [ ] **Step 3: Exclusão mútua entre os dois checkboxes**

Localizar (~linha 56-58):
```js
window.toggleJornadaSabado = function(ativa) {
    document.getElementById('jornadaSabadoContainer').style.display = ativa ? 'block' : 'none';
};
```
Substituir por:
```js
window.toggleJornadaSabado = function(ativa) {
    document.getElementById('jornadaSabadoContainer').style.display = ativa ? 'block' : 'none';
    if (ativa) {
        document.getElementById('sabadoSempreExtra').checked = false;
    }
};

window.toggleSabadoSempreExtra = function(ativa) {
    if (ativa) {
        document.getElementById('jornadaSabadoAtiva').checked = false;
        document.getElementById('jornadaSabadoContainer').style.display = 'none';
    }
};
```

- [ ] **Step 4: Override de `jornadaEfetiva` no sábado, em `calcularFolha`**

Localizar (~linha 1167):
```js
        const jornadaEfetiva = dia.diaSemana === 'Sab' ? jornadaSabadoMinutos : jornadaMinutos;
```
Substituir por:
```js
        const jornadaEfetiva = dia.diaSemana === 'Sab'
            ? (state.sabadoSempreExtra ? 0 : jornadaSabadoMinutos)
            : jornadaMinutos;
```

- [ ] **Step 5: Verificação manual**

No navegador, marcar "Sábado sempre extra" (confirmar que desmarca "Jornada diferenciada para o Sábado" automaticamente, e vice-versa). Lançar um sábado com 3h trabalhadas (ex: entrada 08:00, saída 11:00) e processar. Confirmar:
- Com a regra "Aplicar Hora Extra 100% a partir da 3ª hora" desativada: as 3h aparecem inteiras em "Extra 50%", `00:00` em normais e em faltante.
- Com a regra ativada: 2h em "Extra 50%" e 1h em "Extra 100%".
- Sem nenhuma hora trabalhada no sábado: `00:00` em faltante (não gera falta).

- [ ] **Step 6: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: adicionar flag Sábado Sempre Extra na tela de lançamento"
```

---

## Task 5: "Sábado Sempre Extra" — persistência no lote (salvar e recarregar)

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Ler o checkbox em `iniciarSalvamento`**

Localizar (~linha 941-945):
```js
function iniciarSalvamento() {
    state.jornada = document.getElementById('jornada').value;
    state.jornadaSabadoAtiva = document.getElementById('jornadaSabadoAtiva').checked;
    state.jornadaSabado = document.getElementById('jornadaSabado').value;
    state.ruleExtra100Optional = document.getElementById('ruleExtra100Optional').checked;
```
Substituir por:
```js
function iniciarSalvamento() {
    state.jornada = document.getElementById('jornada').value;
    state.jornadaSabadoAtiva = document.getElementById('jornadaSabadoAtiva').checked;
    state.jornadaSabado = document.getElementById('jornadaSabado').value;
    state.sabadoSempreExtra = document.getElementById('sabadoSempreExtra').checked;
    state.ruleExtra100Optional = document.getElementById('ruleExtra100Optional').checked;
```

- [ ] **Step 2: Incluir no payload salvo em `rh_saves`**

Localizar (~linha 1035-1038):
```js
                jornada: state.jornada,
                jornada_sabado: state.jornadaSabadoAtiva ? state.jornadaSabado : null,
                jornada_sabado_ativa: state.jornadaSabadoAtiva,
                rule_extra_100_opcional: state.ruleExtra100Optional,
```
Substituir por:
```js
                jornada: state.jornada,
                jornada_sabado: state.jornadaSabadoAtiva ? state.jornadaSabado : null,
                jornada_sabado_ativa: state.jornadaSabadoAtiva,
                sabado_sempre_extra: state.sabadoSempreExtra,
                rule_extra_100_opcional: state.ruleExtra100Optional,
```

- [ ] **Step 3: Recarregar nos dois pontos de carregamento de lote**

Este bloco aparece duas vezes no arquivo (uma função carrega rascunho, outra carrega última versão salva) — repetir a mesma edição nas duas ocorrências.

Localizar (~linha 316-335 e novamente ~linha 463-482):
```js
            state.jornada = registrosParaCarregar[0].jornada || '08:00';
            state.jornadaSabado = registrosParaCarregar[0].jornada_sabado || '04:00';
            state.jornadaSabadoAtiva = registrosParaCarregar[0].jornada_sabado_ativa || false;
            state.ruleExtra100Optional = registrosParaCarregar[0].rule_extra_100_opcional || false;
```
Substituir por (nas DUAS ocorrências):
```js
            state.jornada = registrosParaCarregar[0].jornada || '08:00';
            state.jornadaSabado = registrosParaCarregar[0].jornada_sabado || '04:00';
            state.jornadaSabadoAtiva = registrosParaCarregar[0].jornada_sabado_ativa || false;
            state.sabadoSempreExtra = registrosParaCarregar[0].sabado_sempre_extra || false;
            state.ruleExtra100Optional = registrosParaCarregar[0].rule_extra_100_opcional || false;
```

E logo abaixo, também nas duas ocorrências, localizar:
```js
            document.getElementById('jornada').value = state.jornada;
            document.getElementById('jornadaSabado').value = state.jornadaSabado;
            document.getElementById('jornadaSabadoAtiva').checked = state.jornadaSabadoAtiva;
            document.getElementById('jornadaSabadoContainer').style.display = state.jornadaSabadoAtiva ? 'block' : 'none';
            document.getElementById('ruleExtra100Optional').checked = state.ruleExtra100Optional;
```
Substituir por (nas DUAS ocorrências):
```js
            document.getElementById('jornada').value = state.jornada;
            document.getElementById('jornadaSabado').value = state.jornadaSabado;
            document.getElementById('jornadaSabadoAtiva').checked = state.jornadaSabadoAtiva;
            document.getElementById('jornadaSabadoContainer').style.display = state.jornadaSabadoAtiva ? 'block' : 'none';
            document.getElementById('sabadoSempreExtra').checked = state.sabadoSempreExtra;
            document.getElementById('ruleExtra100Optional').checked = state.ruleExtra100Optional;
```

- [ ] **Step 4: Verificação manual**

**Pré-requisito:** a coluna `sabado_sempre_extra` precisa existir em `rh_saves` (Task 1, Step 4) antes deste teste.

Marcar "Sábado sempre extra", processar e salvar um lote. Recarregar a página, selecionar a mesma empresa/competência e confirmar que o checkbox "Sábado sempre extra" volta marcado (e "Jornada diferenciada para o Sábado" continua desmarcado).

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: persistir flag Sábado Sempre Extra no lote salvo (rh_saves)"
```

---

## Task 6: "Sábado Sempre Extra" — modal de Configuração de Rubricas (por empresa)

**Files:**
- Modify: `Projeto RH/index.html`
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Adicionar o checkbox no modal, com exclusão mútua**

Em `index.html`, localizar (~linha 707-716):
```html
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <input type="checkbox" id="cfgJornadaSabadoAtiva" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="document.getElementById('cfgJornadaSabadoContainer').style.display = this.checked ? 'flex' : 'none'">
                            <label for="cfgJornadaSabadoAtiva" style="font-size: 13px; cursor: pointer; margin: 0;">Jornada diferenciada para o Sábado</label>
                        </div>
                        <div id="cfgJornadaSabadoContainer" style="display: none; align-items: center; gap: 12px; padding-left: 24px;">
                            <label style="font-size: 13px; font-weight: 500; min-width: 120px;">Horas no Sábado</label>
                            <input type="text" id="cfgJornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM"
                                style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 80px;">
                        </div>
```
Substituir por:
```html
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <input type="checkbox" id="cfgJornadaSabadoAtiva" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="document.getElementById('cfgJornadaSabadoContainer').style.display = this.checked ? 'flex' : 'none'; if (this.checked) { document.getElementById('cfgSabadoSempreExtra').checked = false; }">
                            <label for="cfgJornadaSabadoAtiva" style="font-size: 13px; cursor: pointer; margin: 0;">Jornada diferenciada para o Sábado</label>
                        </div>
                        <div id="cfgJornadaSabadoContainer" style="display: none; align-items: center; gap: 12px; padding-left: 24px;">
                            <label style="font-size: 13px; font-weight: 500; min-width: 120px;">Horas no Sábado</label>
                            <input type="text" id="cfgJornadaSabado" value="04:00" maxlength="5" placeholder="HH:MM"
                                style="padding: 5px 9px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; font-family: monospace; width: 80px;">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                            <input type="checkbox" id="cfgSabadoSempreExtra" style="width: 16px; height: 16px; cursor: pointer;"
                                onchange="if (this.checked) { document.getElementById('cfgJornadaSabadoAtiva').checked = false; document.getElementById('cfgJornadaSabadoContainer').style.display = 'none'; }">
                            <label for="cfgSabadoSempreExtra" style="font-size: 13px; cursor: pointer; margin: 0;">Sábado sempre extra</label>
                        </div>
```

- [ ] **Step 2: Salvar o novo evento em `salvarConfigRubricas`**

Em `script.js`, localizar (~linha 1806-1810):
```js
    const jornadaRows = [
        { codigo_empresa: codigoEmpresa, evento: 'jornada_diaria',       codigo_rubrica: (document.getElementById('cfgJornada')?.value || '08:00').trim(),           tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSabadoAtiva')?.checked ? '1' : '0',      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado',        codigo_rubrica: (document.getElementById('cfgJornadaSabado')?.value || '04:00').trim(),      tipo_valor: 'jornada' },
    ];
```
Substituir por:
```js
    const jornadaRows = [
        { codigo_empresa: codigoEmpresa, evento: 'jornada_diaria',       codigo_rubrica: (document.getElementById('cfgJornada')?.value || '08:00').trim(),           tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado_ativa',  codigo_rubrica: document.getElementById('cfgJornadaSabadoAtiva')?.checked ? '1' : '0',      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'jornada_sabado',        codigo_rubrica: (document.getElementById('cfgJornadaSabado')?.value || '04:00').trim(),      tipo_valor: 'jornada' },
        { codigo_empresa: codigoEmpresa, evento: 'sabado_sempre_extra',   codigo_rubrica: document.getElementById('cfgSabadoSempreExtra')?.checked ? '1' : '0',       tipo_valor: 'jornada' },
    ];
```

- [ ] **Step 3: Preencher o checkbox ao abrir o modal para uma empresa**

Localizar (~linha 1705-1723):
```js
function _preencherCamposConfigRubricas(cfg) {
    if (!cfg) { _limparCamposConfigRubricas(); return; }
    _CFG_EVENTOS.forEach(def => {
        const v = cfg[def.ev] || {};
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
    const jDiaria   = document.getElementById('cfgJornada');
    const jSabAtiva = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont  = document.getElementById('cfgJornadaSabadoContainer');
    const jSab      = document.getElementById('cfgJornadaSabado');
    if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
    const sabAtiva = cfg['jornada_sabado_ativa']?.cod === '1';
    if (jSabAtiva) jSabAtiva.checked = sabAtiva;
    if (jSabCont)  jSabCont.style.display = sabAtiva ? 'flex' : 'none';
    if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
}
```
Substituir por:
```js
function _preencherCamposConfigRubricas(cfg) {
    if (!cfg) { _limparCamposConfigRubricas(); return; }
    _CFG_EVENTOS.forEach(def => {
        const v = cfg[def.ev] || {};
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = v.cod  || '';
        if (tipoEl) tipoEl.value = v.tipo || def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
    const sabAtiva = cfg['jornada_sabado_ativa']?.cod === '1';
    if (jSabAtiva) jSabAtiva.checked = sabAtiva;
    if (jSabCont)  jSabCont.style.display = sabAtiva ? 'flex' : 'none';
    if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = cfg['sabado_sempre_extra']?.cod === '1';
}
```

- [ ] **Step 4: Limpar o checkbox junto com os demais campos**

Localizar (~linha 1725-1740):
```js
function _limparCamposConfigRubricas() {
    _CFG_EVENTOS.forEach(def => {
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = '';
        if (tipoEl) tipoEl.value = def.defaultTipo;
    });
    const jDiaria   = document.getElementById('cfgJornada');
    const jSabAtiva = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont  = document.getElementById('cfgJornadaSabadoContainer');
    const jSab      = document.getElementById('cfgJornadaSabado');
    if (jDiaria)   jDiaria.value    = '08:00';
    if (jSabAtiva) jSabAtiva.checked = false;
    if (jSabCont)  jSabCont.style.display = 'none';
    if (jSab)      jSab.value       = '04:00';
}
```
Substituir por:
```js
function _limparCamposConfigRubricas() {
    _CFG_EVENTOS.forEach(def => {
        const rubEl  = document.getElementById(`cfgRub_${def.ev}`);
        const tipoEl = document.getElementById(`cfgTipo_${def.ev}`);
        if (rubEl)  rubEl.value  = '';
        if (tipoEl) tipoEl.value = def.defaultTipo;
    });
    const jDiaria       = document.getElementById('cfgJornada');
    const jSabAtiva     = document.getElementById('cfgJornadaSabadoAtiva');
    const jSabCont      = document.getElementById('cfgJornadaSabadoContainer');
    const jSab          = document.getElementById('cfgJornadaSabado');
    const jSabSempreExt = document.getElementById('cfgSabadoSempreExtra');
    if (jDiaria)   jDiaria.value    = '08:00';
    if (jSabAtiva) jSabAtiva.checked = false;
    if (jSabCont)  jSabCont.style.display = 'none';
    if (jSab)      jSab.value       = '04:00';
    if (jSabSempreExt) jSabSempreExt.checked = false;
}
```

- [ ] **Step 5: Verificação manual**

Abrir o modal "Configuração de Rubricas", buscar uma empresa, marcar "Sábado sempre extra" (confirmar exclusão mútua com "Jornada diferenciada para o Sábado") e salvar. Reabrir o modal para a mesma empresa e confirmar que o checkbox volta marcado. Testar também "Limpar Empresa" e confirmar que o checkbox volta desmarcado.

- [ ] **Step 6: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat: adicionar flag Sábado Sempre Extra no modal de Configuração de Rubricas"
```

---

## Task 7: "Sábado Sempre Extra" — pré-preenchimento automático e exportação TXT

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Pré-preencher a tela de lançamento ao selecionar a empresa**

Ao selecionar uma empresa na tela de lançamento (`selecionarEmpresa`), o código já busca o config salvo no modal (Task 6) via `_buscarConfigRubricas` e usa para pré-preencher jornada/jornada de sábado. Precisamos incluir o novo flag nesse pré-preenchimento.

Localizar (~linha 108-131):
```js
async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
    const jDiaria   = document.getElementById('jornada');
    const jSabAtiva = document.getElementById('jornadaSabadoAtiva');
    const jSabCont  = document.getElementById('jornadaSabadoContainer');
    const jSab      = document.getElementById('jornadaSabado');
    if (cfg && cfg['jornada_diaria']) {
        if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
        const sabAtiva = cfg['jornada_sabado_ativa']?.cod === '1';
        if (jSabAtiva) { jSabAtiva.checked = sabAtiva; }
        if (jSabCont)  jSabCont.style.display = sabAtiva ? 'block' : 'none';
        if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
    } else {
        if (jDiaria)   jDiaria.value    = '08:00';
        if (jSabAtiva) jSabAtiva.checked = false;
        if (jSabCont)  jSabCont.style.display = 'none';
        if (jSab)      jSab.value       = '04:00';
```
Substituir por:
```js
async function selecionarEmpresa(codigo, nome) {
    document.getElementById('codigoEmpresa').value = codigo;
    document.getElementById('buscaEmpresa').value = `${codigo} - ${nome}`;
    document.getElementById('buscaEmpresaResultados').style.display = 'none';
    const label = document.getElementById('empresaSelecionadaLabel');
    if (label) label.textContent = '';
    const cfg = await _buscarConfigRubricas(codigo);
    const jDiaria       = document.getElementById('jornada');
    const jSabAtiva     = document.getElementById('jornadaSabadoAtiva');
    const jSabCont      = document.getElementById('jornadaSabadoContainer');
    const jSab          = document.getElementById('jornadaSabado');
    const jSabSempreExt = document.getElementById('sabadoSempreExtra');
    if (cfg && cfg['jornada_diaria']) {
        if (jDiaria)   jDiaria.value = cfg['jornada_diaria']?.cod || '08:00';
        const sempreExtra = cfg['sabado_sempre_extra']?.cod === '1';
        const sabAtiva = !sempreExtra && cfg['jornada_sabado_ativa']?.cod === '1';
        if (jSabAtiva) { jSabAtiva.checked = sabAtiva; }
        if (jSabCont)  jSabCont.style.display = sabAtiva ? 'block' : 'none';
        if (jSab)      jSab.value = cfg['jornada_sabado']?.cod || '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = sempreExtra;
    } else {
        if (jDiaria)   jDiaria.value    = '08:00';
        if (jSabAtiva) jSabAtiva.checked = false;
        if (jSabCont)  jSabCont.style.display = 'none';
        if (jSab)      jSab.value       = '04:00';
        if (jSabSempreExt) jSabSempreExt.checked = false;
```

Manter o restante da função (fechamento do `if/else` e chaves seguintes) inalterado.

- [ ] **Step 2: Ler o flag salvo na exportação TXT**

Localizar (~linha 2023-2033):
```js
        const jornadaMin = converterHoraParaMinutos(save.jornada || '08:00');
        const jornadaSabadoMin = (save.jornada_sabado_ativa && save.jornada_sabado)
            ? converterHoraParaMinutos(save.jornada_sabado)
            : jornadaMin;
        const rule100    = save.rule_extra_100_opcional || false;
        const dados      = JSON.parse(save.dados_json || '[]');

        let tTrab = 0, tEx50 = 0, tEx100 = 0, tNot = 0, tDev = 0, tFaltaDias = 0;
        const diasFaltaDetalhes = [];
        dados.forEach(dia => {
            const jornadaMinEfetiva = dia.diaSemana === 'Sab' ? jornadaSabadoMin : jornadaMin;
```
Substituir por:
```js
        const jornadaMin = converterHoraParaMinutos(save.jornada || '08:00');
        const jornadaSabadoMin = (save.jornada_sabado_ativa && save.jornada_sabado)
            ? converterHoraParaMinutos(save.jornada_sabado)
            : jornadaMin;
        const sabadoSempreExtra = !!save.sabado_sempre_extra;
        const rule100    = save.rule_extra_100_opcional || false;
        const dados      = JSON.parse(save.dados_json || '[]');

        let tTrab = 0, tEx50 = 0, tEx100 = 0, tNot = 0, tDev = 0, tFaltaDias = 0;
        const diasFaltaDetalhes = [];
        dados.forEach(dia => {
            const jornadaMinEfetiva = dia.diaSemana === 'Sab'
                ? (sabadoSempreExtra ? 0 : jornadaSabadoMin)
                : jornadaMin;
```

- [ ] **Step 3: Verificação manual**

Selecionar, na tela de lançamento, uma empresa cujo config no modal (Task 6) tenha "Sábado sempre extra" marcado — confirmar que o checkbox da tela de lançamento vem marcado automaticamente (e "Jornada diferenciada para o Sábado" vem desmarcado). Processar e salvar um lote com horas no sábado, depois gerar a prévia da exportação TXT e confirmar que o total de extras bate com o mostrado em tela (mesmo cenário testado na Task 4, Step 5).

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: pré-preencher Sábado Sempre Extra por empresa e replicar na exportação TXT"
```

---

## Task 8: Verificação manual final (checklist de regressão)

Sem framework de testes automatizados neste projeto, feche o trabalho com uma rodada manual cobrindo os cenários que não mudaram, para garantir que nada quebrou:

- [ ] **Step 1:** Um dia útil normal (jornada completa, sem flags) ainda calcula `00:00` de faltante e `00:00` de extra.
- [ ] **Step 2:** "Atestado Médico" continua zerando o dia inteiro (não conta trabalhado, não conta faltante).
- [ ] **Step 3:** "Atestado de Comparecimento" continua com o mesmo comportamento de antes (não deve ter sido afetado pela adição de "Liberação Meio Expediente").
- [ ] **Step 4:** Um sábado com "Jornada diferenciada para o Sábado" ativa (sem "Sábado sempre extra") continua dividindo entre horas normais e extras como antes.
- [ ] **Step 5:** Feriado/DSR no sábado continua gerando 100% extra independentemente do novo flag.
- [ ] **Step 6:** Exportação TXT de um lote antigo (salvo antes desta mudança, sem a coluna `sabado_sempre_extra` preenchida) não quebra — `!!save.sabado_sempre_extra` deve resultar em `false` para `undefined`/`null`.

Nenhum commit necessário neste task — é só verificação.
