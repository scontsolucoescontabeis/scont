import { FileSpreadsheet, FileText, Mail, MessageCircle } from 'lucide-react'
import { enviarAoDP, montarPayload } from '../services/enviarAoDP'
import { gerarExcel, gerarPDF } from '../services/exportar'
import { useStore } from '../store/useStore'
import type { Escala, ResultadoConformidade } from '../types'

export function Saida({ escala, resultado }: { escala: Escala; resultado: ResultadoConformidade }) {
  const dados = useStore()

  return (
    <section className="cartao space-y-3" aria-labelledby="t-saida">
      <h3 id="t-saida" className="text-lg font-bold">
        Levar a escala
      </h3>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primario" onClick={() => gerarPDF(dados, escala)}>
          <FileText size={16} aria-hidden /> Baixar PDF
        </button>
        <button type="button" className="btn-sec" onClick={() => gerarExcel(dados, escala)}>
          <FileSpreadsheet size={16} aria-hidden /> Baixar Excel
        </button>
      </div>
      <div className="border-t border-line pt-3">
        <p className="mb-2 text-sm font-medium">Enviar ao DP da SCONT</p>
        <p className="mb-2 text-xs text-soft">
          Baixamos um arquivo JSON com a escala completa e abrimos uma mensagem com o resumo. Anexe o arquivo ao enviar.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-sec"
            onClick={() => enviarAoDP(montarPayload(dados, escala, resultado), 'email')}
          >
            <Mail size={16} aria-hidden /> Por e-mail
          </button>
          <button
            type="button"
            className="btn-sec"
            onClick={() => enviarAoDP(montarPayload(dados, escala, resultado), 'whatsapp')}
          >
            <MessageCircle size={16} aria-hidden /> Por WhatsApp
          </button>
        </div>
      </div>
    </section>
  )
}
