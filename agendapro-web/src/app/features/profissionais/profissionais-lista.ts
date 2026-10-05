import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProfissionaisService } from '../../core/api/profissionais.service';
import { ApiError } from '../../core/models/api-error';
import { FiltroProfissionais, Profissional } from '../../core/models/profissional';
import { ehErroDaTela, mensagemDe } from '../../shared/erros';

type Estado = 'carregando' | 'pronto' | 'erro';
type Situacao = 'todos' | 'ativos' | 'inativos';

@Component({
  selector: 'app-profissionais-lista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './profissionais-lista.html',
  styleUrl: './profissionais-lista.scss',
})
export class ProfissionaisLista {
  private readonly service = inject(ProfissionaisService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly colunas = ['nome', 'especialidade', 'situacao', 'acoes'];

  protected readonly filtro = new FormGroup({
    especialidade: new FormControl('', { nonNullable: true }),
    situacao: new FormControl<Situacao>('todos', { nonNullable: true }),
  });

  protected readonly estado = signal<Estado>('carregando');
  protected readonly profissionais = signal<Profissional[]>([]);
  // Sem filtro e sem resultado = "nenhum cadastrado". Com filtro e sem resultado = "nada encontrado".
  protected readonly comFiltro = signal(false);
  // Ids com ativar/inativar em andamento: o botão da linha fica desabilitado até a resposta.
  protected readonly emAlteracao = signal<number[]>([]);

  private carregamento?: Subscription;

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    const filtro = this.lerFiltro();

    this.estado.set('carregando');
    this.comFiltro.set(filtro.especialidade !== undefined || filtro.ativo !== undefined);

    // Cancela a busca anterior: se o usuário filtrar duas vezes seguidas, a resposta
    // atrasada da primeira não pode sobrescrever a da segunda.
    this.carregamento?.unsubscribe();
    this.carregamento = this.service
      .listar(filtro)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => {
          this.profissionais.set(lista);
          this.estado.set('pronto');
        },
        error: () => this.estado.set('erro'),
      });
  }

  protected limparFiltro(): void {
    this.filtro.reset();
    this.carregar();
  }

  protected alternarAtivo(profissional: Profissional): void {
    if (this.emAlteracao().includes(profissional.id)) {
      return;
    }
    this.emAlteracao.update((ids) => [...ids, profissional.id]);

    this.service
      .alterarAtivo(profissional.id, !profissional.ativo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (atualizado) => {
          this.finalizarAlteracao(profissional.id);
          // Troca só a linha alterada, sem recarregar a lista inteira.
          this.profissionais.update((lista) => lista.map((p) => (p.id === atualizado.id ? atualizado : p)));
          const acao = atualizado.ativo ? 'ativado' : 'inativado';
          this.snackBar.open(`${atualizado.nome} foi ${acao}.`, 'Fechar', { duration: 4000 });
        },
        error: (erro: ApiError) => {
          this.finalizarAlteracao(profissional.id);
          this.avisarFalhaAoAlterar(erro);
        },
      });
  }

  private finalizarAlteracao(id: number): void {
    this.emAlteracao.update((ids) => ids.filter((x) => x !== id));
  }

  private avisarFalhaAoAlterar(erro: ApiError): void {
    // Conexão e 5xx já foram avisados pelo interceptor.
    if (!ehErroDaTela(erro)) {
      return;
    }

    if (erro.status === 404) {
      // Outra pessoa removeu o registro: a lista na tela está desatualizada.
      this.snackBar.open('Profissional não encontrado. A lista foi atualizada.', 'Fechar', { duration: 5000 });
      this.carregar();
      return;
    }

    this.snackBar.open(mensagemDe(erro), 'Fechar', { duration: 5000 });
  }

  private lerFiltro(): FiltroProfissionais {
    const { especialidade, situacao } = this.filtro.getRawValue();
    const texto = especialidade.trim();

    return {
      especialidade: texto || undefined,
      ativo: situacao === 'todos' ? undefined : situacao === 'ativos',
    };
  }
}
