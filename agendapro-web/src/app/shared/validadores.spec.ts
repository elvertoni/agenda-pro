import { FormControl, FormGroup } from '@angular/forms';
import { fimDepoisDoInicio, obrigatorioSemEspacos } from './validadores';

describe('obrigatorioSemEspacos', () => {
  it.each(['', '   ', '\t'])('recusa o texto "%s"', (texto) => {
    expect(obrigatorioSemEspacos(new FormControl(texto))).toEqual({ obrigatorio: true });
  });

  it('recusa valor nulo', () => {
    expect(obrigatorioSemEspacos(new FormControl(null))).toEqual({ obrigatorio: true });
  });

  it('aceita texto com conteúdo, mesmo com espaços ao redor', () => {
    expect(obrigatorioSemEspacos(new FormControl('  Ana '))).toBeNull();
  });
});

describe('fimDepoisDoInicio', () => {
  function grupo(inicio: string, fim: string): FormGroup {
    return new FormGroup({ horaInicio: new FormControl(inicio), horaFim: new FormControl(fim) });
  }

  it('aceita fim maior que o início', () => {
    expect(fimDepoisDoInicio(grupo('08:00', '12:00'))).toBeNull();
  });

  it('recusa fim igual ao início (a API também recusa)', () => {
    expect(fimDepoisDoInicio(grupo('08:00', '08:00'))).toEqual({ fimAntesDoInicio: true });
  });

  it('recusa fim menor que o início', () => {
    expect(fimDepoisDoInicio(grupo('12:00', '08:00'))).toEqual({ fimAntesDoInicio: true });
  });

  it('compara pelo relógio, não pelo tamanho do texto', () => {
    // Como texto, "9:00" > "10:00". Com zero à esquerda a ordem fica correta.
    expect(fimDepoisDoInicio(grupo('09:00', '10:00'))).toBeNull();
  });

  it.each([
    ['', '12:00'],
    ['08:00', ''],
    ['', ''],
  ])('não avisa enquanto falta um dos campos (%s e %s)', (inicio, fim) => {
    expect(fimDepoisDoInicio(grupo(inicio, fim))).toBeNull();
  });
});
