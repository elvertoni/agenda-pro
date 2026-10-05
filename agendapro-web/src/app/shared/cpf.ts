// Deixa só os dígitos: "529.982.247-25" vira "52998224725". É o formato que a API grava.
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

// Máscara de digitação: vai formatando conforme o usuário digita ("529" → "529.9" → ... → "529.982.247-25").
// Ignora o que não é dígito e corta no 11º dígito.
export function formatarCpf(texto: string): string {
  const digitos = somenteDigitos(texto).slice(0, 11);

  let resultado = digitos.slice(0, 3);
  if (digitos.length > 3) {
    resultado += '.' + digitos.slice(3, 6);
  }
  if (digitos.length > 6) {
    resultado += '.' + digitos.slice(6, 9);
  }
  if (digitos.length > 9) {
    resultado += '-' + digitos.slice(9, 11);
  }

  return resultado;
}

// Mesmo algoritmo do backend (CpfValidador.EhValido).
export function cpfEhValido(texto: string): boolean {
  const digitos = somenteDigitos(texto);

  if (digitos.length !== 11) {
    return false;
  }

  // 111.111.111-11 passa na conta dos dígitos verificadores, mas não é um CPF real.
  if (new Set(digitos).size === 1) {
    return false;
  }

  return Number(digitos[9]) === calcularDigito(digitos, 9) && Number(digitos[10]) === calcularDigito(digitos, 10);
}

// Multiplica cada dígito por um peso (de quantidade+1 até 2), soma e usa o resto da divisão por 11.
// Resto 0 ou 1 vira dígito 0; senão o dígito é 11 menos o resto.
function calcularDigito(digitos: string, quantidade: number): number {
  let soma = 0;
  for (let i = 0; i < quantidade; i++) {
    soma += Number(digitos[i]) * (quantidade + 1 - i);
  }

  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}
