/**
 * Mapa do Google — carrega o iframe diretamente ao exibir a seção.
 *
 * Hidrata com client:visible. Quando `embedUrl` está configurado o iframe
 * é renderizado imediatamente (com loading="lazy" para não impactar LCP).
 * Sem `embedUrl`, mostra um placeholder com a foto de fundo.
 */
interface MapEmbedProps {
  /** URL de incorporação do Google Maps (clinic.googleMapsEmbedUrl). */
  embedUrl?: string;
  /** Link "ver no Google Maps" (clinic.googleMapsPlaceUrl). */
  placeUrl?: string;
  /** URL otimizada (astro:assets) de uma foto de fundo para o fallback. */
  backgroundImageUrl?: string;
  title?: string;
}

export default function MapEmbed({
  embedUrl,
  placeUrl,
  backgroundImageUrl,
  title = 'Mapa da localização da Clínica Rim',
}: MapEmbedProps) {
  return (
    <div className="relative h-full min-h-[300px] w-full overflow-hidden rounded-2xl bg-ink-900">
      {embedUrl ? (
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <>
          {backgroundImageUrl && (
            <img
              src={backgroundImageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              width={1200}
              height={900}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/50 to-ink-900/30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-ivory/10 text-azure-100 backdrop-blur-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <span className="font-sans text-sm text-azure-100/80">
              O mapa interativo será exibido aqui assim que o endereço for configurado.
            </span>
          </div>
        </>
      )}

      {placeUrl && (
        <a
          href={placeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-3 bottom-3 rounded-md bg-ivory/95 px-3.5 py-1.5 font-sans text-xs font-medium text-ink-900 hover:bg-ivory"
        >
          Ver no Google Maps
        </a>
      )}
    </div>
  );
}
