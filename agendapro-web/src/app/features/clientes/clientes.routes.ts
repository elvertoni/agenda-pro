import { Routes } from '@angular/router';
import { EmConstrucao } from '../../shared/em-construcao';

// Rotas da feature, carregadas sob demanda (loadChildren no app.routes.ts).
// Na Fase F3 entram aqui a lista, o cadastro e a edição.
export const CLIENTES_ROUTES: Routes = [
  {
    path: '',
    title: 'Clientes — AgendaPro',
    component: EmConstrucao,
    data: { titulo: 'Clientes', fase: 'F3' },
  },
];
