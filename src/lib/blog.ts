import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

const PAGE_SIZE = 9;

/** Posts publicados (sem rascunhos), mais recentes primeiro. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * Paginação manual (em vez do `paginate()` do Astro) para garantir que
 * /blog SEMPRE exista — mesmo com zero posts — mostrando um estado vazio em
 * vez de retornar 404 enquanto o conteúdo do blog não é publicado.
 */
export function paginatePosts(posts: BlogPost[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: posts.slice(start, start + pageSize),
    currentPage,
    totalPages,
    pageSize,
  };
}

export { PAGE_SIZE };
