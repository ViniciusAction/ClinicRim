import { cloneElement, isValidElement, useId, useState, type ReactElement } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  contactSchema,
  buildContactMessage,
  PATIENT_INTEREST_OPTIONS,
  type ContactFormValues,
} from '@/lib/schemas/contact';
import { maskPhoneBR } from '@/lib/utils/phone';

/**
 * Formulário de Atendimento — abas "Sou Paciente" / "Sou Médico".
 *
 * Hidrata com client:visible (bem abaixo da dobra). Estado real: aba ativa,
 * validação (Zod + react-hook-form), máscara de telefone, consentimento LGPD
 * e estados de loading/sucesso/erro.
 *
 * Envio: estratégia escolhida foi WhatsApp (wa.me) — não há backend. No
 * submit, montamos a mensagem com os dados e abrimos o WhatsApp da clínica
 * em nova aba. Sem `whatsappNumber` configurado em clinic.ts, o formulário
 * mostra um aviso e desabilita o envio (não falha silenciosamente).
 *
 * ⚠️ Labels de campo e dos botões são VERBATIM. O texto de consentimento LGPD
 * é PLACEHOLDER — substituir pelo texto oficial fornecido pela clínica.
 */
type Tab = 'paciente' | 'medico';

interface ContactFormProps {
  /** Número em formato internacional (clinic.whatsappNumber), sem '+'. */
  whatsappNumber?: string;
}

const LGPD_PLACEHOLDER_TEXT =
  'Li e concordo com o uso dos meus dados para contato pela Clínica RIM, conforme a Política de Privacidade. [Texto provisório — substituir pelo texto oficial de consentimento LGPD da clínica.]';

function fieldId(prefix: string, name: string) {
  return `${prefix}-${name}`;
}

export default function ContactForm({ whatsappNumber }: ContactFormProps) {
  const [tab, setTab] = useState<Tab>('paciente');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const idPrefix = useId();
  const canSend = Boolean(whatsappNumber && whatsappNumber.trim().length > 0);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      tipo: 'paciente',
      nomeCompleto: '',
      telefone: '',
      email: '',
      especialidade: '',
      consentimento: false,
    },
  });

  function handleTabChange(value: string) {
    const next = value as Tab;
    setTab(next);
    setStatus('idle');
    reset({
      tipo: next,
      nomeCompleto: '',
      telefone: '',
      email: '',
      especialidade: '',
      consentimento: false,
    });
  }

  const onSubmit = handleSubmit((data) => {
    if (!whatsappNumber) {
      setStatus('error');
      return;
    }

    try {
      const message = buildContactMessage(data);
      const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      setStatus('success');
      reset({
        tipo: data.tipo,
        nomeCompleto: '',
        telefone: '',
        email: '',
        especialidade: '',
        consentimento: false,
      });
    } catch {
      setStatus('error');
    }
  });

  return (
    <Tabs.Root
      value={tab}
      onValueChange={handleTabChange}
      className="mx-auto max-w-xl rounded-3xl border border-ink-100 bg-white p-7 shadow-xl shadow-ink-900/5 sm:p-9"
    >
      <Tabs.List
        aria-label="Tipo de contato"
        className="grid grid-cols-2 gap-2 rounded-full bg-ivory-100 p-1"
      >
        <Tabs.Trigger
          value="paciente"
          className="rounded-full px-4 py-2.5 font-sans text-sm font-semibold text-ink-500 transition-colors focus-visible:ring-2 focus-visible:ring-azure-400 focus-visible:outline-none data-[state=active]:bg-ink-900 data-[state=active]:text-ivory data-[state=active]:shadow-sm"
        >
          Sou Paciente
        </Tabs.Trigger>
        <Tabs.Trigger
          value="medico"
          className="rounded-full px-4 py-2.5 font-sans text-sm font-semibold text-ink-500 transition-colors focus-visible:ring-2 focus-visible:ring-azure-400 focus-visible:outline-none data-[state=active]:bg-ink-900 data-[state=active]:text-ivory data-[state=active]:shadow-sm"
        >
          Sou Médico
        </Tabs.Trigger>
      </Tabs.List>

      {!canSend && (
        <p
          role="status"
          className="mt-4 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 font-sans text-sm text-gold-700"
        >
          O envio por WhatsApp será habilitado assim que o número de contato da clínica for
          configurado.
        </p>
      )}

      <Tabs.Content value="paciente" forceMount className="data-[state=inactive]:hidden">
        <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
          <input type="hidden" {...register('tipo')} value="paciente" />

          <Field
            id={fieldId(idPrefix, 'paciente-nome')}
            label="Nome Completo"
            error={errors.nomeCompleto?.message}
          >
            <input
              id={fieldId(idPrefix, 'paciente-nome')}
              type="text"
              autoComplete="name"
              className={inputClass(Boolean(errors.nomeCompleto))}
              {...register('nomeCompleto')}
            />
          </Field>

          <Field
            id={fieldId(idPrefix, 'paciente-telefone')}
            label="WhatsApp / Telefone"
            error={errors.telefone?.message}
          >
            <Controller
              name="telefone"
              control={control}
              render={({ field }) => (
                <input
                  id={fieldId(idPrefix, 'paciente-telefone')}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(43) 99999-9999"
                  className={inputClass(Boolean(errors.telefone))}
                  value={field.value}
                  onChange={(e) => field.onChange(maskPhoneBR(e.target.value))}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>

          <Field
            id={fieldId(idPrefix, 'paciente-email')}
            label="E-mail"
            error={errors.email?.message}
          >
            <input
              id={fieldId(idPrefix, 'paciente-email')}
              type="email"
              autoComplete="email"
              className={inputClass(Boolean(errors.email))}
              {...register('email')}
            />
          </Field>

          <Field
            id={fieldId(idPrefix, 'paciente-especialidade')}
            label="Especialidade de Interesse"
            error={errors.especialidade?.message}
          >
            <select
              id={fieldId(idPrefix, 'paciente-especialidade')}
              className={inputClass(Boolean(errors.especialidade))}
              defaultValue=""
              {...register('especialidade')}
            >
              <option value="" disabled>
                Selecione uma opção
              </option>
              {PATIENT_INTEREST_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <ConsentCheckbox
            id={fieldId(idPrefix, 'paciente-consentimento')}
            register={register}
            error={errors.consentimento?.message}
          />

          <SubmitButton
            label="Enviar Dados e Solicitar Contato"
            disabled={!canSend}
            isSubmitting={isSubmitting}
          />

          <StatusMessage status={status} />
        </form>
      </Tabs.Content>

      <Tabs.Content value="medico" forceMount className="data-[state=inactive]:hidden">
        <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
          <input type="hidden" {...register('tipo')} value="medico" />

          <Field
            id={fieldId(idPrefix, 'medico-nome')}
            label="Nome Completo"
            error={errors.nomeCompleto?.message}
          >
            <input
              id={fieldId(idPrefix, 'medico-nome')}
              type="text"
              autoComplete="name"
              className={inputClass(Boolean(errors.nomeCompleto))}
              {...register('nomeCompleto')}
            />
          </Field>

          <Field
            id={fieldId(idPrefix, 'medico-telefone')}
            label="WhatsApp / Telefone"
            error={errors.telefone?.message}
          >
            <Controller
              name="telefone"
              control={control}
              render={({ field }) => (
                <input
                  id={fieldId(idPrefix, 'medico-telefone')}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(43) 99999-9999"
                  className={inputClass(Boolean(errors.telefone))}
                  value={field.value}
                  onChange={(e) => field.onChange(maskPhoneBR(e.target.value))}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>

          <Field
            id={fieldId(idPrefix, 'medico-email')}
            label="E-mail"
            error={errors.email?.message}
          >
            <input
              id={fieldId(idPrefix, 'medico-email')}
              type="email"
              autoComplete="email"
              className={inputClass(Boolean(errors.email))}
              {...register('email')}
            />
          </Field>

          <Field
            id={fieldId(idPrefix, 'medico-especialidade')}
            label="Especialidade de Interesse"
            error={errors.especialidade?.message}
          >
            <input
              id={fieldId(idPrefix, 'medico-especialidade')}
              type="text"
              className={inputClass(Boolean(errors.especialidade))}
              {...register('especialidade')}
            />
          </Field>

          <ConsentCheckbox
            id={fieldId(idPrefix, 'medico-consentimento')}
            register={register}
            error={errors.consentimento?.message}
          />

          <SubmitButton label="Enviar Mensagem" disabled={!canSend} isSubmitting={isSubmitting} />

          <StatusMessage status={status} />
        </form>
      </Tabs.Content>
    </Tabs.Root>
  );
}

// --- Subcomponentes internos (apenas deste arquivo) -----------------------

function inputClass(hasError: boolean) {
  return [
    'block w-full rounded-xl border bg-white px-4 py-2.5 font-sans text-sm text-ink-900 shadow-sm transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    hasError
      ? 'border-red-400 focus:ring-red-400'
      : 'border-ink-200 focus:border-azure-400 focus:ring-azure-400',
  ].join(' ');
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactElement;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-sans text-sm font-medium text-ink-900">
        {label}
      </label>
      {/* clona o filho único para injetar aria-* sem repetir os atributos em cada caller */}
      {isValidElement(children)
        ? cloneElement(children, {
            'aria-invalid': Boolean(error) || undefined,
            'aria-describedby': error ? errorId : undefined,
          } as Record<string, unknown>)
        : children}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function ConsentCheckbox({
  id,
  register,
  error,
}: {
  id: string;
  register: ReturnType<typeof useForm<ContactFormValues>>['register'];
  error?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border-ink-300 text-azure-600 focus:ring-azure-400"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          {...register('consentimento')}
        />
        <label htmlFor={id} className="font-sans text-sm leading-relaxed text-ink-600">
          {LGPD_PLACEHOLDER_TEXT}
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({
  label,
  disabled,
  isSubmitting,
}: {
  label: string;
  disabled: boolean;
  isSubmitting: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || isSubmitting}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-azure-600 px-5 font-sans text-sm font-semibold text-white shadow-sm shadow-azure-900/15 transition-all hover:bg-azure-500 hover:shadow-md focus-visible:ring-2 focus-visible:ring-azure-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    >
      {isSubmitting ? 'Enviando…' : label}
    </button>
  );
}

function StatusMessage({ status }: { status: 'idle' | 'success' | 'error' }) {
  if (status === 'idle') return null;

  if (status === 'success') {
    return (
      <p role="status" className="rounded-2xl bg-green-50 px-4 py-3 font-sans text-sm text-green-800">
        Mensagem pronta! Continue o envio pelo WhatsApp que abrimos para você.
      </p>
    );
  }

  return (
    <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
      Não foi possível abrir o WhatsApp agora. Tente novamente em instantes.
    </p>
  );
}
