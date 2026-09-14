# Ficha 360 do Cliente — Design

**Data:** 2026-09-14
**Status:** aprovado em conversa; aguardando revisão da spec escrita
**Abordagem:** A — agregação no navegador (supabase-js), sem RPC/view

## 1. Objetivo

Dar à equipe interna Scont (DP, Contábil, Administrativo) uma visão única de cada empresa cliente: dados do Domínio, dados Scont, vencimentos, situação de DP e Contábil, anotações internas e histórico de WhatsApp — com um **semáforo de saúde** por empresa e um **painel da carteira**.

A ferramenta **consolida** o que já existe nos módulos do portal e **cadastra apenas** o que não existe em lugar nenhum. Não altera nenhum módulo existente na V1. O Domínio continua sendo a plataforma principal.

**Público:** somente equipe interna. **Prestador de Serviço não acessa.**

## 2. Telas

Local: `Projeto Ficha 360/`. Card novo no `portal.html`; acesso controlado por `usuario_ferramentas`; paleta, header/sidebar e auth guard padrão do portal (`PortalAuthGuard.init(1)`).

### 2.1 Painel da Carteira (`index.html`)

- **Contadores:** empresas ativas · 🔴 críticas · 🟡 atenção · sem responsável definido.
- **Filtros:** busca (código ou nome) · responsável (DP/Contábil) · regime · status na carteira · departamento contratado · semáforo. Inativas ocultas por padrão (checkbox "mostrar inativas").
- **Tabela:** código · empresa · regime · responsáveis · nº empregados ativos · semáforo · chips com os motivos (máx. 3 visíveis + "+N"). Clique na linha abre a ficha.
- Carregamento único ao abrir + botão "Atualizar".

### 2.2 Ficha da Empresa (`index.html?empresa=<codigo_empresa>`)

- **Cabeçalho fixo:** nome, código, CNPJ, regime, semáforo, responsáveis, atalhos (Diário, Licenças, Certificado, Controle de Frequência, Fechamento). Atalho abre a ferramenta com `?empresa=<codigo>`; ferramentas que ainda não leem o parâmetro simplesmente abrem normalmente.
- **Abas** — os dados da carteira já ficam em memória após o painel; só buscam sob demanda: contagem de jornada/escala (DP), anotações e CRM:
  1. **Resumo** — um cartão com o número-chave de cada bloco + lista única de alertas ordenada por gravidade.
  2. **Cadastro** — "Dados do Domínio" (somente leitura) + "Dados Scont" (editável) + contatos.
  3. **Vencimentos** — certificados, licenças e alvarás, com dias restantes.
  4. **DP** — empregados ativos, sócios e alertas QSA, último ciclo de fechamento, formulários em aberto, jornada/escala configuradas.
  5. **Contábil** — possui contábil, grupo contábil, onboarding (% concluído), status do Diário nas últimas 6 competências, pendências do Mapeamento, nível de atenção.
  6. **Anotações** — timeline com autor/data, fixar no topo, filtro por categoria.
  7. **CRM** — últimas 10 conversas vinculadas, com aviso "vínculo por nome (aproximado)".
- `?empresa=` inexistente → mensagem + botão "Voltar ao painel".

## 3. Dados

### 3.1 Tabelas novas (`_sql/schema_ficha360.sql`)

**`ficha360_empresa`** — uma linha por empresa (opcional; ausência = cadastro Scont incompleto)

| Coluna | Tipo | Nota |
|---|---|---|
| `codigo_empresa` | TEXT PK, FK `rh_empresas(codigo_empresa)` | |
| `status_carteira` | TEXT NOT NULL DEFAULT `'ativo'` CHECK in (`ativo`,`em_implantacao`,`em_saida`,`inativo`) | distinto de `rh_empresas.status_situacao` (Domínio) |
| `data_inicio_cliente` | DATE | |
| `data_saida_cliente` | DATE | |
| `atende_fiscal` | BOOLEAN NOT NULL DEFAULT false | |
| `atende_societario` | BOOLEAN NOT NULL DEFAULT false | |
| `atende_bpo` | BOOLEAN NOT NULL DEFAULT false | |
| `porte` | TEXT | |
| `atividade_principal` | TEXT | |
| `observacao_geral` | TEXT | |
| `atualizado_por` | TEXT | nome do usuário |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | trigger `set_updated_at` |

DP e Contábil contratados **não** são duplicados: vêm de `fechamento_empresas_config.possui_folha` e `contabil_empresas_config.possui_contabil` (somente leitura na ficha).

**`ficha360_contatos`**

`id UUID PK · codigo_empresa TEXT NOT NULL FK · nome TEXT NOT NULL · funcao TEXT · area TEXT NOT NULL DEFAULT 'geral' CHECK in (geral, dp, contabil, fiscal, financeiro) · telefone TEXT · email TEXT · whatsapp TEXT · principal BOOLEAN NOT NULL DEFAULT false · created_at TIMESTAMPTZ DEFAULT now()`
Índice em `codigo_empresa`. O contato do Mapeamento Contábil permanece lá (RLS `contabil_pode_ver_contato`) e **não é exibido na Ficha 360 na V1** — continua acessível só pela Central Contábil.

**`ficha360_anotacoes`**

`id UUID PK · codigo_empresa TEXT NOT NULL FK · texto TEXT NOT NULL · categoria TEXT NOT NULL DEFAULT 'geral' CHECK in (geral, dp, contabil, financeiro, combinado) · fixada BOOLEAN NOT NULL DEFAULT false · autor_id UUID NOT NULL DEFAULT auth.uid() · autor_nome TEXT · created_at TIMESTAMPTZ DEFAULT now() · editado_em TIMESTAMPTZ`
Índice em `(codigo_empresa, created_at desc)`.

### 3.2 Fontes existentes (chave `codigo_empresa`, salvo indicado)

| Bloco | Fonte | Uso |
|---|---|---|
| Cadastro Domínio | `rh_empresas` | `id, codigo_empresa, nome_empresa, cnpj, regime_enquadramento, inscricao_estadual, inscricao_municipal, endereco, cidade, municipio, uf, cep, status_situacao, email` |
| Grupo | `rh_grupos_empresas_itens` → `rh_grupos_empresas` | nome do grupo |
| Responsáveis DP | `fechamento_empresas_responsaveis` → `usuarios` | nomes |
| Responsáveis Contábil | `contabil_empresas_responsaveis` + RPC `contabil_listar_usuarios_aprovados()` | nomes (usuário vem de `solicitacoes_acesso`; a RPC já existe e é `SECURITY DEFINER`) |
| Depto contratado | `fechamento_empresas_config.possui_folha`, `contabil_empresas_config.possui_contabil` | |
| Certificados | `certificados` (ativos) | vínculo: `cpf_cnpj` só dígitos = `rh_empresas.cnpj` só dígitos (14 díg.); e-CPF: `cpf_cnpj` (11 díg.) ∈ CPFs de `rh_socios` da empresa. Situação via mesma regra `situacaoEfetiva` + `data_vencimento` |
| Licenças/Alvarás | `licencas`, `alvaras` | `empresa_id = rh_empresas.id`, `ativo = true`, `deletado_em is null`, `data_validade` |
| Empregados | `rh_empregados` | contagem `situacao` contendo "ativ" e não "inativ" (mesma regra de `Projeto RH/admin.js`) |
| Sócios / QSA | `rh_socios` + `Projeto RH/qsa-analise.js` | reuso da função de análise (importar o arquivo, não copiar) |
| Folha | `fechamento_ciclo` + `fechamento_ciclo_fase` | última competência (`MM/AAAA`), fases com `status <> 'concluida'` |
| Jornada/Escala | `rh_jornada_trabalho`, `rh_escala_trabalho` | existe registro sim/não |
| Formulários | `formularios`, `empregados` por `rh_empresa_id` | em aberto = status not in (`validado`, `excluido`, `rejeitado`); idade = `created_at` |
| Onboarding | `contabil_onboardings` + `contabil_onboarding_itens` | status, `data_inicio`, % itens `aprovado`/`nao_aplicavel` |
| Mapeamento | `contabil_mapeamento` + `contabil_mapeamento_pendencias` | `periodicidade`, `ultimo_mes_fechado`, `nivel_atencao`, pendências `status='aberta'` e `prazo` |
| Diário | `contabil_diario_status_mensal`, `contabil_diario_fechamentos` | último `tipo_evento` por competência |
| CRM | `contatos_empresas` → `contatos` → `conversas` | `normalizarNome(empresa) = normalizarNome(nome_empresa)`; últimas 10 conversas |

**Verificação obrigatória antes de implementar:** o CLI/REST não teve acesso ao schema de produção nesta sessão. O primeiro passo do plano é o usuário rodar no SQL Editor uma consulta a `information_schema.columns` das tabelas acima; colunas divergentes ajustam `fontes.js` antes de qualquer tela.

## 4. Semáforo e alertas

Cada regra retorna `{ modulo, gravidade: 'critico'|'atencao'|'info', mensagem, link? }`. Semáforo da empresa = pior gravidade (`critico` > `atencao` > `info`/nenhum = verde). `status_carteira = 'inativo'` → sem alertas, cor cinza.

Limites em constantes no topo de `js/regras.js`.

| Módulo | 🔴 Crítico | 🟡 Atenção | ⚪ Info |
|---|---|---|---|
| Certificado | vencido ou ≤ 7 dias | 8–30 dias | nenhum certificado vinculado |
| Licença/Alvará | vencido ou ≤ 15 dias | 16–60 dias | — |
| Folha (se `possui_folha`) | ciclo da competência anterior (mês passado) não concluído — ou inexistente — após o dia 10 do mês corrente | ciclo da competência anterior ainda não concluído até o dia 10 | sem responsável DP |
| QSA | sócio com participação ativa também empregado ativo | sobreposição já encerrada | — |
| Formulários | em aberto há > 15 dias | em aberto há ≤ 15 dias | — |
| Diário (se `possui_contabil`) | último evento da competência = `rejeitado` | competência esperada (pela `periodicidade`) sem evento `enviado`/`aprovado` | sem responsável Contábil |
| Mapeamento | `nivel_atencao = 'critico'` | `nivel_atencao = 'alto'` ou pendência aberta com `prazo` vencido | pendências abertas |
| Onboarding | — | `em_andamento` há > 60 dias | — |
| Cadastro Scont | — | — | sem linha em `ficha360_empresa` ou sem contato `principal` |

- CRM não gera alerta.
- Módulo com erro ou sem permissão não gera alerta; o painel mostra aviso de alertas incompletos.
- "Competência esperada" do Diário reutiliza a lógica de periodicidade já existente em `Projeto Onboarding Contabil` (importar, não reescrever); se não for isolável, extrair para função pura compartilhada.

## 5. Permissões

- **Acesso à ferramenta:** registro em `ferramentas` + `usuario_ferramentas` (padrão do portal).
- **Prestador de Serviço:** bloqueado no front ao carregar (`empresa` do usuário = `'prestador de serviço'`, mesma verificação de `Projeto Onboarding Contabil/configuracoes.js`), exceto admin.
- **Blocos existentes:** consultas sob o RLS de cada módulo. Retorno vazio por permissão ou erro 401/403 → bloco mostra "🔒 sem permissão".
- **RLS das tabelas novas:**
  - `ficha360_empresa`, `ficha360_contatos`: SELECT/INSERT/UPDATE/DELETE para `authenticated`.
  - `ficha360_anotacoes`: SELECT/INSERT para `authenticated`; UPDATE/DELETE quando `autor_id = auth.uid() OR public.is_admin()`.

## 6. Estrutura do código

```
Projeto Ficha 360/
  index.html          painel + ficha (alterna por ?empresa=)
  css/ficha360.css
  js/
    app.js            namespace F360, helpers (esc, datas), bootstrap, roteamento
    carteira.js       função pura montarCarteira(dados, hoje) → itens com alertas/semáforo
    fontes.js         uma função por módulo → { ok:true, dados } | { ok:false, motivo:'sem_permissao'|'erro'|'tabela_ausente' }
    vinculos.js       normalizarCnpj, normalizarNome, indexarPorCodigo
    regras.js         funções puras: alertas<Modulo>(dados, hoje) → [alerta]; semaforo(alertas)
    painel.js         tela 1
    ficha.js          tela 2 (cabeçalho, abas, lazy load)
    cadastro.js       edição ficha360_empresa + contatos
    anotacoes.js      timeline
  tests/
    regras.test.js
    vinculos.test.js
_sql/schema_ficha360.sql
```

`regras.js` e `vinculos.js` não dependem de Supabase nem de DOM (testáveis em Node, no padrão de `Projeto RH/test-qsa-analise.js`).

## 7. Desempenho e erros

- Painel: ~12 consultas em paralelo com `Promise.allSettled`, colunas explícitas (nunca `select('*')` no painel).
- Tabelas grandes (`rh_empregados`, `conversas`, `contabil_diario_*`): paginação em blocos de 1000 via `.range()`; Diário limitado às últimas 6 competências.
- Falha de uma fonte: painel carrega, faixa "⚠️ <Módulo> indisponível — alertas incompletos".
- Tabela `ficha360_*` ausente (erro `42P01` / PGRST205): Cadastro Scont e Anotações exibem "Configuração pendente — SQL não executado"; restante funciona.
- Código de empresa inexistente: tela de erro com voltar.

## 8. Testes

**Automáticos (Node):**
- `regras.test.js`: bordas 7/8 e 30/31 (certificado), 15/16 e 60/61 (licença), dia 10/11 (folha), 15/16 (formulários), 60/61 (onboarding); inativo sem alertas; pior gravidade vence; módulo `ok:false` não gera alerta; Diário respeitando periodicidade mensal/trimestral/anual.
- `vinculos.test.js`: CNPJ com/sem máscara; CPF vs CNPJ; nomes com acento, "LTDA", "ME", "EIRELI", pontuação e espaços duplos.

**Manuais (produção):**
- 3 empresas reais: sem alertas, certificado vencendo, Diário rejeitado.
- Usuário sem permissão de contato do Mapeamento.
- Usuário Prestador de Serviço (deve ser bloqueado).
- Antes de rodar o SQL (degradação) e depois.

## 9. Fora da V1

- Honorários/financeiro do cliente.
- Procurações eletrônicas.
- Alterações contratuais (ferramenta ainda não persiste no banco).
- Ajustar ferramentas existentes para aceitar `?empresa=`.
- Envio de alertas por e-mail a partir da ficha (Central de Alertas segue como canal).
- Versão para o cliente.
- Vínculo forte CRM ↔ `rh_empresas` (hoje por nome).
