import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Rim de partículas em WebGL — assinatura visual do Hero (estilo "cérebro da
 * Dala", adaptado ao órgão-símbolo da clínica).
 *
 * Milhares de TRIÂNGULOS luminosos, de tamanhos e ângulos variados, formam a
 * silhueta volumétrica de um rim. Usam a paleta da marca (aqua em várias
 * intensidades + toques de dourado + faíscas brancas). As partículas "voam"
 * para a posição na entrada (efeito de formação), flutuam em repouso e a nuvem
 * inteira gira reagindo ao mouse. No scroll, o rim gira/sobe e some (fade),
 * revelando o conteúdo abaixo.
 *
 * ShaderMaterial próprio para permitir tamanho/ângulo/cor por partícula.
 * Respeita prefers-reduced-motion. Densidade escala com a largura da tela.
 */
interface HeroKidneyProps {
  class?: string;
}

// Pontos de controle da silhueta do rim (bean anatômico), orientação vertical.
// Lado direito convexo e liso; lado esquerdo com o HILO (entalhe fundo) no
// centro — a marca registrada que faz "ler" como rim. y↑, x→direita.
const KIDNEY_OUTLINE: Array<[number, number]> = [
  [0.02, 1.02],   // topo (lobo superior)
  [0.58, 0.92],   // ombro superior direito
  [0.96, 0.55],   // superior direito
  [1.04, 0.0],    // bojo direito (máx. convexo)
  [0.96, -0.55],  // inferior direito
  [0.58, -0.92],  // ombro inferior direito
  [0.02, -1.02],  // base (lobo inferior)
  [-0.54, -0.88], // inferior esquerdo
  [-0.92, -0.46], // corpo inferior esquerdo (lobo plump)
  [-0.68, -0.14], // entrada do hilo (baixo)
  [-0.34, 0.0],   // PONTA DO HILO (entalhe fundo, para dentro)
  [-0.68, 0.14],  // entrada do hilo (cima)
  [-0.92, 0.46],  // corpo superior esquerdo (lobo plump)
  [-0.54, 0.88],  // superior esquerdo
];

function buildOutlinePolygon(samplesPerSegment = 24): Array<[number, number]> {
  const pts = KIDNEY_OUTLINE;
  const n = pts.length;
  const poly: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      poly.push([x, y]);
    }
  }
  return poly;
}

function pointInPolygon(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPolygon(x: number, y: number, poly: Array<[number, number]>): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0];
    const ay = poly[j][1];
    const bx = poly[i][0];
    const by = poly[i][1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-6;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(x - cx, y - cy);
    if (d < min) min = d;
  }
  return min;
}

/** Textura de um triângulo com contorno luminoso (o "grão" da nuvem). */
function makeTriangleTexture(): THREE.Texture {
  const size = 64;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const m = 8;
  ctx.beginPath();
  ctx.moveTo(cx, m);
  ctx.lineTo(size - m, size - m);
  ctx.lineTo(m, size - m);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 6;
  ctx.stroke();
  // leve preenchimento interno para dar "corpo"
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  const tex = new THREE.Texture(cvs);
  tex.needsUpdate = true;
  return tex;
}

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAngle;
  attribute vec3 aColor;
  attribute float aTwinkle;
  uniform float uSizeScale;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAngle;
  varying float vTw;
  void main() {
    vColor = aColor;
    vAngle = aAngle + uTime * 0.15;
    vTw = 0.7 + 0.3 * sin(uTime * 2.0 + aTwinkle * 6.2831);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uSizeScale / max(-mv.z, 0.001);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAngle;
  varying float vTw;
  void main() {
    // rotaciona a coordenada do sprite por partícula
    vec2 c = gl_PointCoord - 0.5;
    float s = sin(vAngle);
    float co = cos(vAngle);
    vec2 rc = vec2(c.x * co - c.y * s, c.x * s + c.y * co) + 0.5;
    if (rc.x < 0.0 || rc.x > 1.0 || rc.y < 0.0 || rc.y > 1.0) discard;
    vec4 t = texture2D(uTex, rc);
    gl_FragColor = vec4(vColor, 1.0) * t.a * uOpacity * vTw;
  }
`;

export default function HeroKidney({ class: className }: HeroKidneyProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const w0 = window.innerWidth;
    // Nuvem densa e fina (grão estilo Dala) — dividida entre os dois rins.
    const targetCount = w0 < 640 ? 11000 : w0 < 1024 ? 18000 : 26000;

    const poly = buildOutlinePolygon();
    let maxDist = 0;
    for (let i = 0; i < poly.length; i++) {
      const d = distToPolygon(poly[i][0] * 0.5, poly[i][1] * 0.5, poly);
      if (d > maxDist) maxDist = d;
    }

    // Paleta da marca — aqua em intensidades + dourado + faíscas brancas.
    const palette = {
      white: new THREE.Color('#f2fbff'),
      aquaLight: new THREE.Color('#8fe3f0'),
      aqua: new THREE.Color('#48b2c7'),
      aquaDeep: new THREE.Color('#217a92'),
      gold: new THREE.Color('#e6c470'),
    };
    function pickColor(edgeT: number): THREE.Color {
      // edgeT: 0 centro → 1 borda. A BORDA acende (aqua clara/branco); o miolo
      // é mais escuro/aqua-profundo para não "estourar" em branco e a silhueta
      // do rim ficar nítida.
      const r = Math.random();
      if (edgeT > 0.78) {
        if (r < 0.06) return palette.gold.clone();
        return (Math.random() < 0.55 ? palette.white : palette.aquaLight).clone();
      }
      if (edgeT > 0.45) {
        if (r < 0.05) return palette.gold.clone();
        return (Math.random() < 0.5 ? palette.aquaLight : palette.aqua).clone();
      }
      // miolo: mais escuro
      return (Math.random() < 0.6 ? palette.aquaDeep : palette.aqua).clone();
    }

    const home: number[] = [];
    const start: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const angles: number[] = [];
    const phases: number[] = [];
    const seeds: number[] = [];
    const twinkle: number[] = [];

    // Brilho geral mais contido (pedido do cliente: "efeitos muito fortes").
    const COLOR_GAIN = 0.62;

    // Transforma um ponto local do rim (silhueta base, hilo à esquerda) para o
    // mundo. `sign=-1` espelha em x (para o rim da esquerda, com o hilo virado
    // para dentro); `cx` afasta cada rim do centro formando o PAR.
    function pushParticle(
      lx: number,
      ly: number,
      lz: number,
      edgeT: number,
      sizeBase: number,
      sign: number,
      cx: number,
      scale: number,
    ) {
      const x = sign * (lx * scale) + sign * cx;
      const y = ly * scale;
      const z = lz * scale;
      home.push(x, y, z);
      if (reduceMotion) {
        start.push(x, y, z);
      } else {
        const r = 2.6 + Math.random() * 2.6;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(Math.random() * 2 - 1);
        start.push(
          r * Math.sin(ph) * Math.cos(th),
          r * Math.sin(ph) * Math.sin(th),
          r * Math.cos(ph),
        );
      }
      const col = pickColor(edgeT);
      colors.push(col.r * COLOR_GAIN, col.g * COLOR_GAIN, col.b * COLOR_GAIN);
      sizes.push(sizeBase * (0.5 + Math.random() * 1.1));
      angles.push(Math.random() * Math.PI * 2);
      phases.push(Math.random() * Math.PI * 2);
      seeds.push(0.5 + Math.random());
      twinkle.push(Math.random());
    }

    // Gera UM rim (interior volumétrico + borda) em coordenadas locais.
    function addKidney(sign: number, cx: number, scale: number, budget: number) {
      const interiorTarget = Math.floor(budget * 0.7);
      let placed = 0;
      let tries = 0;
      while (placed < interiorTarget && tries < interiorTarget * 40) {
        tries++;
        const x = Math.random() * 2.3 - 1.15;
        const y = Math.random() * 2.3 - 1.15;
        if (!pointInPolygon(x, y, poly)) continue;
        const edge = distToPolygon(x, y, poly);
        const thickness = Math.min(1, edge / (maxDist || 1));
        const z = (Math.random() * 2 - 1) * thickness * 0.3;
        pushParticle(x, y, z, 1 - thickness, 15, sign, cx, scale);
        placed++;
      }
      const edgeTarget = budget - placed;
      for (let i = 0; i < edgeTarget; i++) {
        const p = poly[Math.floor(Math.random() * poly.length)];
        const j = 0.02;
        pushParticle(
          p[0] + (Math.random() * 2 - 1) * j,
          p[1] + (Math.random() * 2 - 1) * j,
          (Math.random() * 2 - 1) * 0.06,
          1,
          14,
          sign,
          cx,
          scale,
        );
      }

      // Ureter — tubo fino que desce do hilo, curvando para dentro/baixo (como
      // no par anatômico). Bézier quadrática em coordenadas locais.
      const ureterCount = Math.floor(budget * 0.06);
      const p0x = -0.28;
      const p0y = -0.06;
      const p1x = -0.42;
      const p1y = -0.78;
      const p2x = -0.62;
      const p2y = -1.42;
      for (let i = 0; i < ureterCount; i++) {
        const tt = Math.random();
        const mt = 1 - tt;
        const bx = mt * mt * p0x + 2 * mt * tt * p1x + tt * tt * p2x;
        const by = mt * mt * p0y + 2 * mt * tt * p1y + tt * tt * p2y;
        const j = 0.028;
        pushParticle(
          bx + (Math.random() * 2 - 1) * j,
          by + (Math.random() * 2 - 1) * j,
          (Math.random() * 2 - 1) * 0.04,
          0.85,
          13,
          sign,
          cx,
          scale,
        );
      }
    }

    // PAR de rins: hilos voltados um para o outro (anatômico).
    //  - rim direito: sign=+1, hilo (à esquerda na silhueta) fica virado p/ dentro
    //  - rim esquerdo: sign=-1 (espelhado), hilo fica virado p/ dentro
    const pairScale = 0.62;
    const pairGap = 0.64;
    addKidney(1, pairGap, pairScale, Math.floor(targetCount / 2));
    addKidney(-1, pairGap, pairScale, Math.floor(targetCount / 2));

    const count = home.length / 3;
    const homeArr = new Float32Array(home);
    const startArr = new Float32Array(start);
    const positions = new Float32Array(startArr);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(sizes), 1));
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(new Float32Array(angles), 1));
    geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(new Float32Array(twinkle), 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: makeTriangleTexture() },
        uSizeScale: { value: 1 },
        uOpacity: { value: 1 },
        uTime: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    const group = new THREE.Group();
    group.add(points);
    const scene = new THREE.Scene();
    scene.add(group);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    // z=3.4 dá margem para o rim aparecer INTEIRO (sem cortar nas bordas).
    camera.position.set(0, 0, 3.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    function resize() {
      const rect = container!.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      const aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      // tamanho do ponto proporcional à resolução (para não sumir em telas densas)
      material.uniforms.uSizeScale.value = h * dpr * 0.0016;
      // Full-bleed: empurra o par para a direita para não invadir o texto.
      group.position.x = aspect > 1.15 ? 1.35 : 0;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let targetRotY = 0;
    let targetRotX = 0;
    let rotY = 0;
    let rotX = 0;
    let scrollNorm = 0;

    function onPointer(e: PointerEvent) {
      // rotação contida para o rim NUNCA perder a orientação anatômica
      targetRotY = (e.clientX / window.innerWidth - 0.5) * 2 * 0.28;
      targetRotX = (e.clientY / window.innerHeight - 0.5) * 2 * 0.16;
    }
    function onScroll() {
      scrollNorm = window.scrollY || 0;
    }
    if (!reduceMotion) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const clock = new THREE.Clock();
    let intro = 0;
    let raf = 0;
    let running = true;

    function frame() {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      material.uniforms.uTime.value = t;

      if (intro < 1) intro = Math.min(1, intro + dt / 2.0);
      const eased = 1 - Math.pow(1 - intro, 3);

      const driftAmp = reduceMotion ? 0 : 0.035;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const ph = phases[i];
        const sd = seeds[i];
        const hx = homeArr[ix] + Math.sin(t * 0.6 * sd + ph) * driftAmp;
        const hy = homeArr[ix + 1] + Math.cos(t * 0.5 * sd + ph * 1.3) * driftAmp;
        const hz = homeArr[ix + 2] + Math.sin(t * 0.7 * sd + ph * 0.7) * driftAmp;
        pos.array[ix] = startArr[ix] + (hx - startArr[ix]) * eased;
        pos.array[ix + 1] = startArr[ix + 1] + (hy - startArr[ix + 1]) * eased;
        pos.array[ix + 2] = startArr[ix + 2] + (hz - startArr[ix + 2]) * eased;
      }
      pos.needsUpdate = true;

      // Scroll: 1º scroll gira/sobe; 2º scroll some (fade).
      const vh = window.innerHeight || 1;
      const sp = scrollNorm / vh;
      const fade = Math.max(0, 1 - Math.max(0, sp - 0.85) / 0.75);
      material.uniforms.uOpacity.value = reduceMotion ? 1 : fade;

      const auto = reduceMotion ? 0 : Math.sin(t * 0.25) * 0.05;
      const scrollSpin = reduceMotion ? 0 : Math.min(sp, 1.5) * 0.5;
      rotY += (targetRotY + auto + scrollSpin - rotY) * 0.06;
      rotX += (targetRotX - rotX) * 0.06;
      group.rotation.y = rotY;
      group.rotation.x = rotX;
      group.position.y = reduceMotion ? 0 : sp * 0.9;
      group.position.z = reduceMotion ? 0 : -Math.max(0, sp - 0.85) * 1.8;

      renderer.render(scene, camera);
    }
    frame();

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !running) {
            running = true;
            clock.getDelta();
            frame();
          } else if (!entry.isIntersecting) {
            running = false;
            cancelAnimationFrame(raf);
          }
        });
      },
      { threshold: 0.01 },
    );
    io.observe(container);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      geometry.dispose();
      material.uniforms.uTex.value.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
