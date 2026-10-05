import { DiaSemana } from '../core/models/horario';

export interface OpcaoDiaSemana {
  valor: DiaSemana;
  nome: string;
}

// Na ordem de exibição do calendário brasileiro (a semana começa na segunda).
// A API devolve o nome em inglês; a tela mostra em português.
export const DIAS_SEMANA: readonly OpcaoDiaSemana[] = [
  { valor: 'Monday', nome: 'Segunda-feira' },
  { valor: 'Tuesday', nome: 'Terça-feira' },
  { valor: 'Wednesday', nome: 'Quarta-feira' },
  { valor: 'Thursday', nome: 'Quinta-feira' },
  { valor: 'Friday', nome: 'Sexta-feira' },
  { valor: 'Saturday', nome: 'Sábado' },
  { valor: 'Sunday', nome: 'Domingo' },
];

export function nomeDoDia(dia: DiaSemana): string {
  return DIAS_SEMANA.find((opcao) => opcao.valor === dia)?.nome ?? dia;
}
