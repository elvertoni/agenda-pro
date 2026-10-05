import { Routes } from '@angular/router';
import { EmConstrucao } from '../../shared/em-construcao';

// Rotas da feature, carregadas sob demanda (loadChildren no app.routes.ts).
// Na Fase F2 entram aqui a lista, o cadastro e a edição.
export const PROFISSIONAIS_ROUTES: Routes = [
  {
    path: '',
    title: 'Profissionais — AgendaPro',
    component: EmConstrucao,
    data: { titulo: 'Profissionais', fase: 'F2' },
  },
];
