import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import (
    SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
    EMAIL_REMETENTE, NOME_REMETENTE, DOMAIN,
    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
)
from twilio.rest import Client as TwilioClient

class NotificacaoService:
    
    @staticmethod
    def enviar_email(email_destinatario, nome_cliente, empresa, link_apresentacao):
        """Envia email com link da apresentação"""
        try:
            # Criar mensagem
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f'Sua Apresentação Personalizada - {empresa}'
            msg['From'] = f'{NOME_REMETENTE} <{EMAIL_REMETENTE}>'
            msg['To'] = email_destinatario
            
            # HTML do email
            html = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', Arial, sans-serif; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ 
                        background: linear-gradient(135deg, #6b3e3e 0%, #4a2a2a 100%);
                        color: white;
                        padding: 30px;
                        border-radius: 8px 8px 0 0;
                        text-align: center;
                    }}
                    .content {{ 
                        background: #f9fafb;
                        padding: 30px;
                        border-radius: 0 0 8px 8px;
                    }}
                    .button {{
                        display: inline-block;
                        background: linear-gradient(135deg, #6b3e3e 0%, #4a2a2a 100%);
                        color: white;
                        padding: 14px 28px;
                        text-decoration: none;
                        border-radius: 6px;
                        margin: 20px 0;
                        font-weight: 600;
                    }}
                    .button:hover {{ opacity: 0.9; }}
                    .footer {{
                        margin-top: 30px;
                        font-size: 12px;
                        color: #999;
                        border-top: 1px solid #ddd;
                        padding-top: 20px;
                    }}
                    .info-box {{
                        background: white;
                        padding: 15px;
                        border-radius: 6px;
                        margin: 15px 0;
                        border-left: 4px solid #d4a574;
                    }}
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1>🎯 Bem-vindo à Scont</h1>
                        <p>Soluções Contábeis Completas</p>
                    </div>
                    
                    <div class='content'>
                        <p>Olá <strong>{nome_cliente}</strong>,</p>
                        
                        <p>Preparamos uma apresentação personalizada especialmente para <strong>{empresa}</strong> com todas as informações sobre nossos serviços contábeis, fiscais, trabalhistas e societários.</p>
                        
                        <div class='info-box'>
                            <strong>✓ Apresentação Personalizada</strong>
                            <p>Todos os dados da sua empresa já estão preenchidos. Basta visualizar!</p>
                        </div>
                        
                        <p style='text-align: center;'>
                            <a href='{link_apresentacao}' class='button'>
                                📄 Visualizar Apresentação
                            </a>
                        </p>
                        
                        <p><strong>Ou copie este link:</strong></p>
                        <div class='info-box' style='word-break: break-all; font-family: monospace; font-size: 12px;'>
                            {link_apresentacao}
                        </div>
                        
                        <h3>Nossos Departamentos:</h3>
                        <ul>
                            <li><strong>Fiscal:</strong> fiscal@scontdf.com.br</li>
                            <li><strong>Pessoal:</strong> pessoal@scontdf.com.br</li>
                            <li><strong>Contábil:</strong> contabil@scontdf.com.br</li>
                            <li><strong>Administrativo:</strong> contato@scontdf.com.br</li>
                        </ul>
                        
                        <p>Se tiver dúvidas, entre em contato conosco!</p>
                        
                        <p>Atenciosamente,<br><strong>Equipe Scont Soluções Contábeis</strong></p>
                    </div>
                    
                    <div class='footer'>
                        <p>&copy; 2026 Scont Soluções Contábeis. Todos os direitos reservados.</p>
                        <p>Este é um email automático. Não responda diretamente.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Anexar HTML
            msg.attach(MIMEText(html, 'html'))
            
            # Enviar
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
            
            return {'sucesso': True, 'mensagem': 'Email enviado com sucesso'}
        
        except Exception as e:
            return {'sucesso': False, 'mensagem': f'Erro ao enviar email: {str(e)}'}
    
    @staticmethod
    def enviar_whatsapp(telefone, nome_cliente, empresa, link_apresentacao):
        """Envia link via WhatsApp usando Twilio"""
        try:
            if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
                return {'sucesso': False, 'mensagem': 'WhatsApp não configurado'}
            
            client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            
            # Formatar telefone para WhatsApp
            if not telefone.startswith('whatsapp:'):
                telefone = f'whatsapp:+55{telefone.replace(" ", "").replace("-", "")}'
            
            mensagem = f"""
Olá {nome_cliente}! 👋

Preparamos uma apresentação personalizada para {empresa} com todos os detalhes sobre nossos serviços.

Clique no link abaixo para visualizar:
{link_apresentacao}

Qualquer dúvida, estamos à disposição! 😊

Scont Soluções Contábeis
            """
            
            message = client.messages.create(
                from_=TWILIO_WHATSAPP_NUMBER,
                body=mensagem,
                to=telefone
            )
            
            return {'sucesso': True, 'mensagem': 'WhatsApp enviado com sucesso', 'sid': message.sid}
        
        except Exception as e:
            return {'sucesso': False, 'mensagem': f'Erro ao enviar WhatsApp: {str(e)}'}
    
    @staticmethod
    def enviar_notificacoes(dados_apresentacao, enviar_email=True, enviar_whatsapp=True):
        """Envia email e/ou WhatsApp"""
        resultados = {}
        
        link = f"{DOMAIN}/index.html?id={dados_apresentacao['id']}"
        
        if enviar_email:
            resultados['email'] = NotificacaoService.enviar_email(
                dados_apresentacao['email_cliente'],
                dados_apresentacao['nome_contato'],
                dados_apresentacao['razao_social'],
                link
            )
        
        if enviar_whatsapp and dados_apresentacao.get('telefone'):
            resultados['whatsapp'] = NotificacaoService.enviar_whatsapp(
                dados_apresentacao['telefone'],
                dados_apresentacao['nome_contato'],
                dados_apresentacao['razao_social'],
                link
            )
        
        return resultados