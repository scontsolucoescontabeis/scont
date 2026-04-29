# Contexto de Sessão — Portal Scont
> Gerado em 28/04/2026 para continuação em sessões futuras.

---

## 1. Arquitetura Geral

**Raiz do projeto:** `c:\Users\Herbert G L J\Desktop\Projetos HTML\Projeto Portal Scont\`

O portal é composto por pastas independentes, cada uma sendo uma ferramenta:

```
Projeto Portal Scont/
├── portal.html                  ← Hub central
├── portal-auth-guard.js         ← Guard de autenticação (Supabase portal)
├── supabase-config.js           ← Credenciais do Supabase do portal
├── licencas-config.js           ← Credenciais dos Supabase de licenças (CRIADO)
├── Projeto Boas Vindas/         ← Apresentação de dados do cliente
├── Projeto Central Alertas/     ← Central de alertas unificada
├── Projeto Gerenciador Formularios/ ← Formulários de registro/alteração/empregado
├── Projeto Licenças/            ← Controle de licenças e alvarás (INTEGRADO)
└── ...outras ferramentas
```

---

## 2. Supabase — Multi-projeto

| Projeto       | Variável URL      | Variável KEY      | Tabelas principais                      |
|---------------|-------------------|-------------------|-----------------------------------------|
| Portal        | `SUPABASE_URL`    | `SUPABASE_KEY`    | perfis, formularios, socios, empregados |
| Licenças A    | `LIC_URL_A`       | `LIC_KEY_A`       | licencas, alvaras, processos            |
| Licenças B    | `LIC_URL_B`       | `LIC_KEY_B`       | empresas (clientes)                     |

- `supabase-config.js` define `SUPABASE_URL` e `SUPABASE_KEY` (portal).
- `licencas-config.js` define `LIC_URL_A/B` e `LIC_KEY_A/B` (licenças).
- **Nunca reutilizar** `SUPABASE_URL`/`SUPABASE_KEY` nos projetos de licenças — conflito de variável global.

---

## 3. Auth Guard

```javascript
// Em qualquer página protegida:
const auth = await window.PortalAuthGuard.init(depth);
// depth = número de níveis abaixo da raiz
// Ex: Projeto Licenças/index.html → depth = 1
//     Projeto Gerenciador Formularios/formulario_registro.HTML → depth = 1
```

Fluxo DOMContentLoaded padrão:
```html
<script src="../supabase-config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../portal-auth-guard.js"></script>
<script src="../licencas-config.js"></script>  <!-- apenas se usar licenças -->
<script>
document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;
    document.getElementById('authOverlay')?.remove();
    // ... inicializar app
});
</script>
```

---

## 4. Paleta do Portal

```css
--primary: #8B3A3A;
--primary-dark: #6B2A2A;
--primary-light: #A85252;
--secondary: #2C3E50;
--bg: #F0F2F5;
--border: #E0E6ED;
--success: #27AE60;
--danger: #E74C3C;
```

Gradiente sidebar: `linear-gradient(135deg, #8B3A3A 0%, #2C3E50 100%)` (vinho → azul escuro)

---

## 5. Projeto Licenças (`Projeto Licenças/index.html`)

**Origem:** `control_NOVO.html` migrado para `index.html` com integração ao portal.

**O que foi feito:**
- Auth guard adicionado (depth=1)
- CSS alinhado à paleta do portal (`--brand:#8B3A3A`, etc.)
- Botão "Voltar ao Portal" na sidebar
- Credenciais extraídas para `licencas-config.js` (variáveis `LIC_URL_A/B`, `LIC_KEY_A/B`)
- Bug do `tipo_documento` duplicado em processos corrigido
- Header da tabela de clientes corrigido
- Validação de data (validade não pode ser anterior à emissão)
- `.filter(d => d.data_validade)` em todos os cálculos do dashboard

**Schema SQL:** `Projeto Licenças/schema_licencas.sql` — criado com LGPD completa:
- Tabelas: `empresas`, `licencas`, `alvaras`, `processos`, `andamento_processos`
- Soft delete em todas as tabelas (`ativo`, `deletado_em`, `deletado_por`)
- Auditoria completa (`criado_em/por`, `atualizado_em/por`)
- Funções: `fn_soft_delete()`, `fn_exportar_dados_cliente()`
- Log imutável em `andamento_processos`

---

## 6. Central de Alertas (`Projeto Central Alertas/`)

**Arquivo:** `app.js` + `index.html`

**O que foi feito:**
- Aba "Licenças" adicionada ao filtro
- `loadAlerts()` refatorado com `Promise.allSettled` para combinar alertas do portal (via RPC `fn_alertas_sistema`) + alertas de licenças (via client separado)
- Função `loadLicencasAlerts()` criada: busca `licencas` e `alvaras` que vencem em 30 dias, mapeia para o formato de alerta com severidade baseada em dias restantes

Severidade das licenças:
- `critico`: vencido ou ≤ 7 dias
- `urgente`: ≤ 14 dias
- `atencao`: ≤ 30 dias

Link dos alertas de licenças: `../Projeto Licenças/index.html`

`index.html` recebe `<script src="../licencas-config.js"></script>` antes de `app.js`.

---

## 7. Formulários (`Projeto Gerenciador Formularios/`)

### 7.1 formulario_registro.HTML
**Bugs corrigidos:**
- `atividade_principal` → `cnae_principal` no INSERT
- CPF dos sócios adicionado ao `sociosData.push()`
- RG e CNH removidos dos cards de sócio

### 7.2 formulario_alteracao.html
**Mudanças implementadas:**
- Toggle "Haverá alteração no quadro societário?" (Sim/Não) antes dos cards de sócio
  - HTML: `<div id="quadroSocietarioSection" style="display:none;">`
  - JS: `function toggleQuadroSocietario()` — mostra/oculta a seção; cria 1º card se Sim
- `addInitialSocio()` esvaziada — a seção começa oculta
- Campo CPF adicionado ao card de sócio (form-row com Nome)
- Select de ação (`Inclusão/Edição/Exclusão`) ao lado do título "SÓCIO #N"
- RG e CNH removidos dos cards de sócio
- `validateForm()` e `validateSocios()` condicionados ao toggle (não validam sócios se "Não")
- INSERT `formularios`: campo `alterar_quadro_societario` adicionado
- INSERT `socios`: `acao_socio` adicionado; `rg` e `cnh` removidos

### 7.3 formulario_empregado.html
**Mudanças implementadas:**
- `<input type="checkbox">` removido de dentro das labels de cada document-item
- CSS morto `.document-item input[type="checkbox"]` removido
- Labels afetadas: Carteira de Trabalho, Identidade/CPF/Título, Cartão PIS, Reservista, Certidão Filhos, Comprovante Residência, Exame Médico

### 7.4 schema_formularios.sql — versão 2.0
Reescrito com:
- `formularios`: removidas colunas antigas não usadas (cnpj, inscricao_estadual/municipal, regime_tributario, simples_nacional, mei, imune_isento, tipo_alteracao, descricao/motivo_alteracao, colunas de endereço separadas); adicionadas todas as colunas que os formulários realmente inserem
- `socios`: removidas `rg` e `cnh`; adicionadas `acao_socio TEXT`, `documento_url TEXT`, `documento_nome TEXT`; `participacao` como `NUMERIC(5,2)`
- Seção 7 com bloco `DO $$` de migrações para tabelas já existentes (ADD/DROP COLUMN idempotentes)
- RLS e storage mantidos

---

## 8. Projeto Boas Vindas

**CNAEs secundários:**
- Armazenados como string separada por `\n`, formato `XXXX-X/XX — Descrição`
- Exibidos no `index.html` com `innerHTML` quebrando por `\n` e envolvendo em `<span style="display:block">`
- O admin salva assim: `cnaes.map(c => \`${c.codigo} — ${c.atividade}\`).join('\n')`

---

## 9. Pendências conhecidas

- **Controle de Licenças:** Testar fluxo completo após criação das tabelas no Supabase (schema ainda não executado — banco vazio)
- **formulario_alteracao.html:** Verificar se a validação da soma de participações (100%) deve ou não se aplicar quando `acao_socio = 'exclusao'`
- **PDF do formulário de alteração:** A seção de sócios no PDF usa `for (let i = 1; i <= sociosCount; i++)` — quando quadro societário é "Não", `sociosCount = 0`, logo nenhum sócio é listado (comportamento correto)

---

## 10. Convenções do projeto

- Formulários usam chave **anon** do Supabase (sem login do usuário no formulário)
- Autenticação é exclusiva do portal (`portal-auth-guard.js`)
- Nomes de arquivo gerados: sanitizados (sem acento, sem espaço), com timestamp
- Bucket Storage: `documentos` (privado, 50 MB máx)
- Comentários no código: mínimos, apenas quando o porquê não é óbvio
