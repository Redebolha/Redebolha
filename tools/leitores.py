#!/usr/bin/env python3
"""
Área do Leitor — cifra o conteúdo exclusivo e grava o cofre em leitores/index.html.

A IDEIA
  O repositório é público. Então o que é só para leitor NUNCA entra nele em
  texto aberto: fica numa pasta privada, fora do repositório, e este script
  grava na página apenas a versão cifrada (AES-256-GCM). Sem um código de
  leitor, o cofre é texto embaralhado — no site e no GitHub.

A PASTA PRIVADA (fora do repositório)
  conteudo.html   o miolo da área, em HTML simples (sem <html>/<head>/<body>)
  codigos.json    um código por livro:
                    {"codigos": [
                      {"livro": "hvnr", "nome": "Homem, Você Não É Ridículo",
                       "codigo": "HVNR-7KQ4-M9TX"},
                      ...
                    ]}

USO
  python3 tools/leitores.py --privado ~/leitores-privado     # cifra e grava
  python3 tools/leitores.py --novo-codigo HVNR               # sorteia um código
  python3 tools/leitores.py --conferir --privado ~/leitores-privado
                                                             # testa se cada código abre

  A pasta também pode vir de RB_LEITORES_PRIVADO no ambiente.

DEPOIS DE GRAVAR
  Suba leitores/index.html e aumente VERSAO em service-worker.js, senão quem
  já visitou continua vendo o cofre antigo por um tempo.

TROCAR UM CÓDIGO QUE VAZOU
  Sorteie outro com --novo-codigo, troque no codigos.json e rode de novo.
  Os códigos dos outros livros continuam valendo.

REQUISITO
  pip install cryptography
"""

import argparse
import base64
import datetime as dt
import json
import os
import re
import secrets
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PAGINA = RAIZ / "leitores" / "index.html"

# Custo de cada tentativa de código. O cofre é público, então quem quiser
# chutar códigos pode tentar fora do navegador: cada chute tem de sair caro.
# 600 mil é o piso recomendado hoje para PBKDF2-SHA256; no celular do leitor
# isso custa algo entre meio e um segundo, uma vez só.
ITERACOES = 600_000

# Sem 0/O, 1/I/L: nada que se confunda impresso em papel.
ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

# Oito sorteados do alfabeto acima: ~40 bits. O prefixo do livro não conta.
MINIMO_SORTEADO = 8

COFRE_RE = re.compile(
    r'(<script type="application/json" id="rb-cofre">)(.*?)(</script>)', re.S)


def normalizar(codigo: str) -> str:
    """Igual ao normalizar() de js/leitores.js."""
    sem_acento = "".join(ch for ch in unicodedata.normalize("NFD", codigo)
                         if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^A-Z0-9]", "", sem_acento.upper())


def b64(dados: bytes) -> str:
    return base64.b64encode(dados).decode("ascii")


def novo_codigo(prefixo: str) -> str:
    prefixo = normalizar(prefixo)[:6] or "RB"
    corpo = "".join(secrets.choice(ALFABETO) for _ in range(MINIMO_SORTEADO))
    return f"{prefixo}-{corpo[:4]}-{corpo[4:]}"


def exigir_cryptography():
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # noqa: F401
    except ImportError:
        sys.exit("Falta a biblioteca de criptografia. Rode: pip install cryptography")


def chave_do_codigo(codigo_norm: str, sal: bytes) -> bytes:
    import hashlib
    return hashlib.pbkdf2_hmac("sha256", codigo_norm.encode("utf-8"), sal, ITERACOES, 32)


def pasta_privada(arg: str | None) -> Path:
    bruto = arg or os.environ.get("RB_LEITORES_PRIVADO")
    if not bruto:
        sys.exit("Diga onde está a pasta privada: --privado CAMINHO "
                 "(ou RB_LEITORES_PRIVADO no ambiente).")
    pasta = Path(bruto).expanduser().resolve()
    # A trava que importa: texto aberto dentro do repositório público vaza.
    try:
        pasta.relative_to(RAIZ)
        sys.exit(f"RECUSADO: {pasta} está dentro do repositório, que é público.\n"
                 "O conteúdo em texto aberto e os códigos têm de ficar FORA dele.")
    except ValueError:
        pass
    if not pasta.is_dir():
        sys.exit(f"Pasta privada não encontrada: {pasta}")
    return pasta


def carregar(pasta: Path):
    conteudo = (pasta / "conteudo.html").read_text(encoding="utf-8-sig")
    lista = json.loads((pasta / "codigos.json").read_text(encoding="utf-8-sig"))["codigos"]

    vistos, codigos = set(), []
    for item in lista:
        livro = str(item.get("livro", "")).strip()
        nome = str(item.get("nome", "")).strip()
        norm = normalizar(str(item.get("codigo", "")))
        if not livro or not nome or not norm:
            sys.exit(f"Código incompleto em codigos.json: {item}")
        if len(norm) < MINIMO_SORTEADO + 2:
            sys.exit(f"O código de '{livro}' é curto demais para ficar num cofre público. "
                     f"Use --novo-codigo {livro.upper()} para sortear um.")
        if norm in vistos:
            sys.exit(f"Código repetido em codigos.json ({livro}).")
        vistos.add(norm)
        codigos.append({"livro": livro, "nome": nome, "norm": norm})
    if not codigos:
        sys.exit("codigos.json não tem nenhum código.")
    return conteudo, codigos


def cifrar(conteudo: str, codigos: list) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    chave_conteudo = AESGCM.generate_key(bit_length=256)
    iv = secrets.token_bytes(12)
    miolo = AESGCM(chave_conteudo).encrypt(iv, conteudo.encode("utf-8"), None)

    sal = secrets.token_bytes(16)
    chaves = []
    for c in codigos:
        pacote = json.dumps({"k": b64(chave_conteudo), "livro": c["livro"], "nome": c["nome"]},
                            ensure_ascii=False).encode("utf-8")
        iv_c = secrets.token_bytes(12)
        chaves.append({"iv": b64(iv_c),
                       "ct": b64(AESGCM(chave_do_codigo(c["norm"], sal)).encrypt(iv_c, pacote, None))})
    secrets.SystemRandom().shuffle(chaves)   # a ordem não diz qual livro é qual

    return {
        "v": 1,
        "kdf": {"alg": "PBKDF2-SHA256", "iter": ITERACOES, "salt": b64(sal)},
        "chaves": chaves,
        "conteudo": {"iv": b64(iv), "ct": b64(miolo)},
        "gerado": dt.date.today().isoformat(),
    }


def conferir(cofre: dict, codigos: list, conteudo: str) -> None:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    sal = base64.b64decode(cofre["kdf"]["salt"])
    for c in codigos:
        k = chave_do_codigo(c["norm"], sal)
        aberto = None
        for ch in cofre["chaves"]:
            try:
                aberto = json.loads(AESGCM(k).decrypt(base64.b64decode(ch["iv"]),
                                                      base64.b64decode(ch["ct"]), None))
                break
            except Exception:
                continue
        if not aberto:
            sys.exit(f"FALHOU: o código de '{c['livro']}' não abre o cofre.")
        claro = AESGCM(base64.b64decode(aberto["k"])).decrypt(
            base64.b64decode(cofre["conteudo"]["iv"]),
            base64.b64decode(cofre["conteudo"]["ct"]), None).decode("utf-8")
        if claro != conteudo:
            sys.exit(f"FALHOU: o código de '{c['livro']}' abre, mas o conteúdo não bate.")
        print(f"  ok  {c['livro']:<8} {c['nome']}")


def main():
    ap = argparse.ArgumentParser(description="Cifra a Área do Leitor.")
    ap.add_argument("--privado", help="pasta privada com conteudo.html e codigos.json")
    ap.add_argument("--novo-codigo", metavar="PREFIXO", help="sorteia um código novo e sai")
    ap.add_argument("--conferir", action="store_true",
                    help="só testa se os códigos abrem o cofre que já está na página")
    a = ap.parse_args()

    if a.novo_codigo:
        print(novo_codigo(a.novo_codigo))
        return

    exigir_cryptography()
    pasta = pasta_privada(a.privado)
    conteudo, codigos = carregar(pasta)

    html = PAGINA.read_text(encoding="utf-8")
    achado = COFRE_RE.search(html)
    if not achado:
        sys.exit("Não achei o bloco <script id=\"rb-cofre\"> em leitores/index.html.")

    if a.conferir:
        print("Conferindo o cofre que está na página:")
        conferir(json.loads(achado.group(2)), codigos, conteudo)
        return

    cofre = cifrar(conteudo, codigos)
    print("Conferindo antes de gravar:")
    conferir(cofre, codigos, conteudo)

    texto = json.dumps(cofre, ensure_ascii=True, separators=(",", ":"))
    novo = html[:achado.start(2)] + texto + html[achado.end(2):]
    # UTF-8 sem BOM: com BOM os acentos do site viram lixo.
    PAGINA.write_text(novo, encoding="utf-8", newline="\n")

    print(f"\nCofre gravado em {PAGINA.relative_to(RAIZ)} — {len(codigos)} código(s), "
          f"{len(texto) // 1024} KB cifrados.")
    print("Agora: suba a página e aumente VERSAO em service-worker.js.")


if __name__ == "__main__":
    main()
