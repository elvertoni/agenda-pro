import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { SaudeService } from '../../core/api/saude.service';
import { Inicio } from './inicio';

describe('Inicio', () => {
  // Monta a tela com um SaudeService falso: o teste decide o que a "API" responde.
  async function montar(verificar: () => Observable<string>) {
    await TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [provideRouter([]), { provide: SaudeService, useValue: { verificar } }],
    }).compileComponents();

    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();

    return { fixture, tela: fixture.nativeElement as HTMLElement };
  }

  it('mostra "verificando" enquanto a API não responde', async () => {
    const semResposta = new Subject<string>();

    const { tela } = await montar(() => semResposta);

    expect(tela.querySelector('.estado-api')?.textContent).toContain('Verificando a conexão');
  });

  it('mostra "API conectada" quando o /health responde', async () => {
    const { tela } = await montar(() => of('Healthy'));

    expect(tela.querySelector('.estado-api')?.textContent).toContain('API conectada.');
  });

  it('mostra o erro e deixa tentar de novo quando a API falha', async () => {
    let apiNoAr = false;
    const verificar = vi.fn(() => (apiNoAr ? of('Healthy') : throwError(() => new Error('fora do ar'))));

    const { fixture, tela } = await montar(verificar);

    expect(tela.querySelector('.estado-api')?.textContent).toContain('Sem resposta da API.');

    apiNoAr = true;
    tela.querySelector<HTMLButtonElement>('.estado-api button')?.click();
    await fixture.whenStable();

    expect(verificar).toHaveBeenCalledTimes(2);
    expect(tela.querySelector('.estado-api')?.textContent).toContain('API conectada.');
  });

  it('mostra um atalho para cada tela', async () => {
    const { tela } = await montar(() => of('Healthy'));

    const enderecos = Array.from(tela.querySelectorAll('.atalhos a')).map((a) => a.getAttribute('href'));

    expect(enderecos).toEqual(['/profissionais', '/clientes', '/agendar', '/agendamentos']);
  });
});
