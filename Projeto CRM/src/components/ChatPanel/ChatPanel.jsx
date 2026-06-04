import { useEffect, useRef, useState } from 'react'
import { UserCheck, ArrowRightLeft, XCircle, Tag } from 'lucide-react'
import { useMensagens } from '@/hooks/useMensagens'
import { useRealtime } from '@/hooks/useRealtime'
import { useWhatsApp } from '@/hooks/useWhatsApp'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { ModalTransferencia } from './ModalTransferencia'

const STATUS_LABELS = {
  ABERTA:         'Aberta',
  EM_ATENDIMENTO: 'Em Atendimento',
  AGUARDANDO:     'Aguardando',
  ENCERRADA:      'Encerrada',
}

export function ChatPanel({ conversa, perfil, onConversaAtualizada }) {
  const { timeline, loading, adicionarMensagem, adicionarAnotacao, refresh } = useMensagens(conversa?.id)
  const { sending, enviarMensagem, encerrarConversa, transferirConversa, assumirConversa, salvarAnotacao, marcarLidas } = useWhatsApp()
  const [mostrarModal, setMostrarModal] = useState(false)
  const [confirmandoEncerrar, setConfirmandoEncerrar] = useState(false)
  const endRef = useRef(null)

  useRealtime({
    onNovaMensagem: (msg) => {
      if (msg.conversa_id === conversa?.id) adicionarMensagem({ ...msg, _tipo: 'mensagem' })
    },
    onNovaAnotacao: (anotacao) => {
      if (anotacao.conversa_id === conversa?.id) adicionarAnotacao({ ...anotacao, _tipo: 'anotacao' })
    },
    onConversaAtualizada: (c) => {
      if (c.id === conversa?.id) onConversaAtualizada?.(c)
    },
  })

  useEffect(() => {
    if (conversa?.id) marcarLidas(conversa.id)
  }, [conversa?.id])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline.length])

  const handleEnviar = async (texto) => {
    const { error } = await enviarMensagem(conversa.id, texto)
    if (error) alert('Erro ao enviar mensagem: ' + error.message)
  }

  const handleAnotacao = async (texto) => {
    const { data, error } = await salvarAnotacao(conversa.id, texto)
    if (error) alert('Erro ao salvar nota: ' + error.message)
  }

  const handleAssumir = async () => {
    const { error } = await assumirConversa(conversa.id)
    if (!error) onConversaAtualizada?.({ ...conversa, status: 'EM_ATENDIMENTO', agente_id: perfil?.id })
  }

  const handleEncerrar = async () => {
    const { error } = await encerrarConversa(conversa.id)
    if (error) { alert('Erro: ' + error.message); return }
    setConfirmandoEncerrar(false)
    onConversaAtualizada?.({ ...conversa, status: 'ENCERRADA' })
  }

  const handleTransferir = async (paraDepto, paraAgenteId, motivo) => {
    const { error } = await transferirConversa(conversa.id, paraDepto, paraAgenteId, motivo)
    if (error) alert('Erro: ' + error.message)
    else refresh()
  }

  if (!conversa) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f6f4' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <p style={{ fontSize: 14, color: '#888480' }}>Selecione uma conversa para começar</p>
        </div>
      </div>
    )
  }

  const encerrada = conversa.status === 'ENCERRADA'
  const nomeContato = conversa.contatos?.nome || conversa.contatos?.telefone || '...'
  const podeAssumir = conversa.status === 'ABERTA' || conversa.status === 'AGUARDANDO'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#f7f6f4' }}>
      {/* Header do chat */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e0dcd8',
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{nomeContato}</div>
          <div style={{ fontSize: 11, color: '#888480', fontFamily: 'DM Mono, monospace' }}>
            {conversa.protocolo} · {STATUS_LABELS[conversa.status] ?? conversa.status}
            {conversa.usuarios?.nome && ` · ${conversa.usuarios.nome}`}
          </div>
        </div>

        {/* Ações da toolbar */}
        {!encerrada && (
          <div style={{ display: 'flex', gap: 6 }}>
            {podeAssumir && (
              <button onClick={handleAssumir} title="Assumir conversa"
                style={toolbarBtn('#2d7a4f', '#ECFDF5')}>
                <UserCheck size={14} /> Assumir
              </button>
            )}
            <button onClick={() => setMostrarModal(true)} title="Transferir"
              style={toolbarBtn('#1D4ED8', '#EFF6FF')}>
              <ArrowRightLeft size={14} /> Transferir
            </button>
            {!confirmandoEncerrar ? (
              <button onClick={() => setConfirmandoEncerrar(true)} title="Encerrar"
                style={toolbarBtn('#b83232', '#FEF2F2')}>
                <XCircle size={14} /> Encerrar
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#b83232', fontWeight: 500 }}>Confirmar?</span>
                <button onClick={handleEncerrar} style={toolbarBtn('#b83232', '#FEF2F2')}>Sim</button>
                <button onClick={() => setConfirmandoEncerrar(false)} style={toolbarBtn('#888480', '#F3F4F6')}>Não</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#888480', fontSize: 13 }}>Carregando mensagens...</div>
        ) : timeline.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#888480', fontSize: 13 }}>Nenhuma mensagem ainda</div>
        ) : (
          timeline.map((item, i) => <MessageBubble key={item.id ?? i} item={item} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      {!encerrada && (
        <InputBar
          onEnviar={handleEnviar}
          onAnotacao={handleAnotacao}
          disabled={sending}
        />
      )}

      {encerrada && (
        <div style={{ padding: 12, textAlign: 'center', background: '#f7f6f4', borderTop: '1px solid #e0dcd8' }}>
          <span style={{ fontSize: 12, color: '#888480', fontStyle: 'italic' }}>Conversa encerrada</span>
        </div>
      )}

      {mostrarModal && (
        <ModalTransferencia
          conversaId={conversa.id}
          deptoAtual={conversa.departamento}
          onConfirmar={handleTransferir}
          onFechar={() => setMostrarModal(false)}
        />
      )}
    </div>
  )
}

function toolbarBtn(color, bg) {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', borderRadius: 5, border: `1px solid ${color}20`,
    background: bg, color, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
  }
}
