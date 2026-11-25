import { REGRAS } from '../config/regras'

const fmt = (iso: string) => iso.split('-').reverse().join('/')

interface Item {
  p: string
  r: string[]
}

interface Grupo {
  titulo: string
  itens: Item[]
}

function montarGrupos(): Grupo[] {
  const e1 = REGRAS.etapa1
  const e2 = REGRAS.etapa2
  return [
    {
      titulo: 'O que muda',
      itens: [
        {
          p: 'O que é o fim da escala 6x1?',
          r: [
            `A EC 141/2026 reduz a jornada semanal máxima e passa a exigir ${e1.repousosSemanais} repousos semanais remunerados, no lugar de 1. Na prática, a escala de 6 dias de trabalho para 1 de folga deixa de ser possível e a referência passa a ser a 5x2.`,
          ],
        },
        {
          p: 'Quais são as etapas e os prazos?',
          r: [
            `Regra atual: ${REGRAS.legado.jornadaSemanalMax}h semanais e ${REGRAS.legado.repousosSemanais} repouso semanal.`,
            `1ª etapa (a partir de ${fmt(e1.inicio)}): ${e1.jornadaSemanalMax}h semanais e ${e1.repousosSemanais} repousos.`,
            `2ª etapa (a partir de ${fmt(e2.inicio)}): ${e2.jornadaSemanalMax}h semanais e ${e2.repousosSemanais} repousos.`,
            'A data de início da 1ª etapa (15 ou 16/12/2026) ainda precisa ser confirmada no texto oficial. Por segurança, trate 15/12 como prazo interno.',
          ],
        },
        {
          p: 'Preciso reduzir o salário dos empregados?',
          r: [
            'Esta ferramenta não trata de salário. A redução de jornada não deve vir acompanhada de redução salarial, mas confirme esse ponto com o Departamento Pessoal ou com a assessoria jurídica antes de qualquer alteração em folha.',
          ],
        },
      ],
    },
    {
      titulo: 'Como montar a escala',
      itens: [
        {
          p: 'Quantas horas posso colocar por dia na 1ª etapa?',
          r: [
            `Distribuindo as ${e1.jornadaSemanalMax}h em 5 dias, a jornada fica em até 8h24 líquidas por dia (${e1.jornadaSemanalMax}h ÷ 5), sem horas extras. É o limite que o Montador usa.`,
            'Líquidas quer dizer sem contar o intervalo de refeição. Um turno das 08:00 às 17:24 com 1h de intervalo fecha exatamente 8h24.',
          ],
        },
        {
          p: 'O domingo precisa ser folga?',
          r: [
            'A regra pede que um dos repousos seja, preferencialmente, no domingo. Quando a empresa funciona aos domingos, o Montador faz rodízio para que todos os empregados tenham domingos de folga ao longo das semanas.',
            'A semana da escala começa no domingo e termina no sábado.',
          ],
        },
        {
          p: 'Meu comércio abre 7 dias por semana. Dá para cumprir a 5x2?',
          r: [
            'Dá, mas costuma exigir mais gente. Cada empregado trabalha 5 dos 7 dias, então a cobertura dos demais dias precisa ser feita por outros. O passo 3 (Cobertura) mostra quantas pessoas cada período precisa, e a tela de contratações estima o quadro necessário.',
          ],
        },
        {
          p: 'Posso compensar horas em um dia e folgar em outro?',
          r: [
            'Só se houver amparo em acordo, convenção coletiva ou banco de horas válido. O Montador não considera compensação: ele trabalha com o limite de 8h24 líquidas por dia, e qualquer compensação deve ser validada pelo DP.',
          ],
        },
      ],
    },
    {
      titulo: 'Acordo coletivo e decisão do STF',
      itens: [
        {
          p: 'O que é a liminar do STF e como ela afeta minha empresa?',
          r: [
            'Segundo a base legal cadastrada, em 12/11/2026 o STF (ADIs 8.041 e 8.042) permitiu que empresas sem convenção ou acordo coletivo distribuam as 42h em cinco jornadas de até 8h24, sem horas extras, até 15/12/2027.',
            'A decisão ainda depende de referendo do Plenário. O rito foi convertido em julgamento de mérito em 17/11/2026, então ela pode mudar.',
          ],
        },
        {
          p: 'Minha empresa tem convenção coletiva. O que vale?',
          r: [
            'Confira o que a convenção ou o acordo da categoria prevê, porque pode haver regra própria de jornada e compensação. O Montador não considera convenção ou acordo coletivo, então peça ao DP para validar a escala gerada.',
          ],
        },
        {
          p: 'O que significa o alerta amarelo ou vermelho?',
          r: [
            'Vermelho: a escala está fora da regra. Amarelo: atenção, ou algo que depende de validação do DP. Verde: dentro dos parâmetros configurados. Cada alerta cita o parâmetro que o gerou.',
          ],
        },
      ],
    },
    {
      titulo: 'Custos e contratações',
      itens: [
        {
          p: 'Vou precisar contratar mais gente?',
          r: [
            'Depende da cobertura. Com menos horas por empregado, manter o mesmo atendimento pode exigir mais pessoas. O quadro de contratações e o impacto calculam isso a partir da cobertura que você informou.',
            'Os valores de custo são estimativas, não projeções contábeis.',
          ],
        },
        {
          p: 'Posso usar hora extra para suprir a falta de gente?',
          r: [
            'Na 1ª etapa, a jornada acima do limite sai da regra e gera custo adicional. A proposta do Montador é cumprir a cobertura sem horas extras, ajustando turnos e folgas.',
          ],
        },
      ],
    },
    {
      titulo: 'Sobre esta ferramenta',
      itens: [
        {
          p: 'O resultado do Montador tem valor jurídico?',
          r: [
            'Não. É um apoio ao planejamento e não substitui a análise do Departamento Pessoal nem de assessoria jurídica.',
            'As regras estão em um único arquivo parametrizado e podem ser atualizadas se houver decreto, decisão do STF ou convenção coletiva.',
          ],
        },
        {
          p: 'Perco meus dados se fechar a página?',
          r: [
            'Os dados ficam salvos no navegador deste computador. O botão "Recomeçar" apaga tudo.',
          ],
        },
      ],
    },
  ]
}

export function Faq() {
  const grupos = montarGrupos()
  return (
    <section aria-labelledby="faq-titulo" className="space-y-6">
      <div className="cartao">
        <h2 id="faq-titulo" className="text-lg font-bold text-brand">
          Dúvidas sobre o fim da escala 6x1
        </h2>
        <p className="text-sm text-soft">
          Respostas rápidas para as perguntas mais comuns sobre a EC 141/2026. Clique na pergunta para ver a resposta.
        </p>
      </div>
      {grupos.map((g) => (
        <div key={g.titulo} className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-soft">{g.titulo}</h3>
          {g.itens.map((it) => (
            <details key={it.p} className="group rounded-xl border border-line bg-white p-4 shadow-card">
              <summary className="cursor-pointer list-none text-sm font-semibold text-brand marker:content-none">
                {it.p}
              </summary>
              <div className="mt-3 space-y-2 text-sm text-ink">
                {it.r.map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      ))}
    </section>
  )
}
