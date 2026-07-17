import { clsx, type ClassValue } from 'clsx';

/**
 * Concatena classes condicionais. Mantido fino de propósito; se no futuro
 * houver conflito de utilitárias do Tailwind, troque por `tailwind-merge`.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
