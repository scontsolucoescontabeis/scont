# Sistema de Apuração de Folha de Ponto

Módulo do SCONT-RH para cálculo e gestão de ponto eletrônico.

## 🎯 Funcionalidades

- ✅ Autenticação com Supabase
- ✅ Registro de entrada/saída
- ✅ Cálculo automático de horas extras, noturnas e devidas
- ✅ Gerenciamento de feriados
- ✅ Salvamento automático
- ✅ Retomada de preenchimentos
- ✅ Exportação em CSV
- ✅ Log de alterações

## 🚀 Como Acessar

1. Acesse o hub principal: `https://herbertglj-leao.github.io/SCONT-RH/`
2. Clique em "Gestão de Ponto"
3. Faça login com suas credenciais
4. Comece a registrar ponto

## 🔧 Configuração

Edite `script.js` e substitua as credenciais Supabase:
```javascript
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_KEY = 'sua-chave-publica-aqui';