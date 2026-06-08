import { useState, useRef, useCallback } from 'react'
import { X, FileSpreadsheet, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'

// ── helpers (exportados para testes) ─────────────────────────

export function baixarModelo() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['nome', 'telefone', 'cpf_cnpj', 'empresa', 'cnpj_empresa', 'cargo', 'email', 'observacoes'],
    ['João Silva (exemplo)', '5561999991111', '000.000.000-00', 'ACME Ltda', '00.000.000/0001-00', 'Sócio', 'joao@acme.com', ''],
    ['João Silva (exemplo)', '5561999991111', '', 'Outra Empresa Ltda', '11.111.111/0001-11', 'Diretor', '', ''],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Contatos')
  XLSX.writeFile(wb, 'modelo-contatos.xlsx')
}

export function normalizarLinhas(rawRows) {
  return rawRows.map((row, idx) => {
    const telefone = String(row.telefone ?? '').trim().replace(/\D/g, '')
    return {
      idx,
      nome:         String(row.nome         ?? '').trim(),
      telefone,
      empresa:      String(row.empresa      ?? '').trim() || null,
      cnpj_empresa: String(row.cnpj_empresa ?? '').trim() || null,
      cargo:        String(row.cargo        ?? '').trim() || null,
      email:        String(row.email        ?? '').trim() || null,
      cpf_cnpj:     String(row.cpf_cnpj     ?? '').trim() || null,
      observacoes:  String(row.observacoes  ?? '').trim() || null,
      status:      telefone ? 'novo_contato' : 'erro',
      conflictId:  null,
      contatoId:   null,
      acao:        null,
    }
  })
}

export async function parsearEProcessar(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  const linhas = normalizarLinhas(rawRows)
  const linhasValidas = linhas.filter(l => l.status !== 'erro')
  if (linhasValidas.length === 0) return linhas

  const telefones = [...new Set(linhasValidas.map(l => l.telefone))]
  const { data: contatosExistentes } = await supabase
    .from('contatos')
    .select('id, telefone')
    .in('telefone', telefones)

  const contatoMap = {}
  ;(contatosExistentes ?? []).forEach(c => { contatoMap[c.telefone] = c.id })

  const contatoIds = Object.values(contatoMap)
  let empresaExistentes = []
  if (contatoIds.length > 0) {
    const { data } = await supabase
      .from('contatos_empresas')
      .select('id, contato_id, empresa')
      .in('contato_id', contatoIds)
    empresaExistentes = data ?? []
  }

  linhasValidas.forEach(l => {
    const cId = contatoMap[l.telefone]
    if (!cId) {
      l.status = 'novo_contato'
      return
    }
    l.contatoId = cId
    const vinculo = empresaExistentes.find(
      e => e.contato_id === cId && (e.empresa ?? '') === (l.empresa ?? '')
    )
    if (vinculo) {
      l.status = 'conflito'
      l.conflictId = vinculo.id
      l.acao = 'atualizar'
    } else {
      l.status = 'nova_empresa'
    }
  })

  return linhas
}

export async function confirmarImportacao(linhas) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return ['Sessão expirada. Faça login novamente.']
  const agora = new Date().toISOString()
  const erros = []

  for (const l of linhas) {
    if (l.status === 'erro') continue
    if (l.status === 'conflito' && l.acao === 'ignorar') continue

    if (l.status === 'novo_contato') {
      const { data: novoContato, error: errC } = await supabase
        .from('contatos')
        .insert({
          nome:           l.nome || l.telefone,
          telefone:       l.telefone,
          email:          l.email       || null,
          cpf_cnpj:       l.cpf_cnpj    || null,
          observacoes:    l.observacoes || null,
          atualizado_por: user.id,
          atualizado_em:  agora,
        })
        .select('id')
        .single()
      if (errC) { erros.push(errC.message); continue }

      if (l.empresa) {
        const { error: errE } = await supabase
          .from('contatos_empresas')
          .insert({ contato_id: novoContato.id, empresa: l.empresa, cargo: l.cargo || null, cnpj: l.cnpj_empresa || null })
        if (errE) erros.push(errE.message)
      }
      continue
    }

    if (l.status === 'nova_empresa') {
      if (l.empresa) {
        const { error } = await supabase
          .from('contatos_empresas')
          .insert({ contato_id: l.contatoId, empresa: l.empresa, cargo: l.cargo || null, cnpj: l.cnpj_empresa || null })
        if (error) erros.push(error.message)
      }
      continue
    }

    if (l.status === 'conflito' && l.acao === 'atualizar') {
      const { error: errC } = await supabase
        .from('contatos')
        .update({
          nome:           l.nome || l.telefone,
          email:          l.email       || null,
          cpf_cnpj:       l.cpf_cnpj    || null,
          observacoes:    l.observacoes || null,
          atualizado_por: user.id,
          atualizado_em:  agora,
        })
        .eq('id', l.contatoId)
      if (errC) erros.push(errC.message)

      const { error: errE } = await supabase
        .from('contatos_empresas')
        .update({ cargo: l.cargo || null, cnpj: l.cnpj_empresa || null })
        .eq('id', l.conflictId)
      if (errE) erros.push(errE.message)
    }
  }

  return erros
}

// ── Step 1: Upload ────────────────────────────────────────────

function StepUpload({ onArquivo }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = useCallback((file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) return
    onArquivo(file)
  }, [onArquivo])

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#7a1e1e' : '#e0dcd8'}`,
          borderRadius: 10, padding: '40px 24px', textAlign: 'center',
          background: dragging ? '#fdf6f6' : '#fafaf9', cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <FileSpreadsheet size={32} color={dragging ? '#7a1e1e' : '#c5c0ba'} style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: '0 0 4px' }}>
          Arraste sua planilha aqui
        </p>
        <p style={{ fontSize: 12, color: '#888480', margin: 0 }}>
          ou clique para selecionar · .xlsx ou .xls
        </p>
        <input
          ref={inputRef} type="file" accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          onClick={e => { e.stopPropagation(); baixarModelo() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a1e1e', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Download size={12} /> Baixar modelo .xlsx
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Prévia ────────────────────────────────────────────

const STATUS_CONFIG = {
  novo_contato: { label: '✓ Novo contato', color: '#2d7a4f' },
  nova_empresa: { label: '✓ Nova empresa', color: '#1D4ED8' },
  erro:         { label: '✗ Sem telefone', color: '#b83232' },
}

function StepPrevia({ linhas, onChange }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e0dcd8', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f7f6f4' }}>
            {['Nome', 'Telefone', 'Empresa', 'CNPJ Empresa', 'Cargo', 'Status'].map(col => (
              <th key={col} style={{
                padding: '8px 10px', textAlign: 'left', color: '#888480',
                fontWeight: 600, borderBottom: '1px solid #e0dcd8', whiteSpace: 'nowrap',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.idx} style={{
              background: l.status === 'conflito' ? '#fff8ed' : l.status === 'erro' ? '#fff8f8' : '#fff',
              borderBottom: '1px solid #f0ede9',
            }}>
              <td style={{ padding: '7px 10px', color: '#1a1a1a' }}>{l.nome || '—'}</td>
              <td style={{ padding: '7px 10px', fontFamily: 'DM Mono, monospace', color: l.status === 'erro' ? '#b83232' : '#1a1a1a' }}>
                {l.telefone || '—'}
              </td>
              <td style={{ padding: '7px 10px', color: '#888480' }}>{l.empresa || '—'}</td>
              <td style={{ padding: '7px 10px', color: '#888480', fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{l.cnpj_empresa || '—'}</td>
              <td style={{ padding: '7px 10px', color: '#888480' }}>{l.cargo || '—'}</td>
              <td style={{ padding: '7px 10px' }}>
                {l.status === 'conflito' ? (
                  <div style={{ display: 'inline-flex', border: '1px solid #e0dcd8', borderRadius: 4, overflow: 'hidden', fontSize: 11 }}>
                    <button
                      onClick={() => onChange(l.idx, 'atualizar')}
                      style={{
                        padding: '3px 9px', border: 'none', cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
                        background: l.acao === 'atualizar' ? '#7a1e1e' : '#fff',
                        color:      l.acao === 'atualizar' ? '#fff'    : '#888480',
                      }}
                    >
                      Atualizar
                    </button>
                    <button
                      onClick={() => onChange(l.idx, 'ignorar')}
                      style={{
                        padding: '3px 9px', border: 'none', borderLeft: '1px solid #e0dcd8',
                        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
                        background: l.acao === 'ignorar' ? '#7a1e1e' : '#fff',
                        color:      l.acao === 'ignorar' ? '#fff'    : '#888480',
                      }}
                    >
                      Ignorar
                    </button>
                  </div>
                ) : (
                  <span style={{ color: STATUS_CONFIG[l.status]?.color, fontWeight: 600 }}>
                    {STATUS_CONFIG[l.status]?.label ?? l.status}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────

export default function ModalImportarPlanilha({ onFechar, onImportado }) {
  const [step, setStep]               = useState(1)
  const [processando, setProcessando] = useState(false)
  const [linhas, setLinhas]           = useState([])
  const [confirmando, setConfirmando] = useState(false)
  const [erroMsg, setErroMsg]         = useState('')

  const handleArquivo = async (file) => {
    setProcessando(true); setErroMsg('')
    try {
      const resultado = await parsearEProcessar(file)
      setLinhas(resultado)
      setStep(2)
    } catch {
      setErroMsg('Erro ao ler a planilha. Verifique se o arquivo está no formato correto.')
    }
    setProcessando(false)
  }

  const handleToggle = (idx, acao) =>
    setLinhas(prev => prev.map(l => l.idx === idx ? { ...l, acao } : l))

  const handleConfirmar = async () => {
    setConfirmando(true); setErroMsg('')
    const erros = await confirmarImportacao(linhas)
    setConfirmando(false)
    if (erros.length > 0) { setErroMsg(erros[0]) }
    else { onImportado(); onFechar() }
  }

  const novosContatos  = linhas.filter(l => l.status === 'novo_contato').length
  const novasEmpresas  = linhas.filter(l => l.status === 'nova_empresa').length
  const conflitos      = linhas.filter(l => l.status === 'conflito').length
  const erros          = linhas.filter(l => l.status === 'erro').length
  const aImportar      = novosContatos + novasEmpresas +
                         linhas.filter(l => l.status === 'conflito' && l.acao === 'atualizar').length

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 740,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px 14px', borderBottom: '1px solid #e0dcd8', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={16} color="#7a1e1e" />
            </div>
            <div>
              <h3 style={{ fontFamily: 'Merriweather, serif', fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                Importar Planilha
              </h3>
              {step === 2 && (
                <p style={{ fontSize: 11, color: '#888480', margin: 0 }}>
                  {novosContatos} novos · {novasEmpresas} novas empresas · {conflitos} conflitos · {erros} erros
                </p>
              )}
            </div>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#888480" />
          </button>
        </div>

        {/* Steps bar */}
        <div style={{ padding: '10px 24px 0', display: 'flex', gap: 4, flexShrink: 0 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#7a1e1e' }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: step === 2 ? '#7a1e1e' : '#e0dcd8' }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {processando ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#888480', fontSize: 13 }}>
              Lendo planilha e verificando duplicatas...
            </div>
          ) : step === 1 ? (
            <StepUpload onArquivo={handleArquivo} />
          ) : (
            <StepPrevia linhas={linhas} onChange={handleToggle} />
          )}
          {erroMsg && <p style={{ fontSize: 12, color: '#b83232', marginTop: 10 }}>{erroMsg}</p>}
        </div>

        {/* Footer */}
        {step === 2 && !processando && (
          <div style={{
            padding: '14px 24px', borderTop: '1px solid #e0dcd8',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <button
              onClick={() => { setStep(1); setLinhas([]) }}
              style={{
                padding: '8px 18px', borderRadius: 6, border: '1px solid #e0dcd8',
                background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer',
              }}
            >
              ← Voltar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={confirmando || aImportar === 0}
              style={{
                padding: '8px 20px', borderRadius: 6, border: 'none',
                background: confirmando || aImportar === 0 ? '#c5c0ba' : '#7a1e1e',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: confirmando || aImportar === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {confirmando ? 'Importando...' : `Confirmar ${aImportar} registro${aImportar !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
