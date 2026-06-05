import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_LABEL = {
  ABERTA:      'Aberta',
  EM_EXECUCAO: 'Em Execução',
  CONCLUIDA:   'Concluída',
  CANCELADA:   'Cancelada',
}
const PRIORIDADE_LABEL = {
  BAIXA: 'Baixa', NORMAL: 'Normal', ALTA: 'Alta', URGENTE: 'Urgente',
}
const DEPTO_LABEL = {
  PESSOAL: 'Pessoal', CONTABIL: 'Contábil',
  ADMINISTRATIVO: 'Administrativo', TRIBUTARIO: 'Tributário',
}

function fmt(date) {
  if (!date) return ''
  try { return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) } catch { return '' }
}

export function exportarTarefasExcel(tarefas, filtros = {}) {
  // ── 1. Montar linhas ─────────────────────────────────────────
  const linhas = tarefas.map((t, i) => ({
    '#':            i + 1,
    'Título':       t.titulo,
    'Demandante':   t.demandante ?? '—',
    'Departamento': DEPTO_LABEL[t.departamento] ?? t.departamento,
    'Status':       STATUS_LABEL[t.status]       ?? t.status,
    'Prioridade':   PRIORIDADE_LABEL[t.prioridade] ?? t.prioridade,
    'Responsável':  t.responsavel?.nome ?? '—',
    'Criado por':   t.criador?.nome     ?? '—',
    'Prazo':        fmt(t.prazo),
    'Aberta em':    fmt(t.criado_em),
    'Concluída em': fmt(t.concluido_em),
    'Conversa':     t.conversas?.protocolo ?? '—',
    'Descrição':    t.descricao ?? '',
  }))

  // ── 2. Criar worksheet ───────────────────────────────────────
  const ws = XLSX.utils.json_to_sheet(linhas)

  // Larguras de coluna
  ws['!cols'] = [
    { wch: 4  },  // #
    { wch: 40 },  // Título
    { wch: 28 },  // Demandante
    { wch: 16 },  // Departamento
    { wch: 14 },  // Status
    { wch: 12 },  // Prioridade
    { wch: 22 },  // Responsável
    { wch: 22 },  // Criado por
    { wch: 16 },  // Prazo
    { wch: 16 },  // Aberta em
    { wch: 16 },  // Concluída em
    { wch: 20 },  // Conversa
    { wch: 50 },  // Descrição
  ]

  // Estilo do cabeçalho (linha 1)
  const headerRange = XLSX.utils.decode_range(ws['!ref'])
  for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: C })
    if (!ws[cell]) continue
    ws[cell].s = {
      font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill:      { fgColor: { rgb: '7A1E1E' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
      border: {
        bottom: { style: 'thin', color: { rgb: 'C0A0A0' } },
      },
    }
  }

  // Estilo zebra nas linhas de dados
  for (let R = 1; R <= headerRange.e.r; R++) {
    for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C })
      if (!ws[cell]) ws[cell] = { t: 's', v: '' }
      ws[cell].s = {
        fill:      { fgColor: { rgb: R % 2 === 0 ? 'F7F6F4' : 'FFFFFF' } },
        alignment: { vertical: 'center', wrapText: false },
        font:      { sz: 10 },
      }
    }
  }

  // Congela a linha do cabeçalho
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

  // ── 3. Criar aba de resumo ───────────────────────────────────
  const total    = tarefas.length
  const porStatus = Object.entries(STATUS_LABEL).map(([k, v]) => ({
    Status: v,
    Quantidade: tarefas.filter(t => t.status === k).length,
  }))
  const wsResumo = XLSX.utils.json_to_sheet([
    { Info: 'Total de tarefas',       Valor: total },
    { Info: 'Abertas',                Valor: tarefas.filter(t => t.status === 'ABERTA').length },
    { Info: 'Em Execução',            Valor: tarefas.filter(t => t.status === 'EM_EXECUCAO').length },
    { Info: 'Concluídas',             Valor: tarefas.filter(t => t.status === 'CONCLUIDA').length },
    { Info: 'Canceladas',             Valor: tarefas.filter(t => t.status === 'CANCELADA').length },
    { Info: '',                       Valor: '' },
    { Info: 'Exportado em',           Valor: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) },
    ...(filtros.departamento ? [{ Info: 'Filtro Departamento', Valor: DEPTO_LABEL[filtros.departamento] ?? filtros.departamento }] : []),
  ])
  wsResumo['!cols'] = [{ wch: 24 }, { wch: 18 }]

  // ── 4. Montar workbook ───────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws,      'Tarefas')
  XLSX.utils.book_append_sheet(wb, wsResumo,'Resumo')

  // ── 5. Download ──────────────────────────────────────────────
  const dataStr   = format(new Date(), 'yyyy-MM-dd', { locale: ptBR })
  const fileName  = `tarefas_scont_${dataStr}.xlsx`
  XLSX.writeFile(wb, fileName, { cellStyles: true })
}
