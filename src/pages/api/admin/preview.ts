import type { APIRoute } from 'astro';
import { renderPostBody } from '@/lib/blog';

/**
 * Pré-visualização ao vivo do editor: markdown entra, HTML sanitizado sai.
 *
 * POR QUE NO SERVIDOR, E NÃO NO NAVEGADOR
 * Dava para embutir um `marked`/`markdown-it` na página e renderizar no
 * cliente. Seria mais rápido de escrever e estaria ERRADO pelo motivo que mais
 * importa: a prévia precisa mostrar o que vai ser publicado. Dois
 * renderizadores diferentes divergem — em tabela, em aspas tipográficas, em
 * autolink, no que a sanitização remove — e uma prévia que mente é pior que não
 * ter prévia, porque o médico confia nela.
 *
 * Aqui a prévia passa exatamente pelo `renderPostBody()` que a página do artigo
 * usa, com o mesmo rehype-sanitize. O que aparece é o que sai.
 *
 * Fica sob /api/admin/ de propósito: o middleware exige sessão em tudo abaixo
 * desse caminho. Não é um conversor de markdown aberto na internet — seria um
 * jeito bobo de doar CPU a qualquer um.
 */
export const prerender = false;

/**
 * Limite de tamanho. O corpo de um artigo real tem alguns milhares de
 * caracteres; 100 mil é folga generosa. Sem limite, uma requisição com megabytes
 * de markdown patológico ocuparia CPU do servidor a cada tecla digitada.
 */
const MAX_CHARS = 100_000;

export const POST: APIRoute = async ({ request }) => {
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  let markdown: string;

  try {
    const payload = (await request.json()) as { markdown?: unknown };
    markdown = typeof payload.markdown === 'string' ? payload.markdown : '';
  } catch {
    return json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  if (markdown.length > MAX_CHARS) {
    return json({ error: `O texto excede ${MAX_CHARS} caracteres.` }, 413);
  }

  if (!markdown.trim()) return json({ html: '' });

  try {
    return json({ html: await renderPostBody(markdown) });
  } catch (error) {
    console.error('[preview] falha ao renderizar:', (error as Error).message);
    return json({ error: 'Não foi possível gerar a pré-visualização.' }, 500);
  }
};
