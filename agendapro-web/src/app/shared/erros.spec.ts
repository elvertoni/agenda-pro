import { FormControl, FormGroup } from '@angular/forms';
import { ApiError } from '../core/models/api-error';
import { aplicarErrosDoServidor, ehErroDaTela, mensagemDe } from './erros';

function erro(parcial: Partial<ApiError>): ApiError {
  return { status: 400, title: 'Erro', detail: null, errosPorCampo: {}, ...parcial };
}

describe('ehErroDaTela', () => {
  it.each([400, 404, 409, 422])('o %i é tratado pela tela', (status) => {
    expect(ehErroDaTela(erro({ status }))).toBe(true);
  });

  it.each([0, 500, 502, 503, 504])('o %i já foi avisado pelo interceptor', (status) => {
    expect(ehErroDaTela(erro({ status }))).toBe(false);
  });
});

describe('mensagemDe', () => {
  it('usa o detail da regra de negócio quando existe', () => {
    expect(mensagemDe(erro({ title: 'Horário sobreposto', detail: 'Já existe um horário nesse dia.' }))).toBe(
      'Já existe um horário nesse dia.',
    );
  });

  it('usa o título quando não há detail', () => {
    expect(mensagemDe(erro({ title: 'Not Found' }))).toBe('Not Found');
  });

  it('não mostra o título em inglês da validação: troca por um aviso em português', () => {
    const validacao = erro({
      title: 'One or more validation errors occurred.',
      errosPorCampo: { nome: ['The Nome field is required.'] },
    });

    expect(mensagemDe(validacao)).toBe('Confira os dados informados.');
  });
});

describe('aplicarErrosDoServidor', () => {
  function formulario(): FormGroup {
    return new FormGroup({ nome: new FormControl('Ana'), especialidade: new FormControl('Pele') });
  }

  it('marca o erro no campo certo e deixa os outros intactos', () => {
    const form = formulario();

    const semCampo = aplicarErrosDoServidor(form, erro({ errosPorCampo: { nome: ['Nome muito longo.'] } }));

    expect(form.controls['nome'].getError('servidor')).toBe('Nome muito longo.');
    expect(form.controls['nome'].touched).toBe(true);
    expect(form.controls['especialidade'].errors).toBeNull();
    expect(semCampo).toEqual([]);
  });

  it('junta várias mensagens do mesmo campo', () => {
    const form = formulario();

    aplicarErrosDoServidor(form, erro({ errosPorCampo: { nome: ['Primeira.', 'Segunda.'] } }));

    expect(form.controls['nome'].getError('servidor')).toBe('Primeira. Segunda.');
  });

  it('devolve as mensagens de campos que o formulário não tem', () => {
    const form = formulario();

    const semCampo = aplicarErrosDoServidor(form, erro({ errosPorCampo: { dto: ['The dto field is required.'] } }));

    expect(semCampo).toEqual(['The dto field is required.']);
  });

  it('o erro do servidor some quando o usuário edita o campo', () => {
    const form = formulario();
    aplicarErrosDoServidor(form, erro({ errosPorCampo: { nome: ['Nome muito longo.'] } }));

    form.controls['nome'].setValue('Ana Maria');

    expect(form.controls['nome'].hasError('servidor')).toBe(false);
  });
});
