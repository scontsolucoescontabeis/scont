#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gestta_chat_extractor.py
========================================
Extrai mensagens das conversas Pendentes e Em Atendimento
do Gestta Messenger e salva de forma INCREMENTAL em:
  Desktop/atendimentos/atendimentos.txt

INSTALAÇÃO (primeira vez):
  pip install selenium webdriver-manager

EXECUÇÃO MANUAL:
  python gestta_chat_extractor.py

AGENDAMENTO AUTOMÁTICO (Windows Task Scheduler):
  Programa : python
  Argumentos: "C:\Users\SEU_USUARIO\Desktop\atendimentos\gestta_chat_extractor.py"
  Disparar  : A cada 5 minutos
========================================
"""

import time
import re
import os
from datetime import datetime
from pathlib import Path

# pip install selenium webdriver-manager
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

# ════════════════════════════════════════════════
#  CONFIGURAÇÕES
# ════════════════════════════════════════════════
GESTTA_URL    = "https://app.gestta.com.br/attendance/#/chat/pending"
WAIT_TIMEOUT  = 15    # segundos para aguardar elementos
PAGE_LOAD_WAIT = 2.5  # pausa após abrir cada conversa (seg)

OUTPUT_DIR  = Path.home() / "Desktop" / "atendimentos"
OUTPUT_FILE = OUTPUT_DIR / "atendimentos.txt"

# Seletores CSS (inspecionados em 21/05/2026 – atualizar se o site mudar)
SEL_TAB          = ".c-dHEioN"          # abas: Pendentes / Em atendimento
SEL_CONV_ITEM    = ".sc-kbFRbL.sc-ABqPz"  # item de conversa na lista
SEL_MSG_BLOCK    = ".sc-cHijrb"         # container de cada mensagem
SEL_MSG_TEXT     = ".sc-flJqrB"         # texto da mensagem
SEL_MSG_TIME     = ".sc-bJFmQb"         # timestamp da mensagem
SEL_SENDER_INIT  = ".sc-fcSHUR"         # elemento com iniciais do remetente
CLASS_RECEIVED   = "kYXnxI"             # classe = mensagem do CLIENTE
CLASS_SENT       = "feNlRi"             # classe = mensagem do ATENDENTE


# ════════════════════════════════════════════════
#  FUNÇÕES AUXILIARES
# ════════════════════════════════════════════════

def ensure_dir():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_seen_lines():
    """Retorna (set_de_linhas_salvas, lista_de_linhas_salvas)."""
    if not OUTPUT_FILE.exists():
        return set(), []
    lines = OUTPUT_FILE.read_text(encoding="utf-8").splitlines()
    seen = {l.strip() for l in lines if l.strip()}
    return seen, lines


def append_to_file(existing_lines: list, new_lines: list):
    """Sobrescreve o arquivo mantendo histórico + novas mensagens."""
    ensure_dir()
    separator = f"\n--- Atualizado em {datetime.now().strftime('%d/%m/%Y %H:%M:%S')} ---"
    all_lines = existing_lines + [separator] + new_lines
    OUTPUT_FILE.write_text("\n".join(all_lines), encoding="utf-8")
    print(f"  ✓ {len(new_lines)} nova(s) mensagem(ns) salva(s) → {OUTPUT_FILE}")


def build_driver():
    """Cria driver Chrome reutilizando o perfil do usuário (mantém sessão/login)."""
    opts = Options()
    # ── Modo visível ou headless ──────────────────────────────────────────
    # Para rodar em segundo plano, descomente a linha abaixo:
    # opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    # ── Reutilizar perfil Chrome para manter login ────────────────────────
    user_data = Path.home() / "AppData" / "Local" / "Google" / "Chrome" / "User Data"
    if user_data.exists():
        opts.add_argument(f"--user-data-dir={user_data}")
        opts.add_argument("--profile-directory=Default")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)
    driver.implicitly_wait(3)
    return driver


def wait_for(driver, selector, timeout=WAIT_TIMEOUT):
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
    )


def wait_for_all(driver, selector, timeout=WAIT_TIMEOUT):
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_all_elements_located((By.CSS_SELECTOR, selector))
    )


def click_tab(driver, tab_keyword: str) -> bool:
    """Clica na aba cujo texto contém tab_keyword."""
    try:
        tabs = driver.find_elements(By.CSS_SELECTOR, SEL_TAB)
        for tab in tabs:
            if tab_keyword.lower() in tab.text.lower():
                tab.click()
                time.sleep(1.5)
                return True
    except Exception:
        pass
    return False


def get_conv_name(item_el) -> str:
    """Extrai nome do cliente a partir do elemento da lista de conversas."""
    try:
        raw = item_el.text or ""
        lines = [l.strip() for l in raw.split("\n")
                 if l.strip() and l.strip() != "--"]
        if not lines:
            return "Desconhecido"
        # Se a 1ª linha são iniciais (<=3 chars maiúsculos), nome é a 2ª linha
        if len(lines) >= 2 and len(lines[0]) <= 3 and lines[0].upper() == lines[0]:
            return lines[1]
        return lines[0]
    except Exception:
        return "Desconhecido"


def extract_messages(driver, conv_name: str) -> list:
    """
    Extrai mensagens da conversa aberta.
    Retorna lista de dicts: {conv, timestamp, sender, text}
    """
    try:
        wait_for(driver, SEL_MSG_BLOCK, timeout=10)
    except TimeoutException:
        return []

    messages = []
    blocks = driver.find_elements(By.CSS_SELECTOR, SEL_MSG_BLOCK)

    for block in blocks:
        try:
            block_class = block.get_attribute("class") or ""

            # ── Determinar quem enviou ────────────────────────────────────
            if CLASS_RECEIVED in block_class:
                base_sender = "CLIENTE"
            elif CLASS_SENT in block_class:
                base_sender = "ATENDENTE"
            else:
                continue  # evento de sistema (transferência, conclusão, etc.)

            # Nome completo via atributo title do container das iniciais
            sender_name = base_sender
            try:
                init_el = block.find_element(By.CSS_SELECTOR, SEL_SENDER_INIT)
                parent_el = init_el.find_element(By.XPATH, "..")
                title = parent_el.get_attribute("title") or ""
                if title:
                    sender_name = f"{base_sender} ({title})"
            except NoSuchElementException:
                pass

            # ── Texto ─────────────────────────────────────────────────────
            text = "[Arquivo/Mídia]"
            try:
                txt_el = block.find_element(By.CSS_SELECTOR, SEL_MSG_TEXT)
                raw = txt_el.text.strip()
                if raw:
                    text = raw.replace("\n", " | ")
            except NoSuchElementException:
                pass

            # ── Timestamp ────────────────────────────────────────────────
            timestamp = datetime.now().strftime("%d/%m/%Y - %H:%M")
            try:
                t_el = block.find_element(By.CSS_SELECTOR, SEL_MSG_TIME)
                ts = t_el.text.strip()
                if ts:
                    timestamp = ts
            except NoSuchElementException:
                pass

            messages.append({
                "conv"     : conv_name,
                "timestamp": timestamp,
                "sender"   : sender_name,
                "text"     : text,
            })

        except Exception:
            continue

    return messages


def format_line(msg: dict) -> str:
    """Formata uma mensagem como linha de texto."""
    return f"[{msg['timestamp']}] [{msg['conv']}] {msg['sender']}: {msg['text']}"


def process_tab(driver, tab_keyword: str, seen: set) -> list:
    """
    Abre a aba, itera pelas conversas e retorna linhas novas.
    """
    label = "Pendentes" if "pend" in tab_keyword.lower() else "Em atendimento"
    print(f"\n{'═'*50}")
    print(f"  Aba: {label}")
    print(f"{'═'*50}")

    new_lines = []

    if not click_tab(driver, tab_keyword):
        print(f"  ⚠ Aba '{tab_keyword}' não encontrada!")
        return new_lines

    try:
        conv_items = wait_for_all(driver, SEL_CONV_ITEM, timeout=10)
    except TimeoutException:
        print("  ⚠ Nenhuma conversa encontrada nesta aba.")
        return new_lines

    # Coletar nomes antes de clicar (evitar StaleElementReferenceException)
    names = [get_conv_name(item) for item in conv_items]
    print(f"  Conversas encontradas: {len(names)}")

    for idx, name in enumerate(names):
        print(f"  [{idx+1}/{len(names)}] {name} ...", end=" ", flush=True)
        try:
            # Re-buscar para evitar stale reference
            items = driver.find_elements(By.CSS_SELECTOR, SEL_CONV_ITEM)
            if idx >= len(items):
                print("⚠ item não encontrado")
                continue

            items[idx].click()
            time.sleep(PAGE_LOAD_WAIT)

            msgs = extract_messages(driver, name)
            added = 0
            for msg in msgs:
                line = format_line(msg)
                if line not in seen:
                    seen.add(line)
                    new_lines.append(line)
                    added += 1

            print(f"{len(msgs)} msgs, {added} nova(s)")

        except Exception as e:
            print(f"ERRO: {e}")

    return new_lines


# ════════════════════════════════════════════════
#  ENTRY POINT
# ════════════════════════════════════════════════

def main():
    start = datetime.now()
    print("\n" + "═"*60)
    print(f"  GESTTA CHAT EXTRACTOR  |  {start.strftime('%d/%m/%Y %H:%M:%S')}")
    print("═"*60)

    ensure_dir()
    seen, existing_lines = load_seen_lines()
    print(f"  Mensagens já no arquivo: {len(seen)}")

    driver = build_driver()
    all_new = []

    try:
        print(f"\n  Abrindo: {GESTTA_URL}")
        driver.get(GESTTA_URL)
        print("  Aguardando carregamento...")
        time.sleep(5)

        # ── Verificar login ───────────────────────────────────────────────
        try:
            wait_for(driver, SEL_TAB, timeout=20)
            print("  ✓ Login detectado automaticamente")
        except TimeoutException:
            print("\n  ⚠ ATENÇÃO: Parece que você não está logado.")
            print("  Faça o login manualmente no navegador que abriu.")
            input("  Pressione ENTER após fazer login para continuar...")
            wait_for(driver, SEL_TAB, timeout=30)

        # ── Processar abas ────────────────────────────────────────────────
        all_new += process_tab(driver, "Pendentes", seen)
        all_new += process_tab(driver, "Em atendimento", seen)

    except Exception as e:
        print(f"\n  ✗ Erro geral: {e}")
    finally:
        driver.quit()

    # ── Salvar resultado ──────────────────────────────────────────────────
    elapsed = (datetime.now() - start).seconds
    print(f"\n{'═'*60}")
    if all_new:
        append_to_file(existing_lines, all_new)
        print(f"  Total de mensagens novas: {len(all_new)}")
    else:
        print("  Nenhuma mensagem nova encontrada.")

    print(f"  Tempo de execução: {elapsed}s")
    print("  Arquivo: " + str(OUTPUT_FILE))
    print("═"*60 + "\n")


if __name__ == "__main__":
    main()
