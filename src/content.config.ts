import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { SPECIALTIES } from '@/data/specialties';
import { doctors } from '@/data/doctors';

/**
 * Coleção do blog (Content Layer API do Astro 5).
 *
 * `author` referencia o `id` de um médico em src/data/doctors.ts — assim o
 * blog reaproveita a mesma fonte usada na seção "Corpo Clínico" (DRY) e os
 * posts podem futuramente puxar CRM/RQE/especialidade do autor automaticamente.
 *
 * `specialty` categoriza o post para SEO de conteúdo médico e alimenta as
 * páginas /blog/especialidade/[specialty].
 */
const authorIds = doctors.map((d) => d.id) as [string, ...string[]];

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      cover: image(),
      coverAlt: z.string(),
      tags: z.array(z.string()).default([]),
      author: z.enum(authorIds),
      specialty: z.enum(SPECIALTIES),
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog };
