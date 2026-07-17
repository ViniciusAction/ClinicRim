/**
 * Especialidades da Clínica RIM.
 * Fonte única de verdade — usada nos médicos, no blog (categorias),
 * na seção de sintomas e nas opções do formulário.
 */
export const SPECIALTIES = ['Nefrologia', 'Endocrinologia', 'Urologia'] as const;

export type Specialty = (typeof SPECIALTIES)[number];

/** Slugs estáveis para URLs do blog por especialidade (/blog/especialidade/[specialty]). */
export const SPECIALTY_SLUGS: Record<Specialty, string> = {
  Nefrologia: 'nefrologia',
  Endocrinologia: 'endocrinologia',
  Urologia: 'urologia',
};

/** Resolve um slug de volta para o rótulo da especialidade. */
export function specialtyFromSlug(slug: string): Specialty | undefined {
  return (Object.keys(SPECIALTY_SLUGS) as Specialty[]).find((s) => SPECIALTY_SLUGS[s] === slug);
}
