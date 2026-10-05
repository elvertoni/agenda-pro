import {
  formatarHora,
  lerDataApi,
  lerDataHoraApi,
  paraDataApi,
  paraDataHoraApi,
  paraHoraApi,
} from './datas';

// Os casos de fuso só provam algo quando o computador NÃO está em UTC.
// No Brasil (UTC-3), às 22h já é o dia seguinte em UTC: uma implementação com toISOString()
// devolveria o dia 13 e estes testes falhariam. Em UTC as duas implementações coincidem,
// por isso o CI deve rodar com TZ=America/Sao_Paulo.
describe('datas', () => {
  describe('paraDataApi', () => {
    it('às 22h continua no mesmo dia (caso que quebra com toISOString no Brasil)', () => {
      const noite = new Date(2026, 9, 12, 22, 0, 0);

      expect(paraDataApi(noite)).toBe('2026-10-12');
    });

    it('logo depois da meia-noite continua no mesmo dia (caso que quebra em fusos à frente do UTC)', () => {
      const madrugada = new Date(2026, 9, 12, 0, 30, 0);

      expect(paraDataApi(madrugada)).toBe('2026-10-12');
    });

    it('completa mês e dia com zero à esquerda', () => {
      expect(paraDataApi(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('último dia do ano às 23h59 não vira o ano seguinte', () => {
      expect(paraDataApi(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
    });
  });

  describe('paraDataHoraApi', () => {
    it('monta o texto com o horário local, sem fuso', () => {
      expect(paraDataHoraApi(new Date(2026, 9, 12, 14, 30, 0))).toBe('2026-10-12T14:30:00');
    });

    it('às 22h mantém o dia e a hora locais', () => {
      expect(paraDataHoraApi(new Date(2026, 9, 12, 22, 0, 0))).toBe('2026-10-12T22:00:00');
    });

    it('completa hora, minuto e segundo com zero à esquerda', () => {
      expect(paraDataHoraApi(new Date(2026, 0, 5, 9, 5, 7))).toBe('2026-01-05T09:05:07');
    });

    it('não termina com Z nem traz deslocamento de fuso', () => {
      expect(paraDataHoraApi(new Date(2026, 9, 12, 14, 30, 0))).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('lerDataApi', () => {
    it('lê a data como meia-noite local (caso que quebra com new Date("2026-10-12") no Brasil)', () => {
      const data = lerDataApi('2026-10-12');

      expect(data.getFullYear()).toBe(2026);
      expect(data.getMonth()).toBe(9);
      expect(data.getDate()).toBe(12);
      expect(data.getHours()).toBe(0);
    });

    it('ida e volta devolve o mesmo texto', () => {
      expect(paraDataApi(lerDataApi('2026-03-01'))).toBe('2026-03-01');
    });

    it.each(['', '12/10/2026', '2026-10-12T14:30:00', '2026-1-5'])('recusa o formato "%s"', (texto) => {
      expect(() => lerDataApi(texto)).toThrow('Data inválida');
    });
  });

  describe('lerDataHoraApi', () => {
    it('lê data e hora no horário local', () => {
      const data = lerDataHoraApi('2026-10-12T22:00:00');

      expect(data.getFullYear()).toBe(2026);
      expect(data.getMonth()).toBe(9);
      expect(data.getDate()).toBe(12);
      expect(data.getHours()).toBe(22);
      expect(data.getMinutes()).toBe(0);
    });

    it('ignora frações de segundo', () => {
      const data = lerDataHoraApi('2026-10-12T14:30:15.1234567');

      expect(data.getSeconds()).toBe(15);
      expect(data.getMilliseconds()).toBe(0);
    });

    it('ida e volta devolve o mesmo texto', () => {
      expect(paraDataHoraApi(lerDataHoraApi('2026-10-12T09:05:00'))).toBe('2026-10-12T09:05:00');
    });

    it.each(['', '2026-10-12', '12/10/2026 14:30'])('recusa o formato "%s"', (texto) => {
      expect(() => lerDataHoraApi(texto)).toThrow('Data e hora inválidas');
    });
  });

  describe('horas', () => {
    it('formatarHora tira os segundos para exibir', () => {
      expect(formatarHora('09:00:00')).toBe('09:00');
    });

    it('paraHoraApi acrescenta os segundos que a API espera', () => {
      expect(paraHoraApi('09:00')).toBe('09:00:00');
    });

    it('paraHoraApi não mexe em hora que já tem segundos', () => {
      expect(paraHoraApi('09:00:00')).toBe('09:00:00');
    });
  });
});
