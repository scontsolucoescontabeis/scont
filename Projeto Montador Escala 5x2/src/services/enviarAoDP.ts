/**
 * Envio ao DP da SCONT.
 * Fase 1: gera um JSON estruturado, baixa o arquivo e abre mailto/WhatsApp com um resumo.
 * Fase 2: troque `enviarAoDP` por uma chamada a uma Edge Function do Supabase
 * (ex.: supabase.functions.invoke('receber-escala-5x2', { body: payload })) mantendo
 * a mesma assinatura — a interface só depende de `EnviarAoDP`.
 */
import { REGRAS } from '../config/regras'
import type { Dados } from '../store/useStore'
import type { Escala, ResultadoConformidade } from '../types'

// TODO: confirmar os contatos oficiais do DP da SCONT.
export const CONTATO_DP = {
  email: 'dp@scont.com.br',
  whatsapp: '5561999999999',
}

export interface PayloadDP {
  versaoPayload: 1
  geradoEm: string
  regras: { versao: string; atualizadoEm: string; modoTransicao: string }
  empresa: Dados['empresa']
  funcoes: Dados['funcoes']
  turnos: Dados['turnos']
  cobertura: Dados['cobertura']
  escala: Escala
  alertas: ResultadoConformidade['alertas']
  semaforo: ResultadoConformidade['semaforo']
}

export type Canal = 'email' | 'whatsapp'
export type EnviarAoDP = (payload: PayloadDP, canal: Canal) => Promise<void>

export function montarPayload(
  dados: Dados,
  escala: Escala,
  resultado: ResultadoConformidade,
): PayloadDP {
  return {
    versaoPayload: 1,
    geradoEm: new Date().toISOString(),
    regras: {
      versao: REGRAS.versao,
      atualizadoEm: REGRAS.atualizadoEm,
      modoTransicao: REGRAS.modoTransicao,
    },
    empresa: dados.empresa,
    funcoes: dados.funcoes,
    turnos: dados.turnos,
    cobertura: dados.cobertura,
    escala,
    alertas: resultado.alertas,
    semaforo: resultado.semaforo,
  }
}

export function resumoTexto(p: PayloadDP): string {
  const equipe = p.funcoes.map((f) => `${f.quantidade}x ${f.nome}`).join(', ')
  return (
    `Olá, DP da SCONT! Montei uma proposta de escala 5x2 (EC 141/2026).\n` +
    `Empresa: ${p.empresa.nome || '(sem nome)'} — ${p.empresa.setor || 'setor não informado'}\n` +
    `Equipe: ${equipe}\n` +
    `Situação: ${p.semaforo.toUpperCase()} — ${p.alertas.filter((a) => a.severidade === 'vermelho').length} alerta(s) vermelho(s), ` +
    `${p.alertas.filter((a) => a.severidade === 'amarelo').length} amarelo(s).\n` +
    `Estou anexando o arquivo JSON com a escala completa.`
  )
}

function baixarJSON(p: PayloadDP): void {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `escala-5x2-${(p.empresa.nome || 'empresa').replace(/\s+/g, '-').toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const enviarAoDP: EnviarAoDP = async (payload, canal) => {
  baixarJSON(payload)
  const texto = resumoTexto(payload)
  if (canal === 'email') {
    const assunto = `Escala 5x2 — ${payload.empresa.nome || 'proposta'}`
    window.open(
      `mailto:${CONTATO_DP.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`,
      '_blank',
    )
  } else {
    window.open(`https://wa.me/${CONTATO_DP.whatsapp}?text=${encodeURIComponent(texto)}`, '_blank')
  }
}
