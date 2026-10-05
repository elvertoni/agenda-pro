import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Cliente } from '../models/cliente';
import { ClientesService } from './clientes.service';

describe('ClientesService', () => {
  let service: ClientesService;
  let servidor: HttpTestingController;

  const maria: Cliente = { id: 1, nome: 'Maria Silva', cpf: '***.982.247-**', telefone: '(41) 99999-0000' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ClientesService);
    servidor = TestBed.inject(HttpTestingController);
  });

  // Falha o teste se sobrou requisição sem resposta ou se alguma não era esperada.
  afterEach(() => servidor.verify());

  it('lista sem busca: GET sem parâmetros', () => {
    let resultado: Cliente[] | undefined;
    service.listar().subscribe((lista) => (resultado = lista));

    const chamada = servidor.expectOne('/api/clientes');
    expect(chamada.request.method).toBe('GET');
    expect(chamada.request.params.keys()).toEqual([]);

    chamada.flush([maria]);
    expect(resultado).toEqual([maria]);
  });

  it('lista com busca: envia o nome', () => {
    service.listar('mar').subscribe();

    const chamada = servidor.expectOne((req) => req.url === '/api/clientes');
    expect(chamada.request.params.get('nome')).toBe('mar');

    chamada.flush([]);
  });

  it('não envia nome vazio', () => {
    service.listar('').subscribe();

    const chamada = servidor.expectOne('/api/clientes');
    expect(chamada.request.params.has('nome')).toBe(false);

    chamada.flush([]);
  });

  it('obtém um cliente pelo id', () => {
    let resultado: Cliente | undefined;
    service.obter(1).subscribe((cliente) => (resultado = cliente));

    const chamada = servidor.expectOne('/api/clientes/1');
    expect(chamada.request.method).toBe('GET');

    chamada.flush(maria);
    expect(resultado).toEqual(maria);
  });

  it('cria com POST e o corpo no formato da API', () => {
    service.criar({ nome: 'Maria Silva', cpf: '52998224725', telefone: null }).subscribe();

    const chamada = servidor.expectOne('/api/clientes');
    expect(chamada.request.method).toBe('POST');
    expect(chamada.request.body).toEqual({ nome: 'Maria Silva', cpf: '52998224725', telefone: null });

    chamada.flush(maria, { status: 201, statusText: 'Created' });
  });

  it('atualiza com PUT no id informado, sem CPF no corpo', () => {
    service.atualizar(1, { nome: 'Maria S.', telefone: '(41) 3333-0000' }).subscribe();

    const chamada = servidor.expectOne('/api/clientes/1');
    expect(chamada.request.method).toBe('PUT');
    expect(chamada.request.body).toEqual({ nome: 'Maria S.', telefone: '(41) 3333-0000' });
    expect(chamada.request.body).not.toHaveProperty('cpf');

    chamada.flush(maria);
  });

  it('repassa o erro da API para quem chamou', () => {
    let status: number | undefined;
    service
      .criar({ nome: 'Maria', cpf: '52998224725', telefone: null })
      .subscribe({ error: (erro: { status: number }) => (status = erro.status) });

    servidor
      .expectOne('/api/clientes')
      .flush({ title: 'Já existe um cliente com este CPF.', status: 409 }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
  });
});
