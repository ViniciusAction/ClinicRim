/**
 * Cria as contas de painel dos três médicos.
 *
 *   npm run seed:admins -- dr-alexandre=alexandre@exemplo.com \
 *                          dra-bruna=bruna@exemplo.com \
 *                          dr-igor=igor@exemplo.com
 *
 * Cada conta nasce com uma senha temporária ALEATÓRIA, impressa uma única vez
 * aqui no terminal, e com `must_change_password = true` — o painel obriga a
 * troca no primeiro acesso. Nenhuma senha fica em variável de ambiente, em
 * arquivo ou no histórico do git.
 *
 * É idempotente: rodar de novo não mexe em quem já existe. Para redefinir a
 * senha de alguém, use /admin/usuarios (é para isso que a tela existe).
 *
 * Roda no Node puro (sem Vite), por isso os imports são relativos e não usam
 * o alias `@/`.
 */
import { doctors } from '../src/data/doctors.ts';
import { generateTemporaryPassword, hashPassword } from '../src/lib/auth/password.ts';
import { db, dbConfigError } from '../src/lib/db.ts';

const VALID_IDS = doctors.map((doctor) => doctor.id);

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function usage(): never {
  console.error(
    [
      '',
      'Uso:',
      '  npm run seed:admins -- <doctor-id>=<email> [...]',
      '',
      'Médicos disponíveis (src/data/doctors.ts):',
      ...doctors.map((doctor) => `  ${doctor.id.padEnd(14)} ${doctor.name} — ${doctor.role}`),
      '',
      'Exemplo:',
      '  npm run seed:admins -- dr-alexandre=alexandre@clinica.com.br \\',
      '                         dra-bruna=bruna@clinica.com.br \\',
      '                         dr-igor=igor@clinica.com.br',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

/** Converte os argumentos `id=email` em pares validados. */
function parseArgs(argv: string[]): Array<{ doctorId: string; email: string }> {
  if (argv.length === 0) usage();

  return argv.map((argument) => {
    const [doctorId, email] = argument.split('=');

    if (!doctorId || !email) fail(`Argumento inválido: "${argument}". Use o formato id=email.`);
    if (!VALID_IDS.includes(doctorId)) {
      fail(`Médico desconhecido: "${doctorId}". Válidos: ${VALID_IDS.join(', ')}.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`E-mail inválido: "${email}".`);

    return { doctorId, email: email.toLowerCase() };
  });
}

async function main() {
  const configError = dbConfigError();
  if (configError) fail(`${configError}\n  Rode com um .env preenchido na raiz do projeto.`);

  const entries = parseArgs(process.argv.slice(2));

  const duplicated = entries.filter(
    (entry, index) => entries.findIndex((other) => other.doctorId === entry.doctorId) !== index,
  );
  if (duplicated.length > 0) fail(`Médico repetido nos argumentos: ${duplicated[0]!.doctorId}.`);

  const { data: existing, error: readError } = await db()
    .from('admin_users')
    .select('doctor_id, email');

  if (readError) {
    fail(
      `Não foi possível ler admin_users: ${readError.message}\n` +
        '  A migration supabase/migrations/0001_init.sql já foi aplicada no projeto?',
    );
  }

  const alreadySeeded = new Set((existing ?? []).map((row) => row.doctor_id as string));
  const created: Array<{ name: string; email: string; password: string }> = [];

  for (const { doctorId, email } of entries) {
    const doctor = doctors.find((candidate) => candidate.id === doctorId)!;

    if (alreadySeeded.has(doctorId)) {
      console.log(`· ${doctor.name} — já cadastrado, pulando.`);
      continue;
    }

    const password = generateTemporaryPassword();

    const { error } = await db()
      .from('admin_users')
      .insert({
        doctor_id: doctorId,
        email,
        name: doctor.name,
        password_hash: await hashPassword(password),
        must_change_password: true,
      });

    if (error) fail(`Falha ao criar ${doctor.name}: ${error.message}`);

    created.push({ name: doctor.name, email, password });
    console.log(`✔ ${doctor.name} — conta criada.`);
  }

  if (created.length === 0) {
    console.log('\nNada a fazer: todas as contas informadas já existiam.\n');
    return;
  }

  console.log('\n' + '─'.repeat(72));
  console.log('SENHAS TEMPORÁRIAS — anote agora, não serão exibidas de novo.');
  console.log('─'.repeat(72));
  for (const account of created) {
    console.log(`\n  ${account.name}`);
    console.log(`  e-mail: ${account.email}`);
    console.log(`  senha:  ${account.password}`);
  }
  console.log('\n' + '─'.repeat(72));
  console.log('Entregue cada senha pessoalmente ou por telefone — nunca por e-mail ou');
  console.log('mensagem. No primeiro acesso o painel exige a troca por uma senha própria.');
  console.log('─'.repeat(72) + '\n');
}

main().catch((error: unknown) => fail((error as Error).message));
