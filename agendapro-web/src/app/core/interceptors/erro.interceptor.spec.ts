import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiError } from '../models/api-error';
import { erroInterceptor } from './erro.interceptor';

describe('erroInterceptor', () => {
  let http: HttpClient;
  let servidor: HttpTestingController;
  let abrirSnackBar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    abrirSnackBar = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erroInterceptor])),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: abrirSnackBar } },
      ],
    });

    http = TestBed.inject(HttpClient);
    servidor = TestBed.inject(HttpTestingController);
  });

  afterEach(() => servidor.verify());

  // Faz uma chamada, deixa o teste responder e devolve o erro que a tela receberia.
  function capturarErro(responder: () => void): ApiError {
    let recebido: ApiError | undefined;
    http.get('/api/teste').subscribe({ error: (erro: ApiError) => (recebido = erro) });

    responder();

    if (!recebido) {
      throw new Error('A chamada deveria ter falhado.');
    }
    return recebido;
  }

  it('não interfere quando a requisição dá certo', () => {
    let resposta: unknown;
    http.get('/api/teste').subscribe((corpo) => (resposta = corpo));

    servidor.expectOne('/api/teste').flush({ ok: true });

    expect(resposta).toEqual({ ok: true });
    expect(abrirSnackBar).not.toHaveBeenCalled();
  });

  it('converte o 400 de validação e passa as chaves para camelCase', () => {
    const erro = capturarErro(() =>
      servidor.expectOne('/api/teste').flush(
        {
          title: 'One or more validation errors occurred.',
          status: 400,
          errors: {
            Nome: ['The Nome field is required.'],
            Especialidade: ['The Especialidade field is required.'],
          },
        },
        { status: 400, statusText: 'Bad Request' },
      ),
    );

    expect(erro.status).toBe(400);
    expect(erro.title).toBe('One or more validation errors occurred.');
    expect(erro.detail).toBeNull();
    expect(erro.errosPorCampo).toEqual({
      nome: ['The Nome field is required.'],
      especialidade: ['The Especialidade field is required.'],
    });
  });

  it('remove o prefixo "$." das chaves de erro de leitura do JSON', () => {
    const erro = capturarErro(() =>
      servidor.expectOne('/api/teste').flush(
        { title: 'Erro', status: 400, errors: { '$.dataHoraInicio': ['Valor inválido.'] } },
        { status: 400, statusText: 'Bad Request' },
      ),
    );

    expect(erro.errosPorCampo).toEqual({ dataHoraInicio: ['Valor inválido.'] });
  });

  it('converte erro de regra de negócio com title e detail', () => {
    const erro = capturarErro(() =>
      servidor.expectOne('/api/teste').flush(
        {
          title: 'Profissional inativo.',
          status: 400,
          detail: 'Um profissional inativo não tem horários disponíveis.',
        },
        { status: 400, statusText: 'Bad Request' },
      ),
    );

    expect(erro.title).toBe('Profissional inativo.');
    expect(erro.detail).toBe('Um profissional inativo não tem horários disponíveis.');
    expect(erro.errosPorCampo).toEqual({});
  });

  it.each([400, 404, 409])('não mostra aviso no %i: quem trata é a tela', (status) => {
    capturarErro(() =>
      servidor.expectOne('/api/teste').flush({ title: 'Erro', status }, { status, statusText: 'Erro' }),
    );

    expect(abrirSnackBar).not.toHaveBeenCalled();
  });

  it('mostra aviso quando não consegue conectar (status 0)', () => {
    const erro = capturarErro(() => servidor.expectOne('/api/teste').error(new ProgressEvent('error')));

    expect(erro.status).toBe(0);
    expect(erro.title).toBe('Erro inesperado');
    expect(abrirSnackBar).toHaveBeenCalledTimes(1);
    expect(abrirSnackBar.mock.calls[0][0]).toBe('Não foi possível conectar à API.');
  });

  it.each([502, 504])('mostra aviso de conexão quando o proxy não alcança a API (%i)', (status) => {
    const erro = capturarErro(() =>
      servidor.expectOne('/api/teste').flush('', { status, statusText: 'Erro' }),
    );

    expect(erro.status).toBe(status);
    expect(abrirSnackBar).toHaveBeenCalledTimes(1);
    expect(abrirSnackBar.mock.calls[0][0]).toBe('Não foi possível conectar à API.');
  });

  it.each([500, 503])('mostra aviso de erro no servidor no %i', (status) => {
    const erro = capturarErro(() =>
      servidor.expectOne('/api/teste').flush('Unhealthy', { status, statusText: 'Erro' }),
    );

    // O corpo veio em texto, não em ProblemDetails: o título vira o padrão.
    expect(erro.status).toBe(status);
    expect(erro.title).toBe('Erro inesperado');
    expect(abrirSnackBar).toHaveBeenCalledTimes(1);
    expect(abrirSnackBar.mock.calls[0][0]).toBe('Erro no servidor. Tente novamente em instantes.');
  });
});
