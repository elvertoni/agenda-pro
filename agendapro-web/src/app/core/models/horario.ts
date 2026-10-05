// A API serializa o DayOfWeek do .NET como texto em inglês (JsonStringEnumConverter).
export type DiaSemana =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

// Espelha o HorarioDto da API. As horas chegam como "HH:mm:ss".
export interface Horario {
  id: number;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
}

// Corpo do POST: CriarHorarioDto.
export interface CriarHorario {
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFim: string;
}
