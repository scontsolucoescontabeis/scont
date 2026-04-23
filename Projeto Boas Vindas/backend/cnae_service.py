import json
import logging

logger = logging.getLogger(__name__)

class CNAEService:
    """Serviço para gerenciar dados de CNAE"""
    
    def __init__(self):
        self.cnaes = self._carregar_cnaes()
    
    def _carregar_cnaes(self):
        """Carrega dados de CNAE do arquivo cnaes.txt"""
        try:
            cnaes_dict = {}
            
            # Ler arquivo cnaes.txt
            with open('cnaes.txt', 'r', encoding='utf-8') as f:
                conteudo = f.read()
            
            # Extrair dados entre window.CNAE_DATA = ` e `;
            inicio = conteudo.find('window.CNAE_DATA = `') + len('window.CNAE_DATA = `')
            fim = conteudo.find('`;', inicio)
            
            if inicio > -1 and fim > -1:
                dados_brutos = conteudo[inicio:fim]
                
                # Processar linhas
                linhas = dados_brutos.split('\n')
                
                for linha in linhas:
                    linha = linha.strip()
                    if not linha or linha.startswith('//'):
                        continue
                    
                    # Formato: ;;;;CODIGO;ATIVIDADE
                    partes = linha.split(';')
                    
                    if len(partes) >= 6:
                        codigo = partes[4].strip()
                        atividade = partes[5].strip().strip('"')
                        
                        if codigo and atividade and '/' in codigo:
                            cnaes_dict[codigo] = {
                                'codigo': codigo,
                                'atividade': atividade
                            }
                
                logger.info(f'Carregados {len(cnaes_dict)} CNAEs')
                return cnaes_dict
        
        except Exception as e:
            logger.error(f'Erro ao carregar CNAEs: {str(e)}', exc_info=True)
            return {}
    
    def buscar_cnaes(self, termo):
        """Busca CNAEs por termo (código ou atividade)"""
        if not termo or len(termo) < 2:
            return []
        
        termo_lower = termo.lower()
        resultados = []
        
        for codigo, dados in self.cnaes.items():
            if (termo_lower in codigo.lower() or 
                termo_lower in dados['atividade'].lower()):
                resultados.append({
                    'codigo': codigo,
                    'atividade': dados['atividade']
                })
        
        # Limitar a 20 resultados
        return resultados[:20]
    
    def obter_cnae(self, codigo):
        """Obtém informações de um CNAE específico"""
        return self.cnaes.get(codigo, None)
    
    def listar_todos(self):
        """Lista todos os CNAEs"""
        return list(self.cnaes.values())
    
    def validar_cnae(self, codigo):
        """Valida se um CNAE existe"""
        return codigo in self.cnaes

# Instância global
cnae_service = CNAEService()