# Montador de Escala 5x2 (SCONT)

Ferramenta web para clientes da SCONT planejarem escalas conforme a EC 141/2026 (fim da 6x1).
Vite + React + TypeScript + Tailwind + Zustand + Vitest. Sem backend nesta fase (localStorage).

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest (motor de conformidade, gerador, impacto)
npm run lint
npm run build      # tsc + vite build -> ./app (estático, versionado)
```

## Estrutura

| Caminho | Função |
|---|---|
| `src/config/regras.ts` | **Única** fonte das regras legais (versão, datas, limites, modo de transição, aviso legal) |
| `src/config/feriados.ts` | Feriados nacionais 2026–2027 (editáveis na interface) |
| `src/config/tema.ts` | Cores (trocar pelas oficiais da SCONT) |
| `src/engine/conformidade.ts` | Motor puro de validação (semáforo + correções) |
| `src/engine/gerador.ts` | Gera 3 propostas (fixo, rodízio de domingos, folga móvel) |
| `src/engine/impacto.ts` | Calculadora de impacto (ESTIMATIVA) |
| `src/services/storage.ts` | Persistência isolada (trocar por Supabase) |
| `src/services/enviarAoDP.ts` | Envio ao DP (JSON + mailto/WhatsApp; trocar por Edge Function) |
| `src/services/exportar.ts` | PDF (jsPDF) e Excel (SheetJS) |

## Atualizar as regras (decreto, regulamentação, decisão do STF)

1. Edite **apenas** `src/config/regras.ts`: datas (`etapa1.inicio`, `etapa2.inicio`), limites, `modoTransicao`
   (`'padrao'` ou `'flexivel_stf'`), e atualize `versao` e `atualizadoEm`.
2. Toda mensagem de alerta cita o id do parâmetro (ex.: `etapa1.jornadaSemanalMax`), então a interface acompanha.
3. Rode `npm test`. Os testes de mudança de etapa usam as datas do arquivo; ajuste-os se as datas mudarem.
4. `npm run build` e republique.

## Publicar

`npm run build` gera HTML/JS/CSS estáticos em `../montador-escala` (`base: './'`, funciona em qualquer subpasta).
URL: `Projeto Montador Escala 5x2/app/index.html`.

## Trocar localStorage / envio por Supabase

- `storage.ts`: reimplemente `carregar/salvar/limpar`.
- `enviarAoDP.ts`: reimplemente `enviarAoDP` com `supabase.functions.invoke(...)` mantendo `EnviarAoDP`.
- Contatos do DP em `CONTATO_DP` são **placeholders** (TODO).

## Premissas legais a validar pelo DP

Veja a lista no resumo da entrega e os comentários no topo de `conformidade.ts` e `regras.ts`.
