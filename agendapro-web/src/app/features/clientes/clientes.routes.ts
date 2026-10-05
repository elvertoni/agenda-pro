import { Routes } from '@angular/router';
import { ClienteForm } from './cliente-form';
import { ClientesLista } from './clientes-lista';

// Rotas da feature, carregadas sob demanda (loadChildren no app.routes.ts).
// O ":id" do endereço chega ao componente como input() (withComponentInputBinding).
export const CLIENTES_ROUTES: Routes = [
  { path: '', title: 'Clientes — AgendaPro', component: ClientesLista },
  { path: 'novo', title: 'Novo cliente — AgendaPro', component: ClienteForm },
  { path: ':id/editar', title: 'Editar cliente — AgendaPro', component: ClienteForm },
];
