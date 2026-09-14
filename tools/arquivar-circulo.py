#!/usr/bin/env python3
"""
Tira o Circulo e a Area de Membros do ar, sem apagar nada.

O plano previa o Circulo como receita. Nao virou receita, e enquanto nao
virar ele so ocupa espaco que deveria ser da audiencia e dos livros. As
paginas vao inteiras para `arquivo/circulo/` e este script limpa as
chamadas espalhadas pelo site.

Nada aqui apaga conteudo: o que sai daqui continua no git e continua em
arquivo/. Para voltar, leia arquivo/circulo/README.md.

Uso:
    python3 tools/arquivar-circulo.py          # aplica
    python3 tools/arquivar-circulo.py --check  # so relata
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CHECK = "--check" in sys.argv

# Pastas que ja foram para arquivo/ nao devem ser reeditadas.
IGNORAR = {".git", "arquivo", "tools"}


# ------------------------------------------------------------ os cortes ----
# Cada corte e (nome, regex). Todos sao idempotentes por construcao: rodar
# de novo nao encontra nada e nao muda nada.

CORTES = [
    # O bloco de fim de artigo, em 25 paginas. Sai inteiro — o que fica no
    # lugar e a captura d'A Carta, que o newsletter.js injeta sozinho.
    ("bloco de fim de artigo",
     re.compile(r'\n?[ \t]*<div class="cta">\s*'
                r'<p class="eyebrow">Círculo Rede Bolha</p>.*?</div>\s*',
                re.S)),

    # A secao da home inteira.
    ("seção da home",
     re.compile(r'\n?<section class="bloco-circulo".*?</section>\s*', re.S)),

    # A secao do hub de ferramentas.
    ("seção do hub",
     re.compile(r'\n?<section class="hub-circulo">.*?</section>\s*', re.S)),

    # Itens de menu e de rodape que apontam para a assinatura.
    ("item de lista",
     re.compile(r'\n?[ \t]*<li><a href="/assinatura/"[^>]*>[^<]*</a></li>')),

    # Paragrafo solto no rodape da /sobre-o-autor.html.
    ("parágrafo de rodapé",
     re.compile(r'\n?[ \t]*<p><a href="/assinatura/"[^>]*>[^<]*</a></p>')),

    # Link solto no rodape da 404.
    ("link de rodapé",
     re.compile(r'\n?[ \t]*<a href="/assinatura/"[^>]*>[^<]*</a>')),
]


def paginas():
    for caminho in sorted(RAIZ.rglob("*.html")):
        if set(caminho.relative_to(RAIZ).parts) & IGNORAR:
            continue
        yield caminho


def main() -> int:
    total = {nome: 0 for nome, _ in CORTES}
    alterados = 0

    for caminho in paginas():
        html = caminho.read_text(encoding="utf-8", errors="surrogateescape")
        original = html

        for nome, padrao in CORTES:
            html, n = padrao.subn("\n", html)
            total[nome] += n

        if html != original:
            alterados += 1
            if not CHECK:
                caminho.write_text(html, encoding="utf-8",
                                   errors="surrogateescape")
            print(f"  {caminho.relative_to(RAIZ)}")

    print(f"\n{alterados} páginas limpas:")
    for nome, n in total.items():
        print(f"  {n:3d}  {nome}")

    # O que sobrou tem que aparecer, senao vira link quebrado silencioso.
    # So faz sentido depois de gravar: em --check nada foi para o disco.
    if CHECK:
        print("\n(--check: nada gravado, varredura do que sobrou não se aplica)")
        return 0

    restou = []
    for caminho in paginas():
        t = caminho.read_text(encoding="utf-8", errors="surrogateescape")
        for linha_n, linha in enumerate(t.splitlines(), 1):
            if "/assinatura/" in linha or "/membros/" in linha:
                restou.append(f"{caminho.relative_to(RAIZ)}:{linha_n}")
    if restou:
        print(f"\nAINDA APONTAM PARA AS PÁGINAS ARQUIVADAS ({len(restou)}):")
        for r in restou:
            print(f"  {r}")
    else:
        print("\nNenhuma página aponta mais para o Círculo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
