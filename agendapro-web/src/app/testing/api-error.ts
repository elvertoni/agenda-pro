import { ApiError } from '../core/models/api-error';

// Monta um ApiError para os testes das telas, que simulam as falhas que o interceptor entregaria.
export function criarApiError(parcial: Partial<ApiError> = {}): ApiError {
  return { status: 400, title: 'Erro', detail: null, errosPorCampo: {}, ...parcial };
}
