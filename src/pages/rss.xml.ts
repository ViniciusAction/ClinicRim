import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '@/lib/blog';

/**
 * Feed RSS do blog. Sob demanda porque os artigos vêm do Postgres — assim um
 * artigo novo entra no feed no mesmo instante em que é publicado.
 */
export const prerender = false;

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();

  return rss({
    title: 'Blog — Clínica RIM',
    description: 'Conteúdo médico sobre Nefrologia, Endocrinologia e Urologia.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.title,
      description: post.description,
      // Não-nulo com segurança: `getPublishedPosts` filtra por status
      // 'published', e o banco recusa publicado sem data
      // (constraint posts_published_needs_date).
      pubDate: post.publishedAt!,
      link: `/blog/${post.slug}/`,
      categories: [post.specialty, ...post.tags],
    })),
    customData: '<language>pt-BR</language>',
  });
}
