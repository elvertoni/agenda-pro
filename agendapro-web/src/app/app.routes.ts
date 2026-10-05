import { Routes } from '@angular/router';

// Todas as rotas usam lazy loading: o código de cada tela só é baixado
// quando o usuário entra nela, e o carregamento inicial fica menor.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'AgendaPro',
    loadComponent: () => import('./features/inicio/inicio').then((m) => m.Inicio),
  },

  // loadChildren: a feature tem várias telas e traz o próprio arquivo de rotas.
  {
    path: 'profissionais',
    loadChildren: () =>
      import('./features/profissionais/profissionais.routes').then((m) => m.PROFISSIONAIS_ROUTES),
  },
  {
    path: 'clientes',
    loadChildren: () => import('./features/clientes/clientes.routes').then((m) => m.CLIENTES_ROUTES),
  },

  // loadComponent: uma tela só. As telas de verdade chegam nas Fases F4 e F5.
  {
    path: 'agendar',
    title: 'Agendar — AgendaPro',
    loadComponent: () => import('./shared/em-construcao').then((m) => m.EmConstrucao),
    data: { titulo: 'Agendar', fase: 'F4' },
  },
  {
    path: 'agendamentos',
    title: 'Agendamentos — AgendaPro',
    loadComponent: () => import('./shared/em-construcao').then((m) => m.EmConstrucao),
    data: { titulo: 'Agendamentos', fase: 'F5' },
  },

  // Precisa ser a última: "**" casa com qualquer endereço que não bateu nas rotas acima.
  {
    path: '**',
    title: 'Página não encontrada — AgendaPro',
    loadComponent: () => import('./shared/nao-encontrada').then((m) => m.NaoEncontrada),
  },
];
