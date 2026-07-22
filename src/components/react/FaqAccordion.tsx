import { useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import type { AnswerBlock, FaqCategory } from '@/data/faq';

/**
 * FAQ clean — layout sidebar + acordeão sobre fundo CLARO.
 * Sidebar esquerda: navegação entre categorias (destaque aqua).
 * Área direita: perguntas/respostas da categoria ativa em cards brancos.
 * ⚠️ Perguntas e respostas são VERBATIM (vêm via props).
 */
interface FaqAccordionProps {
  categories: FaqCategory[];
}

function ChevronDown() {
  return (
    <svg
      className="size-4 shrink-0"
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
  );
}

function AnswerContent({ blocks }: { blocks: AnswerBlock[] }) {
  return (
    <div className="space-y-3 px-6 pt-2 pb-6 font-sans text-sm leading-relaxed text-azure-100">
      {blocks.map((block, i) =>
        block.type === 'paragraph' ? (
          <p key={i}>{block.text}</p>
        ) : (
          <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-azure-400">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

export default function FaqAccordion({ categories }: FaqAccordionProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.title ?? '');
  const current = categories.find((c) => c.title === activeCategory) ?? categories[0];

  return (
    <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
      <div className="flex flex-col lg:flex-row">

        {/* ── Sidebar de categorias ── */}
        <div className="border-b border-white/10 bg-ink-950/40 lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="p-4">
            <p className="mb-3 px-3 font-sans text-[10px] font-medium tracking-[0.15em] text-ink-300 uppercase">
              Categorias
            </p>
            <nav aria-label="Categorias do FAQ">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.title;
                return (
                  <button
                    key={cat.title}
                    onClick={() => setActiveCategory(cat.title)}
                    aria-current={isActive ? 'true' : undefined}
                    className={[
                      'group relative block w-full rounded-md px-4 py-3 text-left font-sans text-sm transition-all',
                      isActive
                        ? 'bg-azure-500/10 font-medium text-azure-300'
                        : 'font-medium text-azure-100/70 hover:bg-white/5 hover:text-white',
                    ].join(' ')}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-azure-400"
                        aria-hidden="true"
                      />
                    )}
                    <span className="flex items-center justify-between gap-2">
                      {cat.title}
                      <span
                        className={[
                          'shrink-0 rounded-md px-1.5 py-0.5 font-sans text-[10px] font-medium tabular-nums',
                          isActive ? 'bg-azure-500/20 text-azure-200' : 'bg-white/10 text-ink-300',
                        ].join(' ')}
                      >
                        {cat.items.length}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-white/10 px-7 py-4">
            <p className="font-sans text-[11px] text-ink-300">
              {categories.reduce((acc, c) => acc + c.items.length, 0)} perguntas no total
            </p>
          </div>
        </div>

        {/* ── Acordeão da categoria ativa ── */}
        <div className="flex-1 p-4 lg:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
            <h3 className="font-display text-xs font-medium tracking-[0.15em] text-azure-300 uppercase">
              {current?.title}
            </h3>
            <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
          </div>

          <Accordion.Root type="single" collapsible className="space-y-2.5">
            {current?.items.map((item, index) => {
              const value = `${current.title}-${index}`;
              return (
                <Accordion.Item
                  key={value}
                  value={value}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-ink-950/40 transition-colors data-[state=open]:border-azure-500/30 data-[state=open]:bg-azure-500/5"
                >
                  <Accordion.Header className="m-0">
                    <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-sans text-sm font-medium text-white transition-colors hover:text-azure-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-azure-400">
                      <span>{item.question}</span>
                      <span className="shrink-0 text-azure-500 transition-transform duration-200 group-data-[state=open]:rotate-180">
                        <ChevronDown />
                      </span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content forceMount className="data-[state=closed]:hidden">
                    <AnswerContent blocks={item.answer} />
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion.Root>
        </div>
      </div>
    </div>
  );
}
