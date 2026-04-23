from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from config import CORS_ORIGINS, SECRET_KEY, DEBUG, DOMAIN
from supabase_client import db
from notificacoes import NotificacaoService
import logging
import os
from datetime import datetime

# ===== CONFIGURAÇÃO DE LOGGING =====
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== INICIALIZAR FLASK =====
# Servir arquivos estáticos da raiz do projeto
app = Flask(__name__, static_folder='..', static_url_path='')
app.config['SECRET_KEY'] = SECRET_KEY
app.config['JSON_SORT_KEYS'] = False

# ===== CONFIGURAR CORS =====
CORS(app, resources={
    r"/api/*": {
        "origins": CORS_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# ===== ROTAS ESTÁTICAS =====

@app.route('/')
def index():
    """Serve index.html"""
    return send_from_directory('..', 'index.html')

@app.route('/admin/admin.html')
def admin():
    """Serve admin.html"""
    return send_from_directory('../admin', 'admin.html')

@app.route('/admin/<path:filename>')
def admin_static(filename):
    """Serve arquivos estáticos do admin (CSS, JS)"""
    return send_from_directory('../admin', filename)

@app.route('/<path:filename>')
def static_files(filename):
    """Serve arquivos estáticos (CSS, JS, imagens)"""
    return send_from_directory('..', filename)

# ===== ROTAS DE SAÚDE =====

@app.route('/api/health', methods=['GET'])
def health():
    """Verifica saúde da API"""
    try:
        return jsonify({
            'status': 'ok',
            'mensagem': 'API funcionando corretamente',
            'timestamp': datetime.now().isoformat(),
            'versao': '1.0.0'
        }), 200
    except Exception as e:
        logger.error(f'Erro em health check: {str(e)}')
        return jsonify({
            'status': 'erro',
            'mensagem': 'Erro ao verificar saúde da API'
        }), 500

# ===== ROTAS DE APRESENTAÇÕES =====

@app.route('/api/criar-apresentacao', methods=['POST'])
def criar_apresentacao():
    """
    Cria uma nova apresentação personalizada
    
    Body esperado:
    {
        "razaoSocial": "string",
        "cnpj": "string",
        "inscricao": "string",
        "regime": "string",
        "porte": "string",
        "ramo": "string",
        "nomeContato": "string",
        "emailCliente": "string",
        "telefone": "string",
        "cargo": "string",
        "mensagem": "string",
        "enviarEmail": boolean,
        "enviarWhatsApp": boolean
    }
    """
    try:
        dados = request.get_json()
        
        # ===== VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS =====
        campos_obrigatorios = [
            'razaoSocial',
            'cnpj',
            'nomeContato',
            'emailCliente'
        ]
        
        campos_faltantes = [campo for campo in campos_obrigatorios if not dados.get(campo)]
        
        if campos_faltantes:
            logger.warning(f'Campos obrigatórios faltando: {campos_faltantes}')
            return jsonify({
                'sucesso': False,
                'mensagem': f'Campos obrigatórios faltando: {", ".join(campos_faltantes)}'
            }), 400
        
        # ===== VALIDAÇÃO DE EMAIL =====
        email = dados.get('emailCliente', '').strip()
        if '@' not in email or '.' not in email:
            logger.warning(f'Email inválido: {email}')
            return jsonify({
                'sucesso': False,
                'mensagem': 'Email do cliente inválido'
            }), 400
        
        # ===== VALIDAÇÃO DE TELEFONE (SE WHATSAPP ATIVADO) =====
        enviar_whatsapp = dados.get('enviarWhatsApp', False)
        telefone = dados.get('telefone', '').strip()
        
        if enviar_whatsapp and not telefone:
            logger.warning('WhatsApp ativado mas telefone não fornecido')
            return jsonify({
                'sucesso': False,
                'mensagem': 'Telefone é obrigatório para envio via WhatsApp'
            }), 400
        
        # ===== CRIAR NO BANCO DE DADOS =====
        logger.info(f'Criando apresentação para: {dados.get("razaoSocial")}')
        resultado = db.criar_apresentacao(dados)
        
        if not resultado['sucesso']:
            logger.error(f'Erro ao criar apresentação: {resultado.get("mensagem")}')
            return jsonify(resultado), 400
        
        apresentacao = resultado['dados']
        id_apresentacao = resultado['id']
        
        # ===== GERAR LINK ÚNICO =====
        link_unico = f"{DOMAIN}/index.html?id={id_apresentacao}"
        
        logger.info(f'Apresentação criada com ID: {id_apresentacao}')
        
        # ===== ENVIAR NOTIFICAÇÕES =====
        enviar_email = dados.get('enviarEmail', True)
        
        logger.info(f'Enviando notificações - Email: {enviar_email}, WhatsApp: {enviar_whatsapp}')
        
        notificacoes = NotificacaoService.enviar_notificacoes(
            apresentacao,
            enviar_email=enviar_email,
            enviar_whatsapp=enviar_whatsapp
        )
        
        # ===== REGISTRAR ENVIOS NO BANCO =====
        if notificacoes.get('email', {}).get('sucesso'):
            db.registrar_log_envio(id_apresentacao, 'email', 'sucesso', 'Email enviado com sucesso')
            logger.info(f'Email enviado para: {email}')
        
        if notificacoes.get('whatsapp', {}).get('sucesso'):
            db.registrar_log_envio(id_apresentacao, 'whatsapp', 'sucesso', 'WhatsApp enviado com sucesso')
            logger.info(f'WhatsApp enviado para: {telefone}')
        
        # ===== RESPOSTA DE SUCESSO =====
        return jsonify({
            'sucesso': True,
            'id': id_apresentacao,
            'razaoSocial': apresentacao['razao_social'],
            'nomeContato': apresentacao['nome_contato'],
            'emailCliente': apresentacao['email_cliente'],
            'linkUnico': link_unico,
            'notificacoes': notificacoes,
            'mensagem': 'Apresentação criada e notificações enviadas com sucesso!'
        }), 201
    
    except ValueError as e:
        logger.error(f'Erro de validação: {str(e)}')
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro de validação: {str(e)}'
        }), 400
    
    except Exception as e:
        logger.error(f'Erro ao criar apresentação: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao criar apresentação: {str(e)}'
        }), 500

@app.route('/api/obter-apresentacao/<id_apresentacao>', methods=['GET'])
def obter_apresentacao(id_apresentacao):
    """
    Obtém dados de uma apresentação pelo ID
    
    Parâmetros:
    - id_apresentacao: UUID da apresentação
    """
    try:
        logger.info(f'Buscando apresentação: {id_apresentacao}')
        
        resultado = db.obter_apresentacao(id_apresentacao)
        
        if not resultado['sucesso']:
            logger.warning(f'Apresentação não encontrada: {id_apresentacao}')
            return jsonify(resultado), 404
        
        # ===== ATUALIZAR ACESSO =====
        db.atualizar_acesso(id_apresentacao)
        logger.info(f'Acesso registrado para apresentação: {id_apresentacao}')
        
        return jsonify({
            'sucesso': True,
            'dados': resultado['dados']
        }), 200
    
    except Exception as e:
        logger.error(f'Erro ao obter apresentação: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao obter apresentação: {str(e)}'
        }), 500

@app.route('/api/historico', methods=['GET'])
def obter_historico():
    """
    Obtém histórico de apresentações criadas
    
    Parâmetros de query:
    - limite: número máximo de registros (padrão: 50)
    """
    try:
        limite = request.args.get('limite', 50, type=int)
        
        # Validar limite
        if limite < 1 or limite > 500:
            limite = 50
        
        logger.info(f'Buscando histórico com limite: {limite}')
        
        resultado = db.obter_historico(limite)
        
        return jsonify(resultado), 200
    
    except Exception as e:
        logger.error(f'Erro ao obter histórico: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao obter histórico: {str(e)}'
        }), 500

@app.route('/api/reenviar-notificacoes/<id_apresentacao>', methods=['POST'])
def reenviar_notificacoes(id_apresentacao):
    """
    Reenvia notificações para uma apresentação existente
    
    Body esperado:
    {
        "email": boolean,
        "whatsapp": boolean
    }
    """
    try:
        dados_request = request.get_json() or {}
        
        logger.info(f'Reenviando notificações para: {id_apresentacao}')
        
        # ===== OBTER APRESENTAÇÃO =====
        resultado = db.obter_apresentacao(id_apresentacao)
        
        if not resultado['sucesso']:
            logger.warning(f'Apresentação não encontrada: {id_apresentacao}')
            return jsonify(resultado), 404
        
        apresentacao = resultado['dados']
        
        # ===== REENVIAR NOTIFICAÇÕES =====
        notificacoes = NotificacaoService.enviar_notificacoes(
            apresentacao,
            enviar_email=dados_request.get('email', True),
            enviar_whatsapp=dados_request.get('whatsapp', False)
        )
        
        # ===== REGISTRAR ENVIOS =====
        if notificacoes.get('email', {}).get('sucesso'):
            db.registrar_log_envio(id_apresentacao, 'email', 'sucesso', 'Email reenviado')
        
        if notificacoes.get('whatsapp', {}).get('sucesso'):
            db.registrar_log_envio(id_apresentacao, 'whatsapp', 'sucesso', 'WhatsApp reenviado')
        
        logger.info(f'Notificações reenviadas para: {id_apresentacao}')
        
        return jsonify({
            'sucesso': True,
            'notificacoes': notificacoes,
            'mensagem': 'Notificações reenviadas com sucesso'
        }), 200
    
    except Exception as e:
        logger.error(f'Erro ao reenviar notificações: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao reenviar notificações: {str(e)}'
        }), 500

@app.route('/api/obter-historico-detalhado/<id_apresentacao>', methods=['GET'])
def obter_historico_detalhado(id_apresentacao):
    """
    Obtém histórico detalhado de envios de uma apresentação
    """
    try:
        logger.info(f'Buscando histórico detalhado: {id_apresentacao}')
        
        resultado = db.obter_logs_envio(id_apresentacao)
        
        return jsonify(resultado), 200
    
    except Exception as e:
        logger.error(f'Erro ao obter histórico detalhado: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao obter histórico detalhado: {str(e)}'
        }), 500

# ===== ROTAS DE CNAE =====

@app.route('/api/buscar-cnaes', methods=['GET'])
def buscar_cnaes():
    """Busca CNAEs por termo"""
    try:
        termo = request.args.get('termo', '', type=str)
        
        if not termo or len(termo) < 2:
            return jsonify({
                'sucesso': False,
                'mensagem': 'Digite pelo menos 2 caracteres'
            }), 400
        
        from cnae_service import cnae_service
        resultados = cnae_service.buscar_cnaes(termo)
        
        logger.info(f'Busca CNAE: {termo} - {len(resultados)} resultados')
        
        return jsonify({
            'sucesso': True,
            'resultados': resultados
        }), 200
    
    except Exception as e:
        logger.error(f'Erro ao buscar CNAEs: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao buscar CNAEs: {str(e)}'
        }), 500

@app.route('/api/obter-cnae/<codigo_cnae>', methods=['GET'])
def obter_cnae(codigo_cnae):
    """Obtém informações de um CNAE específico"""
    try:
        from cnae_service import cnae_service
        cnae = cnae_service.obter_cnae(codigo_cnae)
        
        if cnae:
            return jsonify({
                'sucesso': True,
                'cnae': cnae
            }), 200
        else:
            return jsonify({
                'sucesso': False,
                'mensagem': 'CNAE não encontrado'
            }), 404
    
    except Exception as e:
        logger.error(f'Erro ao obter CNAE: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao obter CNAE: {str(e)}'
        }), 500

@app.route('/api/listar-cnaes', methods=['GET'])
def listar_cnaes():
    """Lista todos os CNAEs (com paginação)"""
    try:
        pagina = request.args.get('pagina', 1, type=int)
        limite = request.args.get('limite', 50, type=int)
        
        from cnae_service import cnae_service
        todos_cnaes = cnae_service.listar_todos()
        
        # Paginação
        inicio = (pagina - 1) * limite
        fim = inicio + limite
        cnaes_paginados = todos_cnaes[inicio:fim]
        
        return jsonify({
            'sucesso': True,
            'cnaes': cnaes_paginados,
            'total': len(todos_cnaes),
            'pagina': pagina,
            'limite': limite
        }), 200
    
    except Exception as e:
        logger.error(f'Erro ao listar CNAEs: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao listar CNAEs: {str(e)}'
        }), 500

@app.route('/api/validar-cnae/<codigo_cnae>', methods=['GET'])
def validar_cnae(codigo_cnae):
    """Valida se um CNAE existe"""
    try:
        from cnae_service import cnae_service
        valido = cnae_service.validar_cnae(codigo_cnae)
        
        return jsonify({
            'sucesso': True,
            'valido': valido
        }), 200
    
    except Exception as e:
        logger.error(f'Erro ao validar CNAE: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao validar CNAE: {str(e)}'
        }), 500

# ===== ROTAS DE CONFIGURAÇÕES =====

@app.route('/api/obter-configuracoes', methods=['GET'])
def obter_configuracoes():
    """Obtém configurações do sistema"""
    try:
        resultado = db.obter_configuracoes()
        return jsonify(resultado), 200
    
    except Exception as e:
        logger.error(f'Erro ao obter configurações: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao obter configurações: {str(e)}'
        }), 500

@app.route('/api/salvar-configuracoes', methods=['POST'])
def salvar_configuracoes():
    """Salva configurações do sistema"""
    try:
        dados = request.get_json()
        
        logger.info('Salvando configurações do sistema')
        
        resultado = db.salvar_configuracoes(dados)
        
        return jsonify(resultado), 200
    
    except Exception as e:
        logger.error(f'Erro ao salvar configurações: {str(e)}', exc_info=True)
        return jsonify({
            'sucesso': False,
            'mensagem': f'Erro ao salvar configurações: {str(e)}'
        }), 500

# ===== TRATAMENTO DE ERROS =====

@app.errorhandler(404)
def not_found(error):
    """Rota não encontrada"""
    return jsonify({
        'sucesso': False,
        'mensagem': 'Rota não encontrada',
        'status': 404
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    """Método não permitido"""
    return jsonify({
        'sucesso': False,
        'mensagem': 'Método HTTP não permitido',
        'status': 405
    }), 405

@app.errorhandler(500)
def internal_error(error):
    """Erro interno do servidor"""
    logger.error(f'Erro interno: {str(error)}', exc_info=True)
    return jsonify({
        'sucesso': False,
        'mensagem': 'Erro interno do servidor',
        'status': 500
    }), 500

# ===== MIDDLEWARE DE LOGGING =====

@app.before_request
def log_request():
    """Log de requisições"""
    logger.info(f'{request.method} {request.path} - IP: {request.remote_addr}')

@app.after_request
def log_response(response):
    """Log de respostas"""
    logger.info(f'Response: {response.status_code}')
    return response

# ===== INICIAR SERVIDOR =====

if __name__ == '__main__':
    logger.info('Iniciando servidor Scont API')
    logger.info(f'DEBUG: {DEBUG}')
    logger.info(f'DOMAIN: {DOMAIN}')
    logger.info(f'CORS_ORIGINS: {CORS_ORIGINS}')
    
    app.run(
        debug=DEBUG,
        host='0.0.0.0',
        port=5000,
        threaded=True
    )