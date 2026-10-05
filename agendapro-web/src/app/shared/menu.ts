export interface ItemMenu {
  rota: string;
  rotulo: string;
  // Nome do ícone na fonte Material Symbols.
  icone: string;
  descricao: string;
}

// Uma lista só para o menu lateral e para os atalhos da página inicial:
// uma tela nova entra nos dois lugares ao mesmo tempo.
export const ITENS_MENU: readonly ItemMenu[] = [
  {
    rota: '/profissionais',
    rotulo: 'Profissionais',
    icone: 'badge',
    descricao: 'Cadastro e expediente de cada profissional.',
  },
  {
    rota: '/clientes',
    rotulo: 'Clientes',
    icone: 'group',
    descricao: 'Cadastro e busca de clientes.',
  },
  {
    rota: '/agendar',
    rotulo: 'Agendar',
    icone: 'event_available',
    descricao: 'Marcar um horário livre para um cliente.',
  },
  {
    rota: '/agendamentos',
    rotulo: 'Agendamentos',
    icone: 'calendar_month',
    descricao: 'Consultar, cancelar e concluir agendamentos.',
  },
];
