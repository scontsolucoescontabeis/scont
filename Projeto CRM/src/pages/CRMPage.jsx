import { useState } from 'react'
import { ConversaList } from '@/components/ConversaList/ConversaList'
import { ChatPanel } from '@/components/ChatPanel/ChatPanel'
import { PainelDireito } from '@/components/PainelDireito/PainelDireito'

export default function CRMPage({ perfil }) {
  const [conversaAtiva, setConversaAtiva] = useState(null)

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
      />
      <ChatPanel
        conversa={conversaAtiva}
        perfil={perfil}
        onConversaAtualizada={handleConversaAtualizada}
      />
      <PainelDireito conversa={conversaAtiva} />
    </div>
  )
}
