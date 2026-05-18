#!/usr/bin/env python3
"""
Setup script para instalar dependências e verificar ambiente
Uso: python setup.py
"""

import subprocess
import sys
import os
from pathlib import Path


def run_command(cmd, description=""):
    """Executa comando e retorna sucesso/falha"""
    try:
        if description:
            print(f"✓ {description}...")
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        return result.returncode == 0
    except Exception as e:
        print(f"  Erro: {e}")
        return False


def main():
    print("\n" + "="*60)
    print("  SETUP - Conversor PDF para Excel de Vencimentos")
    print("="*60 + "\n")
    
    # 1. Verifica Python
    print("1️⃣  Verificando Python...")
    py_version = sys.version_info
    if py_version.major < 3 or (py_version.major == 3 and py_version.minor < 7):
        print(f"   ❌ Python 3.7+ necessário. Você tem: {py_version.major}.{py_version.minor}")
        sys.exit(1)
    print(f"   ✓ Python {py_version.major}.{py_version.minor}.{py_version.micro} OK\n")
    
    # 2. Verifica pip
    print("2️⃣  Verificando pip...")
    if not run_command(f"{sys.executable} -m pip --version"):
        print("   ❌ pip não encontrado ou com erro")
        sys.exit(1)
    print("   ✓ pip OK\n")
    
    # 3. Instala/verifica dependências
    print("3️⃣  Instalando dependências...\n")
    
    dependencies = {
        "openpyxl": "Para criar arquivos Excel com formatação",
        "pypdf": "Para ler e extrair texto de PDFs",
    }
    
    for package, description in dependencies.items():
        print(f"   • {package}: {description}")
        cmd = f"{sys.executable} -m pip install {package} --quiet"
        
        if run_command(cmd):
            print(f"     ✓ {package} instalado\n")
        else:
            print(f"     ⚠️  Erro ao instalar {package}")
            print(f"     Tente manualmente: pip install {package}\n")
    
    # 4. Verifica arquivos necessários
    print("4️⃣  Verificando arquivos...\n")
    
    required_files = {
        "pdf_to_excel_vencimentos.py": "Script principal",
        "requirements.txt": "Arquivo de dependências",
    }
    
    script_dir = Path(__file__).parent
    
    for filename, description in required_files.items():
        filepath = script_dir / filename
        if filepath.exists():
            print(f"   ✓ {filename}: {description}")
        else:
            print(f"   ⚠️  {filename} não encontrado em {script_dir}")
    
    print()
    
    # 5. Verifica scripts shell (não essencial)
    print("5️⃣  Verificando scripts auxiliares...\n")
    
    shell_scripts = {
        "converter_vencimentos.sh": "macOS/Linux",
        "converter_vencimentos.bat": "Windows",
    }
    
    for filename, platform in shell_scripts.items():
        filepath = script_dir / filename
        if filepath.exists():
            print(f"   ✓ {filename} ({platform})")
            # Torna executável no Unix
            if filename.endswith(".sh"):
                os.chmod(filepath, 0o755)
        else:
            print(f"   ℹ️  {filename} não encontrado (opcional)")
    
    print()
    
    # 6. Resumo
    print("="*60)
    print("  ✅ SETUP CONCLUÍDO COM SUCESSO!")
    print("="*60 + "\n")
    
    print("📖 Próximos passos:\n")
    print("  1. Colocar seu arquivo PDF na mesma pasta dos scripts")
    print("  2. Executar um dos comandos abaixo:\n")
    print("     🐧 macOS/Linux:")
    print("        ./converter_vencimentos.sh seu_arquivo.pdf\n")
    print("     🪟 Windows:")
    print("        converter_vencimentos.bat seu_arquivo.pdf\n")
    print("     🐍 Python (qualquer SO):")
    print("        python pdf_to_excel_vencimentos.py seu_arquivo.pdf\n")
    
    print("📚 Para mais informações, leia: README.md\n")


if __name__ == "__main__":
    main()
