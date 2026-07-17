import { z } from 'zod';
import { isValidPhoneBR } from '@/lib/utils/phone';

/**
 * Schema do formulário de contato (abas "Sou Paciente" / "Sou Médico").
 *
 * Modelado como UM schema com validação condicional por `tipo` (superRefine) —
 * mais ergonômico com react-hook-form do que uma discriminated union, sem
 * perder a regra específica de cada perfil:
 *   - Paciente: especialidade DEVE ser uma das opções do menu.
 *   - Médico:   especialidade é texto livre.
 *
 * O consentimento (LGPD) é obrigatório. O TEXTO do consentimento é placeholder
 * e deve ser substituído pelo texto oficial fornecido pela clínica.
 */
export const PATIENT_INTEREST_OPTIONS = [
  'Nefrologia',
  'Endocrinologia',
  'Urologia',
  'Não sei / Gostaria de ajuda',
] as const;

export type PatientInterest = (typeof PATIENT_INTEREST_OPTIONS)[number];

export const contactSchema = z
  .object({
    tipo: z.enum(['paciente', 'medico']),
    nomeCompleto: z.string().trim().min(3, 'Informe seu nome completo.'),
    telefone: z
      .string()
      .trim()
      .refine(isValidPhoneBR, 'Informe um WhatsApp/telefone válido com DDD.'),
    email: z.string().trim().email('Informe um e-mail válido.'),
    especialidade: z.string().trim().min(1, 'Selecione ou informe a especialidade de interesse.'),
    consentimento: z
      .boolean()
      .refine((v) => v === true, 'É necessário concordar para enviar seus dados.'),
  })
  .superRefine((data, ctx) => {
    if (
      data.tipo === 'paciente' &&
      !PATIENT_INTEREST_OPTIONS.includes(data.especialidade as PatientInterest)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['especialidade'],
        message: 'Selecione uma das opções de especialidade.',
      });
    }
  });

export type ContactFormValues = z.infer<typeof contactSchema>;

/** Monta a mensagem do WhatsApp a partir dos dados já validados. */
export function buildContactMessage(data: ContactFormValues): string {
  const intro =
    data.tipo === 'paciente'
      ? 'Olá! Sou paciente e gostaria de solicitar contato.'
      : 'Olá! Sou médico(a) e gostaria de entrar em contato.';

  return [
    intro,
    `Nome: ${data.nomeCompleto}`,
    `WhatsApp/Telefone: ${data.telefone}`,
    `E-mail: ${data.email}`,
    `Especialidade de Interesse: ${data.especialidade}`,
  ].join('\n');
}
