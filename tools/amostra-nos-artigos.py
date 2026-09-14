#!/usr/bin/env python3
"""
Poe o capitulo 1 gratuito ao lado de cada convite ao livro.

Os artigos terminam com um bloco `.cta` que manda para a pagina de venda.
O texto desses blocos e bom e fica como esta — o que faltava era a opcao de
LER antes de comprar, que e o que de fato cria vontade (§3-A do plano).

Idempotente: o bloco que ja tem a linha da amostra e pulado.

Uso:
    python3 tools/amostra-nos-artigos.py          # aplica
    python3 tools/amostra-nos-artigos.py --check  # so relata
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CHECK = "--check" in sys.argv

LEITOR = "/leia/homem-voce-nao-e-ridiculo/"
MARCA = 'data-rb="amostra"'

# A linha entra DEPOIS do botao de compra, dentro do mesmo bloco: quem ja
# decidiu comprar clica em cima; quem nao decidiu encontra a saida de graca
# logo abaixo, em vez de fechar a aba.
LINHA = (
    f'\n<p class="rb-amostra" {MARCA} style="margin:12px 0 0;font-size:.9rem">'
    f'<a href="{LEITOR}">Ou leia o primeiro capítulo agora, de graça →</a></p>'
)

# So blocos que convidam para ESTE livro. Os outros tres livros nao tem
# amostra publicada e prometer uma seria repetir erro antigo.
ALVO = re.compile(
    r'(<div class="cta">(?:(?!</div>).)*?'
    r'<a class="btn" href="/livros/homem-voce-nao-e-ridiculo\.html">[^<]*</a>)',
    re.S,
)

IGNORAR = {".git", "arquivo", "tools", "admin", "leia", "livros"}


def main() -> int:
    tocados = total = 0
    for caminho in sorted(RAIZ.rglob("*.html")):
        if set(caminho.relative_to(RAIZ).parts) & IGNORAR:
            continue
        html = caminho.read_text(encoding="utf-8", errors="surrogateescape")
        if MARCA in html:            # ja tem: nao empilha uma segunda linha
            continue

        html, n = ALVO.subn(lambda m: m.group(1) + LINHA, html)
        if n:
            tocados += 1
            total += n
            if not CHECK:
                caminho.write_text(html, encoding="utf-8",
                                   errors="surrogateescape")
            print(f"  {caminho.relative_to(RAIZ)}  (+{n})")

    modo = "teriam" if CHECK else "têm"
    print(f"\n{tocados} páginas {modo} a amostra ao lado do convite ({total} blocos).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
