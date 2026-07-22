import { useEffect, useState } from 'react';

/**
 * Carrossel "Nossos Especialistas" — layout inspirado no "Our team" da Dala:
 * título/intro à esquerda, foto grande em destaque no centro, nome + especialidade
 * à direita, setas circulares embaixo e prévias escurecidas dos vizinhos nas
 * laterais. Troca com fade; autoplay com pausa ao interagir.
 */
export interface CarouselDoctor {
  id: string;
  name: string;
  role: string;
  specialty: string;
  crm: string;
  rqe: string;
  miniBio: string;
  photo: string | null;
  photoW: number;
  photoH: number;
  wa: string | null;
}

interface Props {
  eyebrow?: string;
  title: string;
  intro?: string;
  doctors: CarouselDoctor[];
}

const ACCENT: Record<string, string> = {
  Nefrologia: 'text-azure-300',
  Endocrinologia: 'text-gold-300',
  Urologia: 'text-ink-200',
};

function initials(name: string) {
  return name
    .replace(/^(Dr\.|Dra\.)\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function DoctorsCarousel({ eyebrow, title, intro, doctors }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = doctors.length;

  const go = (dir: number) => setIndex((i) => (i + dir + n) % n);

  useEffect(() => {
    if (paused || n <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % n), 6000);
    return () => window.clearInterval(id);
  }, [paused, n]);

  const current = doctors[index];
  const prev = doctors[(index - 1 + n) % n];
  const next = doctors[(index + 1) % n];
  const accent = ACCENT[current.specialty] ?? 'text-azure-300';

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Área do "filmstrip": prévias grandes dos vizinhos, logo atrás do
          conteúdo (preenchem o espaço), cortadas nas bordas da tela. */}
      <div className="relative overflow-hidden">
        {prev?.photo && (
          <div className="pointer-events-none absolute top-1/2 left-0 z-0 hidden aspect-[4/5] h-[84%] -translate-x-[18%] -translate-y-1/2 overflow-hidden rounded-3xl opacity-40 grayscale lg:block">
            <img src={prev.photo} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-ink-950/40" />
          </div>
        )}
        {next?.photo && (
          <div className="pointer-events-none absolute top-1/2 right-0 z-0 hidden aspect-[4/5] h-[84%] translate-x-[18%] -translate-y-1/2 overflow-hidden rounded-3xl opacity-40 grayscale lg:block">
            <img src={next.photo} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-ink-950/40" />
          </div>
        )}

        <div className="relative z-10 mx-auto grid max-w-[1120px] items-center gap-8 px-5 py-4 sm:px-8 lg:grid-cols-[1fr_minmax(320px,380px)_1fr] lg:gap-10">
        {/* ── Coluna esquerda: título + intro ── */}
        <div className="text-center lg:text-left">
          {eyebrow && (
            <p className="mb-4 flex justify-center lg:justify-start">
              <span className="inline-flex items-center gap-2 rounded-md border border-azure-400/30 bg-azure-400/10 px-3.5 py-1.5 font-sans text-[11px] font-medium tracking-[0.12em] text-azure-200 uppercase">
                <span className="size-1.5 rounded-full bg-azure-300" aria-hidden="true" />
                {eyebrow}
              </span>
            </p>
          )}
          <h2 className="font-display text-4xl leading-none font-medium tracking-tight text-white sm:text-5xl">
            {title}
          </h2>
          {intro && (
            <p className="mx-auto mt-6 max-w-md font-sans text-base leading-relaxed text-azure-100 lg:mx-0">
              {intro}
            </p>
          )}
        </div>

        {/* ── Centro: foto em destaque ── */}
        <div className="order-first lg:order-none">
          <div
            key={current.id}
            className="relative mx-auto aspect-[4/5] w-full max-w-[360px] overflow-hidden rounded-3xl border border-white/10 bg-ink-900"
            style={{ animation: 'team-fade 0.5s ease-out' }}
          >
            {current.photo ? (
              <img
                src={current.photo}
                alt={`Foto de ${current.name}`}
                width={current.photoW}
                height={current.photoH}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-display text-6xl font-medium text-white/80">
                  {initials(current.name)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Coluna direita: nome + especialidade + CTA ── */}
        <div key={`${current.id}-info`} style={{ animation: 'team-fade 0.5s ease-out' }} className="text-center lg:text-left">
          <p className={`font-sans text-xs font-medium tracking-[0.15em] uppercase ${accent}`}>
            {current.role}
          </p>
          <h3 className="mt-2 font-display text-4xl leading-[1.05] font-medium tracking-tight text-white sm:text-5xl">
            {current.name}
          </h3>
          <p className="mt-3 font-sans text-xs tracking-[0.12em] text-ink-300 uppercase">
            CRM {current.crm}&thinsp;·&thinsp;RQE {current.rqe}
          </p>
          <p className="mx-auto mt-5 max-w-md font-sans text-sm leading-relaxed text-azure-100 lg:mx-0">
            {current.miniBio}
          </p>
          {current.wa && (
            <a
              href={current.wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-md bg-brand-glow px-6 py-3 font-sans text-sm font-medium tracking-[0.08em] text-white uppercase transition-all hover:brightness-110"
            >
              Agendar consulta
            </a>
          )}
        </div>
        </div>
      </div>

      {/* ── Setas ── */}
      {n > 1 && (
        <div className="mt-12 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Especialista anterior"
            className="flex size-12 items-center justify-center rounded-full bg-brand-glow text-white transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-azure-400 focus-visible:outline-none"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="flex items-center gap-2" aria-hidden="true">
            {doctors.map((d, i) => (
              <span
                key={d.id}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-azure-300' : 'w-1.5 bg-white/25'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Próximo especialista"
            className="flex size-12 items-center justify-center rounded-full bg-brand-glow text-white transition-all hover:brightness-110 focus-visible:ring-2 focus-visible:ring-azure-400 focus-visible:outline-none"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
