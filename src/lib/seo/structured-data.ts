import { clinic } from '@/data/clinic';
import { doctors, type Doctor } from '@/data/doctors';
import { faqCategories, answerToPlainText } from '@/data/faq';
import type { Specialty } from '@/data/specialties';

type JsonLd = Record<string, unknown>;

/**
 * Builders de Schema.org (JSON-LD) para rich snippets de saúde.
 * Tudo é derivado das fontes tipadas em src/data — sem texto duplicado.
 */

/** Mapeia nossa especialidade para o enum MedicalSpecialty do schema.org. */
const SCHEMA_SPECIALTY: Record<Specialty, string> = {
  Nefrologia: 'Renal',
  Endocrinologia: 'Endocrine',
  Urologia: 'Urologic',
};

export function medicalClinicSchema(siteUrl: string): JsonLd {
  const schema: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: clinic.name,
    url: siteUrl,
    medicalSpecialty: Object.values(SCHEMA_SPECIALTY),
  };

  // Só inclui endereço/telefone quando os dados reais existirem.
  const a = clinic.address;
  if (a.street || a.postalCode) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: a.street || undefined,
      addressLocality: a.city,
      addressRegion: a.state,
      postalCode: a.postalCode || undefined,
      addressCountry: a.country,
    };
  }
  if (clinic.whatsappNumber) schema.telephone = `+${clinic.whatsappNumber}`;
  if (clinic.email) schema.email = clinic.email;

  return schema;
}

export function physicianSchema(doctor: Doctor): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: doctor.name,
    medicalSpecialty: SCHEMA_SPECIALTY[doctor.specialty],
    description: doctor.miniBio,
    identifier: [
      { '@type': 'PropertyValue', name: 'CRM', value: doctor.crm },
      { '@type': 'PropertyValue', name: 'RQE', value: doctor.rqe },
    ],
    worksFor: { '@type': 'MedicalClinic', name: clinic.name },
  };
}

export function faqPageSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqCategories
      .flatMap((category) => category.items)
      .map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answerToPlainText(item.answer),
        },
      })),
  };
}

/** Conjunto de schemas da home (clínica + médicos + FAQ). */
export function homepageSchemas(siteUrl: string): JsonLd[] {
  return [medicalClinicSchema(siteUrl), ...doctors.map(physicianSchema), faqPageSchema()];
}
