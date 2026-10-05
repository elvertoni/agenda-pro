import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nao-encontrada',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, RouterLink],
  template: `
    <h1>Página não encontrada</h1>
    <p>O endereço digitado não existe no AgendaPro.</p>
    <a matButton="filled" routerLink="/">Voltar para o início</a>
  `,
})
export class NaoEncontrada {}
