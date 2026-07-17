import type { Specialty } from './specialties';

/**
 * Seção "Quando procurar um Especialista?" (sintomas por especialidade).
 *
 * ⚠️ CONTEÚDO VERBATIM — não alterar títulos, leads ou itens.
 * Renderizado como acordeão nativo (<details>/<summary>), 0 JS.
 */
export interface SymptomGroup {
  specialty: Specialty;
  /** Título do grupo (verbatim). */
  title: string;
  /** Frase de introdução do grupo (verbatim). */
  lead: string;
  /** Lista de sinais/sintomas (verbatim). */
  items: string[];
}

/** Parágrafo de introdução da seção (verbatim). */
export const symptomsIntro =
  'Muitas disfunções do corpo evoluem de forma silenciosa nas fases iniciais. A avaliação especializada com nossa equipe integrada é fundamental para o diagnóstico precoce, prevenção de complicações e tratamentos mais assertivos.';

export const symptomGroups: SymptomGroup[] = [
  {
    specialty: 'Nefrologia',
    title: 'Quando procurar um Nefrologista?',
    lead: 'A consulta com o nefrologista é indicada especialmente para proteger e preservar a função dos seus rins em cenários como:',
    items: [
      'Pressão alta de difícil controle',
      'Alterações na creatinina ou nos exames de urina',
      'Presença de proteína ou sangue na urina',
      'Inchaço nas pernas, rosto ou corpo inteiro',
      'Cálculos renais recorrentes (pedras nos rins)',
      'Histórico familiar de doença renal crônica',
      'Diabetes com risco de desenvolver lesão renal',
      'Infecções urinárias de repetição',
      'Distúrbios de sódio, potássio ou outros eletrólitos',
      'Avaliação e acompanhamento de pacientes em diálise ou pré-diálise',
    ],
  },
  {
    specialty: 'Endocrinologia',
    title: 'Quando procurar um Endocrinologista?',
    lead: 'A consulta com o endocrinologista auxilia a reequilibrar seus hormônios e metabolismo em situações como:',
    items: [
      'Sobrepeso, obesidade ou dificuldade crônica para perder peso',
      'Diabetes, pré-diabetes ou resistência à insulina',
      'Alterações de colesterol e triglicerídeos elevados',
      'Alterações na tireoide (hipotireoidismo, hipertireoidismo e nódulos)',
      'Menopausa e fogachos decorrentes de mudanças hormonais',
      'Síndrome dos ovários policísticos (SOP)',
      'Excesso de pelos faciais/corporais, acne tardia ou queda de cabelo',
      'Osteopenia e osteoporose (saúde óssea)',
      'Cansaço excessivo, fadiga inexplicável ou alterações persistentes no sono',
    ],
  },
  {
    specialty: 'Urologia',
    title: 'Quando procurar um Urologista?',
    lead: 'A avaliação com o urologista é recomendada para homens e mulheres que apresentam sintomas no trato urinário, ou homens em exames preventivos:',
    items: [
      'Dor, ardência, queimação ou dificuldade para urinar',
      'Aumento da frequência urinária (ir ao banheiro muitas vezes, especialmente à noite)',
      'Sensação incômoda de esvaziamento incompleto da bexiga',
      'Presença visível ou laboratorial de sangue na urina',
      'Infecções urinárias recorrentes',
      'Cálculos renais ou episódios de cólicas renais agudas',
      'Incontinência urinária ou perdas involuntárias de urina',
      'Dor pélvica, dor testicular ou dor na região lombar',
      'Disfunção erétil, alterações na ejaculação ou redução de libido',
      'Dificuldade para engravidar relacionada ao fator masculino (infertilidade)',
      'Aumento benigno da próstata (HPB)',
      'Rastreamento preventivo e tratamento de tumores de próstata, rim, bexiga, testículo ou pênis',
    ],
  },
];
