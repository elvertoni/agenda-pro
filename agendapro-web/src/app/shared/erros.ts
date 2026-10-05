import { AbstractControl, FormGroup } from '@angular/forms';
import { ApiError } from '../core/models/api-error';

// Erros 4xx são da tela. Falha de conexão e 5xx já foram avisados pelo interceptor:
// se a tela avisasse de novo, o usuário veria duas mensagens para o mesmo problema.
export function ehErroDaTela(erro: ApiError): boolean {
  return erro.status >= 400 && erro.status < 500;
}

// Texto para mostrar ao usuário: o "detail" da regra de negócio (já vem em português).
// Erro de validação só traz o título genérico em inglês ("One or more validation errors..."),
// então vira um aviso nosso. Os outros erros ficam com o título que a API mandou.
export function mensagemDe(erro: ApiError): string {
  if (erro.detail) {
    return erro.detail;
  }

  return Object.keys(erro.errosPorCampo).length > 0 ? 'Confira os dados informados.' : erro.title;
}

// Coloca os erros de validação do servidor nos campos do formulário.
// Devolve as mensagens que não pertencem a nenhum campo (para a tela mostrar à parte).
export function aplicarErrosDoServidor(formulario: FormGroup, erro: ApiError): string[] {
  const semCampo: string[] = [];

  for (const [campo, mensagens] of Object.entries(erro.errosPorCampo)) {
    const controle: AbstractControl | null = formulario.get(campo);

    if (controle) {
      // O erro sai sozinho quando o usuário muda o valor do campo (o Angular revalida).
      controle.setErrors({ servidor: mensagens.join(' ') });
      controle.markAsTouched();
    } else {
      semCampo.push(...mensagens);
    }
  }

  return semCampo;
}
