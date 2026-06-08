import { useState, useEffect } from 'react'
import { ConversaList } from '@/components/ConversaList/ConversaList'
import { ChatPanel } from '@/components/ChatPanel/ChatPanel'
import { PainelDireito } from '@/components/PainelDireito/PainelDireito'
import { PainelSLA } from '@/components/PainelSLA/PainelSLA'
import { useConversas } from '@/hooks/useConversas'
import { useRealtime } from '@/hooks/useRealtime'
import { useSLA } from '@/hooks/useSLA'
import { buscarSLAConfig, buscarClassificacaoSLAConfig } from '@/services/crm.service'

export default function CRMPage({ perfil }) {
  const [conversaAtiva, setConversaAtiva] = useState(null)
  const [slaConfig, setSlaConfig]                             = useState([])
  const [classificacaoSLAConfig, setClassificacaoSLAConfig]   = useState([])

  useEffect(() => {
    buscarSLAConfig().then(setSlaConfig).catch(() => {})
    buscarClassificacaoSLAConfig().then(setClassificacaoSLAConfig).catch(() => {})
  }, [])

  // Conversas ABERTA independente de filtros — alimentam o PainelSLA.
  // RLS do Supabase garante que agentes só veem o próprio departamento.
  const { conversas: abertasParaSLA, refresh: refreshSLA } = useConversas({
    status: 'ABERTA',
    departamento: null,
    busca: '',
  })
  useRealtime({ onNovaMensagem: refreshSLA, onConversaAtualizada: refreshSLA })

  const abertasComSLA = useSLA(abertasParaSLA, slaConfig, classificacaoSLAConfig)
  const alertas       = abertasComSLA.filter(c => c.sla_status !== 'OK')

  const handleConversaAtualizada = (dadosAtualizados) => {
    if (conversaAtiva?.id === dadosAtualizados.id) {
      setConversaAtiva(prev => ({ ...prev, ...dadosAtualizados }))
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <ConversaList
        conversaAtiva={conversaAtiva}
        onSelecionarConversa={setConversaAtiva}
        perfilRole={perfil?.role}
        slaConfig={slaConfig}
        classificacaoSLAConfig={classificacaoSLAConfig}
      />
      <ChatPanel
        conversa={conversaAtiva}
        perfil={perfil}
        onConversaAtualizada={handleConversaAtualizada}
      />
      {/* Coluna direita: PainelSLA (condicional) + PainelDireito */}
      <div style={{
        width: 260,
        borderLeft: '1px solid #e0dcd8',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <PainelSLA alertas={alertas} />
        <PainelDireito conversa={conversaAtiva} />
      </div>
    </div>
  )
}
