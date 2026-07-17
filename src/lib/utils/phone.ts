/**
 * Utilitários de telefone/WhatsApp no formato brasileiro.
 * - maskPhoneBR: formata progressivamente enquanto o usuário digita.
 * - isValidPhoneBR: valida por contagem de dígitos (10 fixo, 11 celular).
 */

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Aplica a máscara (XX) XXXX-XXXX (fixo) ou (XX) XXXXX-XXXX (celular),
 * de forma determinística com base na quantidade de dígitos.
 */
export function maskPhoneBR(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  const len = d.length;

  if (len === 0) return '';
  if (len <= 2) return `(${d}`;
  if (len <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (len <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone BR válido: 10 dígitos (fixo) ou 11 dígitos (celular), com DDD. */
export function isValidPhoneBR(value: string): boolean {
  const len = onlyDigits(value).length;
  return len === 10 || len === 11;
}
