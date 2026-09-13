#!/usr/bin/env python3
"""
Fase 2 — marca o tema de cada pagina e instala o motor de patrocinio.

O tema e o que decide qual livro patrocina a pagina. Ele vai no <body> como
data-tema e e lido por js/patrocinio.js.

    python3 tools/temas.py          # aplica
    python3 tools/temas.py --check  # so relata
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SCRIPT = '<script src="/js/patrocinio.js" defer></script>'

# Pastas inteiras: todo mundo dentro herda o tema.
POR_PASTA = {
    "financas": "dinheiro",
    "economia": "economia",
    "masculinidade": "masculinidade",
    "paternidade": "paternidade",
    "relacionamentos": "relacionamentos",
    "saude-emocional-masculina": "emocional",
    "proposito": "proposito",
    "fe-e-identidade": "fe",
}

# Artigos variam de assunto — cada um recebe o seu.
POR_ARTIGO = {
    "a-mascara-que-voce-usa-todo-dia": "masculinidade",
    "amor-nao-e-fraqueza": "relacionamentos",
    "cansaco-emocional-do-provedor": "dinheiro",   # o peso de prover e conta
    "casamento-comunicacao": "relacionamentos",
    "corpo-grita-o-que-a-boca-cala": "emocional",
    "crise-dos-40": "proposito",
    "fe-sem-mascara": "fe",
    "heranca-paterna": "paternidade",
    "homem-diante-do-fracasso": "proposito",
    "homem-e-a-lideranca": "proposito",
    "homem-e-o-dinheiro": "dinheiro",
    "homem-e-o-envelhecimento": "proposito",
    "homem-e-o-perdao": "emocional",
    "homem-masculinidade-em-jogo": "masculinidade",
    "homem-que-deixa-legado": "proposito",
    "homem-voce-e-necessario": "masculinidade",
    "o-silencio-que-mata": "emocional",
    "ponto-de-virada-renda-passiva": "dinheiro",
    "por-que-homem-nao-chora": "emocional",
    "raiva-masculina": "emocional",
    "reconstruindo-a-identidade": "proposito",
    "solidao-masculina": "emocional",
}

# Paginas na raiz que merecem tema proprio.
POR_ARQUIVO = {
    "index.html": "dinheiro",                 # o foco do site
    "simulador-renda-passiva.html": "dinheiro",
}

# Fora do alcance: painel, area logada, utilitarios e as proprias paginas de
# venda — anunciar um livro dentro da pagina de outro nao faz sentido.
IGNORAR_PASTAS = {"admin", "membros", "livros", "oferta", "hvnr"}
IGNORAR_ARQUIVOS = {
    "offline.html", "logo-3d.html", "destaque-promocional-backup.html",
    "google2811742ec626a64f.html", "404.html", "instalar-app.html",
    "politica-de-privacidade.html", "termos-de-uso.html",
}


def tema_de(caminho: Path) -> str | None:
    rel = caminho.relative_to(RAIZ)
    partes = rel.parts

    if partes[0] in IGNORAR_PASTAS or caminho.name in IGNORAR_ARQUIVOS:
        return None
    if len(partes) == 1:
        return POR_ARQUIVO.get(caminho.name)
    if partes[0] == "artigos":
        return POR_ARTIGO.get(caminho.stem)
    return POR_PASTA.get(partes[0])


def aplicar(caminho: Path, tema: str) -> tuple[bool, bool]:
    html = caminho.read_text(encoding="utf-8", errors="surrogateescape")
    original = html

    # data-tema no <body>, sem mexer nos outros atributos que ja existam.
    def marca(m):
        tag = m.group(0)
        if "data-tema=" in tag:
            return re.sub(r'data-tema="[^"]*"', f'data-tema="{tema}"', tag)
        return tag[:-1].rstrip() + f' data-tema="{tema}">'

    # O <body> real e o primeiro que NAO esta dentro de um comentario: ha
    # paginas que mencionam "<body>" em comentarios explicativos.
    comentarios = [(m.start(), m.end()) for m in re.finditer(r"<!--.*?-->", html, re.S)]

    def dentro_de_comentario(pos: int) -> bool:
        return any(ini <= pos < fim for ini, fim in comentarios)

    alvo = next((m for m in re.finditer(r"<body[^>]*>", html)
                 if not dentro_de_comentario(m.start())), None)
    if alvo is None:
        return False, False   # pagina sem <body> real — nao da para marcar

    html = html[:alvo.start()] + marca(alvo) + html[alvo.end():]

    if "/js/patrocinio.js" not in html:
        if "</body>" in html:
            html = html.replace("</body>", f"{SCRIPT}\n</body>", 1)
        else:
            html = html.rstrip() + "\n" + SCRIPT + "\n"

    mudou = html != original
    if mudou and "--check" not in sys.argv:
        caminho.write_text(html, encoding="utf-8", errors="surrogateescape")
    return mudou, True


def main() -> int:
    aplicados, sem_body, contagem = 0, [], {}

    for caminho in sorted(RAIZ.rglob("*.html")):
        if ".git" in caminho.parts:
            continue
        tema = tema_de(caminho)
        if tema is None:
            continue
        mudou, ok = aplicar(caminho, tema)
        if not ok:
            sem_body.append(str(caminho.relative_to(RAIZ)))
            continue
        if mudou:
            aplicados += 1
        contagem[tema] = contagem.get(tema, 0) + 1

    print(f"{aplicados} paginas marcadas\n")
    for tema, n in sorted(contagem.items(), key=lambda x: -x[1]):
        print(f"  {tema:16} {n}")
    if sem_body:
        print(f"\nsem <body>, nao marcadas: {', '.join(sem_body)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
