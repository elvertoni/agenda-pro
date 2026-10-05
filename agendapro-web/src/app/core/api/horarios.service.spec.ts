import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Horario } from '../models/horario';
import { HorariosService } from './horarios.service';

describe('HorariosService', () => {
  let service: HorariosService;
  let servidor: HttpTestingController;

  const segunda: Horario = { id: 4, diaSemana: 'Monday', horaInicio: '08:00:00', horaFim: '12:00:00' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(HorariosService);
    servidor = TestBed.inject(HttpTestingController);
  });

  afterEach(() => servidor.verify());

  it('lista o expediente na rota aninhada do profissional', () => {
    let resultado: Horario[] | undefined;
    service.listar(7).subscribe((lista) => (resultado = lista));

    const chamada = servidor.expectOne('/api/profissionais/7/horarios');
    expect(chamada.request.method).toBe('GET');

    chamada.flush([segunda]);
    expect(resultado).toEqual([segunda]);
  });

  it('cria com POST e o dia da semana em texto', () => {
    service.criar(7, { diaSemana: 'Monday', horaInicio: '08:00:00', horaFim: '12:00:00' }).subscribe();

    const chamada = servidor.expectOne('/api/profissionais/7/horarios');
    expect(chamada.request.method).toBe('POST');
    expect(chamada.request.body).toEqual({ diaSemana: 'Monday', horaInicio: '08:00:00', horaFim: '12:00:00' });

    chamada.flush(segunda, { status: 201, statusText: 'Created' });
  });

  it('remove com DELETE no id do horário', () => {
    let terminou = false;
    service.remover(7, 4).subscribe({ complete: () => (terminou = true) });

    const chamada = servidor.expectOne('/api/profissionais/7/horarios/4');
    expect(chamada.request.method).toBe('DELETE');

    chamada.flush(null, { status: 204, statusText: 'No Content' });
    expect(terminou).toBe(true);
  });

  it('repassa o 409 de horário sobreposto para quem chamou', () => {
    let status: number | undefined;
    service
      .criar(7, { diaSemana: 'Monday', horaInicio: '09:00:00', horaFim: '10:00:00' })
      .subscribe({ error: (erro: { status: number }) => (status = erro.status) });

    servidor
      .expectOne('/api/profissionais/7/horarios')
      .flush({ title: 'Horário sobreposto', status: 409 }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
  });
});
