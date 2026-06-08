import { useState, useRef, useCallback } from 'react'
import { X, FileSpreadsheet, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'

// ── helpers (exportados para testes) ─────────────────────────

export function baixarModelo() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['nome', 'telefone', 'empresa', 'cargo', 'email', 'cpf_cnpj', 'observacoes'],
    ['João Silva (exemplo)', '5561999991111', 'ACME Ltda', 'Sócio', 'joao@acme.com', '000.000.000-00', ''],
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
      nome:        String(row.nome        ?? '').trim(),
      telefone,
      empresa:     String(row.empresa     ?? '').trim() || null,
      cargo:       String(row.cargo       ?? '').trim() || null,
      email:       String(row.email       ?? '').trim() || null,
      cpf_cnpj:    String(row.cpf_cnpj    ?? '').trim() || null,
      observacoes: String(row.observacoes ?? '').trim() || null,
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
          .insert({ contato_id: novoContato.id, empresa: l.empresa, cargo: l.cargo || null })
        if (errE) erros.push(errE.message)
      }
      continue
    }

    if (l.status === 'nova_empresa') {
      if (l.empresa) {
        const { error } = await supabase
          .from('contatos_empresas')
          .insert({ contato_id: l.contatoId, empresa: l.empresa, cargo: l.cargo || null })
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
        .update({ cargo: l.cargo || null })
        .eq('id', l.conflictId)
      if (errE) erros.push(errE.message)
    }
  }

  return erros
}
