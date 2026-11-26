import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { TEMA } from '../config/tema'
import { diaDaSemana } from '../engine/datas'
import type { Dados } from '../store/useStore'
import type { Escala } from '../types'
import {
  DIAS_CURTOS,
  NOME_TIPO,
  SIGLA_TIPO,
  datasDaEscala,
  formatarData,
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

/** Nome do arquivo baixado (PDF/Excel). */
function nomeArquivo(dados: Dados, ext: string): string {
  return `escala-5x2-${(dados.empresa.nome || 'empresa').replace(/\s+/g, '-').toLowerCase()}.${ext}`
}

/** Linha de cada funcionário: nome, função e o texto de cada dia (como está na tela, com os ajustes do passo 4). */
function linhasEscala(dados: Dados, escala: Escala, celula: (fid: string, i: number) => string): string[][] {
  return escala.funcionarios.map((f) => [
    f.vaga ? `${f.nome} (a contratar)` : f.nome,
    dados.funcoes.find((x) => x.id === f.funcaoId)?.nome ?? '',
    ...datasDaEscala(escala).map((_, i) => celula(f.id, i)),
  ])
}

/** PDF só com a escala proposta (a que está no passo 4, com os ajustes feitos). */
export function gerarPDF(dados: Dados, escala: Escala): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const acento = hexParaRgb(TEMA.cores.acento)
  const largura = doc.internal.pageSize.getWidth()
  const nomeEmpresa = dados.empresa.nome || 'Empresa'

  doc.setFillColor(...acento)
  doc.rect(0, 0, largura, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text('SCONT Soluções Contábeis — Escala proposta', 10, 11.5)
  doc.setFontSize(9)
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, largura - 10, 11.5, { align: 'right' })

  doc.setTextColor(31, 41, 55)
  doc.setFontSize(11)
  doc.text(`${nomeEmpresa}${dados.empresa.setor ? ' — ' + dados.empresa.setor : ''}`, 10, 26)
  doc.setFontSize(9)
  const datas = datasDaEscala(escala)
  const feriadosEscala = new Set(dados.feriados.map((f) => f.data))
  doc.text(`Período: ${formatarData(escala.inicio)} a ${formatarData(datas.slice(-1)[0])}`, 10, 31)

  autoTable(doc, {
    startY: 35,
    margin: { bottom: 12 },
    head: [
      [
        'Funcionário',
        'Função',
        ...datas.map(
          (d) =>
            `${DIAS_CURTOS[diaDaSemana(d)]}\n${d.slice(8)}/${d.slice(5, 7)}${feriadosEscala.has(d) ? '\nFER' : ''}`,
        ),
      ],
    ],
    body: linhasEscala(dados, escala, (fid, i) => textoCelula(escala, fid, i)),
    styles: { fontSize: 5.5, cellPadding: 0.6, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: acento, textColor: 255 },
    columnStyles: { 0: { halign: 'left', cellWidth: 30, fontSize: 6.5 }, 1: { halign: 'left', cellWidth: 18, fontSize: 6 } },
    didParseCell: (d) => {
      if (d.section === 'head' && d.column.index > 1 && feriadosEscala.has(datas[d.column.index - 2])) {
        d.cell.styles.fillColor = [180, 83, 9]
      }
      if (d.section !== 'body' || d.column.index < 2) return
      const t = String(d.cell.raw)
      if (t === 'F' || t === 'DSR') d.cell.styles.fillColor = [219, 234, 254]
      else if (t === 'FER') d.cell.styles.fillColor = [254, 243, 199]
      else if (t === 'AUS') d.cell.styles.fillColor = [229, 231, 235]
    },
  })
  const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFontSize(7)
  doc.text(
    'Legenda: horários = dia trabalhado (entrada e saída) | F = folga | DSR = descanso semanal | FER = feriado | AUS = férias/ausência.',
    10,
    y1 + 4,
  )

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFontSize(6)
    doc.setTextColor(75, 85, 99)
    doc.text(`Página ${p}/${total}`, largura - 10, doc.internal.pageSize.getHeight() - 4, { align: 'right' })
  }

  doc.save(nomeArquivo(dados, 'pdf'))
}

/** Excel só com a escala proposta (a que está no passo 4, com os ajustes feitos). */
export function gerarExcel(dados: Dados, escala: Escala): void {
  const datas = datasDaEscala(escala)
  const wb = XLSX.utils.book_new()
  const cab = ['Funcionário', 'Função', ...datas.map((d) => `${DIAS_CURTOS[diaDaSemana(d)]} ${formatarData(d)}`)]
  const linhas = linhasEscala(dados, escala, (fid, i) => {
    const c = escala.celulas[fid][i]
    return c.tipo === 'trabalho' ? rotuloTurno(escala.turnos.find((t) => t.id === c.turnoId)) : NOME_TIPO[c.tipo]
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cab, ...linhas]), 'Escala')
  XLSX.writeFile(wb, nomeArquivo(dados, 'xlsx'))
}
