import { cpfEhValido, formatarCpf, somenteDigitos } from './cpf';

describe('somenteDigitos', () => {
  it('remove tudo que não é número', () => {
    expect(somenteDigitos('529.982.247-25')).toBe('52998224725');
    expect(somenteDigitos(' a1b2 ')).toBe('12');
  });

  it('texto sem números vira texto vazio', () => {
    expect(somenteDigitos('abc.-')).toBe('');
  });
});

describe('formatarCpf', () => {
  it.each([
    ['', ''],
    ['5', '5'],
    ['529', '529'],
    ['5299', '529.9'],
    ['529982', '529.982'],
    ['5299822', '529.982.2'],
    ['529982247', '529.982.247'],
    ['5299822472', '529.982.247-2'],
    ['52998224725', '529.982.247-25'],
  ])('"%s" vira "%s"', (digitado, esperado) => {
    expect(formatarCpf(digitado)).toBe(esperado);
  });

  it('corta no 11º dígito', () => {
    expect(formatarCpf('5299822472599')).toBe('529.982.247-25');
  });

  it('ignora letras e refaz a máscara de um valor já formatado', () => {
    expect(formatarCpf('52a9.98')).toBe('529.98');
    expect(formatarCpf('529.982.247-25')).toBe('529.982.247-25');
  });
});

describe('cpfEhValido', () => {
  it.each(['529.982.247-25', '52998224725', '111.444.777-35'])('aceita o CPF válido %s', (cpf) => {
    expect(cpfEhValido(cpf)).toBe(true);
  });

  it('recusa dígito verificador errado', () => {
    expect(cpfEhValido('529.982.247-24')).toBe(false);
    expect(cpfEhValido('529.982.247-35')).toBe(false);
  });

  it.each(['000.000.000-00', '111.111.111-11', '999.999.999-99'])('recusa sequência repetida %s', (cpf) => {
    expect(cpfEhValido(cpf)).toBe(false);
  });

  it.each(['', '123', '5299822472', '529982247255'])('recusa tamanho diferente de 11 dígitos ("%s")', (cpf) => {
    expect(cpfEhValido(cpf)).toBe(false);
  });
});
