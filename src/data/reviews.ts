/**
 * Prova Social — avaliações de pacientes.
 *
 * O conteúdo original indica "Puxar avaliações do Google Meu Negócio e
 * Doctoralia". Como ainda NÃO há integração nem avaliações reais, este arquivo
 * expõe:
 *   1) um tipo `Review` estável;
 *   2) dados MOCK claramente marcados como exemplo (NÃO são depoimentos reais);
 *   3) um "seam" `getReviews()` — hoje retorna o mock; amanhã troca para a
 *      chamada à API (Google Places / Doctoralia) sem mexer no componente.
 *
 * ⚠️ Substituir o mock pela integração real antes de publicar. Não usar texto
 * fictício como se fosse avaliação de paciente.
 */
export type ReviewSource = 'Google' | 'Doctoralia';

export interface Review {
  id: string;
  author: string;
  /** Nota de 0 a 5. */
  rating: number;
  text: string;
  source: ReviewSource;
  /** Data ISO (YYYY-MM-DD), opcional. */
  date?: string;
  /** Link para a avaliação original, opcional. */
  url?: string;
  /** Marca itens de exemplo para não confundir com avaliação real. */
  isPlaceholder?: boolean;
}

/** Dados reais do Google Meu Negócio */
const realReviews: Review[] = [
  {
    id: 'elza-novaes',
    author: 'Elza Novaes',
    rating: 5,
    text: 'Tudo perfeito: do atendimento via telefone com as secretárias até a consulta, sem atraso, com o médico. O dr Alexandre Pipino é extremamente detalhista, atencioso e humano. Atende sem pressa, sana todas as dúvidas e se põe à disposição do paciente. Um profissional e ser humano incrível!! E a secretária Bruna, muito prestativa, sempre procurando ajudar.',
    source: 'Google',
    date: 'um mês atrás',
  },
  {
    id: 'joao-pedro',
    author: 'João Pedro Koiti Nakagawa',
    rating: 5,
    text: 'Passei com a Dra Bruna e o Dr Alexandre. Excelente atendimento!! Extremamente educados e muito qualificados! Recomendo a todos!',
    source: 'Google',
    date: '3 meses atrás',
  },
  {
    id: 'carmen-lopes',
    author: 'Carmen Lopes',
    rating: 5,
    text: 'Sou paciente do Dr Alexandre ,e posso garantir com toda convicção que ele é maravilhoso, humano e gentil. Para esse médico eu dou mto mais que cinco estrelas',
    source: 'Google',
    date: '2 meses atrás',
  },
  {
    id: 'eliane-souza',
    author: 'ELIANE DE SOUZA',
    rating: 5,
    text: 'Excelente profissional, muito atencioso. Tira todas as dúvidas do paciente sem pressa. Vale muito a consulta com Dr. Alexandre, nessa clínica fomos muito bem tratadas.',
    source: 'Google',
    date: '2 semanas atrás',
  },
  {
    id: 'margarete-silva',
    author: 'Margarete Da Silva Mar',
    rating: 5,
    text: 'Atendimento ótimo, excelente nas explicação e um ser humano fantástico com seus paciente, recomendo .',
    source: 'Google',
    date: 'um mês atrás',
  },
  {
    id: 'vanda-regina',
    author: 'Vanda Regina Kuhn Neves',
    rating: 5,
    text: 'Dr Alexandre Pipino, excelente profissional! Agora com um novo espaço, bem aconchegante e acolhedor! O Dr trata seus pacientes com carinho e sempre muito educado. O melhor nefrologista de Londrina!',
    source: 'Google',
    date: '2 meses atrás',
  },
  {
    id: 'vanilda-ferreira',
    author: 'Vanilda Ferreira',
    rating: 5,
    text: 'O dr Alexandre, muito atencioso explica bem com muito carinho e paciência ,adoramos o atendimento desde a secretaria muita atenciosa tb !!nota 1000',
    source: 'Google',
    date: '3 semanas atrás',
  }
];

/**
 * Ponto único de obtenção das avaliações.
 * SÍNCRONO hoje (mock). Quando for integrar, troque a assinatura para Promise
 * e busque em build time (endpoint/SDK) — o componente já consome via await.
 */
export function getReviews(): Review[] {
  return realReviews;
}
