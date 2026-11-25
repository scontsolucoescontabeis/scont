# Montador — regras por pessoa: mulheres, estagiários e menores

Data: 2026-11-25 · Decisões do responsável: aplicar as sugestões abaixo.

## Origem
Auditoria da escala gerada (2026-11-25): para empregados adultos a escala cumpre as regras que o motor
conhece (5x2, 42/40 h, 2 repousos, máx. 6 dias seguidos, interjornada 11 h, repouso 35 h, intrajornada,
domingo 1 vez a cada 3 semanas no comércio — maior sequência de domingos trabalhados medida: 2). Faltam
regras que dependem de sexo, idade e tipo de vínculo. Dados reais (780 ativos Empregado/Estágiario):
434 mulheres (56%), 54 estagiários, 8 menores de 18 (todos estagiários).

## Regras novas (parametrizadas em `src/config/regras.ts`)
1. **Mulheres — domingo quinzenal (CLT art. 386):** com trabalho aos domingos, escala de revezamento
   quinzenal que favoreça o repouso dominical ⇒ a mulher folga o domingo ao menos 1 vez a cada **2** semanas
   (no máximo 1 domingo trabalhado em seguida). **Interruptor** "Aplicar CLT art. 386 às mulheres",
   **ligado por padrão** (a aplicação do art. 386 e convenções coletivas devem ser validadas pelo DP).
2. **Estagiários (Lei 11.788/2008, art. 10):** padrão **6 h/dia e 30 h/semana**; configurável 4 h/20 h
   (ensino fundamental/educação especial) ou 40 h (cursos que alternam teoria e prática). A escala nunca
   passa do limite; sem jornada cadastrada, o estagiário entra com o limite, não com 44 h.
3. **Menores de 18 anos (CLT arts. 404, 411 e 413):** no máximo 8 h/dia, **sem trabalho noturno (22h–5h)** e
   sem horas extras.

## Dados
- `montador_dados_empresa` passa a devolver por empregado também `sexo` (`'F'`, `'M'` ou `null`, derivado de
  `rh_empregados.sexo` = Feminino/Masculino) e `menor_de_idade` (boolean calculado no banco com
  `data_nascimento`; **a data de nascimento nunca sai do banco**). Chaves dos empregados passam a ser:
  `codigo_empregado, nome_empregado, cargo, tipo_empregado, sexo, menor_de_idade`.
- `PessoaEscala` ganha `sexo?: 'F' | 'M'`, `menor: boolean`, `estagiario: boolean`.
- Configuração (persistida, não pessoal): `regrasPessoais: { mulheresDomingoQuinzenal: boolean (true);
  estagioHorasSemanais: 20 | 30 | 40 (30) }`, editável no Passo 2 do modo portal.

## Motor e conformidade
- Rodízio de domingos: ciclo por pessoa (mulher com a regra ligada → 2; demais → ciclo do setor).
- Jornada por pessoa: estagiário limitado a `estagioHorasSemanais` (diária = semanal ÷ 5, teto 6 h; 8 h se 40 h);
  menor limitado a 8 h/dia e com entrada/saída fora de 22h–5h.
- Novos alertas (vermelho; `regraId`): `domingoMulher`, `estagioJornada`, `menorJornada`, `menorNoturno`,
  citando a base legal.
- Modo avulso (sem `pessoas`) e escalas sem mulheres/estagiários/menores: resultado idêntico ao atual.

## Não objetivos
Aprendiz, gestantes/lactantes, PcD, convenções coletivas, e o quadro de contratações não reflete a regra
quinzenal (limitação documentada). Os parâmetros da EC 141/2026 continuam a validar pelo DP.
