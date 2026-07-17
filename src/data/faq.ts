/**
 * FAQ — Perguntas Frequentes, agrupadas por categoria.
 *
 * ⚠️ CONTEÚDO VERBATIM — não alterar perguntas, respostas, listas ou ordem.
 * Renderizado por um acordeão acessível (Radix) e também exportado como
 * FAQPage (JSON-LD) para rich snippets.
 *
 * Uma resposta é uma lista de "blocos" para suportar respostas com listas
 * (ex.: cobertura por convênio), preservando a estrutura sem alterar texto.
 */
export type AnswerBlock = { type: 'paragraph'; text: string } | { type: 'list'; items: string[] };

export interface FaqItem {
  question: string;
  answer: AnswerBlock[];
}

export interface FaqCategory {
  /** Nome da categoria (verbatim). */
  title: string;
  items: FaqItem[];
}

export const faqCategories: FaqCategory[] = [
  {
    title: 'Agendamento',
    items: [
      {
        question: 'Como faço para agendar uma consulta na Clínica Rim?',
        answer: [
          {
            type: 'paragraph',
            text: 'Você pode entrar em contato com a nossa equipe pelo WhatsApp ou telefone da clínica. Nossa secretária irá verificar a disponibilidade de horários, especialidade desejada e orientar sobre os documentos necessários para o atendimento.',
          },
        ],
      },
      {
        question: 'Quais informações preciso enviar para agendar minha consulta?',
        answer: [
          {
            type: 'paragraph',
            text: 'Solicitamos nome completo, data de nascimento, CPF, telefone para contato, convênio (se aplicável para fins de identificação/reembolso) e o nome do médico desejado.',
          },
        ],
      },
      {
        question: 'A Clínica Rim atende por convênio?',
        answer: [
          {
            type: 'paragraph',
            text: 'O atendimento por convênio ou plano de saúde varia de acordo com o médico especialista desejado. Confira a cobertura de cada profissional da nossa equipe:',
          },
          {
            type: 'list',
            items: [
              'Dr. Igor (Urologista): Atende pelos planos SSG e Hospitalar.',
              'Dra. Bruna (Endocrinologista): Atende pelos planos SSG e Sistema Premium.',
              'Dr. Alexandre (Nefrologista): Atende pelos planos SSG, Unipax e Sistema Premium.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Para planos não listados acima ou modalidades que não cobrem o profissional escolhido, o atendimento será realizado na modalidade particular. Nesses casos, emitimos toda a documentação técnica e a Nota Fiscal necessária para que você possa solicitar o reembolso diretamente junto ao seu plano de saúde, caso ele ofereça essa opção.',
          },
        ],
      },
    ],
  },
  {
    title: 'Atendimento Presencial',
    items: [
      {
        question: 'O que devo levar no dia da consulta?',
        answer: [
          {
            type: 'paragraph',
            text: 'Pedimos que o paciente traga um documento oficial com foto, exames de laboratório ou imagem recentes, receitas médicas em uso e uma lista com as medicações atuais.',
          },
        ],
      },
      {
        question: 'Preciso chegar com antecedência?',
        answer: [
          {
            type: 'paragraph',
            text: 'Sim. Recomendamos chegar com, no mínimo, 10 minutos de antecedência para a conferência de documentos, atualização cadastral e check-in em nosso sistema.',
          },
        ],
      },
      {
        question: 'Na primeira consulta preciso assinar algum documento?',
        answer: [
          {
            type: 'paragraph',
            text: 'Sim. Na primeira visita, o paciente receberá e assinará as orientações e documentos relacionados à nossa política de atendimento interno e consentimento.',
          },
        ],
      },
      {
        question: 'A clínica solicita foto do paciente no cadastro?',
        answer: [
          {
            type: 'paragraph',
            text: 'Sim, para a sua segurança e identificação interna em nosso sistema médico, a secretária atualizará seu prontuário incluindo uma foto de identificação.',
          },
        ],
      },
    ],
  },
  {
    title: 'Teleconsulta',
    items: [
      {
        question: 'A Clínica Rim realiza teleconsulta?',
        answer: [
          {
            type: 'paragraph',
            text: 'Sim. Alguns atendimentos e retornos podem ser realizados de forma totalmente online por teleconsulta, conforme a disponibilidade do profissional e a indicação clínica específica para o seu caso.',
          },
        ],
      },
      {
        question: 'Como funciona a teleconsulta?',
        answer: [
          {
            type: 'paragraph',
            text: 'A consulta ocorre de forma online através de uma plataforma segura utilizada pela clínica. Você receberá todas as instruções de acesso da nossa equipe antes do horário agendado.',
          },
        ],
      },
      {
        question: 'Quando recebo o link da teleconsulta?',
        answer: [
          {
            type: 'paragraph',
            text: 'O link exclusivo de acesso é enviado diretamente para você cerca de 30 minutos antes do horário marcado para o atendimento.',
          },
        ],
      },
      {
        question: 'O que preciso ter em mãos para a teleconsulta?',
        answer: [
          {
            type: 'paragraph',
            text: 'Separe seus documentos pessoais, lista de medicamentos em uso, exames recentes organizados e certifique-se de estar em um ambiente silencioso, privado e com uma boa conexão de internet.',
          },
        ],
      },
      {
        question: 'Preciso assinar algum termo para teleconsulta?',
        answer: [
          {
            type: 'paragraph',
            text: 'Sim. É obrigatório o envio e validação eletrônica de um termo de consentimento específico relacionado à política de privacidade, cancelamentos e diretrizes da LGPD, enviado pela secretária.',
          },
        ],
      },
    ],
  },
  {
    title: 'Especialidades, Pagamentos e Urgência',
    items: [
      {
        question: 'Quais especialidades são atendidas na Clínica Rim?',
        answer: [
          {
            type: 'paragraph',
            text: 'Contamos com uma estrutura de corpo clínico focado nas áreas de Nefrologia, Endocrinologia e Urologia. Para confirmar horários e profissionais específicos disponíveis, fale com nossa recepção no WhatsApp.',
          },
        ],
      },
      {
        question: 'Quais formas de pagamento são aceitas e a clínica emite nota fiscal?',
        answer: [
          {
            type: 'paragraph',
            text: 'Aceitamos diferentes modalidades de pagamento para consultas particulares. A nossa secretaria detalhará as opções no ato do agendamento. Emitimos Nota Fiscal de todos os atendimentos particulares para declaração ou processos de reembolso.',
          },
        ],
      },
      {
        question: 'A Clínica Rim atende urgências ou emergências?',
        answer: [
          {
            type: 'paragraph',
            text: 'Não. A Clínica Rim realiza atendimentos exclusivamente ambulatoriais e eletivos (com horários previamente agendados). Em caso de sintomas agudos graves, dores intensas súbitas ou emergências médicas, dirija-se imediatamente ao pronto atendimento hospitalar mais próximo.',
          },
        ],
      },
      {
        question: 'Posso pedir orientação médica ou condutas pelo WhatsApp da clínica?',
        answer: [
          {
            type: 'paragraph',
            text: 'O WhatsApp da clínica é um canal estritamente administrativo (destinado a agendamentos, dúvidas de horários e check-in). Para avaliação de sintomas, prescrição de receitas, alterações de conduta ou análise de exames, é indispensável o agendamento de uma consulta médica (presencial ou teleconsulta).',
          },
        ],
      },
    ],
  },
];

/** Achata os blocos de uma resposta em texto puro (para o JSON-LD FAQPage). */
export function answerToPlainText(answer: AnswerBlock[]): string {
  return answer
    .map((block) => (block.type === 'paragraph' ? block.text : block.items.join(' ')))
    .join(' ');
}
