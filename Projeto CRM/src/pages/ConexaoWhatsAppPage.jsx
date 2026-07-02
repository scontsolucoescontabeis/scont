import { useState } from 'react'
import { QrCode, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useWhatsAppConexao } from '@/hooks/useWhatsAppConexao'

const STATUS_LABEL = {
  DESCONECTADO: { label: 'Desconectado', color: '#b83232' },
  CONECTANDO:   { label: 'Conectando...', color: '#b87a00' },
  CONECTADO:    { label: 'Conectado', color: '#2d7a4f' },
}

export function resolverQrCodeSrc(qrcodeBase64) {
  if (!qrcodeBase64) return null
  return qrcodeBase64.startsWith('data:') ? qrcodeBase64 : `data:image/png;base64,${qrcodeBase64}`
}

export default function ConexaoWhatsAppPage() {
  const { config, loading, gerandoQr, erro, gerarQrCode, trocarCanal } = useWhatsAppConexao()
  const [confirmandoCanal, setConfirmandoCanal] = useState(null)

  if (loading || !config) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888480', fontSize: 13 }}>
        Carregando...
      </div>
    )
  }

  const status = STATUS_LABEL[config.status_conexao] || STATUS_LABEL.DESCONECTADO
  const qrSrc = resolverQrCodeSrc(config.qrcode_base64)

  const handleTrocarCanal = async (canal) => {
    if (canal === config.canal_ativo) return
    await trocarCanal(canal)
    setConfirmandoCanal(null)
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          Conexão WhatsApp
        </h1>
        <p style={{ fontSize: 12, color: '#888480', margin: '6px 0 0', lineHeight: 1.6 }}>
          Escolha como o CRM envia e recebe mensagens do WhatsApp: via QR Code (conexão temporária,
          enquanto a API oficial não está disponível) ou via API Oficial da Meta.
        </p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          Canal Ativo
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {['QR_CODE', 'API_OFICIAL'].map(canal => (
            <button
              key={canal}
              onClick={() => setConfirmandoCanal(canal)}
              disabled={canal === config.canal_ativo}
              style={{
                flex: 1,
                padding: '14px 16px',
                borderRadius: 8,
                border: canal === config.canal_ativo ? '2px solid #7a1e1e' : '1px solid #e0dcd8',
                background: canal === config.canal_ativo ? '#f0e8e8' : '#fff',
                color: canal === config.canal_ativo ? '#7a1e1e' : '#1a1a1a',
                fontWeight: 600,
                fontSize: 13,
                cursor: canal === config.canal_ativo ? 'default' : 'pointer',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {canal === 'QR_CODE' ? 'QR Code' : 'API Oficial'}
              {canal === config.canal_ativo && (
                <div style={{ fontSize: 10, fontWeight: 500, marginTop: 4 }}>Em uso agora</div>
              )}
            </button>
          ))}
        </div>

        {confirmandoCanal && (
          <div style={{ marginTop: 14, padding: 14, background: '#f7f6f4', borderRadius: 6, border: '1px solid #e0dcd8' }}>
            <p style={{ fontSize: 12, color: '#1a1a1a', margin: '0 0 10px' }}>
              Trocar para <strong>{confirmandoCanal === 'QR_CODE' ? 'QR Code' : 'API Oficial'}</strong>?
              Isso muda imediatamente por onde as próximas mensagens são enviadas.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleTrocarCanal(confirmandoCanal)}
                style={{ padding: '7px 16px', background: '#7a1e1e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmandoCanal(null)}
                style={{ padding: '7px 16px', background: 'none', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {config.canal_ativo === 'QR_CODE' ? (
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20,
            background: `${status.color}15`, color: status.color, fontSize: 12, fontWeight: 700, marginBottom: 16,
          }}>
            {config.status_conexao === 'CONECTADO' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {status.label}
          </div>

          {config.status_conexao === 'CONECTADO' ? (
            <p style={{ fontSize: 13, color: '#888480' }}>Sessão conectada. Nenhuma ação necessária.</p>
          ) : (
            <>
              {qrSrc && (
                <img
                  src={qrSrc}
                  alt="QR Code WhatsApp"
                  style={{ width: 220, height: 220, margin: '0 auto 16px', border: '1px solid #e0dcd8', borderRadius: 8, display: 'block' }}
                />
              )}
              <div>
                <button
                  onClick={gerarQrCode}
                  disabled={gerandoQr}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 20px', background: gerandoQr ? '#9b6b6b' : '#7a1e1e',
                    color: '#fff', border: 'none', borderRadius: 6,
                    fontSize: 13, fontWeight: 600, cursor: gerandoQr ? 'not-allowed' : 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {gerandoQr ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                  {gerandoQr ? 'Gerando...' : (qrSrc ? 'Atualizar QR Code' : 'Gerar QR Code')}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#888480', marginTop: 12 }}>
                Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho, e escaneie o código acima.
              </p>
            </>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: 20, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20,
            background: '#2d7a4f15', color: '#2d7a4f', fontSize: 12, fontWeight: 700,
          }}>
            <CheckCircle2 size={14} />
            Conectado via API Oficial
          </div>
          <p style={{ fontSize: 12, color: '#888480', marginTop: 12 }}>
            Mensagens são enviadas e recebidas pela Meta Cloud API, configurada nas variáveis WHATSAPP_*.
          </p>
        </div>
      )}

      {erro && (
        <div style={{ marginTop: 16, padding: '8px 14px', background: '#fff5f5', border: '1px solid #fde8e8', borderRadius: 6, color: '#b83232', fontSize: 12 }}>
          {erro}
        </div>
      )}
    </div>
  )
}
