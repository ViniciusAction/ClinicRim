/**
 * Dados institucionais da Clínica RIM (NAP, contatos, links externos).
 *
 * ⚠️ DADOS REAIS AINDA NÃO DISPONÍVEIS.
 * Os campos abaixo estão como placeholder. Quando os dados chegarem, basta
 * preencher ESTE arquivo — todos os componentes (UI, WhatsApp, mapa, JSON-LD)
 * leem daqui. Onde o valor estiver vazio (''), a UI degrada com elegância
 * (ex.: botão de WhatsApp desabilitado, mapa em estado "indisponível").
 */
export const clinic = {
  name: 'Clínica Rim',
  /** Frase de apoio reutilizável (não é copy da página). */
  specialtiesLabel: 'Nefrologia, Endocrinologia e Urologia',

  // --- NAP (Name, Address, Phone): UI + Schema.org MedicalClinic ---
  address: {
    /** Texto exibido na seção Localização. */
    full: 'Rua Matogrosso, 1114, Sala 909 – Londrina/PR',
    street: 'Rua Matogrosso, 1114, Sala 909',
    neighborhood: 'Centro',
    city: 'Londrina',
    state: 'PR',
    postalCode: '86010-180',
    country: 'BR',
  },

  /** Texto exibido do telefone. */
  phoneDisplay: '(43) 3304-7052',

  /**
   * WhatsApp — número em formato internacional, SOMENTE DÍGITOS (DDI+DDD+número).
   * Ex.: '5543999999999'. Vazio => CTAs de WhatsApp ficam desabilitados.
   */
  whatsappNumber: '554333047052',

  email: '', // TODO

  // --- Links externos (vazio => recurso ocultado/placeholder) ---
  /** URL de <iframe> do Google Maps (Compartilhar > Incorporar um mapa). */
  googleMapsEmbedUrl:
    'https://www.google.com/maps?q=Rua+Mato+Grosso,+1114+-+Centro,+Londrina+-+PR,+86010-180&output=embed',
  /** Link "ver no Google Maps" (abre o app/maps). */
  googleMapsPlaceUrl:
    'https://www.google.com/maps/search/?api=1&query=Rua+Matogrosso+1114+Sala+909+Londrina+PR+86010-180',
  /** Perfil do Google Meu Negócio (Prova Social). */
  googleBusinessUrl: '', // TODO
  /** Perfil na Doctoralia (Prova Social). */
  doctoraliaUrl: '', // TODO

  social: {
    instagram: '', // TODO
  },
} as const;

export type Clinic = typeof clinic;

/** Há um número de WhatsApp configurado? Usado para habilitar/desabilitar CTAs. */
export const hasWhatsapp = clinic.whatsappNumber.trim().length > 0;
