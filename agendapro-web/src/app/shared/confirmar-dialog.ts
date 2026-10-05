import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface DadosConfirmacao {
  titulo: string;
  mensagem: string;
  // Texto do botão que confirma, com o verbo da ação ("Remover", "Cancelar agendamento").
  confirmar: string;
}

// Janela de confirmação. Quem abre recebe true (confirmou) ou false (desistiu) em afterClosed().
@Component({
  selector: 'app-confirmar-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ dados.titulo }}</h2>
    <mat-dialog-content>{{ dados.mensagem }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false">Voltar</button>
      <button matButton="filled" type="button" [mat-dialog-close]="true">{{ dados.confirmar }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmarDialog {
  protected readonly dados = inject<DadosConfirmacao>(MAT_DIALOG_DATA);
}
