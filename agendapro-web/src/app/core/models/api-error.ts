// Formato único de erro dentro do front. O interceptor converte toda falha de HTTP para ele,
// assim as telas não precisam conhecer o HttpErrorResponse nem os detalhes do ProblemDetails.
export interface ApiError {
  // Status HTTP. O valor 0 significa que a requisição nem chegou à API (sem conexão).
  status: number;
  title: string;
  detail: string | null;
  // Erros de validação por campo, com a chave em camelCase (ex.: nome), igual aos controles do formulário.
  errosPorCampo: Record<string, string[]>;
}
