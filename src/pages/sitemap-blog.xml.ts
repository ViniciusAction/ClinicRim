import type { APIContext } from 'astro';
import { getPublishedPosts } from '@/lib/blog';
import { SPECIALTIES, SPECIALTY_SLUGS } from '@/data/specialties';

/**
 * Sitemap dos artigos do blog.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O `@astrojs/sitemap` monta o `sitemap-index.xml` durante o BUILD, varrendo as
 * rotas que o build conhece. Quando os artigos moravam em src/content/blog isso
 * bastava: cada post era uma rota estática, e todas apareciam no sitemap.
 *
 * Com os artigos no Postgres, `/blog/[slug]` passou a ser uma rota sob demanda —
 * e o build não tem como saber quais slugs existem. Sem este endpoint, TODOS os
 * artigos desapareceriam do sitemap. Seria uma regressão de SEO silenciosa: o
 * site continuaria funcionando, e ninguém notaria a queda de indexação até
 * meses depois.
 *
 * A divisão de trabalho ficou assim:
 *   · sitemap-index.xml  → páginas estáticas (home, especialistas, contato…),
 *                          gerado no build pelo @astrojs/sitemap;
 *   · sitemap-blog.xml   → artigos e páginas de especialidade, deste endpoint.
 *
 * Os dois estão declarados em public/robots.txt. Buscadores aceitam múltiplas
 * linhas `Sitemap:` — não é preciso unificar.
 */
export const prerender = false;

/** Escapa o que não pode aparecer cru em XML. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface SitemapEntry {
  path: string;
  lastmod?: Date;
  changefreq: string;
  priority: string;
}

export async function GET(context: APIContext) {
  const site = context.site;

  // Sem `site` configurado não há como montar URL absoluta, e sitemap com URL
  // relativa é inválido. Melhor falhar claro que servir um arquivo que os
  // buscadores vão silenciosamente descartar.
  if (!site) {
    return new Response('`site` não configurado em astro.config.mjs.', { status: 500 });
  }

  const posts = await getPublishedPosts();

  const entries: SitemapEntry[] = [
    // A listagem do blog. Muda a cada publicação, por isso `daily`.
    { path: '/blog/', changefreq: 'daily', priority: '0.8' },

    // As três páginas de especialidade existem sempre, com ou sem artigos.
    ...SPECIALTIES.map((specialty) => ({
      path: `/blog/especialidade/${SPECIALTY_SLUGS[specialty]}/`,
      changefreq: 'weekly',
      priority: '0.6',
    })),

    // Os artigos. `lastmod` é `updated_at`, então editar um artigo publicado
    // avisa os buscadores para revisitá-lo — que é justamente o ponto de ter
    // edição.
    ...posts.map((post) => ({
      path: `/blog/${post.slug}/`,
      lastmod: post.updatedAt,
      changefreq: 'monthly',
      priority: '0.7',
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) =>
      [
        '  <url>',
        `    <loc>${escapeXml(new URL(entry.path, site).href)}</loc>`,
        entry.lastmod ? `    <lastmod>${entry.lastmod.toISOString()}</lastmod>` : null,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Buscadores não precisam do minuto exato; uma hora poupa consultas.
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
