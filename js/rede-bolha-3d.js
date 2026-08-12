/* =====================================================================
   Rede Bolha — Logo 3D  <rede-bolha-3d>
   ---------------------------------------------------------------------
   Componente autônomo que desenha o selo da Rede Bolha em 3D, girando,
   com fundo transparente. Não depende de CDN: o Three.js mora em
   /js/vendor/three/ e só é baixado quando o elemento aparece na tela.

   Uso básico:
     <script type="module" src="/js/rede-bolha-3d.js"></script>
     <rede-bolha-3d tamanho="260"></rede-bolha-3d>

   Botão flutuante "voltar ao topo" (a seta do logo aponta pra cima):
     <rede-bolha-3d modo="topo"></rede-bolha-3d>

   Atributos:
     tamanho   px (padrão 240) ou "fluido" para ocupar a largura do pai
     modo      "inline" (padrão) | "topo"
     velocidade  multiplicador do giro (padrão 1; 0 para parar)
     href      transforma o logo em link
     rotulo    texto do aria-label
     poster    imagem de fallback (padrão /logo-rede-bolha.png)

   Cuidados que o componente já toma sozinho:
     - só renderiza quando está visível e a aba está em primeiro plano;
     - respeita prefers-reduced-motion;
     - cai para a imagem PNG se não houver WebGL ou se algo falhar;
     - libera GPU e memória quando sai do DOM.
   ===================================================================== */

const BASE = new URL('.', import.meta.url);
const THREE_URL = new URL('vendor/three/three.module.min.js', BASE).href;
const POSTER_PADRAO = new URL('../logo-rede-bolha.png', BASE).href;

let _three = null;
const carregarThree = () => (_three ||= import(THREE_URL));

const semMovimento = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --------------------------------------------------------------------
   Textura da face do selo: fundo azul, malha hexagonal e o texto curvo.
   Desenhada uma vez em <canvas> 2D e reaproveitada por todas as cópias.
   -------------------------------------------------------------------- */
let _texturaCache = null;
function desenharFace(S) {
  if (_texturaCache && _texturaCache.width === S) return _texturaCache;

  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2, K = S / 9.2, oy = S / 2 - 0.55 * K;

  const g = ctx.createRadialGradient(cx, oy, 0, cx, oy, S * 0.72);
  g.addColorStop(0.00, '#2f5f9e');
  g.addColorStop(0.45, '#1e4577');
  g.addColorStop(1.00, '#12294c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // malha hexagonal — a "rede"
  const hs = 0.72 * K;
  ctx.lineWidth = S * 0.0035;
  ctx.lineJoin = 'round';
  for (let q = -6; q <= 6; q++) {
    for (let r = -6; r <= 6; r++) {
      const hx = cx + hs * 1.5 * q;
      const hy = oy + hs * Math.sqrt(3) * (r + q / 2);
      const d = Math.hypot(hx - cx, hy - oy);
      if (d > 3.35 * K) continue;
      const fade = Math.max(0, 1 - Math.pow(d / (3.35 * K), 2.2));
      ctx.strokeStyle = `rgba(150,196,240,${0.30 * fade + 0.05})`;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = hx + hs * Math.cos(a), py = hy + hs * Math.sin(a);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = `rgba(190,222,255,${0.28 * fade})`;
      ctx.beginPath();
      ctx.arc(hx, hy, S * 0.004, 0, 7);
      ctx.fill();
    }
  }

  // "REDE BOLHA" acompanhando o arco de baixo, letra por letra
  const txt = 'REDE BOLHA', R = 3.05 * K;
  ctx.font = `700 ${Math.round(K * 0.62)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const larguras = [...txt].map((ch) => ctx.measureText(ch).width + K * 0.055);
  let ang = larguras.reduce((a, b) => a + b, 0) / R / 2;
  ctx.save();
  ctx.translate(cx, oy);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(6,20,45,0.55)';
  ctx.shadowBlur = S * 0.012;
  for (let i = 0; i < txt.length; i++) {
    ang -= larguras[i] / R / 2;
    ctx.save();
    ctx.rotate(ang);
    ctx.translate(0, R);
    ctx.fillText(txt[i], 0, 0);
    ctx.restore();
    ang -= larguras[i] / R / 2;
  }
  ctx.restore();

  _texturaCache = c;
  return c;
}

/* Céu procedural usado só como reflexo (dá o brilho do verniz e do vidro) */
function desenharAmbiente() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.0, '#f2f7ff');
  g.addColorStop(0.4, '#8ea9cd');
  g.addColorStop(0.62, '#3d5a86');
  g.addColorStop(1.0, '#0b1526');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  const h = ctx.createRadialGradient(70, 28, 0, 70, 28, 60);
  h.addColorStop(0, 'rgba(255,255,255,1)');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 256, 128);
  return c;
}

function brilhoSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.25, 'rgba(190,224,255,0.45)');
  g.addColorStop(1.0, 'rgba(120,180,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

/* --------------------------------------------------------------------
   Montagem da cena 3D
   -------------------------------------------------------------------- */
function retanguloArredondado(THREE, w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function normalizarUV(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, (p.getX(i) - b.min.x) / w, (p.getY(i) - b.min.y) / h);
  }
  uv.needsUpdate = true;
}

function criarCena(THREE, canvas, alta) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: alta, alpha: true, powerPreference: 'low-power'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
  camera.position.set(0, 0, 18.4);

  // reflexo do ambiente (sem arquivos externos)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const eq = new THREE.CanvasTexture(desenharAmbiente());
  eq.mapping = THREE.EquirectangularReflectionMapping;
  eq.colorSpace = THREE.SRGBColorSpace;
  scene.environment = pmrem.fromEquirectangular(eq).texture;
  eq.dispose();
  pmrem.dispose();

  const logo = new THREE.Group();
  logo.position.y = -0.35;
  scene.add(logo);

  const curvas = alta ? 24 : 10;
  const descartaveis = [];
  const reg = (x) => (descartaveis.push(x), x);

  // moldura branca
  const molduraGeo = reg(new THREE.ExtrudeGeometry(retanguloArredondado(THREE, 10.4, 10.4, 2.4), {
    depth: 0.55, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14,
    bevelSegments: alta ? 4 : 2, curveSegments: curvas
  }));
  molduraGeo.center();
  logo.add(new THREE.Mesh(molduraGeo, reg(new THREE.MeshPhysicalMaterial({
    color: 0xeef2f8, roughness: 0.35, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3
  }))));

  // placa azul com a arte
  const placaGeo = reg(new THREE.ExtrudeGeometry(retanguloArredondado(THREE, 9.2, 9.2, 2.0), {
    depth: 0.5, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.16,
    bevelSegments: alta ? 5 : 2, curveSegments: curvas
  }));
  placaGeo.center();
  normalizarUV(placaGeo);
  const mapa = reg(new THREE.CanvasTexture(desenharFace(alta ? 1024 : 512)));
  mapa.colorSpace = THREE.SRGBColorSpace;
  mapa.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const placa = new THREE.Mesh(placaGeo, [
    reg(new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.42, metalness: 0.12 })),
    reg(new THREE.MeshStandardMaterial({ color: 0x17365f, roughness: 0.5, metalness: 0.2 }))
  ]);
  placa.position.z = 0.5;
  logo.add(placa);

  // a bolha
  const bolhaGeo = reg(new THREE.SphereGeometry(2.35, alta ? 72 : 32, alta ? 72 : 32));
  const bolha = new THREE.Mesh(bolhaGeo, reg(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.13, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.6, sheenColor: 0xcfe2ff
  })));
  bolha.position.set(0, 0.55, 1.7);
  logo.add(bolha);

  // a seta
  const setaForma = new THREE.Shape();
  setaForma.moveTo(0, 1.30);
  setaForma.lineTo(1.02, 0.16); setaForma.lineTo(0.40, 0.16);
  setaForma.lineTo(0.40, -1.28); setaForma.lineTo(-0.40, -1.28);
  setaForma.lineTo(-0.40, 0.16); setaForma.lineTo(-1.02, 0.16);
  setaForma.closePath();
  const setaGeo = reg(new THREE.ExtrudeGeometry(setaForma, {
    depth: 0.5, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2
  }));
  const seta = new THREE.Mesh(setaGeo, reg(new THREE.MeshPhysicalMaterial({
    color: 0x1b3c6e, roughness: 0.25, metalness: 0.35, clearcoat: 0.8
  })));
  seta.position.set(0, 0.62, 3.55);
  logo.add(seta);

  // sinal: ponto, halo e ondas
  // o conjunto do sinal fica no topo da bolha, sempre dentro da moldura
  const sinal = new THREE.Group();
  sinal.position.set(0, 2.85, 2.05);
  logo.add(sinal);

  const ponto = new THREE.Mesh(
    reg(new THREE.SphereGeometry(0.34, 24, 24)),
    reg(new THREE.MeshBasicMaterial({ color: 0xffffff }))
  );
  sinal.add(ponto);

  const halo = new THREE.Sprite(reg(new THREE.SpriteMaterial({
    map: reg(new THREE.CanvasTexture(brilhoSprite())),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9
  })));
  halo.scale.set(3.4, 3.4, 1);
  sinal.add(halo);

  const ondas = [];
  [0.62, 1.02, 1.42, 1.72].forEach((r, i) => {
    const arco = 2.05;
    const m = new THREE.Mesh(
      reg(new THREE.TorusGeometry(r, 0.075, alta ? 10 : 6, alta ? 64 : 28, arco)),
      reg(new THREE.MeshStandardMaterial({
        color: 0xdcecff, emissive: 0x74b0ec, emissiveIntensity: 1.4,
        roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.9
      }))
    );
    m.rotation.z = Math.PI / 2 - arco / 2;
    m.userData.i = i;
    sinal.add(m);
    ondas.push(m);
  });

  scene.add(new THREE.AmbientLight(0x44618f, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(6, 9, 12);
  const fill = new THREE.DirectionalLight(0x89b6ea, 0.9); fill.position.set(-9, -2, 7);
  const rim = new THREE.DirectionalLight(0x9fc6ff, 1.4); rim.position.set(-4, 6, -9);
  scene.add(key, fill, rim);

  return {
    renderer, scene, camera, logo, ondas, ponto, halo,
    redimensionar(l, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(l, l, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    },
    descartar() {
      descartaveis.forEach((d) => d.dispose && d.dispose());
      scene.environment && scene.environment.dispose();
      renderer.dispose();
    }
  };
}

/* --------------------------------------------------------------------
   O elemento customizado
   -------------------------------------------------------------------- */
const ESTILO = `
  :host {
    display: inline-block;
    position: relative;
    width: var(--rb3d-tamanho, 240px);
    height: var(--rb3d-tamanho, 240px);
    line-height: 0;
    contain: layout paint;
    -webkit-tap-highlight-color: transparent;
  }
  :host([tamanho="fluido"]) { display: block; width: 100%; height: auto; aspect-ratio: 1; }
  :host([modo="topo"]) {
    position: fixed;
    right: clamp(12px, 3vw, 28px);
    bottom: clamp(12px, 3vw, 28px);
    width: var(--rb3d-tamanho, 78px);
    height: var(--rb3d-tamanho, 78px);
    z-index: 900;
    opacity: 0;
    transform: translateY(14px) scale(0.85);
    pointer-events: none;
    transition: opacity .35s ease, transform .35s cubic-bezier(.2,.8,.3,1);
  }
  :host([modo="topo"][visivel]) { opacity: 1; transform: none; pointer-events: auto; }
  :host([modo="topo"]) .palco { cursor: pointer; }

  .palco {
    position: absolute; inset: 0;
    display: block;
    border: 0; padding: 0; margin: 0;
    background: none;
    color: inherit;
    cursor: grab;
    touch-action: pan-y;
    border-radius: 22%;
    outline-offset: 4px;
  }
  .palco:active { cursor: grabbing; }
  :host(:not([href]):not([modo="topo"])) .palco { cursor: grab; }

  canvas, img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    display: block;
    transition: opacity .5s ease;
  }
  img { object-fit: contain; opacity: 1; }
  canvas { opacity: 0; }
  :host([pronto]) img { opacity: 0; }
  :host([pronto]) canvas { opacity: 1; }

  .aura {
    position: absolute; inset: -18%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(90,150,220,.28), rgba(90,150,220,0) 62%);
    pointer-events: none;
    opacity: .9;
  }
  :host([sem-aura]) .aura { display: none; }

  @media (prefers-reduced-motion: reduce) {
    :host([modo="topo"]) { transition: opacity .2s ease; transform: none; }
  }
`;

class RedeBolha3D extends HTMLElement {
  static observedAttributes = ['tamanho', 'modo', 'href', 'rotulo', 'poster'];

  constructor() {
    super();
    this._raiz = this.attachShadow({ mode: 'open' });
    this._cena = null;
    this._raf = 0;
    this._visivel = false;
    this._carregando = false;
    this._giro = 0;          // ângulo Y acumulado
    this._inercia = 0;       // velocidade residual do arrasto
    this._inclina = 0;       // inclinação X suavizada
    this._alvoInclina = 0;
    this._t = 0;
    this._ultimo = 0;
    this._arrastou = false;
  }

  connectedCallback() {
    this._montarDOM();

    this._io = new IntersectionObserver((e) => {
      this._visivel = e[0].isIntersecting;
      if (this._visivel) this._acordar();
      else this._dormir();
    }, { rootMargin: '200px' });
    this._io.observe(this);

    this._onVis = () => (document.hidden ? this._dormir() : this._visivel && this._acordar());
    document.addEventListener('visibilitychange', this._onVis);

    this._ro = new ResizeObserver(() => this._ajustar());
    this._ro.observe(this);

    if (this.getAttribute('modo') === 'topo') this._ligarBotaoTopo();
  }

  disconnectedCallback() {
    this._dormir();
    this._io?.disconnect();
    this._ro?.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    this._onScroll && window.removeEventListener('scroll', this._onScroll);
    this._cena?.descartar();
    this._cena = null;
  }

  attributeChangedCallback(nome) {
    if (!this._palco) return;
    if (nome === 'tamanho') this._ajustar();
    if (nome === 'rotulo' || nome === 'href' || nome === 'modo') this._rotular();
  }

  /* ---------------- DOM interno ---------------- */
  _montarDOM() {
    const est = document.createElement('style');
    est.textContent = ESTILO;

    const tam = this.getAttribute('tamanho');
    if (tam && tam !== 'fluido') this.style.setProperty('--rb3d-tamanho', `${parseFloat(tam)}px`);

    const ehLink = this.hasAttribute('href');
    this._palco = document.createElement(ehLink ? 'a' : 'button');
    this._palco.className = 'palco';
    if (ehLink) this._palco.href = this.getAttribute('href');
    else this._palco.type = 'button';

    const aura = document.createElement('div');
    aura.className = 'aura';

    this._img = document.createElement('img');
    this._img.src = this.getAttribute('poster') || POSTER_PADRAO;
    this._img.alt = '';
    this._img.decoding = 'async';
    this._img.loading = 'lazy';

    this._canvas = document.createElement('canvas');
    this._canvas.setAttribute('aria-hidden', 'true');

    this._palco.append(aura, this._img, this._canvas);
    this._raiz.append(est, this._palco);
    this._rotular();
    this._ligarPonteiro();
  }

  _rotular() {
    if (!this._palco) return;
    const modo = this.getAttribute('modo');
    const rotulo = this.getAttribute('rotulo') ||
      (modo === 'topo' ? 'Voltar ao topo da página'
        : this.hasAttribute('href') ? 'Rede Bolha — página inicial'
          : 'Logo 3D da Rede Bolha');
    this._palco.setAttribute('aria-label', rotulo);
    this._palco.title = rotulo;
    this._img.alt = this.hasAttribute('href') || modo === 'topo' ? '' : 'Logo da Rede Bolha';
  }

  /* ---------------- botão "voltar ao topo" ---------------- */
  _ligarBotaoTopo() {
    this._onScroll = () => {
      const passou = window.scrollY > (window.innerHeight * 0.6);
      if (passou === this.hasAttribute('visivel')) return;
      this.toggleAttribute('visivel', passou);
      passou ? this._acordar() : this._dormir();
    };
    window.addEventListener('scroll', this._onScroll, { passive: true });
    this._onScroll();
    this._palco.addEventListener('click', (ev) => {
      if (this._arrastou) { ev.preventDefault(); return; }
      window.scrollTo({ top: 0, behavior: semMovimento() ? 'auto' : 'smooth' });
    });
  }

  /* ---------------- arrastar para girar ---------------- */
  _ligarPonteiro() {
    let ativo = false, xAnt = 0;

    this._palco.addEventListener('pointerdown', (e) => {
      ativo = true; this._arrastou = false; xAnt = e.clientX;
      this._palco.setPointerCapture(e.pointerId);
    });

    this._palco.addEventListener('pointermove', (e) => {
      const r = this.getBoundingClientRect();
      this._alvoInclina = -((e.clientY - r.top) / r.height - 0.5) * 0.45;
      if (!ativo) return;
      const d = (e.clientX - xAnt) / r.width;
      if (Math.abs(e.clientX - xAnt) > 3) this._arrastou = true;
      this._giro += d * 4;
      this._inercia = d * 4;
      xAnt = e.clientX;
      this._acordar();
    });

    // arrastar não deve virar clique (nem navegar, nem rolar a página)
    this._palco.addEventListener('click', (e) => {
      if (this._arrastou) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    const soltar = () => { ativo = false; };
    this._palco.addEventListener('pointerup', soltar);
    this._palco.addEventListener('pointercancel', soltar);
    this._palco.addEventListener('pointerleave', () => { this._alvoInclina = 0; soltar(); });

    // teclado: setas giram o selo (sem vazar para carrosséis da página)
    this._palco.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      this._inercia = e.key === 'ArrowLeft' ? -0.05 : 0.05;
      this._acordar();
      e.stopPropagation();
    });
  }

  /* ---------------- ciclo de vida do render ---------------- */
  async _acordar() {
    if (document.hidden || !this._visivel) return;
    // no modo "topo" o elemento é fixo: existe na tela o tempo todo, mas só
    // conta como visível depois que a pessoa rola. Sem isso, a home baixaria
    // o Three.js à toa em todo carregamento.
    if (this.getAttribute('modo') === 'topo' && !this.hasAttribute('visivel')) return;
    if (!this._cena) {
      if (this._carregando) return;
      this._carregando = true;
      try {
        const THREE = await carregarThree();
        if (!this.isConnected) return;
        const alta = this._qualidadeAlta();
        this._cena = criarCena(THREE, this._canvas, alta);
        this._ajustar();
        this.setAttribute('pronto', '');
        this._canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          this.removeAttribute('pronto');
          this._dormir();
        });
      } catch (err) {
        console.warn('[rede-bolha-3d] 3D indisponível, mantendo a imagem:', err);
        this.setAttribute('sem-3d', '');
        return;
      } finally {
        this._carregando = false;
      }
    }
    if (!this._raf) {
      this._ultimo = performance.now();
      this._raf = requestAnimationFrame(this._quadro);
    }
  }

  _dormir() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _qualidadeAlta() {
    const q = this.getAttribute('qualidade');
    if (q === 'alta') return true;
    if (q === 'baixa') return false;
    const lado = this.getBoundingClientRect().width || 240;
    return lado >= 120 && (navigator.hardwareConcurrency || 4) > 2;
  }

  _ajustar() {
    if (!this._cena) return;
    const lado = Math.max(1, Math.round(this.getBoundingClientRect().width));
    const teto = this._qualidadeAlta() ? 2 : 1.5;
    this._cena.redimensionar(lado, Math.min(window.devicePixelRatio || 1, teto));
  }

  _quadro = (agora) => {
    this._raf = requestAnimationFrame(this._quadro);
    const dt = Math.min(0.05, (agora - this._ultimo) / 1000);
    this._ultimo = agora;
    this._t += dt;

    const c = this._cena;
    if (!c) return;

    const vel = parseFloat(this.getAttribute('velocidade') ?? '1');
    const auto = semMovimento() ? 0 : 0.42 * (isNaN(vel) ? 1 : vel);

    this._giro += (auto * dt) + this._inercia;
    this._inercia *= 0.92;
    if (Math.abs(this._inercia) < 1e-4) this._inercia = 0;

    this._inclina += (this._alvoInclina - this._inclina) * Math.min(1, dt * 6);

    c.logo.rotation.y = this._giro;
    c.logo.rotation.x = this._inclina + (semMovimento() ? 0 : Math.sin(this._t * 0.5) * 0.07);
    c.logo.position.y = -0.35 + (semMovimento() ? 0 : Math.sin(this._t * 0.8) * 0.18);

    if (!semMovimento()) {
      c.ondas.forEach((o) => {
        const p = (this._t * 0.85 + o.userData.i * 0.25) % 1;
        o.material.opacity = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(p * Math.PI * 2));
      });
      const pulso = 1 + 0.12 * Math.sin(this._t * 3.2);
      c.ponto.scale.setScalar(pulso);
      c.halo.scale.setScalar(3.4 * pulso);
    }

    c.renderer.render(c.scene, c.camera);
  };

  /* ---------------- API pública ---------------- */
  pausar() { this._dormir(); }
  retomar() { this._acordar(); }
}

if (!customElements.get('rede-bolha-3d')) {
  customElements.define('rede-bolha-3d', RedeBolha3D);
}

export default RedeBolha3D;
