import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Profissional } from '../models/profissional';
import { ProfissionaisService } from './profissionais.service';

describe('ProfissionaisService', () => {
  let service: ProfissionaisService;
  let servidor: HttpTestingController;

  const ana: Profissional = { id: 1, nome: 'Dra. Ana Souza', especialidade: 'Dermatologia', ativo: true };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProfissionaisService);
    servidor = TestBed.inject(HttpTestingController);
  });

  // Falha o teste se sobrou requisição sem resposta ou se alguma não era esperada.
  afterEach(() => servidor.verify());

  it('lista sem filtros: GET sem parâmetros', () => {
    let resultado: Profissional[] | undefined;
    service.listar().subscribe((lista) => (resultado = lista));

    const chamada = servidor.expectOne('/api/profissionais');
    expect(chamada.request.method).toBe('GET');
    expect(chamada.request.params.keys()).toEqual([]);

    chamada.flush([ana]);
    expect(resultado).toEqual([ana]);
  });

  it('lista com filtros: envia especialidade e ativo', () => {
    service.listar({ especialidade: 'Derma', ativo: false }).subscribe();

    const chamada = servidor.expectOne((req) => req.url === '/api/profissionais');
    expect(chamada.request.params.get('especialidade')).toBe('Derma');
    expect(chamada.request.params.get('ativo')).toBe('false');

    chamada.flush([]);
  });

  it('não envia especialidade vazia', () => {
    service.listar({ especialidade: '' }).subscribe();

    const chamada = servidor.expectOne('/api/profissionais');
    expect(chamada.request.params.has('especialidade')).toBe(false);

    chamada.flush([]);
  });

  it('obtém um profissional pelo id', () => {
    let resultado: Profissional | undefined;
    service.obter(1).subscribe((profissional) => (resultado = profissional));

    const chamada = servidor.expectOne('/api/profissionais/1');
    expect(chamada.request.method).toBe('GET');

    chamada.flush(ana);
    expect(resultado).toEqual(ana);
  });

  it('cria com POST e o corpo no formato da API', () => {
    service.criar({ nome: 'Dra. Ana Souza', especialidade: 'Dermatologia' }).subscribe();

    const chamada = servidor.expectOne('/api/profissionais');
    expect(chamada.request.method).toBe('POST');
    expect(chamada.request.body).toEqual({ nome: 'Dra. Ana Souza', especialidade: 'Dermatologia' });

    chamada.flush(ana, { status: 201, statusText: 'Created' });
  });

  it('atualiza com PUT no id informado', () => {
    service.atualizar(1, { nome: 'Dra. Ana S.', especialidade: 'Dermatologia' }).subscribe();

    const chamada = servidor.expectOne('/api/profissionais/1');
    expect(chamada.request.method).toBe('PUT');
    expect(chamada.request.body).toEqual({ nome: 'Dra. Ana S.', especialidade: 'Dermatologia' });

    chamada.flush(ana);
  });

  it('ativa ou inativa com PATCH em /ativo', () => {
    service.alterarAtivo(1, false).subscribe();

    const chamada = servidor.expectOne('/api/profissionais/1/ativo');
    expect(chamada.request.method).toBe('PATCH');
    expect(chamada.request.body).toEqual({ ativo: false });

    chamada.flush({ ...ana, ativo: false });
  });

  it('repassa o erro da API para quem chamou', () => {
    let status: number | undefined;
    service.obter(999).subscribe({ error: (erro: { status: number }) => (status = erro.status) });

    servidor
      .expectOne('/api/profissionais/999')
      .flush({ title: 'Not Found', status: 404 }, { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });
});
