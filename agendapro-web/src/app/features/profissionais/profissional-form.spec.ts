import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ProfissionaisService } from '../../core/api/profissionais.service';
import { Profissional } from '../../core/models/profissional';
import { criarApiError } from '../../testing/api-error';
import { ProfissionalForm } from './profissional-form';

describe('ProfissionalForm', () => {
  const ana: Profissional = { id: 3, nome: 'Dra. Ana Souza', especialidade: 'Dermatologia', ativo: true };

  let obter: ReturnType<typeof vi.fn>;
  let criar: ReturnType<typeof vi.fn>;
  let atualizar: ReturnType<typeof vi.fn>;
  let abrirSnackBar: ReturnType<typeof vi.fn>;
  let navegar: ReturnType<typeof vi.fn>;

  // id indefinido = /profissionais/novo; com id = /profissionais/:id/editar.
  async function montar(id?: string, aoObter: () => Observable<Profissional> = () => of(ana)) {
    obter = vi.fn(aoObter);
    criar = vi.fn();
    atualizar = vi.fn();
    abrirSnackBar = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ProfissionalForm],
      providers: [
        provideRouter([]),
        { provide: ProfissionaisService, useValue: { obter, criar, atualizar } },
        { provide: MatSnackBar, useValue: { open: abrirSnackBar } },
      ],
    }).compileComponents();

    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as unknown as ReturnType<
      typeof vi.fn
    >;

    const fixture = TestBed.createComponent(ProfissionalForm);
    if (id !== undefined) {
      fixture.componentRef.setInput('id', id);
    }
    await fixture.whenStable();

    return { fixture, tela: fixture.nativeElement as HTMLElement };
  }

  function preencher(tela: HTMLElement, nome: string, especialidade: string): void {
    const campos = tela.querySelectorAll<HTMLInputElement>('input');
    campos[0].value = nome;
    campos[0].dispatchEvent(new Event('input'));
    campos[1].value = especialidade;
    campos[1].dispatchEvent(new Event('input'));
  }

  async function enviar(fixture: { whenStable(): Promise<unknown> }, tela: HTMLElement): Promise<void> {
    tela.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();
  }

  describe('cadastro (/profissionais/novo)', () => {
    it('abre com o formulário vazio e sem buscar nada na API', async () => {
      const { tela } = await montar();

      expect(tela.querySelector('h1')?.textContent).toContain('Novo profissional');
      expect(obter).not.toHaveBeenCalled();
      expect(tela.querySelectorAll('input')).toHaveLength(2);
    });

    it('com os campos vazios, mostra os erros e não chama a API', async () => {
      const { fixture, tela } = await montar();

      await enviar(fixture, tela);

      expect(criar).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('Informe o nome.');
      expect(tela.textContent).toContain('Informe a especialidade.');
    });

    it('só espaços não vale como preenchido (a API também recusa)', async () => {
      const { fixture, tela } = await montar();
      preencher(tela, '    ', '  ');

      await enviar(fixture, tela);

      expect(criar).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('Informe o nome.');
    });

    it('recusa nome acima de 100 caracteres e especialidade acima de 80', async () => {
      const { fixture, tela } = await montar();
      preencher(tela, 'a'.repeat(101), 'b'.repeat(81));

      await enviar(fixture, tela);

      expect(criar).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('O nome pode ter no máximo 100 caracteres.');
      expect(tela.textContent).toContain('A especialidade pode ter no máximo 80 caracteres.');
    });

    it('aceita exatamente os limites (100 e 80)', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(of({ ...ana, id: 9 }));
      preencher(tela, 'a'.repeat(100), 'b'.repeat(80));

      await enviar(fixture, tela);

      expect(criar).toHaveBeenCalledTimes(1);
    });

    it('envia os textos sem espaços nas pontas, avisa e vai para o expediente', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(of({ id: 9, nome: 'Dr. Novo', especialidade: 'Pediatria', ativo: true }));
      preencher(tela, '  Dr. Novo ', ' Pediatria  ');

      await enviar(fixture, tela);

      expect(criar).toHaveBeenCalledWith({ nome: 'Dr. Novo', especialidade: 'Pediatria' });
      expect(abrirSnackBar.mock.calls[0][0]).toBe('Profissional cadastrado. Agora defina o expediente.');
      expect(navegar).toHaveBeenCalledWith(['/profissionais', 9, 'horarios']);
    });

    it('desabilita o botão enquanto envia e não deixa enviar duas vezes', async () => {
      const { fixture, tela } = await montar();
      const resposta = new Subject<Profissional>();
      criar.mockReturnValue(resposta);
      preencher(tela, 'Dr. Novo', 'Pediatria');

      await enviar(fixture, tela);

      const botao = tela.querySelector<HTMLButtonElement>('button[type="submit"]');
      expect(botao?.disabled).toBe(true);
      expect(botao?.textContent).toContain('Salvando...');

      // Mesmo forçando o envio do formulário, a segunda chamada é barrada.
      tela.querySelector('form')?.dispatchEvent(new Event('submit'));
      expect(criar).toHaveBeenCalledTimes(1);

      resposta.next({ ...ana, id: 9 });
      await fixture.whenStable();
      expect(botao?.disabled).toBe(false);
    });

    it('erro de validação do servidor aparece no campo certo, sem mensagem em inglês solta', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(
        throwError(() =>
          criarApiError({
            title: 'One or more validation errors occurred.',
            errosPorCampo: { nome: ['O nome já está em uso.'] },
          }),
        ),
      );
      preencher(tela, 'Dr. Novo', 'Pediatria');

      await enviar(fixture, tela);

      expect(tela.querySelector('mat-form-field mat-error')?.textContent).toContain('O nome já está em uso.');
      expect(tela.querySelector('.erro-geral')).toBeNull();
      expect(tela.textContent).not.toContain('One or more validation errors');
      expect(navegar).not.toHaveBeenCalled();
    });

    it('erro de regra de negócio aparece em um aviso geral', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(throwError(() => criarApiError({ title: 'Regra', detail: 'Não foi possível salvar.' })));
      preencher(tela, 'Dr. Novo', 'Pediatria');

      await enviar(fixture, tela);

      expect(tela.querySelector('.erro-geral')?.textContent).toContain('Não foi possível salvar.');
    });

    it('5xx: não mostra aviso na tela, porque o interceptor já avisou, e libera o botão', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(throwError(() => criarApiError({ status: 503, title: 'Erro' })));
      preencher(tela, 'Dr. Novo', 'Pediatria');

      await enviar(fixture, tela);

      expect(tela.querySelector('.erro-geral')).toBeNull();
      expect(tela.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    });
  });

  describe('edição (/profissionais/:id/editar)', () => {
    it('busca o profissional pelo id do endereço e preenche o formulário', async () => {
      const { tela } = await montar('3');

      const campos = tela.querySelectorAll<HTMLInputElement>('input');

      expect(obter).toHaveBeenCalledWith(3);
      expect(tela.querySelector('h1')?.textContent).toContain('Editar profissional');
      expect(campos[0].value).toBe('Dra. Ana Souza');
      expect(campos[1].value).toBe('Dermatologia');
    });

    it('mostra "carregando" enquanto busca', async () => {
      const { tela } = await montar('3', () => new Subject<Profissional>());

      expect(tela.textContent).toContain('Carregando profissional...');
      expect(tela.querySelector('form')).toBeNull();
    });

    it('salva com PUT no id certo, avisa e volta para a lista', async () => {
      const { fixture, tela } = await montar('3');
      atualizar.mockReturnValue(of({ ...ana, nome: 'Dra. Ana S.' }));
      preencher(tela, 'Dra. Ana S.', 'Dermatologia');

      await enviar(fixture, tela);

      expect(atualizar).toHaveBeenCalledWith(3, { nome: 'Dra. Ana S.', especialidade: 'Dermatologia' });
      expect(criar).not.toHaveBeenCalled();
      expect(abrirSnackBar.mock.calls[0][0]).toBe('Alterações salvas.');
      expect(navegar).toHaveBeenCalledWith(['/profissionais']);
    });

    it('404 ao buscar: mostra "não encontrado" e nenhum formulário', async () => {
      const { tela } = await montar('999', () => throwError(() => criarApiError({ status: 404, title: 'Not Found' })));

      expect(tela.textContent).toContain('Profissional não encontrado.');
      expect(tela.querySelector('form')).toBeNull();
    });

    it('falha de conexão ao buscar: mostra o erro com "Tentar de novo"', async () => {
      let apiNoAr = false;
      const { fixture, tela } = await montar('3', () =>
        apiNoAr ? of(ana) : throwError(() => criarApiError({ status: 0 })),
      );

      expect(tela.textContent).toContain('Não foi possível carregar o profissional.');

      apiNoAr = true;
      Array.from(tela.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Tentar de novo'))
        ?.click();
      await fixture.whenStable();

      expect(tela.querySelector('form')).not.toBeNull();
    });

    it.each(['abc', '0', '-2', '1.5'])('id inválido "%s" no endereço: "não encontrado", sem chamar a API', async (id) => {
      const { tela } = await montar(id);

      expect(obter).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('Profissional não encontrado.');
    });

    it('404 ao salvar (removido por outra pessoa): troca para "não encontrado"', async () => {
      const { fixture, tela } = await montar('3');
      atualizar.mockReturnValue(throwError(() => criarApiError({ status: 404, title: 'Not Found' })));
      preencher(tela, 'Dra. Ana S.', 'Dermatologia');

      await enviar(fixture, tela);

      expect(tela.textContent).toContain('Profissional não encontrado.');
    });
  });
});
