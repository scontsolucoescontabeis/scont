import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { REGRAS, cicloDomingoDoSetor } from '../config/regras'
import { TEMA } from '../config/tema'
import { fmtHoras } from '../engine/conformidade'
import { diaDaSemana } from '../engine/datas'
import { diasPreVigencia, presencaPorDia, resumoAlertas, resumoPorEmpregado, textoHorasSemana } from '../utils/resumo'
import { calcularImpacto } from '../engine/impacto'
import type { Dados } from '../store/useStore'
import type { Escala, ResultadoConformidade } from '../types'
import {
  DIAS_CURTOS,
  NOME_TIPO,
  SIGLA_TIPO,
  datasDaEscala,
  formatarData,
  formatarMoeda,
  rotuloTurno,
} from '../utils/analise'

function hexParaRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function textoCelula(e: Escala, fid: string, i: number): string {
  const c = e.celulas[fid][i]
  if (c.tipo === 'trabalho') {
    const t = e.turnos.find((x) => x.id === c.turnoId)
    return t ? `${t.inicio}\n${t.fim}` : SIGLA_TIPO.trabalho
  }
  return SIGLA_TIPO[c.tipo]
}

function linhasParametros(dados: Dados): [string, string][] {
  return [
    ['Versão das regras', `${REGRAS.versao} (atualizada em ${formatarData(REGRAS.atualizadoEm)})`],
    ['1ª etapa', `a partir de ${formatarData(REGRAS.etapa1.inicio)}: ${REGRAS.etapa1.jornadaSemanalMax}h/semana, ${REGRAS.etapa1.repousosSemanais} repousos`],
    ['2ª etapa', `a partir de ${formatarData(REGRAS.etapa2.inicio)}: ${REGRAS.etapa2.jornadaSemanalMax}h/semana`],
    ['Jornada diária máx.', fmtHoras(REGRAS.jornadaDiariaMax * 60)],
    ['Interjornada mín.', `${REGRAS.interjornadaMinHoras}h`],
    ['Domingo de folga', `ao menos 1 a cada ${cicloDomingoDoSetor(dados.empresa.setor)} semanas`],
    ['Dias seguidos (máx.)', `${REGRAS.diasConsecutivosMax}`],
    ['DSR + interjornada', `${REGRAS.repousoSemanalComInterjornadaHoras}h`],
    ['Modo de transição', REGRAS.modoTransicao],
    ['Encargos / Hora extra (estimativa)', `${dados.custo.encargosPct}% / ${dados.custo.horaExtraPct}%`],
  ]
}

export function gerarPDF(dados: Dados, escala: Escala, resultado: ResultadoConformidade): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const acento = hexParaRgb(TEMA.cores.acento)
  const largura = doc.internal.pageSize.getWidth()
  const nomeEmpresa = dados.empresa.nome || 'Empresa'

  doc.setFillColor(...acento)
  doc.rect(0, 0, largura, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text('SCONT Soluções Contábeis — Proposta de Escala 5x2', 10, 11.5)
  doc.setFontSize(9)
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, largura - 10, 11.5, { align: 'right' })

  doc.setTextColor(31, 41, 55)
  doc.setFontSize(11)
  doc.text(`${nomeEmpresa}${dados.empresa.setor ? ' — ' + dados.empresa.setor : ''}`, 10, 26)
  doc.setFontSize(9)
  const datas = datasDaEscala(escala)
  const pre = diasPreVigencia(datas)
  const feriadosEscala = new Set(dados.feriados.map((f) => f.data))
  doc.text(
    `Período: ${formatarData(escala.inicio)} a ${formatarData(datas.slice(-1)[0])}   |   Situação: ${resultado.semaforo.toUpperCase()} (${resultado.contagem.vermelho} vermelho(s), ${resultado.contagem.amarelo} amarelo(s))`,
    10,
    31,
  )
  if (pre.length > 0) {
    doc.setFontSize(7.5)
    doc.text(
      `Pré-vigência: ${formatarData(pre[0])} a ${formatarData(pre[pre.length - 1])} (antes de ${formatarData(REGRAS.etapa1.inicio)}; valem as regras atuais; colunas com cabeçalho cinza).`,
      10,
      35,
    )
  }

  // Rodapé: aviso legal + base legal (reservado em todas as páginas)
  doc.setFontSize(6)
  const rodape: string[] = doc.splitTextToSize(
    [REGRAS.avisoLegal, ...REGRAS.baseLegal.map((t) => `• ${t}`)].join('  '),
    largura - 20,
  )
  const alturaRodape = rodape.length * 2.6 + 8

  // Escala + presença por dia
  const presenca = presencaPorDia(escala, dados.empresa, dados.turnos, dados.cobertura)
  const nFunc = escala.funcionarios.length
  const nTurnos = presenca.porTurno.length
  autoTable(doc, {
    startY: pre.length > 0 ? 38 : 35,
    margin: { bottom: alturaRodape },
    head: [
      [
        'Funcionário',
        ...datas.map(
          (d) =>
            `${DIAS_CURTOS[diaDaSemana(d)]}\n${d.slice(8)}/${d.slice(5, 7)}${feriadosEscala.has(d) ? '\nFER' : ''}`,
        ),
      ],
    ],
    body: [
      ...escala.funcionarios.map((f) => [f.nome, ...datas.map((_, i) => textoCelula(escala, f.id, i))]),
      ...presenca.porTurno.map((l) => [`Pessoas ${l.turno.inicio}–${l.turno.fim}`, ...l.contagem.map(String)]),
      ['Total presentes', ...presenca.total.map(String)],
      ['Mínimo exigido (pico)', ...presenca.exigido.map(String)],
    ],
    styles: { fontSize: 5.5, cellPadding: 0.6, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: acento, textColor: 255 },
    columnStyles: { 0: { halign: 'left', cellWidth: 30, fontSize: 6.5 } },
    didParseCell: (d) => {
      if (d.section === 'head' && d.column.index > 0) {
        const dia = datas[d.column.index - 1]
        if (pre.includes(dia)) d.cell.styles.fillColor = [100, 116, 139]
        else if (feriadosEscala.has(dia)) d.cell.styles.fillColor = [180, 83, 9]
      }
      if (d.section !== 'body') return
      const linha = d.row.index
      const i = d.column.index - 1
      if (linha >= nFunc) {
        d.cell.styles.fontStyle = 'bold'
        d.cell.styles.fillColor = [243, 244, 246]
        if (i >= 0 && linha === nFunc + nTurnos) {
          if (presenca.total[i] < presenca.exigido[i]) d.cell.styles.fillColor = [254, 202, 202]
          else if (presenca.total[i] === presenca.exigido[i]) d.cell.styles.fillColor = [254, 243, 199]
        }
        return
      }
      if (i < 0) return
      const t = String(d.cell.raw)
      if (t === 'F' || t === 'DSR') d.cell.styles.fillColor = [219, 234, 254]
      else if (t === 'FER') d.cell.styles.fillColor = [254, 243, 199]
      else if (t === 'AUS') d.cell.styles.fillColor = [229, 231, 235]
      else if (feriadosEscala.has(datas[i])) {
        // Trabalho em feriado: destaca (exige autorização em convenção coletiva e lei municipal).
        d.cell.styles.fillColor = [253, 186, 116]
      }
    },
  })
  const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFontSize(7)
  doc.text(
    doc.splitTextToSize(
      'Legenda: horários = dia trabalhado | F = folga | DSR = descanso semanal | FER = feriado | AUS = atestado/férias. Laranja = trabalho em feriado (exige autorização na convenção coletiva e, se houver, lei municipal; confirmar). Total em amarelo = só o mínimo exigido; em vermelho = abaixo do mínimo.',
      largura - 20,
    ),
    10,
    y1 + 4,
  )

  // Resumo por empregado
  doc.addPage()
  doc.setFontSize(12)
  doc.text('Jornada, horas por semana e repousos por empregado', 10, 14)
  autoTable(doc, {
    startY: 18,
    margin: { bottom: alturaRodape },
    head: [
      [
        'Empregado',
        'Jornada diária',
        'Intervalo',
        'Horas por semana',
        'Teto semanal',
        'Maior sequência trabalhada',
        'Repousos seguidos',
        'Trabalho noturno (22h–5h)',
      ],
    ],
    body: resumoPorEmpregado(escala).map((r) => {
      const t = textoHorasSemana(r)
      return [
        r.nome,
        r.jornadaDiaria,
        r.intervalo,
        t.horas,
        t.teto,
        `${r.maiorSequencia} dia(s)`,
        r.semanasCompletas > 0 ? `${r.semanasRepousoSeguido} de ${r.semanasCompletas} semanas` : '—',
        r.minutosNoturnosDia > 0 ? `${r.minutosNoturnosDia} min/dia` : 'não',
      ]
    }),
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: acento },
  })
  const yn = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3
  doc.setFontSize(7)
  doc.text(
    doc.splitTextToSize(
      'Trabalho entre 22h e 5h gera adicional noturno e hora reduzida (52min30s); a folha e a estimativa de custo devem considerar. As folgas contam no cálculo do DSR e dos reflexos em variáveis e comissões.',
      largura - 20,
    ),
    10,
    yn + 2,
  )

  // Conformidade
  const yr = yn + 12
  const resumo = resumoAlertas(resultado)
  doc.setFontSize(12)
  doc.text('Resumo de conformidade', 10, yr)
  autoTable(doc, {
    startY: yr + 3,
    margin: { bottom: alturaRodape },
    head: [['Nível', 'Motivo', 'Qtd.']],
    body:
      resumo.length === 0
        ? [['VERDE', 'Nenhum alerta', '0']]
        : resumo.map((l) => [l.nivel === 'vermelho' ? 'VERMELHO' : 'AMARELO', l.titulo, String(l.quantidade)]),
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: acento },
    columnStyles: { 0: { cellWidth: 25 }, 2: { cellWidth: 15 } },
  })
  const yd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  doc.addPage()
  doc.setFontSize(12)
  doc.text('Detalhe dos alertas', 10, 14)
  void yd
  autoTable(doc, {
    startY: 18,
    margin: { bottom: alturaRodape },
    head: [['Nível', 'Alerta', 'Detalhe', 'Sugestão']],
    body:
      resultado.alertas.length === 0
        ? [['VERDE', 'Nenhum alerta', 'A escala atende às regras parametrizadas.', '']]
        : resultado.alertas.map((a) => [
            a.severidade === 'vermelho' ? 'VERMELHO' : 'AMARELO',
            a.titulo,
            a.mensagem,
            a.sugestao,
          ]),
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: acento },
  })

  // Parâmetros + impacto
  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  autoTable(doc, {
    startY: y2,
    head: [['Parâmetros utilizados', '']],
    body: linhasParametros(dados),
    margin: { bottom: alturaRodape },
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: acento },
    columnStyles: { 0: { cellWidth: 60 } },
  })
  const imp = calcularImpacto(dados.funcoes, dados.etapaImpacto, dados.custo)
  const y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  autoTable(doc, {
    startY: y3,
    margin: { bottom: alturaRodape },
    head: [['ESTIMATIVA de impacto', '']],
    body: [
      ['Horas semanais a cobrir (déficit)', `${imp.deficitHorasSemana.toFixed(1)} h`],
      ['Contratações equivalentes', imp.contratacoesEquivalentes.toFixed(2)],
      ['Custo mensal atual (aprox.)', formatarMoeda(imp.custoMensalAtual)],
      ['Custo mensal contratando (aprox.)', formatarMoeda(imp.custoMensalContratando)],
      ['Custo mensal com horas extras (aprox.)', formatarMoeda(imp.custoMensalHoraExtra)],
    ],
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: acento },
    columnStyles: { 0: { cellWidth: 60 } },
  })

  // Aviso legal em todas as páginas
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    const h = doc.internal.pageSize.getHeight()
    doc.setFontSize(6)
    doc.setTextColor(75, 85, 99)
    doc.text(rodape, 10, h - 4 - rodape.length * 2.6)
    doc.text(`Página ${p}/${total}`, largura - 10, h - 2, { align: 'right' })
  }

  doc.save(`escala-5x2-${nomeEmpresa.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

export function gerarExcel(dados: Dados, escala: Escala, resultado: ResultadoConformidade): void {
  const datas = datasDaEscala(escala)
  const wb = XLSX.utils.book_new()

  const cab = ['Funcionário', 'Função', ...datas.map((d) => `${DIAS_CURTOS[diaDaSemana(d)]} ${formatarData(d)}`)]
  const linhas = escala.funcionarios.map((f) => [
    f.nome,
    dados.funcoes.find((x) => x.id === f.funcaoId)?.nome ?? '',
    ...escala.celulas[f.id].map((c) =>
      c.tipo === 'trabalho'
        ? rotuloTurno(escala.turnos.find((t) => t.id === c.turnoId))
        : NOME_TIPO[c.tipo],
    ),
  ])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab, ...linhas]), 'Escala')

  const alertas = [
    ['Nível', 'Regra', 'Alerta', 'Funcionário', 'Data', 'Detalhe', 'Sugestão'],
    ...resultado.alertas.map((a) => [
      a.severidade,
      a.regraId,
      a.titulo,
      escala.funcionarios.find((f) => f.id === a.funcionarioId)?.nome ?? '',
      a.data ? formatarData(a.data) : '',
      a.mensagem,
      a.sugestao,
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(alertas), 'Conformidade')

  const emp = resumoPorEmpregado(escala).map((r) => {
    const t = textoHorasSemana(r)
    return [
      r.nome,
      r.jornadaDiaria,
      r.intervalo,
      ...r.horasSemana.map((h) => Number(h.toFixed(2))),
      t.teto,
      r.maiorSequencia,
      `${r.semanasRepousoSeguido}/${r.semanasCompletas}`,
      r.minutosNoturnosDia,
    ]
  })
  const nSem = Math.floor(escala.dias / 7)
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [
        'Empregado',
        'Jornada diária',
        'Intervalo',
        ...Array.from({ length: nSem }, (_, w) => `Horas sem. ${w + 1}`),
        'Teto semanal',
        'Maior sequência (dias)',
        'Semanas c/ repousos seguidos',
        'Min. noturnos/dia (22h–5h)',
      ],
      ...emp,
    ]),
    'Resumo por empregado',
  )
  const pres = presencaPorDia(escala, dados.empresa, dados.turnos, dados.cobertura)
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Pessoas', ...datas.map((d) => `${DIAS_CURTOS[diaDaSemana(d)]} ${formatarData(d)}`)],
      ...pres.porTurno.map((l) => [`${l.turno.inicio}–${l.turno.fim}`, ...l.contagem]),
      ['Total presentes', ...pres.total],
      ['Mínimo exigido (pico)', ...pres.exigido],
    ]),
    'Presença por dia',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Nível', 'Motivo', 'Quantidade'],
      ...resumoAlertas(resultado).map((l) => [l.nivel, l.titulo, l.quantidade]),
    ]),
    'Resumo dos alertas',
  )

  const imp = calcularImpacto(dados.funcoes, dados.etapaImpacto, dados.custo)
  const impacto = [
    ['ESTIMATIVA — ' + dados.etapaImpacto],
    ['Função', 'Qtd', 'Horas atuais', 'Horas novas', 'Déficit h/sem', 'Contratações eq.', 'Custo atual', 'Custo contratando', 'Custo c/ hora extra'],
    ...imp.porFuncao.map((p) => [
      p.nome,
      p.quantidade,
      p.horasAtuais,
      p.horasNovas,
      p.horasADescobrirSemana,
      Number(p.contratacoesEquivalentes.toFixed(2)),
      p.custoMensalAtual ?? '',
      p.custoMensalContratando ?? '',
      p.custoMensalHoraExtra ?? '',
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(impacto), 'Impacto (estimativa)')

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['Parâmetro', 'Valor'], ...linhasParametros(dados), ['Aviso legal', REGRAS.avisoLegal], ...REGRAS.baseLegal.map((t) => ['Base legal', t])]),
    'Parâmetros',
  )
  XLSX.writeFile(wb, `escala-5x2-${(dados.empresa.nome || 'empresa').replace(/\s+/g, '-').toLowerCase()}.xlsx`)
}
