import { CRMProvider } from '../contexts/CRMContext'
import { ConversaList } from '../components/ConversaList/ConversaList'
import { ChatPanel } from '../components/ChatPanel/ChatPanel'
import { PainelDireito } from '../components/PainelDireito/PainelDireito'

export function CRMPage() {
  return (
    <CRMProvider>
      <div style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        background: '#f2f2f0',
      }}>
        <ConversaList />
        <ChatPanel />
        <PainelDireito />
      </div>
    </CRMProvider>
  )
}
