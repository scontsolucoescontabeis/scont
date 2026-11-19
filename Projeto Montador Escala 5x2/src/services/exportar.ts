import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { REGRAS } from '../config/regras'
import { TEMA } from '../config/tema'
import { diaDaSemana } from '../engine/datas'
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
    ['Jornada diária máx.', `${REGRAS.jornadaDiariaMax}h`],
    ['Interjornada mín.', `${REGRAS.interjornadaMinHoras}h`],
    ['Modo de transição', REGRAS.modoTransicao],
    ['Compensação diária', dados.empresa.compensacaoDiaria ? 'Sim' : 'Não'],
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
  doc.text(
    `Período: ${formatarData(escala.inicio)} a ${formatarData(datasDaEscala(escala).slice(-1)[0])}   |   Situação: ${resultado.semaforo.toUpperCase()} (${resultado.contagem.vermelho} vermelho(s), ${resultado.contagem.amarelo} amarelo(s))`,
    10,
    31,
  )

  // Escala
  const datas = datasDaEscala(escala)
  autoTable(doc, {
    startY: 35,
    head: [
      ['Funcionário', ...datas.map((d) => `${DIAS_CURTOS[diaDaSemana(d)]}\n${d.slice(8)}/${d.slice(5, 7)}`)],
    ],
    body: escala.funcionarios.map((f) => [f.nome, ...datas.map((_, i) => textoCelula(escala, f.id, i))]),
    styles: { fontSize: 5.5, cellPadding: 0.6, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: acento, textColor: 255 },
    columnStyles: { 0: { halign: 'left', cellWidth: 28, fontSize: 7 } },
    didParseCell: (d) => {
      if (d.section !== 'body' || d.column.index === 0) return
      const t = String(d.cell.raw)
      if (t === 'F' || t === 'DSR') d.cell.styles.fillColor = [219, 234, 254]
      else if (t === 'FER') d.cell.styles.fillColor = [254, 243, 199]
      else if (t === 'AUS') d.cell.styles.fillColor = [229, 231, 235]
    },
  })
  const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFontSize(7)
  doc.text(
    'Legenda: horários = dia trabalhado | F = folga | DSR = descanso semanal | FER = feriado | AUS = atestado/férias',
    10,
    y1 + 4,
  )

  // Conformidade
  doc.addPage()
  doc.setFontSize(12)
  doc.text('Resumo de conformidade', 10, 14)
  autoTable(doc, {
    startY: 18,
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
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: acento },
    columnStyles: { 0: { cellWidth: 60 } },
  })
  const imp = calcularImpacto(dados.funcoes, dados.etapaImpacto, dados.custo)
  const y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  autoTable(doc, {
    startY: y3,
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
    doc.setFontSize(6.5)
    doc.setTextColor(75, 85, 99)
    doc.text(doc.splitTextToSize(REGRAS.avisoLegal, largura - 20), 10, h - 10)
    doc.text(`Página ${p}/${total}`, largura - 10, h - 4, { align: 'right' })
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
    XLSX.utils.aoa_to_sheet([['Parâmetro', 'Valor'], ...linhasParametros(dados), ['Aviso legal', REGRAS.avisoLegal]]),
    'Parâmetros',
  )
  XLSX.writeFile(wb, `escala-5x2-${(dados.empresa.nome || 'empresa').replace(/\s+/g, '-').toLowerCase()}.xlsx`)
}
