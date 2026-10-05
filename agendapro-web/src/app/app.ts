import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { ITENS_MENU } from './shared/menu';

// Moldura do sistema: barra no topo, menu lateral e a área onde o roteador mostra a tela atual.
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly menu = ITENS_MENU;

  // Abaixo de 960px de largura o menu deixa de ficar fixo e vira uma gaveta aberta pelo botão.
  protected readonly telaEstreita = toSignal(
    this.breakpoints.observe([Breakpoints.XSmall, Breakpoints.Small]).pipe(map((estado) => estado.matches)),
    { initialValue: false },
  );

  // Na tela estreita a gaveta cobre o conteúdo: depois de escolher um item ela precisa sair da frente.
  protected fecharSeGaveta(menuLateral: MatSidenav): void {
    if (this.telaEstreita()) {
      menuLateral.close();
    }
  }
}
