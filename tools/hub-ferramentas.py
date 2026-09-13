#!/usr/bin/env python3
"""
Fase 2 — transforma /ferramentas/ em hub de ferramentas de verdade.

A pagina era uma pagina de venda do Circulo que anunciava tres ferramentas
"exclusivas" sem pagina no site, e mostrava as duas publicas apenas de longe.
Alem disso era um fragmento invalido: sem DOCTYPE, <html>, <head> ou <body>.
Sem <head> nao havia <meta charset>, e o navegador exibia "decisoes" quebrado;
sem <body>, o motor de patrocinio nunca chegou nela.

Este script reescreve a pagina como documento valido, preservando o que ja
era bom: o estilo proprio e a calculadora de meta de poupanca, que funciona.
"""

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ALVO = RAIZ / "ferramentas" / "index.html"
# A fonte dos pedacos reaproveitados (estilo e calculadora). Fica separada do
# alvo de proposito: na primeira versao o script lia o proprio resultado e, na
# segunda execucao, extraiu o bloco do GA4 no lugar da calculadora — a pagina
# foi ao ar com a calculadora sem codigo.
FONTE = RAIZ / "tools" / "ferramentas-base.html"

# As ferramentas publicas que existem de verdade. Conferidas uma a uma no
# navegador: todas respondem a entrada do usuario.
FERRAMENTAS = [
    {
        "href": "/financas/simulador-renda-passiva.html",
        "nome": "Simulador de Renda Passiva",
        "desc": "Em quanto tempo os juros passam a render mais que o seu aporte "
                "mensal. O mês em que a conta vira.",
        "tags": "Juros · Ponto de virada",
    },
    {
        "href": "/financas/calculadora-fii.html",
        "nome": "Calculadora de Carteira de FIIs",
        "desc": "Monte sua carteira de fundos imobiliários, veja quantas cotas "
                "cabem no seu bolso e quanta renda isso gera por mês.",
        "tags": "Renda passiva · FIIs",
    },
    {
        "href": "/financas/simulador-100k-1milhao.html",
        "nome": "Da primeira centena ao primeiro milhão",
        "desc": "Quanto tempo o aporte mensal leva até R$ 100 mil e até R$ 1 "
                "milhão — e por que a primeira faixa custa mais da metade do caminho.",
        "tags": "Aporte · Longo prazo",
    },
    {
        "href": "/teste-homem-e-dinheiro/",
        "nome": "Teste: que tipo de homem você é com o dinheiro?",
        "desc": "Seis perguntas, dois minutos. Quatro jeitos de se relacionar com "
                "dinheiro — e o que cada um cobra de você.",
        "tags": "Teste · 2 minutos",
    },
    {
        "href": "/teste-mascara-masculina/",
        "nome": "Teste das Máscaras",
        "desc": "Seis perguntas, dois minutos. Sobre as máscaras que muito homem "
                "aprende a usar sem ninguém ensinar.",
        "tags": "Autoconhecimento",
    },
]

CABECALHO = """<header class="topbar"><div class="wrap">
<a class="brand" href="/"><b>Rede</b> Bolha</a>
<nav class="topnav"><a href="/financas/">Homem e Dinheiro</a> <a href="/masculinidade/">Masculinidade</a> <a href="/economia/">Economia</a> <a href="/artigos/">Artigos</a> <a href="/sobre-o-autor.html">Sobre</a> <a class="rb-entrar" href="https://club.hotmart.com" rel="noopener" target="_blank">Entrar</a></nav>
</div></header>"""

ESTILO_EXTRA = """
/* Cabecalho e rodape do site, na paleta desta pagina. */
.topbar{border-bottom:1px solid var(--border);margin-inline:calc(-1 * clamp(20px,5vw,56px));
  padding-inline:clamp(20px,5vw,56px);margin-bottom:clamp(28px,6vw,52px)}
.topbar .wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
  gap:10px 20px;max-width:1180px;margin:0 auto;padding:16px 0}
.topbar a{text-decoration:none}
.brand{font-family:'Fraunces',Georgia,serif;font-size:.95rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--giz)}
.brand b{color:var(--ouro-text);font-weight:600}
.topnav{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;justify-content:flex-end}
.topnav a{font-size:.72rem;letter-spacing:.13em;text-transform:uppercase;color:var(--giz-mid)}
.topnav a:hover{color:var(--ouro-text)}
.topnav a[aria-current="page"]{color:var(--ouro-text)}
.topnav a.rb-entrar{border:1px solid var(--ouro);border-radius:3px;padding:5px 12px;color:var(--ouro-text)}
.topnav a.rb-entrar:hover{background:var(--ouro);color:#0a0a0c}

/* Grade das ferramentas publicas. */
.hub-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));
  gap:16px;max-width:1180px;margin:0 auto}
.hub-card{display:flex;flex-direction:column;gap:9px;padding:22px;text-decoration:none;
  background:var(--surf);border:1px solid var(--border);border-radius:4px;
  transition:border-color .2s,background .2s}
.hub-card:hover{border-color:var(--ouro);background:var(--surf-2)}
.hub-card h3{font-family:'Fraunces',Georgia,serif;font-size:1.18rem;line-height:1.25;
  color:var(--giz);font-weight:500;margin:0}
.hub-card p{font-size:.9rem;line-height:1.55;color:var(--muted);margin:0}
.hub-card .hub-tags{font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--giz-dim);margin-top:auto;padding-top:8px}
.hub-card .hub-abrir{font-size:.78rem;color:var(--ouro-text);letter-spacing:.04em}

.hub-sec{max-width:1180px;margin:0 auto clamp(36px,7vw,64px)}
.hub-sec-head{margin-bottom:20px}
.hub-sec-head h2{font-family:'Fraunces',Georgia,serif;font-size:clamp(1.5rem,3.4vw,2rem);
  color:var(--giz);font-weight:400;margin:0 0 6px}
.hub-sec-head p{color:var(--muted);font-size:.95rem;max-width:62ch;margin:0}

.hub-circulo{max-width:1180px;margin:0 auto clamp(36px,7vw,64px);padding:26px;
  background:var(--ouro-bg);border:1px solid var(--border-2);border-radius:4px}
.hub-circulo h2{font-family:'Fraunces',Georgia,serif;font-size:1.35rem;color:var(--giz);
  font-weight:500;margin:0 0 8px}
.hub-circulo p{color:var(--muted);font-size:.93rem;line-height:1.6;max-width:66ch;margin:0 0 16px}
.hub-circulo-acoes{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}

.hub-rodape{border-top:1px solid var(--border);max-width:1180px;margin:0 auto;
  padding:26px 0 44px;display:flex;flex-wrap:wrap;gap:8px 20px;
  font-size:.82rem;color:var(--giz-dim)}
.hub-rodape a{color:var(--giz-mid);text-decoration:none}
.hub-rodape a:hover{color:var(--ouro-text)}
"""


def cartao(f: dict) -> str:
    return f"""    <a class="hub-card" href="{f['href']}" data-ferramenta="{f['nome']}">
      <h3>{f['nome']}</h3>
      <p>{f['desc']}</p>
      <span class="hub-abrir">Abrir →</span>
      <span class="hub-tags">{f['tags']}</span>
    </a>"""


def main() -> int:
    bruto = FONTE.read_text(encoding="utf-8")

    estilo = next(
        (m for m in re.finditer(r"<style[^>]*>.*?</style>", bruto, re.S)
         if ":root" in m.group(0)),
        None,
    )
    script = next(
        (m for m in re.finditer(r"<script(?![^>]*src)[^>]*>.*?</script>", bruto, re.S)
         if "calcular" in m.group(0)),
        None,
    )
    fontes = re.findall(r'<link[^>]*(?:preconnect|fonts\.googleapis)[^>]*>', bruto)
    if not (estilo and script):
        print("ERRO: nao achei o estilo ou o script da calculadora", file=sys.stderr)
        return 1

    # A calculadora que ja existe e funciona: preservada inteira.
    ini = bruto.find('<div class="calc-wrap">')
    fim = bruto.find("</div>", bruto.find('id="result-note"'))
    fim = bruto.find("</div>", fim + 6)
    fim = bruto.find("</div>", fim + 6) + 6
    if ini == -1 or fim < ini:
        print("ERRO: nao consegui isolar a calculadora", file=sys.stderr)
        return 1
    calculadora = bruto[ini:fim]

    estilo_final = estilo.group(0).replace("</style>", ESTILO_EXTRA + "</style>", 1)

    doc = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ferramentas — calculadoras e simuladores gratuitos | Rede Bolha</title>
<meta name="description" content="Calculadoras e simuladores gratuitos sobre dinheiro: renda passiva, carteira de FIIs, meta de poupança e o caminho até o primeiro milhão. Sem cadastro.">
<link rel="canonical" href="https://redebolha.com.br/ferramentas/">
<meta property="og:title" content="Ferramentas — calculadoras e simuladores gratuitos">
<meta property="og:description" content="Entenda os números antes de agir. Sem jargão, sem cadastro.">
<meta property="og:url" content="https://redebolha.com.br/ferramentas/">
<meta property="og:type" content="website">
{chr(10).join(fontes)}
{estilo_final}
<script async src="https://www.googletagmanager.com/gtag/js?id=G-6DSL2EMZSL"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', 'G-6DSL2EMZSL');
</script>
</head>
<body data-tema="dinheiro">

{CABECALHO}

<div class="hero">
  <p class="eyebrow">Ferramentas</p>
  <h1>Entenda os números<br><em>antes de agir.</em></h1>
  <p class="hero-sub">Calculadoras e simuladores gratuitos, sem cadastro e sem indicação de
     investimento. Só matemática honesta — porque a conta que a gente evita fazer é sempre
     a que mais pesa.</p>
</div>

{calculadora}

<section class="hub-sec">
  <div class="hub-sec-head">
    <h2>Todas as ferramentas</h2>
    <p>Abertas para qualquer um, agora, sem deixar e-mail.</p>
  </div>
  <div class="hub-grid">
{chr(10).join(cartao(f) for f in FERRAMENTAS)}
  </div>
</section>

<section class="hub-sec" data-newsletter aria-label="Assine a Carta"></section>

<!-- PONTO DE PATROCÍNIO -->
<section class="hub-sec" data-patrocinio aria-label="Patrocínio"></section>

<section class="hub-circulo">
  <h2>Círculo Rede Bolha</h2>
  <p>As ferramentas acima são abertas e sempre vão ser. O Círculo é a assinatura
     mensal para quem quer continuar a conversa: conteúdo e materiais que ficam no
     Hotmart Club, com novidades em primeira mão.</p>
  <div class="hub-circulo-acoes">
    <a href="/assinatura/" class="btn-circulo">Conhecer o Círculo</a>
    <a href="https://club.hotmart.com" rel="noopener" target="_blank" class="link-saiba">Já assino — entrar</a>
  </div>
</section>

<footer class="hub-rodape">
  <span>&copy; 2026 Adm. Romário Cruz · Eldorado do Sul, RS</span>
  <a href="/">Início</a>
  <a href="/financas/">Homem e Dinheiro</a>
  <a href="/artigos/">Artigos</a>
  <a href="/expediente/">Expediente</a>
</footer>

{script.group(0)}
<script src="/js/ferramenta-uso.js" defer></script>
<script src="/js/newsletter.js" defer></script>
<script src="/js/patrocinio.js" defer></script>
</body>
</html>
"""

    if "--check" not in sys.argv:
        ALVO.write_text(doc, encoding="utf-8")
    print(f"/ferramentas/: documento valido, {len(FERRAMENTAS)} ferramentas publicas listadas")
    print(f"  calculadora preservada: {len(calculadora)} chars")
    print(f"  estilo preservado: {len(estilo.group(0))} chars")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
