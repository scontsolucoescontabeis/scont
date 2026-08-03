# Design: Conversor de Folha de Ponto — suporte ao formato "SmartPonto"

**Data:** 2026-08-03
**Ferramenta destino:** Conversor de Folha de Ponto (`Projeto RH/conversor.html`)
**Arquivos novos:** `Projeto RH/folha-ponto-smartponto-parser.js`, `Projeto RH/test-folha-ponto-smartponto-parser.js`
**Contexto:** O conversor hoje só reconhece o PDF exportado pelo Sólides (spec de 2026-07-19). Chegou um novo formato de PDF, de outra plataforma de origem (rodapé "SMART PONTO", título "CARTÃO DE PONTO"), que precisa ser aceito também, gerando o mesmo Excel de sempre.

---

## Problema

Um segundo cliente/plataforma envia a folha de ponto em um PDF de layout diferente do Sólides: uma página por colaborador, mas com uma tabela bem mais densa (Jornadas Realizadas, Normal, Extra, Limite 1/2/3, Banco de Horas, Horários Previstos), todas com valores em formato `HH:MM`, dificultando distinguir horário trabalhado de total calculado por simples contagem de texto.

---

## Escopo

- Mesma dropzone única do Step 1 do wizard — **auto-detecção** decide qual parser usar (Sólides ou SmartPonto), sem o operador escolher.
- Extrai apenas as batidas reais (zona "Jornadas Realizadas") + o status do dia (Falta/Folga/outro). Normal, Extra, Limite 1/2/3, Banco de Horas e Horários Previstos são **descartados** — não vão para o Excel.
- Saída: mesmo `.xlsx` de hoje (aba por colaborador + aba "Ocorrências" informativa), sem mudança de formato do arquivo gerado.
- Número de pares Entrada/Saída no Excel passa a ser **dinâmico** (calculado a partir do maior nº de períodos reais encontrado no arquivo, 2 a 4), em vez de fixo em "2 ou 3" — cobre os dois formatos com a mesma lógica.

---

## Arquitetura

| Arquivo | Papel |
|---|---|
| `folha-ponto-smartponto-parser.js` (novo) | Parser dedicado ao layout SmartPonto. Mesma "forma invariante" de saída do parser do Sólides: `{ nome, cpf, admissao, funcao, codigo, competencia, dias: [...] }` |
| `test-folha-ponto-smartponto-parser.js` (novo) | Testes unitários, mesmo padrão do teste do Sólides |
| `conversor.js` | Step 1 tenta detectar Sólides primeiro; se não bater, tenta SmartPonto. Geração do Excel generalizada para N períodos |
| `conversor.html` | Título/subtítulo e mensagens de erro do Step 1 passam a citar os dois formatos aceitos; inclui o novo script do parser |

### Detecção de formato

Texto concatenado de todas as páginas contém `CARTÃO DE PONTO` + `JORNADAS REALIZADAS` + `HORÁRIOS PREVISTOS` → reconhecido como SmartPonto. Testado **depois** do teste do Sólides (evita qualquer falso positivo por colisão de marcador).

---

## Lógica de Extração

### Cabeçalho do colaborador (por página)

Regex sobre o texto da página:
- **Nome**: `Funcionário:\s*([^\n]*?)\s*Admissão:`
- **Admissão**: `Admiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})`
- **CPF**: `CPF:\s*([\d.\-]{11,14})`
- **Função**: `Cargo:\s*([^\n]*?)\s*(?:Setor:|Depart\.?:|$)`
- **Competência**: `PER[ÍI]ODO:\s*\d{2}\/\d{2}\/\d{4}\s*A\s*(\d{2})\/(\d{2})\/(\d{4})` (tolerante a zero espaços antes do "A", como aparece no PDF de origem) → competência = mês/ano final.

### Calibração de coluna (uma vez por PDF)

1. Localizar, entre os itens de texto de qualquer página, aquele cujo conteúdo é exatamente `NORMAL` (cabeçalho de grupo de colunas) e guardar seu X (`transform[4]`).
2. Esse X é o limite direito da zona "Jornadas Realizadas" — todo token à esquerda dele, numa linha de dia, pertence a essa zona; o resto (Normal/Extra/Limites/Banco/Previstos) fica à direita e é ignorado.
3. Se o marcador `NORMAL` não for encontrado em nenhuma página → aborta com erro ("Não foi possível reconhecer o layout de colunas deste PDF SmartPonto."), mesmo padrão de falha do Sólides.

### Linha de dia

Âncora: início de linha com `DD/MM/AAAA` seguido de uma abreviação de dia da semana (`Seg|Ter|Qua|Qui|Sex|Sáb|Dom`, com ou sem acento).

Tokens da mesma linha, à direita da âncora e com `x < corteX` (zona "Jornadas Realizadas"):
- **Todos os tokens em formato `HH:MM`** → pareados em ordem: Entrada 1/Saída 1, Entrada 2/Saída 2, Entrada 3/Saída 3, Entrada 4/Saída 4 (tantos pares quanto existirem na zona — sem limite fixo de 3 como no Sólides).
- **Algum token não é `HH:MM`** (ex. `FALTA`) → esses tokens formam a **Ocorrência**; não geram Entrada/Saída.
- **Token é exatamente `FOLGA`** → reconhecido, mas **não vira Ocorrência** (fica em branco). Decisão: FOLGA é descanso normal, não um flag a marcar manualmente no Controle de Frequência — não deve poluir a aba "Ocorrências".
- Reconhecimento de status é **genérico** (qualquer token não-`HH:MM` na zona, não uma lista fechada) — casos não previstos ficam revisáveis manualmente na Etapa 4 do wizard, igual já acontece com o Sólides hoje.

Dia da semana final do registro é **recalculado a partir da data** (mesma `_gerarDiasDoMes` já usada), não confia no texto abreviado do PDF.

### Saída invariante do parser (por colaborador)

Idêntica ao Sólides:

```js
{
  nome: 'ALINE GOMES DE LIMA',
  cpf: '06752354138',
  admissao: '10/11/2025',
  funcao: 'AUXILIAR DE SERVIÇOS GERAIS',
  codigo: '',
  competencia: '07/2026',
  dias: [
    { data: '01/07/2026', diaSemana: 'Qua', entrada1: '13:17', saida1: '17:54', entrada2: '', saida2: '', entrada3: '', saida3: '', entrada4: '', saida4: '', ocorrencia: '' },
    { data: '04/07/2026', diaSemana: 'Sáb', entrada1: '', saida1: '', ..., ocorrencia: '' },  // FOLGA: em branco
    { data: '13/07/2026', diaSemana: 'Seg', entrada1: '', saida1: '', ..., ocorrencia: 'FALTA' },
    ...
  ]
}
```

---

## Mudança em `conversor.js` (Step 1 e geração do Excel)

- **Step 1**: após ler o texto de todas as páginas, tenta `_pareceSolides` primeiro; se falso, tenta `_pareceSmartPonto`; se nenhum bater, erro único mencionando os dois formatos aceitos.
- **Geração do Excel**: em vez do toggle fixo `terceiroTurno` (2 ou 3 pares), calcula `maxPeriodos` = maior número de pares Entrada/Saída não vazios em qualquer dia de qualquer colaborador do arquivo (mínimo 2). Colunas do Excel e da tabela de revisão (Etapa 4) são geradas dinamicamente a partir desse número.

---

## O que está fora do escopo

- Normal, Extra, Limite 1/2/3, Banco de Horas, Horários Previstos — descartados, não aparecem no Excel gerado.
- Suporte a mais de 4 pares de Entrada/Saída (não há coluna pra isso no layout SmartPonto).
- Outros formatos de PDF além de Sólides e SmartPonto.
- Persistência dos dados extraídos no Supabase — ferramenta continua client-side.
