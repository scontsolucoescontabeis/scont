import { useState, useRef } from 'react'
import { Send, Lock, Paperclip } from 'lucide-react'

export function InputBar({ onEnviar, onAnotacao, disabled }) {
  const [modo, setModo] = useState('texto') // 'texto' | 'anotacao'
  const [texto, setTexto] = useState('')
  const textareaRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const valor = texto.trim()
    if (!valor) return

    if (modo === 'anotacao') {
      await onAnotacao(valor)
    } else {
      await onEnviar(valor)
    }
    setTexto('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const isAnotacao = modo === 'anotacao'

  return (
    <div style={{
      borderTop: '1px solid #e0dcd8',
      background: '#fff',
      padding: '10px 14px',
    }}>
      {/* Seletor de modo */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          onClick={() => setModo('texto')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 4, border: '1px solid',
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
            borderColor: !isAnotacao ? '#7a1e1e' : '#e0dcd8',
            background: !isAnotacao ? '#f0e8e8' : '#fff',
            color: !isAnotacao ? '#7a1e1e' : '#888480',
          }}
        >
          <Send size={11} />
          Mensagem
        </button>
        <button
          onClick={() => setModo('anotacao')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 4, border: '1px solid',
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
            borderColor: isAnotacao ? '#92400e' : '#e0dcd8',
            background: isAnotacao ? '#fef9c3' : '#fff',
            color: isAnotacao ? '#92400e' : '#888480',
          }}
        >
          <Lock size={11} />
          Nota interna
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAnotacao ? 'Nota interna (visível apenas para agentes)...' : 'Digite uma mensagem... (Enter para enviar)'}
          disabled={disabled}
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid',
            borderColor: isAnotacao ? '#fde047' : '#e0dcd8',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            fontFamily: 'DM Sans, sans-serif',
            outline: 'none',
            background: isAnotacao ? '#fefce8' : '#fff',
            lineHeight: 1.5,
          }}
        />
        <button
          type="submit"
          disabled={disabled || !texto.trim()}
          style={{
            width: 38, height: 38, borderRadius: 8,
            background: disabled || !texto.trim() ? '#e0dcd8' : (isAnotacao ? '#fde047' : '#7a1e1e'),
            border: 'none', cursor: disabled || !texto.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isAnotacao
            ? <Lock size={16} color="#92400e" />
            : <Send size={16} color={disabled || !texto.trim() ? '#888480' : '#fff'} />
          }
        </button>
      </form>
    </div>
  )
}
