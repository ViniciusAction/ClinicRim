import { Buffer } from 'node:buffer';

/**
 * Cliente mínimo da API do GitHub — o "storage" do blog em produção.
 *
 * POR QUE ISSO EXISTE
 * O painel /admin roda como função serverless na Vercel, e lá o filesystem é
 * SOMENTE LEITURA (só /tmp aceita escrita, e é descartado a cada invocação).
 * Gravar o post com fs.writeFileSync estoura EROFS em produção. Então o
 * repositório passa a ser o banco de dados: publicar = fazer um commit.
 * O push dispara o build da Vercel, que regenera as páginas estáticas do blog.
 *
 * Consequências desse desenho (todas desejáveis aqui):
 *  - o markdown continua em src/content/blog, então a Content Layer, o
 *    `image()` do schema, as páginas por especialidade, o RSS e o sitemap
 *    seguem funcionando exatamente como hoje;
 *  - todo post fica versionado, com histórico e rollback por git;
 *  - o artigo entra no ar ~1-2 min depois de publicar (tempo do build).
 *
 * Usa a Git Data API (blobs → tree → commit → ref) em vez da Contents API
 * porque a Contents API grava UM arquivo por chamada — com capa, seriam dois
 * commits e dois builds. Aqui markdown + imagem vão no MESMO commit, atômico.
 */
const GITHUB_API = 'https://api.github.com';

/**
 * Lê variável de ambiente tanto no runtime da Vercel (process.env) quanto no
 * `npm run dev`, onde o Astro carrega o .env em import.meta.env.
 */
function env(key: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  if (fromProcess) return fromProcess;
  return (import.meta.env as Record<string, string | undefined>)[key];
}

export interface GitHubConfig {
  /** "owner/repo" */
  repo: string;
  token: string;
  branch: string;
}

/** Configuração do GitHub, ou null se não estiver definida. */
export function getGitHubConfig(): GitHubConfig | null {
  const token = env('GITHUB_TOKEN');
  const repo = env('GITHUB_REPO');
  if (!token || !repo) return null;
  return { token, repo, branch: env('GITHUB_BRANCH') || 'main' };
}

class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

async function gh<T>(
  cfg: GitHubConfig,
  path: string,
  init?: { method?: string; body?: string },
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: init?.method ?? 'GET',
    body: init?.body,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'clinica-rim-admin',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new GitHubError(
      `GitHub ${init?.method ?? 'GET'} ${path} respondeu ${res.status}: ${detail}`,
      res.status,
    );
  }

  // 204 No Content não tem corpo para desserializar.
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface FileChange {
  /** Caminho a partir da raiz do repositório. */
  path: string;
  /** Conteúdo do arquivo; `null` remove o arquivo no commit. */
  content: string | Uint8Array | null;
}

/**
 * Aplica todas as mudanças em UM único commit e move a branch.
 * Retorna o sha do commit criado.
 */
export async function commitFiles(
  cfg: GitHubConfig,
  message: string,
  changes: FileChange[],
): Promise<string> {
  // 1. Onde a branch está agora.
  const ref = await gh<{ object: { sha: string } }>(
    cfg,
    `/repos/${cfg.repo}/git/ref/heads/${cfg.branch}`,
  );
  const headSha = ref.object.sha;
  const headCommit = await gh<{ tree: { sha: string } }>(
    cfg,
    `/repos/${cfg.repo}/git/commits/${headSha}`,
  );

  // 2. Um blob por arquivo novo/alterado (remoção não precisa de blob).
  const tree = await Promise.all(
    changes.map(async (change) => {
      if (change.content === null) {
        // sha: null é como a Git Data API expressa "apague este caminho".
        return { path: change.path, mode: '100644', type: 'blob', sha: null };
      }

      const isBinary = typeof change.content !== 'string';
      const blob = await gh<{ sha: string }>(cfg, `/repos/${cfg.repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({
          content: isBinary
            ? Buffer.from(change.content as Uint8Array).toString('base64')
            : change.content,
          encoding: isBinary ? 'base64' : 'utf-8',
        }),
      });

      return { path: change.path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );

  // 3. Nova árvore, partindo da atual (base_tree preserva o resto do repo).
  const newTree = await gh<{ sha: string }>(cfg, `/repos/${cfg.repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
  });

  // 4. Commit apontando para a nova árvore.
  const commit = await gh<{ sha: string }>(cfg, `/repos/${cfg.repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
  });

  // 5. Move a branch — é isso que dispara o deploy na Vercel.
  await gh(cfg, `/repos/${cfg.repo}/git/refs/heads/${cfg.branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });

  return commit.sha;
}

export interface RemoteFile {
  name: string;
  path: string;
  raw: string;
}

/**
 * Lê os arquivos markdown de um diretório do repositório.
 * Diretório inexistente (404) devolve lista vazia — é o estado inicial válido.
 */
export async function listMarkdown(cfg: GitHubConfig, dir: string): Promise<RemoteFile[]> {
  let entries: Array<{ name: string; path: string; type: string }>;

  try {
    entries = await gh<Array<{ name: string; path: string; type: string }>>(
      cfg,
      `/repos/${cfg.repo}/contents/${dir}?ref=${cfg.branch}`,
    );
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return [];
    throw error;
  }

  const files = entries.filter((e) => e.type === 'file' && /\.(md|mdx)$/.test(e.name));

  return Promise.all(
    files.map(async (file) => {
      const blob = await gh<{ content: string }>(
        cfg,
        `/repos/${cfg.repo}/contents/${file.path}?ref=${cfg.branch}`,
      );
      return {
        name: file.name,
        path: file.path,
        raw: Buffer.from(blob.content, 'base64').toString('utf8'),
      };
    }),
  );
}
