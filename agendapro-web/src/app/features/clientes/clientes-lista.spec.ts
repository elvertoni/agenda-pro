import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ClientesService } from '../../core/api/clientes.service';
import { Cliente } from '../../core/models/cliente';
import { criarApiError } from '../../testing/api-error';
import { ClientesLista } from './clientes-lista';

describe('ClientesLista', () => {
  const maria: Cliente = { id: 1, nome: 'Maria Silva', cpf: '***.982.247-**', telefone: '(41) 99999-0000' };
  const joao: Cliente = { id: 2, nome: 'João Souza', cpf: '***.444.777-**', telefone: null };

  let listar: ReturnType<typeof vi.fn>;

  async function montar(resposta: Observable<Cliente[]>) {
    listar = vi.fn(() => resposta);

    await TestBed.configureTestingModule({
      imports: [ClientesLista],
      providers: [provideRouter([]), { provide: ClientesService, useValue: { listar } }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ClientesLista);
    await fixture.whenStable();

    return { fixture, tela: fixture.nativeElement as HTMLElement };
  }

  // Simula o usuário digitando no campo de busca.
  function digitar(tela: HTMLElement, texto: string): void {
    const campo = tela.querySelector<HTMLInputElement>('input');
    if (!campo) {
      throw new Error('Campo de busca não encontrado.');
    }
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
  }

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
    const { tela } = await montar(new Subject<Cliente[]>());

    expect(tela.textContent).toContain('Carregando clientes...');
    expect(linhas(tela)).toHaveLength(0);
  });

  it('abre pedindo a lista inteira (sem busca)', async () => {
    await montar(of([maria]));

    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith('');
  });

  it('mostra uma linha por cliente, com o CPF mascarado como a API devolve', async () => {
    const { tela } = await montar(of([maria, joao]));

    const textos = linhas(tela).map((linha) => linha.textContent ?? '');

    expect(textos).toHaveLength(2);
    expect(textos[0]).toContain('Maria Silva');
    expect(textos[0]).toContain('***.982.247-**');
    expect(textos[0]).toContain('(41) 99999-0000');
    expect(textos[1]).toContain('João Souza');
  });

  it('cliente sem telefone mostra um traço', async () => {
    const { tela } = await montar(of([joao]));

    expect(linhas(tela)[0].textContent).toContain('—');
  });

  it('sem clientes e sem busca, diz que nenhum foi cadastrado', async () => {
    const { tela } = await montar(of([]));

    expect(tela.textContent).toContain('Nenhum cliente cadastrado.');
    expect(tela.textContent).toContain('Cadastrar o primeiro');
  });

  it('mostra o erro e deixa tentar de novo quando a API falha', async () => {
    let apiNoAr = false;
    const resposta = new Observable<Cliente[]>((assinante) => {
      if (apiNoAr) {
        assinante.next([maria]);
        assinante.complete();
      } else {
        assinante.error(criarApiError({ status: 503 }));
      }
    });

    const { fixture, tela } = await montar(resposta);

    expect(tela.textContent).toContain('Não foi possível carregar a lista de clientes.');

    apiNoAr = true;
    botao(tela, 'Tentar de novo').click();
    await fixture.whenStable();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(linhas(tela)).toHaveLength(1);
  });

  describe('busca por nome', () => {
    // O debounceTime do RxJS usa setInterval e Date.now. Só eles são trocados pelo relógio falso:
    // o resto (setTimeout, que o Angular usa para atualizar a tela) segue normal.
    beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }));
    afterEach(() => vi.useRealTimers());

    it('espera o usuário parar de digitar antes de buscar', async () => {
      const { tela } = await montar(of([maria]));
      listar.mockClear();

      digitar(tela, 'mar');
      vi.advanceTimersByTime(299);
      expect(listar).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(listar).toHaveBeenCalledTimes(1);
      expect(listar).toHaveBeenCalledWith('mar');
    });

    it('várias teclas seguidas viram uma busca só, com o texto final', async () => {
      const { tela } = await montar(of([maria]));
      listar.mockClear();

      digitar(tela, 'm');
      vi.advanceTimersByTime(100);
      digitar(tela, 'ma');
      vi.advanceTimersByTime(100);
      digitar(tela, 'mar');
      vi.advanceTimersByTime(300);

      expect(listar).toHaveBeenCalledTimes(1);
      expect(listar).toHaveBeenCalledWith('mar');
    });

    it('ignora espaços nas pontas e não busca de novo se o texto final não mudou', async () => {
      const { tela } = await montar(of([maria]));
      listar.mockClear();

      digitar(tela, '  mar ');
      vi.advanceTimersByTime(300);
      digitar(tela, 'mar');
      vi.advanceTimersByTime(300);

      expect(listar).toHaveBeenCalledTimes(1);
      expect(listar).toHaveBeenCalledWith('mar');
    });

    it('sem resultado, diz que nada foi encontrado (e não que não há cadastro)', async () => {
      const { fixture, tela } = await montar(of([]));

      digitar(tela, 'zzz');
      vi.advanceTimersByTime(300);
      await fixture.whenStable();

      expect(tela.textContent).toContain('Nenhum cliente encontrado com esse nome.');
      expect(tela.textContent).not.toContain('Nenhum cliente cadastrado.');
    });

    it('a resposta atrasada de uma busca antiga não sobrescreve a mais nova', async () => {
      const antiga = new Subject<Cliente[]>();
      const nova = new Subject<Cliente[]>();
      const { fixture, tela } = await montar(of([]));
      listar.mockReturnValueOnce(antiga).mockReturnValueOnce(nova);

      digitar(tela, 'ma');
      vi.advanceTimersByTime(300);
      digitar(tela, 'mar');
      vi.advanceTimersByTime(300);

      // A busca nova responde primeiro; depois chega a antiga, que já foi cancelada.
      nova.next([maria]);
      antiga.next([joao]);
      await fixture.whenStable();

      expect(linhas(tela).map((l) => l.textContent)).toEqual([expect.stringContaining('Maria Silva')]);
    });

    it('um erro não derruba a busca: a digitação seguinte funciona', async () => {
      const { fixture, tela } = await montar(throwError(() => criarApiError({ status: 503 })));
      expect(tela.textContent).toContain('Não foi possível carregar a lista de clientes.');

      listar.mockReturnValue(of([maria]));
      digitar(tela, 'mar');
      vi.advanceTimersByTime(300);
      await fixture.whenStable();

      expect(linhas(tela)).toHaveLength(1);
    });

    it('"Tentar de novo" repete a busca com o texto que estava no campo', async () => {
      let apiNoAr = false;
      const resposta = new Observable<Cliente[]>((assinante) => {
        if (apiNoAr) {
          assinante.next([maria]);
          assinante.complete();
        } else {
          assinante.error(criarApiError({ status: 503 }));
        }
      });
      const { fixture, tela } = await montar(resposta);

      digitar(tela, 'mar');
      vi.advanceTimersByTime(300);
      await fixture.whenStable();

      apiNoAr = true;
      botao(tela, 'Tentar de novo').click();
      await fixture.whenStable();

      expect(listar).toHaveBeenLastCalledWith('mar');
      expect(linhas(tela)).toHaveLength(1);
    });

    it('o botão de limpar só aparece com texto e volta a buscar a lista inteira', async () => {
      const { fixture, tela } = await montar(of([maria]));
      expect(tela.querySelector('button[aria-label="Limpar a busca"]')).toBeNull();

      digitar(tela, 'mar');
      vi.advanceTimersByTime(300);
      await fixture.whenStable();
      botao(tela, 'Limpar a busca').click();
      vi.advanceTimersByTime(300);
      await fixture.whenStable();

      expect(tela.querySelector<HTMLInputElement>('input')?.value).toBe('');
      expect(listar).toHaveBeenLastCalledWith('');
    });
  });
});
