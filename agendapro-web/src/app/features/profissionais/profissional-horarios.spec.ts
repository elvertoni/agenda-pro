import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { HorariosService } from '../../core/api/horarios.service';
import { ProfissionaisService } from '../../core/api/profissionais.service';
import { Horario } from '../../core/models/horario';
import { Profissional } from '../../core/models/profissional';
import { ConfirmacaoService } from '../../shared/confirmacao.service';
import { criarApiError } from '../../testing/api-error';
import { ProfissionalHorarios } from './profissional-horarios';

describe('ProfissionalHorarios', () => {
  const ana: Profissional = { id: 3, nome: 'Dra. Ana Souza', especialidade: 'Dermatologia', ativo: true };
  const manha: Horario = { id: 10, diaSemana: 'Monday', horaInicio: '08:00:00', horaFim: '12:00:00' };
  const tarde: Horario = { id: 11, diaSemana: 'Monday', horaInicio: '14:00:00', horaFim: '18:00:00' };
  const sabado: Horario = { id: 12, diaSemana: 'Saturday', horaInicio: '09:00:00', horaFim: '11:00:00' };

  let obter: ReturnType<typeof vi.fn>;
  let listar: ReturnType<typeof vi.fn>;
  let criar: ReturnType<typeof vi.fn>;
  let remover: ReturnType<typeof vi.fn>;
  let confirmar: ReturnType<typeof vi.fn>;
  let abrirSnackBar: ReturnType<typeof vi.fn>;

  async function montar(
    id = '3',
    opcoes: { horarios?: Observable<Horario[]>; profissional?: Observable<Profissional> } = {},
  ) {
    obter = vi.fn(() => opcoes.profissional ?? of(ana));
    listar = vi.fn(() => opcoes.horarios ?? of([tarde, sabado, manha]));
    criar = vi.fn();
    remover = vi.fn();
    confirmar = vi.fn(() => of(true));
    abrirSnackBar = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ProfissionalHorarios],
      providers: [
        provideRouter([]),
        { provide: ProfissionaisService, useValue: { obter } },
        { provide: HorariosService, useValue: { listar, criar, remover } },
        { provide: ConfirmacaoService, useValue: { confirmar } },
        { provide: MatSnackBar, useValue: { open: abrirSnackBar } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfissionalHorarios);
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();

    return { fixture, tela: fixture.nativeElement as HTMLElement };
  }

  const dias = (tela: HTMLElement) => Array.from(tela.querySelectorAll<HTMLElement>('.semana > .dia'));
  const diaDe = (tela: HTMLElement, nome: string) => {
    const dia = dias(tela).find((d) => d.querySelector('h3')?.textContent?.includes(nome));
    if (!dia) {
      throw new Error(`Dia "${nome}" não encontrado.`);
    }
    return dia;
  };
  const blocos = (dia: HTMLElement) => Array.from(dia.querySelectorAll('.bloco')).map((b) => b.textContent?.trim());

  function preencherHoras(tela: HTMLElement, inicio: string, fim: string): void {
    const campos = tela.querySelectorAll<HTMLInputElement>('input[type="time"]');
    campos[0].value = inicio;
    campos[0].dispatchEvent(new Event('input'));
    campos[1].value = fim;
    campos[1].dispatchEvent(new Event('input'));
  }

  async function enviar(fixture: { whenStable(): Promise<unknown> }, tela: HTMLElement): Promise<void> {
    tela.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();
  }

  describe('carregamento', () => {
    it('busca o profissional e o expediente pelo id do endereço', async () => {
      await montar('3');

      expect(obter).toHaveBeenCalledWith(3);
      expect(listar).toHaveBeenCalledWith(3);
    });

    it('mostra o nome e a especialidade', async () => {
      const { tela } = await montar();

      expect(tela.querySelector('h1')?.textContent).toContain('Expediente de Dra. Ana Souza');
      expect(tela.textContent).toContain('Dermatologia');
    });

    it('mostra sempre os 7 dias, de segunda a domingo, em português', async () => {
      const { tela } = await montar();

      expect(dias(tela).map((d) => d.querySelector('h3')?.textContent?.trim())).toEqual([
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado',
        'Domingo',
      ]);
    });

    it('coloca cada bloco no seu dia, ordenado pelo início e sem os segundos', async () => {
      const { tela } = await montar();

      // A API devolveu a tarde antes da manhã: a tela ordena.
      expect(blocos(diaDe(tela, 'Segunda-feira'))).toEqual([
        expect.stringContaining('08:00 às 12:00'),
        expect.stringContaining('14:00 às 18:00'),
      ]);
      expect(blocos(diaDe(tela, 'Sábado'))).toEqual([expect.stringContaining('09:00 às 11:00')]);
    });

    it('dia sem blocos mostra "Sem expediente"', async () => {
      const { tela } = await montar();

      expect(diaDe(tela, 'Terça-feira').textContent).toContain('Sem expediente');
    });

    it('avisa quando o profissional está inativo', async () => {
      const { tela } = await montar('3', { profissional: of({ ...ana, ativo: false }) });

      expect(tela.textContent).toContain('Este profissional está inativo e não recebe agendamentos.');
    });

    it('mostra "carregando" enquanto busca', async () => {
      const { tela } = await montar('3', { horarios: new Subject<Horario[]>() });

      expect(tela.textContent).toContain('Carregando expediente...');
    });

    it('404 do profissional: mostra "não encontrado"', async () => {
      const { tela } = await montar('999', {
        profissional: throwError(() => criarApiError({ status: 404, title: 'Not Found' })),
      });

      expect(tela.textContent).toContain('Profissional não encontrado.');
      expect(tela.querySelector('form')).toBeNull();
    });

    it('falha de conexão: mostra o erro e deixa tentar de novo', async () => {
      let apiNoAr = false;
      const horarios = new Observable<Horario[]>((assinante) => {
        if (apiNoAr) {
          assinante.next([manha]);
          assinante.complete();
        } else {
          assinante.error(criarApiError({ status: 0 }));
        }
      });
      const { fixture, tela } = await montar('3', { horarios });

      expect(tela.textContent).toContain('Não foi possível carregar o expediente.');

      apiNoAr = true;
      Array.from(tela.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Tentar de novo'))
        ?.click();
      await fixture.whenStable();

      expect(tela.querySelector('form')).not.toBeNull();
    });

    it.each(['abc', '0', '-1'])('id inválido "%s": "não encontrado", sem chamar a API', async (id) => {
      const { tela } = await montar(id);

      expect(obter).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('Profissional não encontrado.');
    });
  });

  describe('adicionar horário', () => {
    it('envia dia em inglês e horas com segundos, e mostra o bloco novo', async () => {
      const { fixture, tela } = await montar('3', { horarios: of([]) });
      criar.mockReturnValue(of({ id: 20, diaSemana: 'Monday', horaInicio: '08:00:00', horaFim: '12:00:00' }));
      preencherHoras(tela, '08:00', '12:00');

      await enviar(fixture, tela);

      expect(criar).toHaveBeenCalledWith(3, { diaSemana: 'Monday', horaInicio: '08:00:00', horaFim: '12:00:00' });
      expect(blocos(diaDe(tela, 'Segunda-feira'))).toEqual([expect.stringContaining('08:00 às 12:00')]);
      expect(abrirSnackBar.mock.calls[0][0]).toBe('Horário adicionado: Segunda-feira.');
    });

    it('depois de adicionar, limpa as horas sem pintar os campos de vermelho e mantém o dia', async () => {
      const { fixture, tela } = await montar('3', { horarios: of([]) });
      criar.mockReturnValue(of({ id: 20, diaSemana: 'Monday', horaInicio: '08:00:00', horaFim: '12:00:00' }));
      preencherHoras(tela, '08:00', '12:00');

      await enviar(fixture, tela);

      const campos = tela.querySelectorAll<HTMLInputElement>('input[type="time"]');
      expect(campos[0].value).toBe('');
      expect(campos[1].value).toBe('');
      expect(tela.querySelector('mat-error')).toBeNull();
      expect(fixture.componentInstance['form'].controls.diaSemana.value).toBe('Monday');
    });

    it('com as horas vazias, mostra os erros e não chama a API', async () => {
      const { fixture, tela } = await montar();

      await enviar(fixture, tela);

      expect(criar).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('Informe a hora de início.');
      expect(tela.textContent).toContain('Informe a hora de fim.');
    });

    it.each([
      ['12:00', '08:00'],
      ['08:00', '08:00'],
    ])('fim antes do início (%s e %s): avisa na tela e não chama a API', async (inicio, fim) => {
      const { fixture, tela } = await montar();
      preencherHoras(tela, inicio, fim);

      await enviar(fixture, tela);

      expect(criar).not.toHaveBeenCalled();
      expect(tela.querySelector('.erro-geral')?.textContent).toContain('A hora de fim deve ser maior que a hora de início.');
    });

    it('409 de sobreposição: mostra a mensagem do backend e não altera a lista', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(
        throwError(() =>
          criarApiError({
            status: 409,
            title: 'Horário sobreposto',
            detail: 'Já existe um horário de trabalho que se sobrepõe a este nesse dia.',
          }),
        ),
      );
      preencherHoras(tela, '09:00', '10:00');

      await enviar(fixture, tela);

      expect(tela.querySelector('.erro-geral')?.textContent).toContain(
        'Já existe um horário de trabalho que se sobrepõe a este nesse dia.',
      );
      expect(blocos(diaDe(tela, 'Segunda-feira'))).toHaveLength(2);
      expect(abrirSnackBar).not.toHaveBeenCalled();
    });

    it('a mensagem do servidor some quando o usuário muda qualquer campo', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(throwError(() => criarApiError({ status: 409, detail: 'Já existe um horário.' })));
      preencherHoras(tela, '09:00', '10:00');
      await enviar(fixture, tela);
      expect(tela.querySelector('.erro-geral')).not.toBeNull();

      preencherHoras(tela, '15:00', '16:00');
      await fixture.whenStable();

      expect(tela.querySelector('.erro-geral')).toBeNull();
    });

    it('desabilita o botão enquanto envia e não deixa enviar duas vezes', async () => {
      const { fixture, tela } = await montar();
      const resposta = new Subject<Horario>();
      criar.mockReturnValue(resposta);
      preencherHoras(tela, '09:00', '10:00');

      await enviar(fixture, tela);

      const botao = tela.querySelector<HTMLButtonElement>('button[type="submit"]');
      expect(botao?.disabled).toBe(true);

      tela.querySelector('form')?.dispatchEvent(new Event('submit'));
      expect(criar).toHaveBeenCalledTimes(1);

      resposta.error(criarApiError({ status: 409, detail: 'Já existe um horário.' }));
      await fixture.whenStable();
      expect(botao?.disabled).toBe(false);
    });

    it('5xx: não repete o aviso, porque o interceptor já avisou', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(throwError(() => criarApiError({ status: 503 })));
      preencherHoras(tela, '09:00', '10:00');

      await enviar(fixture, tela);

      expect(tela.querySelector('.erro-geral')).toBeNull();
    });
  });

  describe('remover horário', () => {
    function botaoRemover(tela: HTMLElement, rotulo: string): HTMLButtonElement {
      const encontrado = tela.querySelector<HTMLButtonElement>(`button[aria-label*="${rotulo}"]`);
      if (!encontrado) {
        throw new Error(`Botão de remover "${rotulo}" não encontrado.`);
      }
      return encontrado;
    }

    it('pede confirmação com o dia e as horas, e só então remove', async () => {
      const { fixture, tela } = await montar();
      remover.mockReturnValue(of(undefined));

      botaoRemover(tela, 'Sábado, das 09:00 às 11:00').click();
      await fixture.whenStable();

      expect(confirmar).toHaveBeenCalledWith({
        titulo: 'Remover horário',
        mensagem: 'Remover o horário de Sábado, das 09:00 às 11:00?',
        confirmar: 'Remover',
      });
      expect(remover).toHaveBeenCalledWith(3, 12);
      expect(diaDe(tela, 'Sábado').textContent).toContain('Sem expediente');
      expect(abrirSnackBar.mock.calls[0][0]).toBe('Horário removido.');
    });

    it('se o usuário desiste na confirmação, não chama a API', async () => {
      const { fixture, tela } = await montar();
      confirmar.mockReturnValue(of(false));

      botaoRemover(tela, 'Sábado').click();
      await fixture.whenStable();

      expect(remover).not.toHaveBeenCalled();
      expect(diaDe(tela, 'Sábado').textContent).toContain('09:00 às 11:00');
    });

    it('404 (já removido em outro lugar): avisa e recarrega o expediente', async () => {
      const { fixture, tela } = await montar();
      remover.mockReturnValue(throwError(() => criarApiError({ status: 404, title: 'Not Found' })));

      botaoRemover(tela, 'Sábado').click();
      await fixture.whenStable();

      expect(abrirSnackBar.mock.calls[0][0]).toBe('Esse horário já não existe. A lista foi atualizada.');
      expect(listar).toHaveBeenCalledTimes(2);
    });

    it('desabilita o botão do bloco enquanto remove', async () => {
      const { fixture, tela } = await montar();
      const resposta = new Subject<void>();
      remover.mockReturnValue(resposta);

      botaoRemover(tela, 'Sábado').click();
      await fixture.whenStable();

      expect(botaoRemover(tela, 'Sábado').disabled).toBe(true);

      resposta.next();
      resposta.complete();
      await fixture.whenStable();
      expect(tela.querySelector('button[aria-label*="Sábado"]')).toBeNull();
    });
  });
});
