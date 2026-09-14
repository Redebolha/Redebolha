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


# Dois caminhos de pagamento, cada um com o seu prazo dito na cara.
#   cartao -> Beehiiv cobra e libera sozinho, na hora.
#   Pix    -> chega no WhatsApp e a liberacao e manual.
# Prometer acesso imediato no Pix seria mentira: alguem que paga de madrugada
# vai procurar o acesso e nao vai achar.
WHATSAPP = ("https://wa.me/5551980482820?text="
            "Quero%20entrar%20no%20C%C3%ADrculo%20Rede%20Bolha%20pagando%20por%20Pix")

PRAZO_PIX = "em até 24 horas"

PASSOS = """        <ol class="as-passos">
          <li><b>Você escolhe como pagar</b>Cartão pelo Beehiiv, ou Pix falando comigo no WhatsApp. O preço é o mesmo.</li>
          <li><b>No cartão, o acesso é na hora</b>O Beehiiv libera sozinho assim que o pagamento passa, mesmo de madrugada.</li>
          <li><b>No Pix, quem libera sou eu</b>Você me manda o comprovante e eu libero """ + PRAZO_PIX + """. Não é automático — sou eu mesmo do outro lado.</li>
          <li><b>Toda semana chega coisa nova</b>Você entra na hora que der. Ninguém vai te cobrar presença.</li>
        </ol>"""


def par_de_botoes(assinar: str, marca: str) -> str:
    return (
        f'<a class="as-cta" href="{assinar}" rel="noopener" data-rb="assinar-{marca}">'
        f'Assinar com cartão</a>\n'
        f'        <a class="as-cta as-cta--pix" href="{WHATSAPP}" rel="noopener" '
        f'target="_blank" data-rb="pix-{marca}">Pagar com Pix no WhatsApp</a>'
    )


CSS_PIX = """
.as-cta--pix{background:none;border:1px solid currentColor;margin-top:10px}
.as-cta--pix:hover{background:rgba(255,255,255,.06)}
"""


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

    # Cada CTA vira um par: cartao e Pix. Rodar de novo nao pode empilhar um
    # segundo botao de Pix — por isso a marca so e trocada se ainda estiver so.
    for marca in ("topo", "preco", "fim"):
        if f'data-rb="pix-{marca}"' in t:
            continue
        t = re.sub(
            rf'<a class="as-cta" href="[^"]*" rel="noopener" data-rb="assinar-{marca}">'
            rf'[^<]*</a>',
            lambda _m, mc=marca: par_de_botoes(assinar, mc), t, count=1)

    # --- microcópia do preço -------------------------------------------------
    t = t.replace(
        "Pagamento pela Hotmart · Pix ou cartão · 7 dias de garantia",
        "Cartão (na hora) ou Pix (" + PRAZO_PIX + ") · cancela quando quiser")
    t = t.replace(
        "Cartão · cancela quando quiser · sem fidelidade",
        "Cartão (na hora) ou Pix (" + PRAZO_PIX + ") · cancela quando quiser")
    t = t.replace(
        "R$ 37 por mês · cancela quando quiser · 7 dias de garantia",
        "R$ 37 por mês · cartão na hora, Pix " + PRAZO_PIX + " · 7 dias de garantia")

    # --- como funciona: os dois caminhos -------------------------------------
    t = re.sub(r'        <ol class="as-passos">.*?</ol>', PASSOS, t, flags=re.S)

    # --- FAQ -----------------------------------------------------------------
    t = re.sub(
        r'<p class="as-resp">Pode\. Um clique dentro da própria Hotmart[^<]*</p>',
        '<p class="as-resp">Pode. Um clique dentro do próprio Beehiiv, sem ligar '
        'para ninguém e sem ouvir "mas por quê?". Você continua com acesso até o '
        'fim do período que já pagou.</p>', t)

    t = t.replace(
        '<p class="as-resp">Cartão ou Pix, pela Hotmart — a mesma plataforma onde '
        'meus livros já são vendidos.</p>',
        '<p class="as-resp">De dois jeitos. No <b>cartão</b>, pelo Beehiiv — que é a '
        'mesma plataforma que já envia A Carta — e o acesso sai na hora, sozinho. '
        'No <b>Pix</b>, você me chama no WhatsApp, me manda o comprovante e eu libero '
        + PRAZO_PIX + '. Nesse caminho não é automático: sou eu mesmo do outro lado, '
        'então pode não ser de madrugada.</p>')

    # --- as promessas --------------------------------------------------------
    ini = t.find('<div class="as-item">')
    fim = t.rfind('</div>', 0, t.find('</div>', t.rfind('<div class="as-item">')) + 6) + 6
    if ini != -1 and fim > ini:
        t = t[:ini] + "\n".join(item(a, b) for a, b in PROMESSAS).lstrip() + t[fim:]

    if ".as-cta--pix{" not in t:
        t = t.replace("</style>", CSS_PIX + "</style>", 1)

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

    # Quem pagou por Pix nao pode achar que o acesso falhou: o prazo dele e
    # outro, e a pagina precisa dizer isso, senao o WhatsApp enche de gente
    # achando que deu errado.
    t = re.sub(
        r'(<p class="ajuda">).*?(</p>)',
        lambda m: m.group(1) +
        'Pagou no <b>cartão</b> e não recebeu? O e-mail do Beehiiv chega logo após a '
        'confirmação — vale conferir o spam. Pagou por <b>Pix</b>? Aí quem libera sou '
        'eu, ' + PRAZO_PIX + ' — se já passou disso, '
        '<a href="' + WHATSAPP + '" rel="noopener" target="_blank">me chama no '
        'WhatsApp</a>.' + m.group(2),
        t, count=1, flags=re.S)

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
