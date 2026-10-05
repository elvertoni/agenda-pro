import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ProfissionaisService } from '../../core/api/profissionais.service';
import { Profissional } from '../../core/models/profissional';
import { criarApiError } from '../../testing/api-error';
import { ProfissionaisLista } from './profissionais-lista';

describe('ProfissionaisLista', () => {
  const ana: Profissional = { id: 1, nome: 'Dra. Ana Souza', especialidade: 'Dermatologia', ativo: true };
  const teste: Profissional = { id: 2, nome: 'Dr. Teste', especialidade: 'Cardiologia', ativo: false };

  let listar: ReturnType<typeof vi.fn>;
  let alterarAtivo: ReturnType<typeof vi.fn>;
  let abrirSnackBar: ReturnType<typeof vi.fn>;

  async function montar(resposta: Observable<Profissional[]>) {
    listar = vi.fn(() => resposta);
    alterarAtivo = vi.fn();
    abrirSnackBar = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ProfissionaisLista],
      providers: [
        provideRouter([]),
        { provide: ProfissionaisService, useValue: { listar, alterarAtivo } },
        { provide: MatSnackBar, useValue: { open: abrirSnackBar } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfissionaisLista);
    await fixture.whenStable();

    return { fixture, tela: fixture.nativeElement as HTMLElement };
  }

  // Acha o botão pelo texto visível ou pelo aria-label (os botões de linha trazem o nome da pessoa ali).
  function botao(tela: HTMLElement, texto: string): HTMLButtonElement {
    const encontrado = Array.from(tela.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(texto) || b.getAttribute('aria-label')?.includes(texto),
    );
    if (!encontrado) {
      throw new Error(`Botão "${texto}" não encontrado.`);
    }
    return encontrado;
  }

  const linhas = (tela: HTMLElement) => Array.from(tela.querySelectorAll('tr[mat-row]'));

  it('mostra "carregando" enquanto a API não responde', async () => {
    const { tela } = await montar(new Subject<Profissional[]>());

    expect(tela.textContent).toContain('Carregando profissionais...');
    expect(linhas(tela)).toHaveLength(0);
  });

  it('mostra uma linha por profissional, com a situação em texto', async () => {
    const { tela } = await montar(of([ana, teste]));

    const textos = linhas(tela).map((linha) => linha.textContent ?? '');

    expect(textos).toHaveLength(2);
    expect(textos[0]).toContain('Dra. Ana Souza');
    expect(textos[0]).toContain('Dermatologia');
    expect(textos[0]).toContain('Ativo');
    expect(textos[1]).toContain('Dr. Teste');
    expect(textos[1]).toContain('Inativo');
  });

  it('sem profissionais e sem filtro, diz que nenhum foi cadastrado', async () => {
    const { tela } = await montar(of([]));

    expect(tela.textContent).toContain('Nenhum profissional cadastrado.');
    expect(tela.textContent).toContain('Cadastrar o primeiro');
  });

  it('sem resultado com filtro, diz que nada foi encontrado (e não que não há cadastro)', async () => {
    const { fixture, tela } = await montar(of([]));

    fixture.componentInstance['filtro'].patchValue({ especialidade: 'Ortopedia' });
    botao(tela, 'Filtrar').click();
    await fixture.whenStable();

    expect(tela.textContent).toContain('Nenhum profissional encontrado com esses filtros.');
    expect(tela.textContent).not.toContain('Nenhum profissional cadastrado.');
  });

  it('mostra o erro e deixa tentar de novo quando a API falha', async () => {
    let apiNoAr = false;
    const resposta = new Observable<Profissional[]>((assinante) => {
      if (apiNoAr) {
        assinante.next([ana]);
        assinante.complete();
      } else {
        assinante.error(criarApiError({ status: 503 }));
      }
    });

    const { fixture, tela } = await montar(resposta);

    expect(tela.textContent).toContain('Não foi possível carregar a lista de profissionais.');

    apiNoAr = true;
    botao(tela, 'Tentar de novo').click();
    await fixture.whenStable();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(linhas(tela)).toHaveLength(1);
  });

  describe('filtros', () => {
    it('abre sem filtros: pede a lista inteira', async () => {
      await montar(of([ana]));

      expect(listar).toHaveBeenCalledWith({ especialidade: undefined, ativo: undefined });
    });

    it('envia a especialidade sem espaços nas pontas e a situação escolhida', async () => {
      const { fixture, tela } = await montar(of([ana]));

      fixture.componentInstance['filtro'].setValue({ especialidade: '  Derma ', situacao: 'inativos' });
      botao(tela, 'Filtrar').click();
      await fixture.whenStable();

      expect(listar).toHaveBeenLastCalledWith({ especialidade: 'Derma', ativo: false });
    });

    it('"Ativos" envia ativo verdadeiro', async () => {
      const { fixture, tela } = await montar(of([ana]));

      fixture.componentInstance['filtro'].patchValue({ situacao: 'ativos' });
      botao(tela, 'Filtrar').click();
      await fixture.whenStable();

      expect(listar).toHaveBeenLastCalledWith({ especialidade: undefined, ativo: true });
    });

    it('"Limpar" zera os campos e busca de novo sem filtro', async () => {
      const { fixture, tela } = await montar(of([ana]));
      fixture.componentInstance['filtro'].setValue({ especialidade: 'Derma', situacao: 'ativos' });

      botao(tela, 'Limpar').click();
      await fixture.whenStable();

      expect(fixture.componentInstance['filtro'].getRawValue()).toEqual({ especialidade: '', situacao: 'todos' });
      expect(listar).toHaveBeenLastCalledWith({ especialidade: undefined, ativo: undefined });
    });

    it('o botão "Filtrar" fica desabilitado enquanto a busca está em andamento', async () => {
      const { tela } = await montar(new Subject<Profissional[]>());

      expect(botao(tela, 'Filtrar').disabled).toBe(true);
    });

    it('a resposta atrasada de uma busca antiga não sobrescreve a mais nova', async () => {
      const primeira = new Subject<Profissional[]>();
      const segunda = new Subject<Profissional[]>();
      const { fixture, tela } = await montar(primeira);
      listar.mockReturnValueOnce(segunda);

      // "Limpar" fica habilitado durante a busca e dispara uma segunda, enquanto a primeira ainda não voltou.
      botao(tela, 'Limpar').click();
      segunda.next([teste]);
      primeira.next([ana]);
      await fixture.whenStable();

      expect(listar).toHaveBeenCalledTimes(2);
      expect(linhas(tela).map((l) => l.textContent)).toEqual([expect.stringContaining('Dr. Teste')]);
    });
  });

  describe('ativar e inativar', () => {
    it('inativa, atualiza só a linha e avisa', async () => {
      const { fixture, tela } = await montar(of([ana, teste]));
      alterarAtivo.mockReturnValue(of({ ...ana, ativo: false }));

      botao(tela, 'Inativar Dra. Ana Souza').click();
      await fixture.whenStable();

      expect(alterarAtivo).toHaveBeenCalledWith(1, false);
      expect(listar).toHaveBeenCalledTimes(1);
      expect(linhas(tela)[0].textContent).toContain('Inativo');
      expect(abrirSnackBar.mock.calls[0][0]).toBe('Dra. Ana Souza foi inativado.');
    });

    it('ativa um profissional inativo', async () => {
      const { fixture, tela } = await montar(of([teste]));
      alterarAtivo.mockReturnValue(of({ ...teste, ativo: true }));

      botao(tela, 'Ativar Dr. Teste').click();
      await fixture.whenStable();

      expect(alterarAtivo).toHaveBeenCalledWith(2, true);
      expect(abrirSnackBar.mock.calls[0][0]).toBe('Dr. Teste foi ativado.');
    });

    it('desabilita o botão da linha enquanto a resposta não chega', async () => {
      const { fixture, tela } = await montar(of([ana]));
      const resposta = new Subject<Profissional>();
      alterarAtivo.mockReturnValue(resposta);

      botao(tela, 'Inativar Dra. Ana Souza').click();
      await fixture.whenStable();

      expect(botao(tela, 'Inativar Dra. Ana Souza').disabled).toBe(true);

      // Um segundo clique não dispara outra chamada.
      botao(tela, 'Inativar Dra. Ana Souza').click();
      expect(alterarAtivo).toHaveBeenCalledTimes(1);

      resposta.next({ ...ana, ativo: false });
      await fixture.whenStable();

      expect(botao(tela, 'Ativar Dra. Ana Souza').disabled).toBe(false);
    });

    it('404: avisa que o registro sumiu e recarrega a lista', async () => {
      const { fixture, tela } = await montar(of([ana]));
      alterarAtivo.mockReturnValue(throwError(() => criarApiError({ status: 404, title: 'Not Found' })));

      botao(tela, 'Inativar Dra. Ana Souza').click();
      await fixture.whenStable();

      expect(abrirSnackBar.mock.calls[0][0]).toBe('Profissional não encontrado. A lista foi atualizada.');
      expect(listar).toHaveBeenCalledTimes(2);
    });

    it('5xx: não repete o aviso, porque o interceptor já avisou', async () => {
      const { fixture, tela } = await montar(of([ana]));
      alterarAtivo.mockReturnValue(throwError(() => criarApiError({ status: 503 })));

      botao(tela, 'Inativar Dra. Ana Souza').click();
      await fixture.whenStable();

      expect(abrirSnackBar).not.toHaveBeenCalled();
      expect(botao(tela, 'Inativar Dra. Ana Souza').disabled).toBe(false);
    });
  });
});
