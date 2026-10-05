import { AbstractControl, ValidationErrors } from '@angular/forms';

// Validators.required aceita "   " (só espaços). A API rejeita, então o front também precisa rejeitar.
export function obrigatorioSemEspacos(controle: AbstractControl): ValidationErrors | null {
  const valor: unknown = controle.value;
  const vazio = typeof valor !== 'string' || valor.trim().length === 0;

  return vazio ? { obrigatorio: true } : null;
}

// Validador de grupo: compara dois campos de hora "HH:mm". Texto com zero à esquerda
// e 24 horas ordena igual ao relógio, então a comparação de texto basta.
// Campo vazio não gera este erro: quem avisa é o "obrigatório" do próprio campo.
export function fimDepoisDoInicio(grupo: AbstractControl): ValidationErrors | null {
  const inicio: unknown = grupo.get('horaInicio')?.value;
  const fim: unknown = grupo.get('horaFim')?.value;

  if (typeof inicio !== 'string' || typeof fim !== 'string' || !inicio || !fim) {
    return null;
  }

  return fim > inicio ? null : { fimAntesDoInicio: true };
}
