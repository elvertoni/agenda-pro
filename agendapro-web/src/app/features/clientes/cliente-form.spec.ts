import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ClientesService } from '../../core/api/clientes.service';
import { Cliente } from '../../core/models/cliente';
import { criarApiError } from '../../testing/api-error';
import { ClienteForm } from './cliente-form';

describe('ClienteForm', () => {
  const maria: Cliente = { id: 3, nome: 'Maria Silva', cpf: '***.982.247-**', telefone: '(41) 99999-0000' };

  let obter: ReturnType<typeof vi.fn>;
  let criar: ReturnType<typeof vi.fn>;
  let atualizar: ReturnType<typeof vi.fn>;
  let abrirSnackBar: ReturnType<typeof vi.fn>;
  let navegar: ReturnType<typeof vi.fn>;

  // id indefinido = /clientes/novo; com id = /clientes/:id/editar.
  async function montar(id?: string, aoObter: () => Observable<Cliente> = () => of(maria)) {
    obter = vi.fn(aoObter);
    criar = vi.fn();
    atualizar = vi.fn();
    abrirSnackBar = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ClienteForm],
      providers: [
        provideRouter([]),
        { provide: ClientesService, useValue: { obter, criar, atualizar } },
        { provide: MatSnackBar, useValue: { open: abrirSnackBar } },
      ],
    }).compileComponents();

    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as unknown as ReturnType<
      typeof vi.fn
    >;

    const fixture = TestBed.createComponent(ClienteForm);
    if (id !== undefined) {
      fixture.componentRef.setInput('id', id);
    }
    await fixture.whenStable();

    return { fixture, tela: fixture.nativeElement as HTMLElement };
  }

  const campos = (tela: HTMLElement) => tela.querySelectorAll<HTMLInputElement>('input');

  function digitar(campo: HTMLInputElement, texto: string): void {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
  }

  // Ordem dos campos na tela: nome, CPF, telefone.
  function preencher(tela: HTMLElement, nome: string, cpf: string, telefone = ''): void {
    const [campoNome, campoCpf, campoTelefone] = Array.from(campos(tela));
    digitar(campoNome, nome);
    digitar(campoCpf, cpf);
    digitar(campoTelefone, telefone);
  }

  async function enviar(fixture: { whenStable(): Promise<unknown> }, tela: HTMLElement): Promise<void> {
    tela.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();
  }

  describe('cadastro (/clientes/novo)', () => {
    it('abre com o formulário vazio e sem buscar nada na API', async () => {
      const { tela } = await montar();

      expect(tela.querySelector('h1')?.textContent).toContain('Novo cliente');
      expect(obter).not.toHaveBeenCalled();
      expect(campos(tela)).toHaveLength(3);
      expect(campos(tela)[1].disabled).toBe(false);
    });

    it('com os campos vazios, mostra os erros e não chama a API', async () => {
      const { fixture, tela } = await montar();

      await enviar(fixture, tela);

      expect(criar).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('Informe o nome.');
      expect(tela.textContent).toContain('Informe o CPF.');
    });

    it('só espaços no nome não vale como preenchido (a API também recusa)', async () => {
      const { fixture, tela } = await montar();
      preencher(tela, '    ', '529.982.247-25');

      await enviar(fixture, tela);

      expect(criar).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('Informe o nome.');
    });

    it('aplica a máscara enquanto o CPF é digitado', async () => {
      const { fixture, tela } = await montar();
      const cpf = campos(tela)[1];

      digitar(cpf, '5299');
      expect(cpf.value).toBe('529.9');

      digitar(cpf, '52998224725');
      expect(cpf.value).toBe('529.982.247-25');

      digitar(cpf, '5299822472599');
      await fixture.whenStable();
      expect(cpf.value).toBe('529.982.247-25');
    });

    it('recusa CPF com dígito verificador errado e não chama a API', async () => {
      const { fixture, tela } = await montar();
      preencher(tela, 'Maria Silva', '52998224724');

      await enviar(fixture, tela);

      expect(criar).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('CPF inválido.');
    });

    it('recusa nome acima de 100 caracteres e telefone acima de 20', async () => {
      const { fixture, tela } = await montar();
      preencher(tela, 'a'.repeat(101), '529.982.247-25', '9'.repeat(21));

      await enviar(fixture, tela);

      expect(criar).not.toHaveBeenCalled();
      expect(tela.textContent).toContain('O nome pode ter no máximo 100 caracteres.');
      expect(tela.textContent).toContain('O telefone pode ter no máximo 20 caracteres.');
    });

    it('envia o CPF só com números, o nome sem espaços nas pontas e telefone vazio como null', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(of(maria));
      preencher(tela, '  Maria Silva ', '529.982.247-25', '   ');

      await enviar(fixture, tela);

      expect(criar).toHaveBeenCalledWith({ nome: 'Maria Silva', cpf: '52998224725', telefone: null });
    });

    it('com telefone, envia o texto sem espaços nas pontas; depois avisa e volta para a lista', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(of(maria));
      preencher(tela, 'Maria Silva', '529.982.247-25', ' (41) 99999-0000 ');

      await enviar(fixture, tela);

      expect(criar).toHaveBeenCalledWith({ nome: 'Maria Silva', cpf: '52998224725', telefone: '(41) 99999-0000' });
      expect(abrirSnackBar.mock.calls[0][0]).toBe('Cliente cadastrado.');
      expect(navegar).toHaveBeenCalledWith(['/clientes']);
    });

    it('desabilita o botão enquanto envia e não deixa enviar duas vezes', async () => {
      const { fixture, tela } = await montar();
      const resposta = new Subject<Cliente>();
      criar.mockReturnValue(resposta);
      preencher(tela, 'Maria Silva', '529.982.247-25');

      await enviar(fixture, tela);

      const botao = tela.querySelector<HTMLButtonElement>('button[type="submit"]');
      expect(botao?.disabled).toBe(true);
      expect(botao?.textContent).toContain('Salvando...');

      // Mesmo forçando o envio do formulário, a segunda chamada é barrada.
      tela.querySelector('form')?.dispatchEvent(new Event('submit'));
      expect(criar).toHaveBeenCalledTimes(1);

      resposta.next(maria);
      await fixture.whenStable();
      expect(botao?.disabled).toBe(false);
    });

    it('409 (CPF duplicado): a mensagem aparece no campo CPF, e não em um aviso geral', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(
        throwError(() => criarApiError({ status: 409, title: 'Já existe um cliente com este CPF.' })),
      );
      preencher(tela, 'Maria Silva', '529.982.247-25');

      await enviar(fixture, tela);

      const campoCpf = tela.querySelectorAll('mat-form-field')[1];
      expect(campoCpf.querySelector('mat-error')?.textContent).toContain('Já existe um cliente com este CPF.');
      expect(tela.querySelector('.erro-geral')).toBeNull();
      expect(navegar).not.toHaveBeenCalled();
      expect(tela.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    });

    it('o erro de CPF duplicado some quando o usuário corrige o CPF', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(
        throwError(() => criarApiError({ status: 409, title: 'Já existe um cliente com este CPF.' })),
      );
      preencher(tela, 'Maria Silva', '529.982.247-25');
      await enviar(fixture, tela);

      digitar(campos(tela)[1], '111.444.777-35');
      await fixture.whenStable();

      expect(tela.textContent).not.toContain('Já existe um cliente com este CPF.');
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
      preencher(tela, 'Maria Silva', '529.982.247-25');

      await enviar(fixture, tela);

      expect(tela.querySelector('mat-form-field mat-error')?.textContent).toContain('O nome já está em uso.');
      expect(tela.querySelector('.erro-geral')).toBeNull();
      expect(tela.textContent).not.toContain('One or more validation errors');
    });

    it('400 de regra de negócio aparece em um aviso geral', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(throwError(() => criarApiError({ title: 'CPF inválido.' })));
      preencher(tela, 'Maria Silva', '529.982.247-25');

      await enviar(fixture, tela);

      expect(tela.querySelector('.erro-geral')?.textContent).toContain('CPF inválido.');
    });

    it('5xx: não mostra aviso na tela, porque o interceptor já avisou, e libera o botão', async () => {
      const { fixture, tela } = await montar();
      criar.mockReturnValue(throwError(() => criarApiError({ status: 503, title: 'Erro' })));
      preencher(tela, 'Maria Silva', '529.982.247-25');

      await enviar(fixture, tela);

      expect(tela.querySelector('.erro-geral')).toBeNull();
      expect(tela.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    });
  });

  describe('edição (/clientes/:id/editar)', () => {
    it('busca o cliente pelo id do endereço e preenche o formulário', async () => {
      const { tela } = await montar('3');

      expect(obter).toHaveBeenCalledWith(3);
      expect(tela.querySelector('h1')?.textContent).toContain('Editar cliente');
      expect(campos(tela)[0].value).toBe('Maria Silva');
      expect(campos(tela)[1].value).toBe('***.982.247-**');
      expect(campos(tela)[2].value).toBe('(41) 99999-0000');
    });

    it('o CPF aparece só para leitura, com aviso de que não pode ser alterado', async () => {
      const { tela } = await montar('3');

      expect(campos(tela)[1].disabled).toBe(true);
      expect(tela.textContent).toContain('O CPF não pode ser alterado.');
    });

    it('cliente sem telefone abre com o campo vazio', async () => {
      const { tela } = await montar('3', () => of({ ...maria, telefone: null }));

      expect(campos(tela)[2].value).toBe('');
    });

    it('mostra "carregando" enquanto busca', async () => {
      const { tela } = await montar('3', () => new Subject<Cliente>());

      expect(tela.textContent).toContain('Carregando cliente...');
      expect(tela.querySelector('form')).toBeNull();
    });

    it('salva com PUT no id certo, só com nome e telefone, avisa e volta para a lista', async () => {
      const { fixture, tela } = await montar('3');
      atualizar.mockReturnValue(of({ ...maria, nome: 'Maria S.' }));
      digitar(campos(tela)[0], 'Maria S.');
      digitar(campos(tela)[2], '');

      await enviar(fixture, tela);

      expect(atualizar).toHaveBeenCalledWith(3, { nome: 'Maria S.', telefone: null });
      expect(criar).not.toHaveBeenCalled();
      expect(abrirSnackBar.mock.calls[0][0]).toBe('Alterações salvas.');
      expect(navegar).toHaveBeenCalledWith(['/clientes']);
    });

    it('404 ao buscar: mostra "não encontrado" e nenhum formulário', async () => {
      const { tela } = await montar('999', () => throwError(() => criarApiError({ status: 404, title: 'Not Found' })));

      expect(tela.textContent).toContain('Cliente não encontrado.');
      expect(tela.querySelector('form')).toBeNull();
    });

    it('falha de conexão ao buscar: mostra o erro com "Tentar de novo"', async () => {
      let apiNoAr = false;
      const { fixture, tela } = await montar('3', () =>
        apiNoAr ? of(maria) : throwError(() => criarApiError({ status: 0 })),
      );

      expect(tela.textContent).toContain('Não foi possível carregar o cliente.');

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
      expect(tela.textContent).toContain('Cliente não encontrado.');
    });

    it('404 ao salvar (removido por outra pessoa): troca para "não encontrado"', async () => {
      const { fixture, tela } = await montar('3');
      atualizar.mockReturnValue(throwError(() => criarApiError({ status: 404, title: 'Not Found' })));
      digitar(campos(tela)[0], 'Maria S.');

      await enviar(fixture, tela);

      expect(tela.textContent).toContain('Cliente não encontrado.');
    });
  });
});
