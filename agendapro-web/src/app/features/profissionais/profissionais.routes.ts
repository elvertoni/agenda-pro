import { Routes } from '@angular/router';
import { ProfissionaisLista } from './profissionais-lista';
import { ProfissionalForm } from './profissional-form';
import { ProfissionalHorarios } from './profissional-horarios';

// Rotas da feature, carregadas sob demanda (loadChildren no app.routes.ts).
// O ":id" do endereço chega ao componente como input() (withComponentInputBinding).
export const PROFISSIONAIS_ROUTES: Routes = [
  { path: '', title: 'Profissionais — AgendaPro', component: ProfissionaisLista },
  { path: 'novo', title: 'Novo profissional — AgendaPro', component: ProfissionalForm },
  { path: ':id/editar', title: 'Editar profissional — AgendaPro', component: ProfissionalForm },
  { path: ':id/horarios', title: 'Expediente — AgendaPro', component: ProfissionalHorarios },
];
