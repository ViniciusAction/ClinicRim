import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Hash de senha com scrypt.
 *
 * POR QUE SCRYPT E NÃO BCRYPT/ARGON2
 * scrypt está em `node:crypto` — zero dependência nova, zero binário nativo
 * para compilar no build da Vercel. É recomendado pelo OWASP e, ao contrário
 * do bcrypt, é *memory-hard*: encarece ataque com GPU/ASIC, não só com CPU.
 *
 * FORMATO ARMAZENADO
 *   scrypt$<N>$<r>$<p>$<salt_b64url>$<hash_b64url>
 * Os parâmetros vão junto do hash. Assim, endurecer o custo no futuro não
 * invalida as senhas já cadastradas: cada hash é verificado com os parâmetros
 * com que foi criado, e `needsRehash()` avisa quais devem ser regravados no
 * próximo login bem-sucedido.
 */

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** Custo atual. N=16384 usa ~16 MB e leva ~80-100 ms — bom equilíbrio para serverless. */
const CURRENT: ScryptParams = { N: 16384, r: 8, p: 1 };

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Folga sobre os 128*N*r bytes que o scrypt precisa; o default do Node (32 MB) é apertado. */
const MAX_MEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // NFKC: "café" digitado com acento composto vs. decomposto são bytes
    // diferentes. Sem normalizar, a mesma senha falharia em teclados distintos.
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { ...params, maxmem: MAX_MEM },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await derive(password, salt, CURRENT);

  return [
    'scrypt',
    CURRENT.N,
    CURRENT.r,
    CURRENT.p,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

/**
 * Verifica a senha em tempo constante.
 * Nunca lança: hash corrompido ou em formato desconhecido devolve `false`.
 *
 * Toda recusa por motivo TÉCNICO (formato inválido, falha do scrypt) é
 * registrada no console. Sem isso, uma falha de infraestrutura vira
 * "senha incorreta" na tela e fica indistinguível de erro de digitação —
 * exatamente o tipo de bug que só se descobre com o usuário travado do lado de
 * fora. Nunca logamos a senha nem o hash.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt' || !saltB64 || !hashB64) {
      console.error('[password] hash em formato desconhecido (scheme=%s)', scheme);
      return false;
    }

    const params: ScryptParams = { N: Number(n), r: Number(r), p: Number(p) };
    if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) {
      console.error('[password] parâmetros de scrypt inválidos: N=%s r=%s p=%s', n, r, p);
      return false;
    }

    const expected = Buffer.from(hashB64, 'base64url');
    const actual = await derive(password, Buffer.from(saltB64, 'base64url'), params);

    if (expected.length !== actual.length) {
      console.error(
        '[password] tamanho de hash inesperado: esperado %d, derivado %d',
        expected.length,
        actual.length,
      );
      return false;
    }

    // timingSafeEqual exige mesmo comprimento — a checagem acima garante isso.
    return timingSafeEqual(expected, actual);
  } catch (error) {
    console.error('[password] scrypt falhou:', (error as Error).message);
    return false;
  }
}

/** True quando o hash foi criado com custo menor que o atual e vale regravar. */
export function needsRehash(stored: string): boolean {
  const [scheme, n, r, p] = stored.split('$');
  if (scheme !== 'scrypt') return true;
  return Number(n) < CURRENT.N || Number(r) < CURRENT.r || Number(p) < CURRENT.p;
}

/**
 * Gera uma senha inicial legível ao telefone: 4 grupos de 4 caracteres.
 * Alfabeto sem 0/O/1/l/I — o médico vai receber isso por telefone ou papel.
 * ~20 bits por grupo, 80 bits no total: forte o suficiente como senha temporária.
 */
export function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);

  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12), chars.slice(12, 16)]
    .map((group) => group.join(''))
    .join('-');
}

/* ── Política de senha ─────────────────────────────────────────────────────
 * Mínimo 12 caracteres e sem senha óbvia. Deliberadamente NÃO exigimos
 * "1 maiúscula + 1 número + 1 símbolo": essa regra só produz `Senha@123`,
 * que é pior que uma frase longa. Comprimento é o que importa.
 * (Alinhado com NIST SP 800-63B.)
 */

const MIN_LENGTH = 12;
const MAX_LENGTH = 200;

/** Senhas óbvias no contexto — checagem por substring, não igualdade. */
const BLOCKED = [
  'senha',
  'password',
  'clinica',
  'clinicarim',
  'rim2026',
  'admin',
  '123456',
  'qwerty',
  'abcdef',
  'nefrologia',
  'urologia',
  'endocrinologia',
];

/** Devolve a lista de problemas; vazia = senha aceita. */
export function validatePassword(password: string, context: { email?: string; name?: string } = {}) {
  const errors: string[] = [];
  const value = password.normalize('NFKC');
  const lower = value.toLowerCase();

  if (value.length < MIN_LENGTH) {
    errors.push(`A senha precisa de pelo menos ${MIN_LENGTH} caracteres.`);
  }
  if (value.length > MAX_LENGTH) {
    errors.push(`A senha pode ter no máximo ${MAX_LENGTH} caracteres.`);
  }
  if (BLOCKED.some((blocked) => lower.includes(blocked))) {
    errors.push('Essa senha é previsível demais. Prefira uma frase que só você saiba.');
  }
  if (/^(.)\1+$/.test(value)) {
    errors.push('A senha não pode ser um único caractere repetido.');
  }

  // Nome e e-mail são públicos no site — não servem de senha.
  const localPart = context.email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
    errors.push('A senha não pode conter o seu e-mail.');
  }
  for (const part of (context.name ?? '').toLowerCase().split(/\s+/)) {
    if (part.length >= 4 && lower.includes(part)) {
      errors.push('A senha não pode conter o seu nome.');
      break;
    }
  }

  return errors;
}
