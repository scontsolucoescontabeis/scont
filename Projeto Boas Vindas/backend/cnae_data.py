# ===== DADOS CNAE =====
# Arquivo com estrutura de CNAEs para consulta

CNAE_DATA = {
    "0111-3/01": {
        "codigo": "0111-3/01",
        "atividade": "Cultivo de arroz",
        "secao": "A",
        "divisao": "01",
        "grupo": "01.1",
        "classe": "01.11-3"
    },
    "0111-3/02": {
        "codigo": "0111-3/02",
        "atividade": "Cultivo de milho",
        "secao": "A",
        "divisao": "01",
        "grupo": "01.1",
        "classe": "01.11-3"
    },
    "0111-3/03": {
        "codigo": "0111-3/03",
        "atividade": "Cultivo de trigo",
        "secao": "A",
        "divisao": "01",
        "grupo": "01.1",
        "classe": "01.11-3"
    },
    "6920-6/01": {
        "codigo": "6920-6/01",
        "atividade": "Atividades de contabilidade",
        "secao": "M",
        "divisao": "69",
        "grupo": "69.2",
        "classe": "69.20-6"
    },
    "6920-6/02": {
        "codigo": "6920-6/02",
        "atividade": "Atividades de consultoria e auditoria contábil e tributária",
        "secao": "M",
        "divisao": "69",
        "grupo": "69.2",
        "classe": "69.20-6"
    },
    "4711-3/01": {
        "codigo": "4711-3/01",
        "atividade": "Comércio varejista de mercadorias em geral, com predominância de produtos alimentares",
        "secao": "G",
        "divisao": "47",
        "grupo": "47.1",
        "classe": "47.11-3"
    },
    "5611-2/01": {
        "codigo": "5611-2/01",
        "atividade": "Restaurantes e similares",
        "secao": "I",
        "divisao": "56",
        "grupo": "56.1",
        "classe": "56.11-2"
    }
}

def obter_cnae(codigo):
    """Obtém informações de um CNAE específico"""
    return CNAE_DATA.get(codigo, None)

def buscar_cnaes(termo):
    """Busca CNAEs por termo na atividade"""
    termo_lower = termo.lower()
    resultados = []
    
    for codigo, dados in CNAE_DATA.items():
        if termo_lower in dados['atividade'].lower():
            resultados.append({
                'codigo': codigo,
                'atividade': dados['atividade']
            })
    
    return resultados

def listar_cnaes():
    """Lista todos os CNAEs disponíveis"""
    return [
        {
            'codigo': codigo,
            'atividade': dados['atividade']
        }
        for codigo, dados in CNAE_DATA.items()
    ]