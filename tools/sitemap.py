#!/usr/bin/env python3
"""
Mantem o sitemap.xml em dia com as paginas que existem de verdade.

O sitemap tinha virado uma lista escrita a mao: paginas novas nao entravam e
paginas removidas continuavam la. Rode este script depois de criar ou apagar
pagina e ele acerta a lista, preservando as datas que ja estavam registradas.

    python3 tools/sitemap.py          # aplica
    python3 tools/sitemap.py --check  # so relata o que mudaria
"""

import re
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SITEMAP = RAIZ / "sitemap.xml"
SITE = "https://redebolha.com.br"

# Fora do sitemap: area logada, painel, utilitarios, redirecionadores e paginas
# marcadas como noindex. Nada aqui deve disputar busca.
FORA_PASTAS = {"admin", "membros", "hvnr", "tools"}
FORA_ARQUIVOS = {
    "404.html", "offline.html", "logo-3d.html", "instalar-app.html",
    "destaque-promocional-backup.html", "google2811742ec626a64f.html",
    "politica-de-privacidade.html", "termos-de-uso.html",
}

# Prioridade por secao. O que traz audiencia vem antes do que vende.
PRIORIDADE = [
    ("/", "1.0", "daily"),
    ("/financas/", "0.9", "weekly"),
    ("/ferramentas/", "0.9", "weekly"),
    ("/artigos/", "0.9", "weekly"),
    ("/economia/", "0.8", "weekly"),
    ("/teste-", "0.8", "monthly"),
    ("/livros/", "0.7", "monthly"),
]
PADRAO = ("0.6", "monthly")


def url_de(caminho: Path) -> str | None:
    rel = caminho.relative_to(RAIZ)
    if rel.parts[0] in FORA_PASTAS or caminho.name in FORA_ARQUIVOS:
        return None

    texto = caminho.read_text(encoding="utf-8", errors="surrogateescape")
    if re.search(r'<meta[^>]*name="robots"[^>]*noindex', texto, re.I):
        return None

    # Pagina que aponta canonical para OUTRO endereco e duplicata: mandar ela
    # para o Google concorreria com a versao boa.
    can = re.search(r'<link[^>]*rel="canonical"[^>]*href="([^"]+)"', texto)

    if caminho.name == "index.html":
        pasta = "/".join(rel.parts[:-1])
        url = f"{SITE}/{pasta}/" if pasta else f"{SITE}/"
    else:
        url = f"{SITE}/{rel.as_posix()}"

    if can and can.group(1).rstrip("/") != url.rstrip("/"):
        return None
    return url


def peso(url: str) -> tuple[str, str]:
    caminho = url.replace(SITE, "") or "/"
    for prefixo, prio, freq in PRIORIDADE:
        if caminho == prefixo or (prefixo != "/" and caminho.startswith(prefixo)):
            return prio, freq
    return PADRAO


def main() -> int:
    antigo = SITEMAP.read_text(encoding="utf-8")
    # Preserva as datas ja registradas: mexer nelas sem motivo confunde o Google.
    datas = dict(re.findall(
        r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", antigo))

    urls = sorted(filter(None, (
        url_de(p) for p in RAIZ.rglob("*.html") if ".git" not in p.parts)))

    hoje = date.today().isoformat()
    linhas = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        prio, freq = peso(u)
        linhas += ["    <url>",
                   f"        <loc>{u}</loc>",
                   f"        <lastmod>{datas.get(u, hoje)}</lastmod>",
                   f"        <changefreq>{freq}</changefreq>",
                   f"        <priority>{prio}</priority>",
                   "    </url>"]
    linhas.append("</urlset>")
    novo = "\n".join(linhas) + "\n"

    entraram = [u for u in urls if u not in datas]
    sairam = [u for u in datas if u not in urls]

    if "--check" not in sys.argv:
        SITEMAP.write_text(novo, encoding="utf-8")

    print(f"sitemap: {len(urls)} paginas ({len(datas)} antes)")
    for u in entraram:
        print(f"  + {u.replace(SITE, '')}")
    for u in sairam:
        caminho = u.replace(SITE, "").lstrip("/") or "index.html"
        alvo = RAIZ / (caminho + "index.html" if caminho.endswith("/") else caminho)
        motivo = "excluida por regra (noindex, duplicata ou utilitaria)" \
            if alvo.exists() else "pagina nao existe mais"
        print(f"  - {u.replace(SITE, '')}  ({motivo})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
