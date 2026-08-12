class RedeBolha3D extends HTMLElement {
    constructor() {
          super();
          this.attachShadow({ mode: 'open' });
    }

  connectedCallback() {
        const modo = this.getAttribute('modo') || 'padrao';
        this.renderizar(modo);
        this.iniciarAnimacao();
  }

  renderizar(modo) {
        const canvas = document.createElement('canvas');
        const width = modo === 'topo' ? window.innerWidth : 400;
        const height = modo === 'topo' ? 300 : 400;

      canvas.width = width;
        canvas.height = height;
        canvas.style.display = 'block';
        canvas.style.background = 'linear-gradient(135deg, rgba(196, 163, 101, 0.05) 0%, rgba(10, 10, 12, 1) 100%)';
        canvas.style.borderRadius = '8px';
        canvas.style.marginBottom = '2rem';

      const ctx = canvas.getContext('2d');
        this.ctx = ctx;
        this.canvas = canvas;
        this.modo = modo;

      const style = document.createElement('style');
        style.textContent = `
              :host {
                      display: block;
                              width: 100%;
                                    }
                                          canvas {
                                                  box-shadow: 0 10px 30px rgba(196, 163, 101, 0.2);
                                                        }
                                                              @media (max-width: 768px) {
                                                                      canvas {
                                                                                max-width: 100%;
                                                                                          height: auto;
                                                                                                  }
                                                                                                        }
                                                                                                            `;

      this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(canvas);
  }

  iniciarAnimacao() {
        let rotacao = 0;
        const desenhar = () => {
                rotacao += 0.01;
                this.desenharBolha(rotacao);
                requestAnimationFrame(desenhar);
        };
        desenhar();
  }

  desenharBolha(rotacao) {
        const ctx = this.ctx;
        const canvas = this.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) / 3;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(196, 163, 101, 0.1)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

      ctx.strokeStyle = 'rgba(196, 163, 101, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

      const numPontos = 8;
        for (let i = 0; i < numPontos; i++) {
                const angulo = (i / numPontos) * Math.PI * 2 + rotacao;
                const x = centerX + Math.cos(angulo) * radius * 0.8;
                const y = centerY + Math.sin(angulo) * radius * 0.8;

          ctx.fillStyle = 'rgba(196, 163, 101, 0.7)';
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fill();

          ctx.strokeStyle = 'rgba(196, 163, 101, 1)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.stroke();
        }

      ctx.strokeStyle = 'rgba(196, 163, 101, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < numPontos; i++) {
                const angulo = (i / numPontos) * Math.PI * 2 + rotacao;
                const x = centerX + Math.cos(angulo) * radius * 0.8;
                const y = centerY + Math.sin(angulo) * radius * 0.8;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(x, y);
                ctx.stroke();
        }

      ctx.fillStyle = 'rgba(196, 163, 101, 0.9)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
        ctx.fill();
  }
}

customElements.define('rede-bolha-3d', RedeBolha3D);
