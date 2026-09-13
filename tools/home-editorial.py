#!/usr/bin/env python3
"""
Fase 1 — transforma a home de pagina de venda em capa editorial.

O que faz:
  1. Remove da home o funil de venda do livro (hero do livro, secoes HOOK ate
     o checkout Hotmart, e o fechamento "Garantir livro fisico"). Esse funil
     era redundante: /livros/homem-voce-nao-e-ridiculo.html ja vende o livro
     com sinopse, Hotmart, Mercado Livre, WhatsApp/Pix e Amazon.
  2. Reordena os blocos que sobram na ordem editorial do plano.
  3. Insere a faixa de posicionamento do veiculo logo abaixo do menu.
  4. Reescreve <title> e meta description.
  5. Repointa todo link "#comprar" para a pagina do livro.

Roda uma vez. Depois disso a home ja esta na ordem nova e o script vira
documentacao da mudanca.
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
HOME = RAIZ / "index.html"

PAGINA_DO_LIVRO = "/livros/homem-voce-nao-e-ridiculo.html"

# Blocos da home, por intervalo de linhas (1-indexado, inclusivo).
# Conferidos um a um contra o arquivo antes de escrever este script.
BLOCOS = {
    "abertura":       (1069, 1085),   # <body>, pixel noscript, menu
    "manchete":       (1086, 1127),   # rb-gancho
    "economia":       (1128, 1178),   # rb-eco
    "estante":        (1179, 1220),   # outros-livros
    "funil_hero":     (1221, 1416),   # hero do livro + HOOK..Hotmart  (SAI)
    "dinheiro":       (1417, 1450),   # bloco-dinheiro
    "funil_final":    (1451, 1461),   # "Garantir livro fisico"        (SAI)
    "trabalhe":       (1462, 1497),   # livros, cursos e palestras
    "destaque":       (1498, 1514),   # rb-destaque
    "ultimos":        (1515, 1515),   # ultimos artigos
    "circulo":        (1516, 1533),   # assinatura
    "temas":          (1534, 1578),   # temas + sobre + contato
    "rodape":         (1579, 1591),
    "scripts":        (1592, None),   # ate o fim
}

# A nova ordem: conteudo primeiro, oferta depois.
ORDEM = [
    "abertura",
    "POSICIONAMENTO",   # faixa nova, inserida abaixo do menu
    "manchete",
    "dinheiro",
    "economia",
    "destaque",
    "ultimos",
    "temas",
    "estante",
    "trabalhe",
    "circulo",
    "rodape",
    "scripts",
]

POSICIONAMENTO = """
<!-- POSICIONAMENTO DO VEICULO -->
<section class="rb-posicionamento" aria-label="O que é a Rede Bolha">
  <div class="wrap">
    <p>Dinheiro, masculinidade e as contas que ninguém ensina o homem a fazer.</p>
  </div>
</section>
"""

CSS_POSICIONAMENTO = """
.rb-posicionamento{border-bottom:1px solid rgba(255,255,255,.08);padding:18px 0}
.rb-posicionamento p{margin:0;text-align:center;font-size:clamp(.95rem,2.2vw,1.15rem);
  line-height:1.5;color:var(--dim,#b9b4a8);letter-spacing:.01em}
"""

TITULO = "Rede Bolha — Homem e Dinheiro"
DESCRICAO = (
    "Dinheiro, masculinidade e as contas que ninguém ensina o homem a fazer. "
    "Artigos, simuladores e economia por Adm. Romário Cruz."
)


def fatiar(linhas: list[str], nome: str) -> list[str]:
    ini, fim = BLOCOS[nome]
    return linhas[ini - 1:] if fim is None else linhas[ini - 1:fim]


def main() -> int:
    html = HOME.read_text(encoding="utf-8", errors="surrogateescape")
    linhas = html.split("\n")

    cabeca = linhas[:BLOCOS["abertura"][0] - 1]

    corpo: list[str] = []
    for nome in ORDEM:
        if nome == "POSICIONAMENTO":
            corpo.extend(POSICIONAMENTO.strip().split("\n"))
        else:
            corpo.extend(fatiar(linhas, nome))

    novo = "\n".join(cabeca + corpo)

    # --- titulo e descricao ------------------------------------------------
    novo = re.sub(r"<title>.*?</title>", f"<title>{TITULO}</title>", novo, count=1, flags=re.S)
    novo = re.sub(
        r'(<meta name="description" content=")[^"]*(")',
        lambda m: m.group(1) + DESCRICAO + m.group(2),
        novo, count=1,
    )
    # Open Graph / Twitter acompanham o titulo da pagina.
    novo = re.sub(
        r'(<meta property="og:title" content=")[^"]*(")',
        lambda m: m.group(1) + TITULO + m.group(2), novo, count=1,
    )
    novo = re.sub(
        r'(<meta property="og:description" content=")[^"]*(")',
        lambda m: m.group(1) + DESCRICAO + m.group(2), novo, count=1,
    )

    # --- estilo da faixa nova ---------------------------------------------
    novo = novo.replace("</style>", CSS_POSICIONAMENTO + "</style>", 1)

    if "--check" not in sys.argv:
        HOME.write_text(novo, encoding="utf-8", errors="surrogateescape")

    print(f"home: {len(linhas)} -> {len(novo.split(chr(10)))} linhas")

    # --- #comprar nao existe mais na home ---------------------------------
    trocas = 0
    for caminho in sorted(RAIZ.rglob("*.html")):
        if ".git" in caminho.parts or caminho.name == "index.html":
            continue
        t = caminho.read_text(encoding="utf-8", errors="surrogateescape")
        n = t.replace('href="/#comprar"', f'href="{PAGINA_DO_LIVRO}"')
        n = n.replace('href="#comprar"', f'href="{PAGINA_DO_LIVRO}"')
        if n != t:
            trocas += 1
            if "--check" not in sys.argv:
                caminho.write_text(n, encoding="utf-8", errors="surrogateescape")

    print(f"{trocas} paginas com links #comprar repontados para {PAGINA_DO_LIVRO}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
