import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SaudeService } from './saude.service';

describe('SaudeService', () => {
  let service: SaudeService;
  let servidor: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(SaudeService);
    servidor = TestBed.inject(HttpTestingController);
  });

  afterEach(() => servidor.verify());

  it('chama GET /health pedindo texto', () => {
    let resultado: string | undefined;
    service.verificar().subscribe((texto) => (resultado = texto));

    const chamada = servidor.expectOne('/health');
    expect(chamada.request.method).toBe('GET');
    expect(chamada.request.responseType).toBe('text');

    chamada.flush('Healthy');
    expect(resultado).toBe('Healthy');
  });

  it('falha quando a API responde 503', () => {
    let falhou = false;
    service.verificar().subscribe({ error: () => (falhou = true) });

    servidor.expectOne('/health').flush('Unhealthy', { status: 503, statusText: 'Service Unavailable' });

    expect(falhou).toBe(true);
  });
});
