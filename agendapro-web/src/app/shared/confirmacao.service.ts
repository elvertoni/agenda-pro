import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';
import { ConfirmarDialog, DadosConfirmacao } from './confirmar-dialog';

// As telas pedem a confirmação por aqui, sem conhecer o MatDialog. Nos testes das telas
// basta trocar este service por um que responde true ou false.
@Injectable({ providedIn: 'root' })
export class ConfirmacaoService {
  private readonly dialog = inject(MatDialog);

  confirmar(dados: DadosConfirmacao): Observable<boolean> {
    return this.dialog
      .open<ConfirmarDialog, DadosConfirmacao, boolean>(ConfirmarDialog, { data: dados })
      .afterClosed()
      // Fechar com Esc ou clicando fora devolve undefined: conta como "não confirmou".
      .pipe(map((resposta) => resposta === true));
  }
}
