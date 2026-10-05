import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

// Tela provisória das rotas que ainda não foram construídas.
// Cada fase troca a rota correspondente pela tela de verdade.
@Component({
  selector: 'app-em-construcao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <h1>{{ titulo() }}</h1>
    <p class="aviso">
      <mat-icon aria-hidden="true">construction</mat-icon>
      Esta tela será construída na Fase {{ fase() }}.
    </p>
  `,
  styles: `
    .aviso {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class EmConstrucao {
  // Os dois valores vêm do "data" da rota (withComponentInputBinding no app.config.ts).
  readonly titulo = input.required<string>();
  readonly fase = input.required<string>();
}
