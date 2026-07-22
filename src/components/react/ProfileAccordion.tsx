import { useId, useState } from 'react';

/**
 * Disclosure acessível do "perfil completo" do médico.
 * Suporta `inverted` para uso em fundos escuros (dark glass cards).
 * ⚠️ Os parágrafos do perfil são VERBATIM (vêm via props).
 */
interface ProfileAccordionProps {
  paragraphs: string[];
  triggerLabel?: string;
  doctorName?: string;
  inverted?: boolean;
}

export default function ProfileAccordion({
  paragraphs,
  triggerLabel = 'Clique para ver o perfil completo',
  doctorName,
  inverted = false,
}: ProfileAccordionProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`pt-4 ${inverted ? 'border-t border-white/10' : 'border-t border-ink-100'}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex w-full items-center justify-between gap-3 rounded-md text-left font-sans text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-400',
          inverted
            ? 'text-azure-300 hover:text-azure-100'
            : 'text-azure-700 hover:text-azure-900',
        ].join(' ')}
      >
        <span>
          {triggerLabel}
          {doctorName ? <span className="sr-only"> — {doctorName}</span> : null}
        </span>
        <svg
          className={[
            'size-4 shrink-0 transition-transform',
            open ? 'rotate-180' : '',
            inverted ? 'text-azure-400' : 'text-azure-500',
          ].join(' ')}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className={`mt-3 space-y-3 font-sans text-sm leading-relaxed ${
          inverted ? 'text-azure-100' : 'text-ink-600'
        }`}
      >
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
