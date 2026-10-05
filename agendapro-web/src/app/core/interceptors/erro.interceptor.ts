import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../models/api-error';

// Passa por todas as requisições. Quando uma falha, converte o erro para ApiError
// e só avisa na tela o que nenhuma tela sabe resolver sozinha.
export const erroInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((resposta: unknown) => {
      if (!(resposta instanceof HttpErrorResponse)) {
        return throwError(() => resposta);
      }

      const erro = paraApiError(resposta);

      // Os 4xx ficam com a tela, que tem o contexto (qual campo, qual horário).
      // Avisar aqui também mostraria duas mensagens para o mesmo erro.
      if (semConexaoComApi(erro.status)) {
        snackBar.open('Não foi possível conectar à API.', 'Fechar', { duration: 6000 });
      } else if (erro.status >= 500) {
        snackBar.open('Erro no servidor. Tente novamente em instantes.', 'Fechar', { duration: 6000 });
      }

      return throwError(() => erro);
    }),
  );
};

// 0: o navegador não conseguiu falar com servidor nenhum.
// 502 e 504: o proxy na frente da API (ng serve ou nginx) respondeu, mas não alcançou a API.
function semConexaoComApi(status: number): boolean {
  return status === 0 || status === 502 || status === 504;
}

function paraApiError(resposta: HttpErrorResponse): ApiError {
  // O corpo só é um ProblemDetails quando a API respondeu. Sem conexão (status 0)
  // ou com resposta em texto, ele não tem os campos esperados.
  const corpo = ehObjeto(resposta.error) ? resposta.error : {};

  return {
    status: resposta.status,
    title: typeof corpo['title'] === 'string' ? corpo['title'] : 'Erro inesperado',
    detail: typeof corpo['detail'] === 'string' ? corpo['detail'] : null,
    errosPorCampo: lerErrosPorCampo(corpo['errors']),
  };
}

function lerErrosPorCampo(errors: unknown): Record<string, string[]> {
  const resultado: Record<string, string[]> = {};

  if (!ehObjeto(errors)) {
    return resultado;
  }

  for (const [chave, mensagens] of Object.entries(errors)) {
    if (Array.isArray(mensagens)) {
      resultado[nomeDoControle(chave)] = mensagens.map(String);
    }
  }

  return resultado;
}

// A API devolve "Nome" (nome da propriedade em C#) ou "$.dataHoraInicio" (erro ao ler o JSON).
// Os controles do formulário usam camelCase: "nome", "dataHoraInicio".
function nomeDoControle(chave: string): string {
  const semPrefixo = chave.startsWith('$.') ? chave.slice(2) : chave;
  return semPrefixo.charAt(0).toLowerCase() + semPrefixo.slice(1);
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}
