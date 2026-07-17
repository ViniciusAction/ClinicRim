import { clinic } from '@/data/clinic';

/**
 * Monta o deep link do WhatsApp (wa.me) a partir do número configurado em
 * clinic.ts e de uma mensagem opcional já pré-preenchida.
 *
 * Retorna `null` quando não há número configurado — quem chama decide o
 * fallback (ex.: rolar até o formulário). Assim a UI nunca quebra enquanto
 * os dados reais da clínica não chegam.
 */
export function buildWhatsappUrl(message?: string): string | null {
  const number = clinic.whatsappNumber.trim();
  if (!number) return null;

  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
