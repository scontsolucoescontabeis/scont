"""
pdf_ferias.py — Extrai programação de férias de PDF multi-empresa e filtra por mês de competência.

Uso:
    python pdf_ferias.py <arquivo.pdf> [--mes MM/AAAA] [--empresa "NOME"] [--saida resultado.md]

Exemplos:
    python pdf_ferias.py ferias.pdf --mes 07/2026
    python pdf_ferias.py ferias.pdf --mes 07/2026 --empresa "ANANKE"
    python pdf_ferias.py ferias.pdf --saida ferias.md
"""

import argparse
import re
import sys
from datetime import date, datetime
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    sys.exit("Instale pdfplumber: pip install pdfplumber")


# ---------------------------------------------------------------------------
# Bandas de colunas (coordenadas X calibradas para o relatório SCONT)
# ---------------------------------------------------------------------------
COLS = [
    ("codigo",      0,    37),
    ("empregado",   37,   200),
    ("admissao",    200,  252),
    ("vencto",      252,  303),
    ("fer_venc",    303,  319),
    ("fer_pro",     319,  355),
    ("ini_aquis",   355,  415),
    ("fim_aquis",   415,  472),
    ("ini_gozo",    472,  525),
    ("dias_ferias", 525,  553),
    ("abono",       553,  582),
    ("decimo3",     582,  606),
    ("dir",         606,  628),
    ("goz",         628,  657),
    ("rest",        657,  676),
    ("limite_gozo", 676,  729),
    ("afast",       729,  755),
    ("faltas",      755,  820),
]

# Textos que identificam linhas de cabeçalho/rodapé a ignorar
SKIP_PATTERNS = re.compile(
    r"CNPJ:|Data base:|PROGRAMA|Empregado|admiss|Observa|Sistema|Total de|"
    r"C.digo|P.gina|Emiss|Horas|Vencto|In.cio|Limite|^Dias|Abono|aquisitivo|"
    r"gozo|afast|faltas|dir\.|goz\.|rest\.|pro\.|venc\.|Fer\.|Fim|13\°|^-+$"
)

# Texto que identifica linha com nome da empresa (cabeçalho de cada página)
COMPANY_PATTERN = re.compile(r"CNPJ:\s*[\d./]")


def _col_text(words, x_min, x_max):
    return " ".join(w["text"] for w in words if x_min <= w["x0"] < x_max).strip()


def _parse_date(text):
    """Converte dd/mm/aaaa em date, ou None."""
    text = text.strip()
    if re.match(r"\d{2}/\d{2}/\d{4}", text):
        try:
            return datetime.strptime(text[:10], "%d/%m/%Y").date()
        except ValueError:
            return None
    return None


def _clean(text):
    """Remove placeholders de campos vazios."""
    return re.sub(r"\.{4,}|/{6,}", "—", text).strip()


def extract_company_name(words):
    """Tenta extrair o nome da empresa a partir das palavras da linha de topo."""
    # Palavras ordenadas da esquerda para direita; para antes de 'Página:' (x0 > 600)
    name_parts = [w["text"] for w in sorted(words, key=lambda w: w["x0"]) if w["x0"] < 600]
    name = " ".join(name_parts).strip()
    # Normaliza encoding corrompido
    name = re.sub(r"[^\x20-\x7EÀ-ɏ]", "", name).strip()
    return name or "EMPRESA DESCONHECIDA"


def parse_pdf(pdf_path):
    """
    Lê o PDF e retorna dict: { nome_empresa: [lista de rows] }
    Cada row é um dict com as colunas + 'empresa' e linhas secundárias agrupadas.
    """
    empresas = {}
    empresa_atual = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words()

            # Agrupar palavras por linha com tolerância de 2px (evita fragmentar linhas)
            lines_raw = {}
            for w in words:
                top = w["top"]
                # Procura bucket existente dentro da tolerância
                key = next((k for k in lines_raw if abs(k - top) <= 2), None)
                if key is None:
                    key = top
                lines_raw.setdefault(key, []).append(w)

            page_empresa = None

            for y in sorted(lines_raw.keys()):
                row_words = sorted(lines_raw[y], key=lambda w: w["x0"])
                full_text = " ".join(w["text"] for w in row_words)

                # Detectar linha do nome da empresa (linha que precede o CNPJ)
                # O nome da empresa fica na mesma linha que "Página: X/Y"
                if re.search(r"P.gina:", full_text) and not re.search(r"PROGRAMA|admiss", full_text):
                    page_empresa = extract_company_name(row_words)
                    if page_empresa and page_empresa not in empresas:
                        empresas[page_empresa] = []
                    empresa_atual = page_empresa
                    continue

                # Ignorar linhas de cabeçalho/rodapé
                if SKIP_PATTERNS.search(full_text):
                    continue

                if not empresa_atual:
                    continue

                r = {name: _col_text(row_words, x0, x1) for name, x0, x1 in COLS}

                # Linha secundária (período extra de férias) — sem código, sem nome, mas com período aquisitivo
                if not r["codigo"] and not r["empregado"] and r["ini_aquis"]:
                    if empresas[empresa_atual]:
                        empresas[empresa_atual][-1].setdefault("periodos_extras", []).append(r)
                    continue

                # Linha inválida — sem código nem nome nem período
                if not r["empregado"] and not r["codigo"]:
                    continue

                r["empresa"] = empresa_atual
                r["periodos_extras"] = []
                empresas[empresa_atual].append(r)

    return empresas


def esta_de_ferias_no_mes(row, ano, mes):
    """
    Retorna True se o funcionário tem período de gozo que intersecta o mês dado.
    Verifica a linha principal e todas as linhas secundárias.
    """
    primeiro_dia = date(ano, mes, 1)
    # Último dia do mês
    if mes == 12:
        ultimo_dia = date(ano + 1, 1, 1)
    else:
        ultimo_dia = date(ano, mes + 1, 1)
    # Subtrai 1 dia
    from datetime import timedelta
    ultimo_dia = ultimo_dia - timedelta(days=1)

    def verifica(r):
        ini = _parse_date(r.get("ini_gozo", ""))
        dias_str = r.get("dias_ferias", "").replace("....", "").strip()
        if not ini or not dias_str:
            return False
        try:
            dias = float(dias_str.replace(",", "."))
        except ValueError:
            return False
        if dias <= 0:
            return False
        from datetime import timedelta
        fim = ini + timedelta(days=int(dias) - 1)
        # Intersecção: início <= último_dia E fim >= primeiro_dia
        return ini <= ultimo_dia and fim >= primeiro_dia

    if verifica(row):
        return True
    for extra in row.get("periodos_extras", []):
        if verifica(extra):
            return True
    return False


def formatar_tabela_md(rows, mes=None, ano=None):
    """Retorna string markdown com tabela de todos os funcionários.
    Se mes/ano informados, acrescenta coluna 'Ferias na Competencia'."""
    if not rows:
        return "_Nenhum funcionário cadastrado._\n"

    com_competencia = mes is not None and ano is not None

    cabecalho = ["Cod", "Empregado", "Admissao", "Vencto", "Ini Aquisitivo", "Fim Aquisitivo",
                 "Ini Gozo", "Dias", "Dir", "Goz", "Rest", "Limite Gozo"]
    chaves    = ["codigo", "empregado", "admissao", "vencto", "ini_aquis", "fim_aquis",
                 "ini_gozo", "dias_ferias", "dir", "goz", "rest", "limite_gozo"]

    if com_competencia:
        cabecalho = cabecalho + [f"Ferias {mes:02d}/{ano}"]

    linhas = ["| " + " | ".join(cabecalho) + " |",
              "| " + " | ".join(["---"] * len(cabecalho)) + " |"]

    for r in rows:
        vals = [_clean(r.get(k, "")) for k in chaves]

        if com_competencia:
            de_ferias = esta_de_ferias_no_mes(r, ano, mes)
            vals.append("SIM" if de_ferias else "nao")

        linhas.append("| " + " | ".join(vals) + " |")

        for extra in r.get("periodos_extras", []):
            vals_extra = ["+", ""] + [_clean(extra.get(k, "")) for k in chaves[2:]]
            if com_competencia:
                extra_row = {**extra, "periodos_extras": []}
                de_ferias_extra = esta_de_ferias_no_mes(extra_row, ano, mes)
                vals_extra.append("SIM" if de_ferias_extra else "nao")
            linhas.append("| " + " | ".join(vals_extra) + " |")

    return "\n".join(linhas) + "\n"


def gerar_relatorio(pdf_path, mes=None, ano=None, empresa_filtro=None, omitir_vazias=False):
    """Gera relatório markdown completo."""
    empresas = parse_pdf(pdf_path)

    titulo_mes = f" - Competencia {mes:02d}/{ano}" if mes and ano else ""
    saida = [f"# Programacao de Ferias{titulo_mes}\n"]
    saida.append(f"Fonte: `{Path(pdf_path).name}`\n")

    for nome_empresa, rows in empresas.items():
        if empresa_filtro and empresa_filtro.upper() not in nome_empresa.upper():
            continue

        if omitir_vazias and mes and ano:
            tem_ferias = any(esta_de_ferias_no_mes(r, ano, mes) for r in rows)
            if not tem_ferias:
                continue

        if omitir_vazias and not rows:
            continue

        saida.append(f"\n## {nome_empresa}\n")

        total = len(rows)
        if mes and ano:
            em_ferias = sum(1 for r in rows if esta_de_ferias_no_mes(r, ano, mes))
            saida.append(f"Total: {total} funcionarios | De ferias em {mes:02d}/{ano}: **{em_ferias}**\n")
        else:
            saida.append(f"Total: {total} funcionarios\n")

        saida.append(formatar_tabela_md(rows, mes, ano))

    return "\n".join(saida)


def main():
    parser = argparse.ArgumentParser(description="Extrai programação de férias de PDF SCONT")
    parser.add_argument("pdf", help="Arquivo PDF de entrada")
    parser.add_argument("--mes", help="Mês de competência (MM/AAAA)", default=None)
    parser.add_argument("--empresa", help="Filtrar por nome de empresa", default=None)
    parser.add_argument("--saida", help="Arquivo .md de saída (padrão: stdout)", default=None)
    parser.add_argument("--omitir-vazias", action="store_true", help="Ocultar empresas sem férias no período")
    args = parser.parse_args()

    mes, ano = None, None
    if args.mes:
        try:
            mes, ano = [int(x) for x in args.mes.split("/")]
        except ValueError:
            sys.exit("Formato de mês inválido. Use MM/AAAA")

    relatorio = gerar_relatorio(args.pdf, mes=mes, ano=ano, empresa_filtro=args.empresa, omitir_vazias=args.omitir_vazias)

    if args.saida:
        Path(args.saida).write_text(relatorio, encoding="utf-8")
        print(f"Salvo em: {args.saida}")
    else:
        print(relatorio)


if __name__ == "__main__":
    main()
