import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL = 'https://graxaoomeffhsazuzkvg.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyYXhhb29tZWZmaHNhenV6a3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTUxMDUsImV4cCI6MjA5MDI5MTEwNX0.ZpbVoNVS4momTyf7NME4mcYuI4oCQUvNFSDbORCHktI'

# Email
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USER = os.getenv('SMTP_USER', 'seu-email@gmail.com')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', 'sua-senha-app')
EMAIL_REMETENTE = os.getenv('EMAIL_REMETENTE', 'noreply@scontdf.com.br')
NOME_REMETENTE = os.getenv('NOME_REMETENTE', 'Scont Soluções Contábeis')

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN', '')
TWILIO_WHATSAPP_NUMBER = os.getenv('TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886')

# Configurações da Aplicação
DOMAIN = os.getenv('DOMAIN', 'http://localhost:5000')
SECRET_KEY = os.getenv('SECRET_KEY', 'sua-chave-secreta-aqui')
DEBUG = os.getenv('DEBUG', 'False') == 'True'

# Configurações de CORS
CORS_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://seudominio.com.br'
]