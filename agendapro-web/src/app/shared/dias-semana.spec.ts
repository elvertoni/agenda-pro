import { DIAS_SEMANA, nomeDoDia } from './dias-semana';

describe('dias da semana', () => {
  it('lista os sete dias, da segunda ao domingo', () => {
    expect(DIAS_SEMANA.map((dia) => dia.valor)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });

  it('traduz cada dia que a API devolve', () => {
    expect(nomeDoDia('Monday')).toBe('Segunda-feira');
    expect(nomeDoDia('Wednesday')).toBe('Quarta-feira');
    expect(nomeDoDia('Saturday')).toBe('Sábado');
    expect(nomeDoDia('Sunday')).toBe('Domingo');
  });
});
