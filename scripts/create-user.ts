/**
 * Cria uma conta de EQUIPE no painel — quem opera o blog sem ser médico
 * (agência, secretaria, quem escreve o conteúdo).
 *
 *   npm run create:user -- contato@exemplo.com "Nome da Agência"
 *
 * Para os três médicos use `npm run seed:admins`: lá o nome e o vínculo com o
 * perfil público saem de src/data/doctors.ts, e é isso que faz o artigo exibir
 * CRM/RQE/foto. Aqui `doctor_id` fica NULL de propósito — a conta publica
 * normalmente e escolhe o médico autor no formulário.
 *
 * MESMO PODER, SEM EXCEÇÃO
 * Não há papéis no sistema. A conta criada aqui pode publicar, excluir,
 * redefinir a senha dos médicos e suspender acessos, igual a eles. É o modelo
 * escolhido; se algum dia precisar de acesso restrito, será uma mudança de
 * verdade no schema e no middleware, não uma flag aqui.
 *
 * A senha temporária é ALEATÓRIA, impressa uma única vez aqui no terminal, e a
 * conta nasce com `must_change_password = true` — o painel obriga a troca no
 * primeiro acesso. Nenhuma senha fica em variável de ambiente, arquivo ou git.
 *
 * É idempotente: se o e-mail já existe, avisa e não mexe em nada. Para
 * redefinir a senha de alguém, use /admin/usuarios (é para isso que a tela
 * existe) — este script nunca sobrescreve uma conta.
 *
 * Roda no Node puro (sem Vite), por isso os imports são relativos e não usam
 * o alias `@/`.
 */
import { generateTemporaryPassword, hashPassword } from '../src/lib/auth/password.ts';
import { db, dbConfigError } from '../src/lib/db.ts';

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function usage(): never {
  console.error(
    [
      '',
      'Uso:',
      '  npm run create:user -- <email> "<Nome exibido>"',
      '',
      'Exemplo:',
      '  npm run create:user -- contato@exemplo.com "Nome da Agência"',
      '',
      'Para os três médicos, use `npm run seed:admins` — o nome e o vínculo com o',
      'perfil público vêm de src/data/doctors.ts.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

async function main() {
  const configError = dbConfigError();
  if (configError) fail(`${configError}\n  Rode com um .env preenchido na raiz do projeto.`);

  const [rawEmail, ...nameParts] = process.argv.slice(2);
  if (!rawEmail || nameParts.length === 0) usage();

  const email = rawEmail.trim().toLowerCase();

  // Junta o resto dos argumentos em vez de ler só o segundo: sem as aspas, o
  // shell parte "Luneta Lab" em dois argumentos e a conta nasceria como
  // "Luneta" — errado, e sem nenhum aviso. Assim funciona com e sem aspas.
  const name = nameParts.join(' ').replace(/\s+/g, ' ').trim();

  // As mesmas regras que o banco aplica (0001_init.sql), verificadas aqui para
  // que o erro seja legível em vez de uma violação de CHECK do Postgres.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`E-mail inválido: "${rawEmail}".`);
  if (name.length < 2 || name.length > 120) {
    fail(`O nome precisa ter entre 2 e 120 caracteres (recebi ${name.length}).`);
  }

  // O e-mail é citext e unique no banco, então o INSERT falharia de qualquer
  // forma. Checar antes troca um erro de constraint por uma mensagem útil.
  const { data: existing, error: readError } = await db()
    .from('admin_users')
    .select('name, active')
    .eq('email', email)
    .maybeSingle();

  if (readError) {
    fail(
      `Não foi possível consultar admin_users: ${readError.message}\n` +
        '  As migrations em supabase/migrations/ já foram aplicadas no projeto?',
    );
  }

  if (existing) {
    const account = existing as { name: string; active: boolean };
    console.log(
      `\n· ${email} já tem conta (${account.name}${account.active ? '' : ', suspensa'}).` +
        '\n  Nada foi alterado. Para trocar a senha, use Equipe → Redefinir senha no painel.\n',
    );
    return;
  }

  const password = generateTemporaryPassword();

  const { error } = await db()
    .from('admin_users')
    .insert({
      // NULL = conta de equipe. Exige a migration 0002; sem ela o INSERT falha
      // com violação de NOT NULL.
      doctor_id: null,
      email,
      name,
      password_hash: await hashPassword(password),
      must_change_password: true,
    });

  if (error) {
    const hint = /null value in column "doctor_id"/i.test(error.message)
      ? '\n  Falta aplicar supabase/migrations/0002_contas_de_equipe.sql no Supabase.'
      : '';
    fail(`Falha ao criar a conta: ${error.message}${hint}`);
  }

  console.log('\n' + '─'.repeat(72));
  console.log('CONTA CRIADA — anote a senha agora, ela não será exibida de novo.');
  console.log('─'.repeat(72));
  console.log(`\n  ${name}`);
  console.log(`  e-mail: ${email}`);
  console.log(`  senha:  ${password}`);
  console.log('\n' + '─'.repeat(72));
  console.log('Entregue a senha pessoalmente ou por telefone — nunca por e-mail ou');
  console.log('mensagem. No primeiro acesso o painel exige a troca por uma senha própria.');
  console.log('─'.repeat(72) + '\n');
}

main().catch((error: unknown) => fail((error as Error).message));
