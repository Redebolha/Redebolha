#!/usr/bin/env python3
"""
Poe as ferramentas na home — o bloco que o plano chamava de "porta de entrada
de maior conversao".

O bloco ja existia, mas com tres problemas:
  1. Dizia "Duas calculadoras" e mostrava tres.
  2. Tratava a ferramenta como premio de consolacao — "ainda nao e a hora do
     livro? entao leva uma ferramenta". Sobra da epoca em que a home vendia.
     Hoje a ferramenta e a porta de entrada, nao o consolo.
  3. Mostrava 3 de 8 ferramentas, e nenhuma das que atingem mais gente.

Editar DESTAQUES aqui e rodar o script troca a vitrine da home.

    python3 tools/home-ferramentas.py          # aplica
    python3 tools/home-ferramentas.py --check  # so relata
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
HOME = RAIZ / "index.html"

# Quatro, nao oito: a home convida, o hub lista. Escolhidas pelo alcance —
# todo homem tem uma hora, quase todo tem uma divida ou um carro.
DESTAQUES = [
    ("/ferramentas/quanto-vale-sua-hora.html",
     "Quanto vale a sua hora",
     "Salário dividido por horas dá um número bonito e mentiroso. Esta conta "
     "desconta o trânsito e o que você gasta só porque trabalha.",
     "Fazer a conta"),
    ("/ferramentas/termometro-da-divida.html",
     "Termômetro da Dívida",
     "Em quanto tempo você quita, quanto paga de juros — e se a sua parcela "
     "está derrubando a dívida ou só empurrando ela.",
     "Medir a dívida"),
    ("/ferramentas/custo-real-do-carro.html",
     "O custo real do seu carro",
     "A parcela não é o custo. Depreciação, combustível, IPVA, seguro e "
     "manutenção somados — e quantas horas de trabalho isso dá.",
     "Ver o custo"),
    ("/financas/simulador-renda-passiva.html",
     "Simulador de Renda Passiva",
     "O mês exato em que os juros passam a render mais do que você consegue "
     "guardar. O ponto em que a conta vira.",
     "Abrir o simulador"),
]

SELO = "Sem cadastro, sem e-mail"
TITULO = "Antes de decidir, faça a conta."
LINHA = ("Oito calculadoras abertas, de graça. Porque dinheiro mexe com o brio do "
         "homem mais do que ele admite — e a conta que a gente evita fazer é "
         "sempre a que mais pesa.")
RODAPE_LINKS = [
    ("/ferramentas/", "Ver as oito ferramentas →"),
    ("/teste-homem-e-dinheiro/", "Ou faça o teste: que tipo de homem você é com o dinheiro? →"),
]

# A grade era fixa em duas colunas — com quatro cartoes, melhor deixar a
# largura decidir. A regra ja existe no arquivo: editar ela, e nao empilhar
# uma sobreposicao, que cairia antes e perderia a disputa.
GRADE_ANTIGA = ".bd-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px}"
GRADE_NOVA = (".bd-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));"
              "gap:14px;margin-bottom:22px}\n"
              ".bd-rodape{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center}\n"
              ".bd-rodape .bd-tema{margin:0}")

MEDIDOR = '<script src="/js/ferramenta-uso.js" defer></script>'


def bloco() -> str:
    cartoes = "\n".join(
        f'    <a class="bd-card" href="{href}" data-ferramenta="{nome}">\n'
        f'      <strong>{nome}</strong>\n'
        f'      <span>{desc}</span>\n'
        f'      <em>{acao} →</em>\n'
        f'    </a>'
        for href, nome, desc, acao in DESTAQUES
    )
    links = "\n".join(
        f'      <a class="bd-tema" href="{href}">{rotulo}</a>'
        for href, rotulo in RODAPE_LINKS
    )
    return (
        '<section class="bloco-dinheiro" aria-label="Ferramentas">\n'
        '  <div class="wrap">\n'
        f'    <div class="bd-selo">{SELO}</div>\n'
        f'    <h2>{TITULO}</h2>\n'
        f'    <p>{LINHA}</p>\n'
        '    <div class="bd-cards">\n'
        f'{cartoes}\n'
        '    </div>\n'
        '    <div class="bd-rodape">\n'
        f'{links}\n'
        '    </div>\n'
        '  </div>\n'
        '</section>\n'
    )


def main() -> int:
    html = HOME.read_text(encoding="utf-8", errors="surrogateescape")

    ini = html.find('<section class="bloco-dinheiro"')
    fim = html.find("<!-- FIM BLOCO DINHEIRO -->")
    if ini == -1 or fim < ini:
        print("ERRO: nao achei o bloco de ferramentas na home", file=sys.stderr)
        return 1

    novo = html[:ini] + bloco() + html[fim:]

    if GRADE_ANTIGA in novo:
        novo = novo.replace(GRADE_ANTIGA, GRADE_NOVA, 1)

    # Os cartoes tem data-ferramenta: sem este script, o clique nao e contado.
    if "/js/ferramenta-uso.js" not in novo:
        novo = novo.replace("</body>", MEDIDOR + "\n</body>", 1)

    if "--check" not in sys.argv:
        HOME.write_text(novo, encoding="utf-8", errors="surrogateescape")

    print(f"home: bloco de ferramentas com {len(DESTAQUES)} destaques")
    for _, nome, _, _ in DESTAQUES:
        print(f"  · {nome}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
