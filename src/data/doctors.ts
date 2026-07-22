import type { Specialty } from './specialties';

/**
 * Corpo clínico da Clínica RIM.
 *
 * ⚠️ CONTEÚDO VERBATIM — não alterar nome, CRM/RQE, mini-bio ou perfil completo.
 * Esta é a fonte única usada tanto na seção "Nossos Especialistas" quanto como
 * AUTORES do blog (o campo `id` é a chave de referência do frontmatter).
 *
 * `photoId` aponta para um arquivo em src/assets/doctors/<photoId>.{jpg,png,webp}.
 * Enquanto as fotos reais não existirem, o DoctorCard renderiza um avatar com
 * as iniciais (fallback), sem quebrar o build.
 */
export interface Doctor {
  id: string;
  /** Nome exibido (verbatim). */
  name: string;
  /** Cargo exibido após o nome (verbatim). */
  role: string;
  /** Área de especialidade (liga médico ↔ blog ↔ sintomas). */
  specialty: Specialty;
  /** Número do CRM (renderizado como "CRM {crm}"). */
  crm: string;
  /** Número do RQE (renderizado como "RQE {rqe}"). */
  rqe: string;
  /** Mini-bio (verbatim). */
  miniBio: string;
  /** Rótulo do botão de WhatsApp (verbatim). */
  ctaLabel: string;
  /** Perfil completo do acordeão (verbatim, um item por parágrafo). */
  fullProfile: string[];
  /** Base do nome do arquivo da foto em src/assets/doctors/. */
  photoId: string;
}

export const doctors: Doctor[] = [
  {
    id: 'dr-alexandre',
    name: 'Dr. Alexandre Pipino',
    role: 'Nefrologista',
    specialty: 'Nefrologia',
    crm: '41.107',
    rqe: '32.649',
    miniBio:
      'Docente da UEL com sólida formação clínica e atualização constante. Oferece atendimento individualizado focado na prevenção e controle de doenças renais através de uma prática que une precisão técnica, escuta atenta e respeito integral ao paciente.',
    ctaLabel: 'Falar com a equipe do Dr. Alexandre',
    fullProfile: [
      'Médico pela Universidade Estadual de Londrina (UEL), com residência em Clínica Médica pelo Hospital Universitário (HU) Londrina e em Nefrologia pelo Hospital Evangélico de Londrina. É titulado pela Sociedade Brasileira de Nefrologia e atualmente atua como docente da disciplina de Nefrologia na UEL.',
      'Sua atuação em consultório abrange o acompanhamento de pacientes com Doença Renal Crônica, Hipertensão Arterial, Diabetes mellitus, cálculos renais, alterações urinárias, distúrbios hidroeletrolíticos e estratégias para retardar a progressão da perda da função renal, garantindo um cuidado responsável ao longo do tempo.',
    ],
    photoId: 'dr-alexandre',
  },
  {
    id: 'dra-bruna',
    name: 'Dra. Bruna Matarazzo',
    role: 'Endocrinologista e Metabologista',
    specialty: 'Endocrinologia',
    crm: '39.197',
    rqe: '36.796',
    miniBio:
      'Formada e pós-graduada pela UEL, atua na promoção de saúde a longo prazo e no manejo de distúrbios metabólicos, unindo o rigor das evidências científicas a um olhar integral e atento à qualidade de vida.',
    ctaLabel: 'Falar com a equipe da Dra. Bruna',
    fullProfile: [
      'Médica endocrinologista formada pela Universidade Estadual de Londrina (UEL), com residência em Clínica Médica e Endocrinologia pela mesma instituição. Possui formação complementar em Medicina do Estilo de Vida pela MEV Brasil e atua como médica assistente do Serviço de Endocrinologia do Hospital Universitário de Londrina.',
      'Atua com foco baseado em evidências científicas no tratamento de obesidade, diabetes, pré-diabetes, resistência à insulina, doenças da tireoide (incluindo nódulos), menopausa, alterações hormonais, Síndrome dos Ovários Policísticos (SOP), osteopenia e osteoporose, auxiliando cada paciente a conquistar mais vitalidade e bem-estar de forma personalizada.',
    ],
    photoId: 'dra-bruna',
  },
  {
    id: 'dr-igor',
    name: 'Dr. Igor Favoreto',
    role: 'Urologista',
    specialty: 'Urologia',
    crm: '43.701',
    rqe: '38.838',
    miniBio:
      'Preceptor de residência médica com sólida experiência cirúrgica. Especialista no tratamento clínico e cirúrgico do trato urinário masculino e feminino, com foco principal em procedimentos urológicos modernos e minimamente invasivos (laser).',
    ctaLabel: 'Falar com a equipe do Dr. Igor',
    fullProfile: [
      'Médico formado pela Universidade do Vale do Itajaí (UNIVALI), com residência médica em Cirurgia pelo Hospital Evangélico de Londrina e em Urologia pelo Hospital Universitário de Londrina. É titulado pela Sociedade Brasileira de Urologia (SBU). Atualmente é preceptor da Residência Médica de Urologia no Hospital Universitário de Londrina e atua no ambiente hospitalar e de consultório (Hospital Evangélico de Londrina e Hospital Torao Tokuda em Apucarana).',
      'Sua prática abrange patologias do trato urinário masculino e feminino e do sistema reprodutor masculino, com ênfase no tratamento de cálculos renais a laser, hiperplasia prostática benigna, vasectomia, disfunções sexuais e Uro-Oncologia (tumores urológicos), aliando segurança, acolhimento e precisão técnica.',
    ],
    photoId: 'dr-igor',
  },
];

/** Lookup por id — usado para resolver o autor de um post do blog. */
export function getDoctorById(id: string): Doctor | undefined {
  return doctors.find((d) => d.id === id);
}
