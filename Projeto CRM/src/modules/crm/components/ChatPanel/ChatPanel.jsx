import { useEffect, useRef, useState } from 'react'
import { UserCheck, ArrowRightLeft, CheckCircle, Tag, X } from 'lucide-react'
import { MensagemBolha } from './MensagemBolha'
import { AnotacaoInterna } from './AnotacaoInterna'
import { InputBar } from './InputBar'
import { ModalTransferencia } from './ModalTransferencia'
import { BadgeDepartamento } from '../shared/BadgeDepartamento'
import { BadgeStatus } from '../shared/BadgeStatus'
import { Protocolo } from '../shared/Protocolo'
import { useMensagens } from '../../hooks/useMensagens'
import { useRealtimeMensagens } from '../../hooks/useRealtime'
import { useWhatsApp } from '../../hooks/useWhatsApp'
import { useCRM } from '../../contexts/CRMContext'
import {
  assumirConversa,
  marcarComoLida,
  salvarAnotacaoInterna,
  listarTags,
  adicionarTag,
  removerTag,
  listarTagsDaConversa,
} from '../../services/crm.service'

function ConfirmacaoEncerrar({ onConfirmar, onCancelar }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, padding: 28, width: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
          Encerrar conversa?
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888480', lineHeight: 1.5 }}>
          Isso enviará uma mensagem de encerramento ao cliente e marcará o atendimento como concluído.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancelar}
            style={{ padding: '8px 18px', border: '1px solid #e0dcd8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 6, background: '#b83232', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Encerrar
          </button>
        </div>
      </div>
    </div>
  )
}

export function ChatPanel() {
  const { conversaAtiva, selecionarConversa, perfil } = useCRM()
  const { timeline, loading, adicionarMensagem, adicionarAnotacao } = useMensagens(conversaAtiva?.id)
  const { enviarMensagem, encerrarConversa, transferirConversa, enviando, encerrando, transferindo } = useWhatsApp()
  const bottomRef       = useRef(null)
  const [modalTransf, setModalTransf] = useState(false)
  const [modalEncerrar, setModalEncerrar] = useState(false)
  const [tags, setTags]                 = useState([])
  const [tagsDaConversa, setTagsDaConversa] = useState([])
  const [showTags, setShowTags]         = useState(false)

  // Rola para o final ao carregar e ao receber novas mensagens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline.length])

  // Marca como lida ao abrir
  useEffect(() => {
    if (conversaAtiva?.id) {
      marcarComoLida(conversaAtiva.id).catch(() => {})
      listarTagsDaConversa(conversaAtiva.id).then(setTagsDaConversa).catch(() => {})
    }
  }, [conversaAtiva?.id])

  // Realtime — nova mensagem na conversa ativa
  useRealtimeMensagens(conversaAtiva?.id, (nova) => {
    adicionarMensagem(nova)
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  })

  // Tags
  useEffect(() => {
    if (showTags) listarTags().then(setTags).catch(() => {})
  }, [showTags])

  const handleEnviar = async (conteudo) => {
    try {
      const { mensagem } = await enviarMensagem(conversaAtiva.id, conteudo)
      if (mensagem) adicionarMensagem(mensagem)
    } catch (err) {
      alert('Erro ao enviar mensagem: ' + err.message)
    }
  }

  const handleAnotacao = async (conteudo) => {
    try {
      const anotacao = await salvarAnotacaoInterna(conversaAtiva.id, perfil.id, conteudo)
      adicionarAnotacao(anotacao)
    } catch (err) {
      alert('Erro ao salvar nota: ' + err.message)
    }
  }

  const handleAssumir = async () => {
    try {
      await assumirConversa(conversaAtiva.id, perfil.id)
      selecionarConversa({ ...conversaAtiva, agente_id: perfil.id, status: 'EM_ATENDIMENTO' })
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }

  const handleEncerrar = async () => {
    setModalEncerrar(false)
    try {
      await encerrarConversa(conversaAtiva.id)
      selecionarConversa({ ...conversaAtiva, status: 'ENCERRADA' })
    } catch (err) {
      alert('Erro ao encerrar: ' + err.message)
    }
  }

  const handleTransferir = async (paraDepartamento, paraAgenteId, motivo) => {
    try {
      await transferirConversa(conversaAtiva.id, paraDepartamento, paraAgenteId, motivo)
      setModalTransf(false)
      selecionarConversa({ ...conversaAtiva, departamento: paraDepartamento, status: paraAgenteId ? 'EM_ATENDIMENTO' : 'AGUARDANDO' })
    } catch (err) {
      alert('Erro ao transferir: ' + err.message)
    }
  }

  const handleToggleTag = async (tag) => {
    const jatem = tagsDaConversa.find(t => t.id === tag.id)
    if (jatem) {
      await removerTag(conversaAtiva.id, tag.id)
      setTagsDaConversa(prev => prev.filter(t => t.id !== tag.id))
    } else {
      await adicionarTag(conversaAtiva.id, tag.id)
      setTagsDaConversa(prev => [...prev, tag])
    }
  }

  // Estado vazio
  if (!conversaAtiva) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: '#888480', background: '#f7f6f4',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.2 }}>💬</div>
        <p style={{ fontSize: 14, margin: 0 }}>Selecione uma conversa para começar</p>
      </div>
    )
  }

  const encerrada = conversaAtiva.status === 'ENCERRADA'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar superior */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e0dcd8',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversaAtiva.contatos?.nome || conversaAtiva.contatos?.telefone || 'Desconhecido'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <BadgeDepartamento departamento={conversaAtiva.departamento} size="xs" />
            <BadgeStatus status={conversaAtiva.status} size="xs" />
            <Protocolo protocolo={conversaAtiva.protocolo} size="xs" />
          </div>
        </div>

        {/* Tags aplicadas */}
        {tagsDaConversa.map(tag => (
          <span key={tag.id} style={{
            background: tag.cor + '22',
            color: tag.cor,
            border: `1px solid ${tag.cor}44`,
            borderRadius: 9999,
            padding: '2px 8px',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {tag.nome}
            <X size={10} style={{ cursor: 'pointer' }} onClick={() => handleToggleTag(tag)} />
          </span>
        ))}

        {/* Botões de ação */}
        {!encerrada && (
          <>
            {!conversaAtiva.agente_id && (
              <BotaoAcao icon={<UserCheck size={14} />} label="Assumir" onClick={handleAssumir} />
            )}
            <BotaoAcao icon={<ArrowRightLeft size={14} />} label="Transferir" onClick={() => setModalTransf(true)} />
            <BotaoAcao icon={<CheckCircle size={14} />} label="Encerrar" onClick={() => setModalEncerrar(true)} danger />
          </>
        )}
        <BotaoAcao icon={<Tag size={14} />} label="Tags" onClick={() => setShowTags(s => !s)} active={showTags} />
      </div>

      {/* Painel de tags */}
      {showTags && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #e0dcd8', background: '#fafaf9', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map(tag => {
            const ativa = tagsDaConversa.find(t => t.id === tag.id)
            return (
              <button
                key={tag.id}
                onClick={() => handleToggleTag(tag)}
                style={{
                  background: ativa ? tag.cor : '#fff',
                  color: ativa ? '#fff' : tag.cor,
                  border: `1px solid ${tag.cor}`,
                  borderRadius: 9999,
                  padding: '3px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {tag.nome}
              </button>
            )
          })}
        </div>
      )}

      {/* Área de mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f7f6f4' }}>
        {loading && <div style={{ textAlign: 'center', color: '#888480', fontSize: 13 }}>Carregando...</div>}

        {timeline.map(item =>
          item._tipo === 'anotacao'
            ? <AnotacaoInterna key={`nota-${item.id}`} anotacao={item} />
            : <MensagemBolha key={`msg-${item.id}`} mensagem={item} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* InputBar */}
      {!encerrada && (
        <InputBar onEnviar={handleEnviar} onAnotacao={handleAnotacao} enviando={enviando} />
      )}
      {encerrada && (
        <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#888480', borderTop: '1px solid #e0dcd8', background: '#fafaf9' }}>
          Conversa encerrada
        </div>
      )}

      {/* Modais */}
      {modalEncerrar && (
        <ConfirmacaoEncerrar onConfirmar={handleEncerrar} onCancelar={() => setModalEncerrar(false)} />
      )}
      <ModalTransferencia
        aberto={modalTransf}
        onFechar={() => setModalTransf(false)}
        onConfirmar={handleTransferir}
        carregando={transferindo}
      />
    </div>
  )
}

function BotaoAcao({ icon, label, onClick, danger, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        border: `1px solid ${danger ? '#b83232' : active ? '#7a1e1e' : '#e0dcd8'}`,
        borderRadius: 6,
        background: danger ? '#b83232' : active ? '#f0e8e8' : '#fff',
        color: danger ? '#fff' : active ? '#7a1e1e' : '#1a1a1a',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'DM Sans, sans-serif',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
