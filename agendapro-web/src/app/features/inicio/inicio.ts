import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { SaudeService } from '../../core/api/saude.service';
import { ITENS_MENU } from '../../shared/menu';

type EstadoApi = 'carregando' | 'conectada' | 'fora-do-ar';

@Component({
  selector: 'app-inicio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio {
  private readonly saude = inject(SaudeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly atalhos = ITENS_MENU;
  protected readonly estadoApi = signal<EstadoApi>('carregando');

  constructor() {
    this.verificarApi();
  }

  protected verificarApi(): void {
    this.estadoApi.set('carregando');

    this.saude
      .verificar()
      // Cancela a chamada se o usuário sair da tela antes da resposta.
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.estadoApi.set('conectada'),
        error: () => this.estadoApi.set('fora-do-ar'),
      });
  }
}
