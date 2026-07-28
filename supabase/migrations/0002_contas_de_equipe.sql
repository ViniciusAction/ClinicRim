-- ═════════════════════════════════════════════════════════════════════════════
-- Clínica RIM — contas de painel que não são médicos
--
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- É idempotente: rodar de novo não faz nada (drop not null num campo já
-- nulável é no-op).
--
-- POR QUE
-- A 0001 modelou `admin_users.doctor_id` como NOT NULL com CHECK nos três ids
-- de src/data/doctors.ts. Isso amarrava o painel a exatamente 3 contas: as
-- vagas eram as dos médicos, e não existia uma quarta. Qualquer conta
-- operacional — agência, secretaria, quem escreve o conteúdo — era impossível
-- de criar, e o INSERT falhava com violação de CHECK.
--
-- Aqui `doctor_id` passa a aceitar NULL, e NULL significa exatamente isto:
-- "conta de equipe, não é o perfil público de um médico".
--
-- DUAS COISAS QUE CONTINUAM VALENDO DE GRAÇA
--
--   1. O CHECK original NÃO precisa ser tocado. Em SQL, uma constraint CHECK
--      passa quando a expressão resulta em NULL, e `null in ('a','b')` é NULL.
--      Ou seja: quem tem doctor_id preenchido continua obrigado a ser um dos
--      três ids válidos; quem tem NULL passa. Derrubar a constraint só para
--      reescrevê-la com `doctor_id is null or ...` seria trabalho sem efeito.
--
--   2. O UNIQUE também continua correto. O Postgres trata NULLs como
--      DISTINTOS num índice único, então várias contas de equipe convivem sem
--      colidir, enquanto dois médicos com o mesmo doctor_id seguem barrados.
--
-- O que NÃO muda: não há papéis nem níveis de permissão. Toda conta do painel
-- é admin plena, como na 0001. `doctor_id` é vínculo de autoria/perfil, nunca
-- permissão — quem publica escolhe o médico autor no formulário, e isso vale
-- para os três médicos e para as contas de equipe igualmente.
-- ═════════════════════════════════════════════════════════════════════════════

alter table admin_users
  alter column doctor_id drop not null;

comment on column admin_users.doctor_id is
  'Vínculo com o perfil público em src/data/doctors.ts. NULL = conta de equipe '
  '(agência/secretaria), que opera o painel sem ter perfil de médico no site. '
  'NÃO é permissão: toda conta do painel é admin plena.';
