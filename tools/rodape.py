#!/usr/bin/env python3
"""
Fase 1 — rodape em tres colunas.

O menu caiu de 17 para 5 itens. Tudo que saiu de la precisa continuar
alcancavel em um clique, senao a reducao vira perda de pagina. Este script
reescreve o rodape da home com as tres colunas do plano:

    Estante  ·  Trabalhe com Romario  ·  Institucional
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
HOME = RAIZ / "index.html"

COLUNAS = [
    ("Estante", [
        ("Todos os livros", "/livros/"),
        ("Homem, Você Não É Ridículo", "/livros/homem-voce-nao-e-ridiculo.html"),
        ("O Poder da Decisão", "/livros/o-poder-da-decisao.html"),
        ("Amanhã é Outro Agora", "/livros/amanha-e-outro-agora.html"),
        ("Prefácio de Roque Bakof", "/livros/prefacio.html"),
    ]),
    ("Trabalhe com Romário", [
        ("Cursos", "/cursos/"),
        ("Palestras", "/palestras/"),
        ("Falar no WhatsApp", "https://wa.me/5551980482820"),
    ]),
    ("Institucional", [
        ("Sobre o autor", "/sobre-o-autor.html"),
        ("Contato", "/contato/"),
        ("Expediente e política editorial", "/expediente/"),
        ("Vídeos", "/videos/"),
        ("Fotos", "/fotos/"),
        ("Teste das máscaras", "/teste-mascara-masculina/"),
        ("Instalar o app", "/instalar-app.html"),
        ("Política de Privacidade", "/politica-de-privacidade.html"),
        ("Termos de Uso", "/termos-de-uso.html"),
    ]),
]

CSS = """
.rb-rodape-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
  gap:28px;text-align:left;margin-bottom:30px}
.rb-rodape-col h3{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--gold,#c9a24b);margin:0 0 12px;font-weight:600}
.rb-rodape-col ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.rb-rodape-col a{font-size:.88rem;color:var(--dim,#b9b4a8);text-decoration:none;line-height:1.4}
.rb-rodape-col a:hover{color:var(--gold,#c9a24b);text-decoration:underline}
.rb-rodape-contato{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:center;
  padding-top:22px;border-top:1px solid rgba(255,255,255,.08)}
"""


def montar() -> str:
    cols = []
    for titulo, itens in COLUNAS:
        lis = "".join(
            f'<li><a href="{href}"'
            + (' rel="noopener" target="_blank"' if href.startswith("http") else "")
            + f">{rotulo}</a></li>"
            for rotulo, href in itens
        )
        cols.append(
            f'<div class="rb-rodape-col"><h3>{titulo}</h3><ul>{lis}</ul></div>'
        )
    grade = f'<div class="rb-rodape-grade">{"".join(cols)}</div>'

    contato = (
        '<div class="links rb-rodape-contato">'
        '<a href="https://wa.me/5551980482820" rel="me noopener" target="_blank">'
        "WhatsApp: (51) 98048-2820</a>"
        '<a href="mailto:admromariocruz@gmail.com">admromariocruz@gmail.com</a>'
        "</div>"
    )
    copy = (
        '<div class="copy">&copy; 2026 <b>Adm. Rom&aacute;rio Cruz</b> &middot; '
        "Eldorado do Sul, RS &middot; Dinheiro &middot; Masculinidade &middot; Prop&oacute;sito</div>"
    )

    return (
        '  <footer class="foot">\n    <div class="wrap">\n      '
        + grade + "\n      " + contato + "\n      " + copy
        + "\n    </div>\n  </footer>"
    )


def main() -> int:
    html = HOME.read_text(encoding="utf-8", errors="surrogateescape")

    novo, n = re.subn(
        r'  <footer class="foot">.*?</footer>', lambda _: montar(), html, flags=re.S
    )
    if n != 1:
        print(f"ERRO: esperava 1 rodape, encontrei {n}", file=sys.stderr)
        return 1

    novo = novo.replace("</style>", CSS + "</style>", 1)

    if "--check" not in sys.argv:
        HOME.write_text(novo, encoding="utf-8", errors="surrogateescape")
    print(f"rodape reescrito — {sum(len(i) for _, i in COLUNAS)} links em {len(COLUNAS)} colunas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
