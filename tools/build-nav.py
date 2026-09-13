#!/usr/bin/env python3
"""
Normaliza o cabecalho (marca + menu) de todas as paginas do site.

O site cresceu com tres marcacoes de cabecalho diferentes e com conjuntos de
links escolhidos pagina a pagina. Este script torna o menu unico: edite MENU
aqui, rode `python3 tools/build-nav.py`, e o site inteiro acompanha.

Uso:
    python3 tools/build-nav.py          # aplica
    python3 tools/build-nav.py --check  # so relata, nao grava
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------- o menu ----
# Ordem = hierarquia. "Homem e Dinheiro" primeiro porque e o foco do site.
MENU = [
    ("Homem e Dinheiro", "/financas/"),
    ("Masculinidade",    "/masculinidade/"),
    ("Economia",         "/economia/"),
    ("Artigos",          "/artigos/"),
    ("Sobre",            "/sobre-o-autor.html"),
]

MARCA_HTML = '<b>Rede</b> Bolha'

# Pastas que nao recebem cabecalho do site.
IGNORAR = {
    "admin",            # painel interno
    "membros",          # area logada
}
IGNORAR_ARQUIVOS = {
    "offline.html",                    # tela do service worker
    "logo-3d.html",                    # experimento isolado
    "destaque-promocional-backup.html",  # backup
    "google2811742ec626a64f.html",     # verificacao do Search Console
}


def secao_da_pagina(caminho: Path) -> str:
    """Devolve o href do MENU que corresponde a pagina, ou '' se nenhum."""
    rel = "/" + str(caminho.relative_to(RAIZ)).replace("\\", "/")
    for _, href in MENU:
        if href.endswith("/") and rel.startswith(href):
            return href
        if rel == href:
            return href
    return ""


def links(atual: str, sep: str = " ") -> str:
    saida = []
    for rotulo, href in MENU:
        marca = ' aria-current="page"' if href == atual else ""
        saida.append(f'<a href="{href}"{marca}>{rotulo}</a>')
    return sep.join(saida)


def itens_lista(atual: str, classe: str = "") -> str:
    """Itens <li>. `classe` existe porque o menu da home estiliza por .lnk."""
    cls = f' class="{classe}"' if classe else ""
    saida = []
    for rotulo, href in MENU:
        marca = ' aria-current="page"' if href == atual else ""
        saida.append(f'<li><a{cls} href="{href}"{marca}>{rotulo}</a></li>')
    return "".join(saida)


# ------------------------------------------------------- os tres padroes ----

def padrao_topnav(html: str, atual: str) -> tuple[str, int]:
    """<nav class="topnav"><a>..</a></nav>  — o padrao dominante."""
    novo = f'<nav class="topnav">{links(atual)}</nav>'
    return re.subn(r'<nav class="topnav">.*?</nav>', novo, html, flags=re.S)


def padrao_rb_nav(html: str, atual: str) -> tuple[str, int]:
    """<nav class="rb-nav"> com <ul> — home e 404. Remove tambem o CTA Comprar."""
    n = 0
    html, k = re.subn(
        r'(<nav class="rb-nav".*?<ul>).*?(</ul>)',
        lambda m: m.group(1) + itens_lista(atual, classe="lnk") + m.group(2),
        html, flags=re.S,
    )
    n += k
    # O botao "Comprar" sai do cabecalho: venda deixa de ser navegacao.
    html, k = re.subn(
        r'\s*<a class="(?:cta|lnk)" href="/?#comprar">[^<]*</a>', "", html
    )
    n += k
    return html, n


def padrao_topo(html: str, atual: str) -> tuple[str, int]:
    """<header class="topo"> com <nav aria-label="Principal"><ul>."""
    return re.subn(
        r'(<nav aria-label="Principal">\s*<ul>).*?(</ul>)',
        lambda m: m.group(1) + itens_lista(atual) + m.group(2),
        html, flags=re.S,
    )


def corrigir_marca(html: str) -> tuple[str, int]:
    """A marca do site e Rede Bolha — nao o titulo de um dos livros."""
    n = 0
    for classe in ("brand", "logo"):
        html, k = re.subn(
            rf'(<a class="{classe}"[^>]*>).*?(</a>)',
            lambda m: m.group(1) + MARCA_HTML + m.group(2),
            html, flags=re.S,
        )
        n += k
    return html, n


def processar(caminho: Path) -> dict:
    html = caminho.read_text(encoding="utf-8", errors="surrogateescape")
    original = html
    atual = secao_da_pagina(caminho)

    total = 0
    for fn in (padrao_topnav, padrao_rb_nav, padrao_topo):
        html, n = fn(html, atual)
        total += n

    html, marcas = corrigir_marca(html)

    mudou = html != original
    if mudou and "--check" not in sys.argv:
        caminho.write_text(html, encoding="utf-8", errors="surrogateescape")
    return {"mudou": mudou, "navs": total, "marcas": marcas}


def main() -> int:
    alterados = navs = marcas = 0
    for caminho in sorted(RAIZ.rglob("*.html")):
        partes = caminho.relative_to(RAIZ).parts
        if ".git" in partes or partes[0] in IGNORAR:
            continue
        if caminho.name in IGNORAR_ARQUIVOS:
            continue

        r = processar(caminho)
        if r["mudou"]:
            alterados += 1
            navs += r["navs"]
            marcas += r["marcas"]
            print(f'  {caminho.relative_to(RAIZ)}')

    modo = "verificados" if "--check" in sys.argv else "atualizados"
    print(f"\n{alterados} arquivos {modo} — {navs} menus, {marcas} marcas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
