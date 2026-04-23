from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_ANON_KEY
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class SupabaseClient:
    def __init__(self):
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    # ===== APRESENTAÇÕES =====
    
    def criar_apresentacao(self, dados):
        """Cria uma nova apresentação no banco de dados"""
        try:
            id_unico = str(uuid.uuid4())
            
            apresentacao = {
                'id': id_unico,
                'razao_social': dados.get('razaoSocial'),
                'cnpj': dados.get('cnpj'),
                'inscricao': dados.get('inscricao'),
                'regime': dados.get('regime'),
                'porte': dados.get('porte'),
                'ramo': dados.get('ramo', ''),
                'nome_contato': dados.get('nomeContato'),
                'email_cliente': dados.get('emailCliente'),
                'telefone': dados.get('telefone', ''),
                'cargo': dados.get('cargo', ''),
                'mensagem': dados.get('mensagem', ''),
                'data_criacao': datetime.now().isoformat(),
                'ativo': True
            }
            
            response = self.client.table('apresentacoes').insert(apresentacao).execute()
            
            if response.data:
                logger.info(f'Apresentação criada: {id_unico}')
                return {
                    'sucesso': True,
                    'id': id_unico,
                    'dados': apresentacao
                }
            else:
                logger.error('Erro ao inserir apresentação no Supabase')
                return {
                    'sucesso': False,
                    'mensagem': 'Erro ao inserir apresentação'
                }
        
        except Exception as e:
            logger.error(f'Erro ao criar apresentação: {str(e)}', exc_info=True)
            return {
                'sucesso': False,
                'mensagem': f'Erro: {str(e)}'
            }
    
    def obter_apresentacao(self, id_apresentacao):
        """Obtém uma apresentação pelo ID"""
        try:
            response = self.client.table('apresentacoes').select('*').eq('id', id_apresentacao).execute()
            
            if response.data:
                logger.info(f'Apresentação obtida: {id_apresentacao}')
                return {
                    'sucesso': True,
                    'dados': response.data[0]
                }
            else:
                logger.warning(f'Apresentação não encontrada: {id_apresentacao}')
                return {
                    'sucesso': False,
                    'mensagem': 'Apresentação não encontrada'
                }
        
        except Exception as e:
            logger.error(f'Erro ao obter apresentação: {str(e)}', exc_info=True)
            return {
                'sucesso': False,
                'mensagem': f'Erro: {str(e)}'
            }
    
    def obter_historico(self, limite=50):
        """Obtém histórico de apresentações"""
        try:
            response = self.client.table('apresentacoes').select('*').order('data_criacao', desc=True).limit(limite).execute()
            
            logger.info(f'Histórico obtido: {len(response.data)} registros')
            return {
                'sucesso': True,
                'apresentacoes': response.data
            }
        
        except Exception as e:
            logger.error(f'Erro ao obter histórico: {str(e)}', exc_info=True)
            return {
                'sucesso': False,
                'mensagem': f'Erro: {str(e)}'
            }
    
    def atualizar_acesso(self, id_apresentacao):
        """Atualiza data e contador de acessos"""
        try:
            # Obter apresentação atual
            response = self.client.table('apresentacoes').select('acessos').eq('id', id_apresentacao).execute()
            
            if response.data:
                acessos_atuais = response.data[0].get('acessos', 0) or 0
                
                # Atualizar
                self.client.table('apresentacoes').update({
                    'data_acesso': datetime.now().isoformat(),
                    'acessos': acessos_atuais + 1
                }).eq('id', id_apresentacao).execute()
                
                logger.info(f'Acesso registrado: {id_apresentacao}')
                return {'sucesso': True}
            
            return {'sucesso': False}
        
        except Exception as e:
            logger.error(f'Erro ao atualizar acesso: {str(e)}', exc_info=True)
            return {'sucesso': False, 'mensagem': str(e)}
    
    # ===== LOGS DE ENVIO =====
    
    def registrar_log_envio(self, id_apresentacao, tipo_envio, status, mensagem):
        """Registra log de envio de notificações"""
        try:
            log = {
                'apresentacao_id': id_apresentacao,
                'tipo_envio': tipo_envio,  # 'email' ou 'whatsapp'
                'status': status,  # 'sucesso' ou 'erro'
                'mensagem': mensagem,
                'data_envio': datetime.now().isoformat()
            }
            
            response = self.client.table('logs_envio').insert(log).execute()
            
            if response.data:
                logger.info(f'Log registrado: {tipo_envio} - {status}')
                return {'sucesso': True}
            else:
                return {'sucesso': False}
        
        except Exception as e:
            logger.error(f'Erro ao registrar log: {str(e)}', exc_info=True)
            return {'sucesso': False, 'mensagem': str(e)}
    
    def obter_logs_envio(self, id_apresentacao):
        """Obtém histórico de envios de uma apresentação"""
        try:
            response = self.client.table('logs_envio').select('*').eq('apresentacao_id', id_apresentacao).order('data_envio', desc=True).execute()
            
            logger.info(f'Logs obtidos: {id_apresentacao}')
            return {
                'sucesso': True,
                'logs': response.data
            }
        
        except Exception as e:
            logger.error(f'Erro ao obter logs: {str(e)}', exc_info=True)
            return {
                'sucesso': False,
                'mensagem': f'Erro: {str(e)}'
            }
    
    # ===== CNAES =====
    
    def obter_cnaes_apresentacao(self, id_apresentacao):
        """Obtém CNAEs de uma apresentação"""
        try:
            response = self.client.table('apresentacao_cnaes').select('*').eq('apresentacao_id', id_apresentacao).execute()
            
            logger.info(f'CNAEs obtidos: {id_apresentacao}')
            return {
                'sucesso': True,
                'cnaes': response.data
            }
        
        except Exception as e:
            logger.error(f'Erro ao obter CNAEs: {str(e)}', exc_info=True)
            return {
                'sucesso': False,
                'mensagem': f'Erro: {str(e)}'
            }
    
    def adicionar_cnae_apresentacao(self, id_apresentacao, codigo_cnae, eh_principal=True):
        """Adiciona um CNAE à apresentação"""
        try:
            cnae_data = {
                'apresentacao_id': id_apresentacao,
                'codigo_cnae': codigo_cnae,
                'eh_principal': eh_principal,
                'data_adicao': datetime.now().isoformat()
            }
            
            response = self.client.table('apresentacao_cnaes').insert(cnae_data).execute()
            
            if response.data:
                logger.info(f'CNAE adicionado: {codigo_cnae} - {id_apresentacao}')
                return {'sucesso': True}
            else:
                return {'sucesso': False}
        
        except Exception as e:
            logger.error(f'Erro ao adicionar CNAE: {str(e)}', exc_info=True)
            return {'sucesso': False, 'mensagem': str(e)}
    
    def remover_cnae_apresentacao(self, id_apresentacao, codigo_cnae):
        """Remove um CNAE da apresentação"""
        try:
            self.client.table('apresentacao_cnaes').delete().eq('apresentacao_id', id_apresentacao).eq('codigo_cnae', codigo_cnae).execute()
            
            logger.info(f'CNAE removido: {codigo_cnae} - {id_apresentacao}')
            return {'sucesso': True}
        
        except Exception as e:
            logger.error(f'Erro ao remover CNAE: {str(e)}', exc_info=True)
            return {'sucesso': False, 'mensagem': str(e)}
    
    # ===== CONFIGURAÇÕES =====
    
    def obter_configuracoes(self):
        """Obtém configurações do sistema"""
        try:
            response = self.client.table('configuracoes').select('*').limit(1).execute()
            
            if response.data:
                logger.info('Configurações obtidas')
                return {
                    'sucesso': True,
                    'configuracoes': response.data[0]
                }
            else:
                return {
                    'sucesso': True,
                    'configuracoes': {}
                }
        
        except Exception as e:
            logger.error(f'Erro ao obter configurações: {str(e)}', exc_info=True)
            return {
                'sucesso': False,
                'mensagem': f'Erro: {str(e)}'
            }
    
    def salvar_configuracoes(self, dados):
        """Salva configurações do sistema"""
        try:
            # Verificar se já existe registro
            response = self.client.table('configuracoes').select('id').limit(1).execute()
            
            config = {
                'email_remetente': dados.get('emailRemetente'),
                'nome_remetente': dados.get('nomeRemetente'),
                'assunto_email': dados.get('assuntoEmail'),
                'data_atualizacao': datetime.now().isoformat()
            }
            
            if response.data:
                # Atualizar registro existente
                self.client.table('configuracoes').update(config).eq('id', response.data[0]['id']).execute()
                logger.info('Configurações atualizadas')
            else:
                # Inserir novo registro
                self.client.table('configuracoes').insert(config).execute()
                logger.info('Configurações criadas')
            
            return {
                'sucesso': True,
                'mensagem': 'Configurações salvas com sucesso'
            }
        
        except Exception as e:
            logger.error(f'Erro ao salvar configurações: {str(e)}', exc_info=True)
            return {
                'sucesso': False,
                'mensagem': f'Erro: {str(e)}'
            }
    
    # ===== ALÍQUOTAS (FUTURO) =====
    
    def obter_aliquota(self, codigo_cnae, porte, regime):
        """Obtém alíquota baseada em CNAE, porte e regime (FUTURO)"""
        try:
            # Implementação futura
            logger.info(f'Busca de alíquota: {codigo_cnae} - {porte} - {regime}')
            return {
                'sucesso': False,
                'mensagem': 'Alíquotas em breve'
            }
        
        except Exception as e:
            logger.error(f'Erro ao obter alíquota: {str(e)}', exc_info=True)
            return {
                'sucesso': False,
                'mensagem': f'Erro: {str(e)}'
            }
    
    def salvar_aliquota(self, codigo_cnae, porte, regime, aliquota):
        """Salva alíquota no banco (FUTURO)"""
        try:
            # Implementação futura
            logger.info(f'Alíquota salva: {codigo_cnae} - {aliquota}')
            return {
                'sucesso': False,
                'mensagem': 'Alíquotas em breve'
            }
        
        except Exception as e:
            logger.error(f'Erro ao salvar alíquota: {str(e)}', exc_info=True)
            return {
                'sucesso': False,
                'mensagem': f'Erro: {str(e)}'
            }
    
    # ===== UTILITÁRIOS =====
    
    def verificar_conexao(self):
        """Verifica se a conexão com Supabase está ativa"""
        try:
            response = self.client.table('apresentacoes').select('id').limit(1).execute()
            logger.info('Conexão Supabase OK')
            return {'sucesso': True, 'mensagem': 'Conexão ativa'}
        
        except Exception as e:
            logger.error(f'Erro de conexão Supabase: {str(e)}', exc_info=True)
            return {'sucesso': False, 'mensagem': f'Erro de conexão: {str(e)}'}

# ===== INSTÂNCIA GLOBAL =====
db = SupabaseClient()