// Espelha o ClienteDto da API. O CPF chega sempre mascarado (ex.: ***.456.789-**).
export interface Cliente {
  id: number;
  nome: string;
  cpf: string;
  telefone: string | null;
}

// Corpo do POST (CriarClienteDto). O CPF completo só é aceito na entrada, nunca devolvido.
export interface CriarCliente {
  nome: string;
  cpf: string;
  telefone: string | null;
}

// Corpo do PUT (AtualizarClienteDto): sem CPF de propósito, ele não muda depois do cadastro.
export interface AtualizarCliente {
  nome: string;
  telefone: string | null;
}
