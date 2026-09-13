#!/usr/bin/env python3
"""
Move o Circulo da Hotmart para o Beehiiv.

O QUE MUDA
  - Os 3 botoes de assinatura em /assinatura/ passam a apontar para o Beehiiv.
  - O botao "Entrar" das 59 paginas deixa de ir ao Hotmart Club.
  - /membros/ passa a mandar para a publicacao no Beehiiv.
  - O texto da /assinatura/ para de prometer o que o Beehiiv nao entrega.

O QUE NAO MUDA, E NAO TEM COMO MUDAR
  Os 26 links de venda dos livros continuam na Hotmart. O Beehiiv e plataforma
  de newsletter: nao vende livro fisico nem e-book avulso. Nao ha o que migrar.

AS PROMESSAS QUE SAIRAM
  A pagina prometia video semanal, live mensal e o e-book liberado no primeiro
  dia. O Beehiiv nao hospeda video, nao transmite live e nao entrega arquivo na
  assinatura. Prometer isso seria repetir o erro que este site ja cometeu com
  as "tres ferramentas exclusivas" que nunca existiram.
  Para reativa-las: hospedar video fora (YouTube nao listado) e o e-book num
  e-mail de boas-vindas do proprio Beehiiv, e devolver os itens em PROMESSAS.
"""

import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CONFIG = RAIZ / "js" / "newsletter.json"

HOTMART_CIRCULO = "https://pay.hotmart.com/L107571086U"
HOTMART_CLUB = "https://club.hotmart.com"

# Só o que o Beehiiv entrega de verdade, com os materiais sendo texto.
PROMESSAS = [
    ("Um texto por semana",
     "Escrito só para o Círculo. Não vai para o site, não vai para o Instagram. "
     "É onde eu falo sem meio-tom."),
    ("O acervo inteiro",
     "Tudo que já foi publicado no Círculo desde o começo. Entrou hoje, tem "
     "acesso a tudo que veio antes."),
    ("Sua pergunta respondida",
     "Você escreve, eu leio. As perguntas que se repetem viram tema de um texto."),
    ("Direto no seu e-mail",
     "Chega onde você já olha todo dia. Sem aplicativo para instalar, sem mais "
     "uma senha para lembrar."),
]


def cfg() -> dict:
    d = json.loads(CONFIG.read_text(encoding="utf-8"))
    if not d.get("publicacao"):
        print("ERRO: js/newsletter.json sem publicacao", file=sys.stderr)
        raise SystemExit(1)
    return d


def item(titulo: str, texto: str) -> str:
    return (f'        <div class="as-item">\n'
            f'          <h3>{titulo}</h3>\n'
            f'          <p>{texto}</p>\n'
            f'        </div>')


def migrar_assinatura(pub: str, assinar: str) -> int:
    p = RAIZ / "assinatura" / "index.html"
    t = p.read_text(encoding="utf-8", errors="surrogateescape")
    original = t

    t = t.replace(HOTMART_CIRCULO, assinar)

    # --- microcópia do preço -------------------------------------------------
    t = t.replace(
        "Pagamento pela Hotmart · Pix ou cartão · 7 dias de garantia",
        "Cartão · cancela quando quiser · sem fidelidade")

    # --- como funciona -------------------------------------------------------
    t = t.replace(
        "<li><b>Você assina pela Hotmart</b>Leva dois minutos. Pix ou cartão, "
        "do jeito que for melhor.</li>",
        "<li><b>Você assina pelo Beehiiv</b>Leva dois minutos. É onde A Carta "
        "já mora, então é o mesmo lugar de sempre.</li>")

    # --- FAQ -----------------------------------------------------------------
    t = re.sub(
        r'<p class="as-resp">Pode\. Um clique dentro da própria Hotmart[^<]*</p>',
        '<p class="as-resp">Pode. Um clique dentro do próprio Beehiiv, sem ligar '
        'para ninguém e sem ouvir "mas por quê?". Você continua com acesso até o '
        'fim do período que já pagou.</p>', t)

    t = t.replace(
        '<p class="as-resp">Cartão ou Pix, pela Hotmart — a mesma plataforma onde '
        'meus livros já são vendidos.</p>',
        '<p class="as-resp">Cartão, pelo Beehiiv — a mesma plataforma que já envia '
        'A Carta. Os livros continuam sendo vendidos pela Hotmart, que é outra '
        'coisa.</p>')

    # --- as promessas --------------------------------------------------------
    ini = t.find('<div class="as-item">')
    fim = t.rfind('</div>', 0, t.find('</div>', t.rfind('<div class="as-item">')) + 6) + 6
    if ini != -1 and fim > ini:
        t = t[:ini] + "\n".join(item(a, b) for a, b in PROMESSAS).lstrip() + t[fim:]

    if t != original and "--check" not in sys.argv:
        p.write_text(t, encoding="utf-8", errors="surrogateescape")
    return t.count(assinar)


def migrar_club(pub: str) -> int:
    """O 'Entrar' de todas as paginas deixa de ir ao Hotmart Club."""
    n = 0
    for caminho in sorted(RAIZ.rglob("*.html")):
        if ".git" in caminho.parts or caminho.parts[0] == "tools":
            continue
        t = caminho.read_text(encoding="utf-8", errors="surrogateescape")
        if HOTMART_CLUB not in t:
            continue
        novo = t.replace(HOTMART_CLUB, pub)
        if "--check" not in sys.argv:
            caminho.write_text(novo, encoding="utf-8", errors="surrogateescape")
        n += 1
    return n


def migrar_membros(pub: str) -> bool:
    """A /membros/ teve o link trocado, mas o texto ainda falava em Hotmart
    Club. Meia-migracao confunde mais do que nao migrar."""
    p = RAIZ / "membros" / "index.html"
    t = p.read_text(encoding="utf-8", errors="surrogateescape")
    original = t

    t = t.replace(
        "O conteúdo do Círculo fica no Hotmart Club. Entre com o\n"
        "       mesmo e-mail que você usou na compra.",
        "O conteúdo do Círculo fica no Beehiiv, junto com A Carta. Entre com o\n"
        "       mesmo e-mail que você usou para assinar.")
    t = t.replace("O conteúdo do Círculo fica no Hotmart Club.",
                  "O conteúdo do Círculo fica no Beehiiv, junto com A Carta.")
    t = t.replace("Entre com o mesmo e-mail que você usou na compra.",
                  "Entre com o mesmo e-mail que você usou para assinar.")
    t = t.replace("Acessar o Hotmart Club", "Abrir o Círculo")
    t = t.replace(
        "Não recebeu o acesso? O e-mail da Hotmart chega logo após a\n"
        "       confirmação do pagamento — vale conferir o spam.",
        "Não recebeu o acesso? O e-mail do Beehiiv chega logo após a\n"
        "       confirmação — vale conferir o spam.")
    t = t.replace("O e-mail da Hotmart chega logo após a confirmação do pagamento",
                  "O e-mail do Beehiiv chega logo após a confirmação")

    if t != original and "--check" not in sys.argv:
        p.write_text(t, encoding="utf-8", errors="surrogateescape")
    return "hotmart" not in t.lower()


def main() -> int:
    d = cfg()
    pub = d["publicacao"]
    assinar = d.get("assinatura") or (pub + "/upgrade")

    ctas = migrar_assinatura(pub, assinar)
    paginas = migrar_club(pub)
    membros_ok = migrar_membros(pub)

    print(f"assinatura: {ctas} botoes -> {assinar}")
    print(f"'Entrar': {paginas} paginas -> {pub}")
    print(f"/membros/: texto migrado, sem Hotmart: {membros_ok}")
    print(f"promessas na pagina: {len(PROMESSAS)} (eram 6; sairam video, live e e-book)")

    resta = sum(1 for c in RAIZ.rglob("*.html")
                if ".git" not in c.parts and c.parts[0] != "tools"
                and "hotmart" in c.read_text(encoding="utf-8", errors="surrogateescape").lower())
    print(f"paginas que ainda citam Hotmart: {resta} (os livros — nao ha como migrar)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
