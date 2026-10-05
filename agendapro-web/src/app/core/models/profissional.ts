// Espelha o ProfissionalDto da API.
export interface Profissional {
  id: number;
  nome: string;
  especialidade: string;
  ativo: boolean;
}

// Corpo do POST e do PUT: CriarProfissionalDto e AtualizarProfissionalDto têm os mesmos campos.
export interface SalvarProfissional {
  nome: string;
  especialidade: string;
}

// Filtros opcionais do GET /api/profissionais.
export interface FiltroProfissionais {
  especialidade?: string;
  ativo?: boolean;
}
