import { useState, useRef } from 'react'
import { Send, Lock, Paperclip } from 'lucide-react'

export function InputBar({ onEnviar, onAnotacao, enviando }) {
  const [texto, setTexto]         = useState('')
  const [modoNota, setModoNota]   = useState(false)
  const textareaRef               = useRef(null)

  const handleEnviar = () => {
    const conteudo = texto.trim()
    if (!conteudo) return

    if (modoNota) {
      onAnotacao(conteudo)
    } else {
      onEnviar(conteudo)
    }
    setTexto('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  const bgInput  = modoNota ? '#FEFCE8' : '#ffffff'
  const borda    = modoNota ? '#FEF08A' : '#e0dcd8'

  return (
    <div style={{
      borderTop: '1px solid #e0dcd8',
      background: '#fafaf9',
      padding: '10px 12px',
    }}>
      {/* Indicador de modo nota */}
      {modoNota && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: '#854d0e',
          marginBottom: 6,
          fontWeight: 500,
        }}>
          <Lock size={11} />
          Modo nota interna — não será enviada ao cliente
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={modoNota ? 'Escreva uma nota interna...' : 'Digite uma mensagem...'}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: `1px solid ${borda}`,
            borderRadius: 8,
            padding: '9px 12px',
            fontSize: 13,
            outline: 'none',
            fontFamily: 'DM Sans, sans-serif',
            background: bgInput,
            lineHeight: 1.5,
            maxHeight: 120,
            overflowY: 'auto',
          }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />

        {/* Botão nota interna */}
        <button
          onClick={() => setModoNota(m => !m)}
          title={modoNota ? 'Cancelar nota' : 'Nota interna'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid #e0dcd8',
            background: modoNota ? '#FEF08A' : '#fff',
            color: modoNota ? '#854d0e' : '#888480',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Lock size={15} />
        </button>

        {/* Botão enviar */}
        <button
          onClick={handleEnviar}
          disabled={!texto.trim() || enviando}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: 'none',
            background: (!texto.trim() || enviando) ? '#d6c5c5' : '#7a1e1e',
            color: '#fff',
            cursor: (!texto.trim() || enviando) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          <Send size={15} />
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#888480', marginTop: 5 }}>
        Enter para enviar · Shift+Enter para nova linha
      </div>
    </div>
  )
}
