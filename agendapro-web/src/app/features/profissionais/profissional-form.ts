import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { ProfissionaisService } from '../../core/api/profissionais.service';
import { ApiError } from '../../core/models/api-error';
import { Profissional } from '../../core/models/profissional';
import { aplicarErrosDoServidor, ehErroDaTela, mensagemDe } from '../../shared/erros';
import { obrigatorioSemEspacos } from '../../shared/validadores';

type Estado = 'carregando' | 'pronto' | 'nao-encontrado' | 'erro';

// Os limites são os mesmos do backend (CriarProfissionalDto e AtualizarProfissionalDto).
const MAX_NOME = 100;
const MAX_ESPECIALIDADE = 80;

// Uma tela só para cadastrar (/profissionais/novo) e editar (/profissionais/:id/editar).
@Component({
  selector: 'app-profissional-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './profissional-form.html',
  styleUrl: './profissional-form.scss',
})
export class ProfissionalForm implements OnInit {
  private readonly service = inject(ProfissionaisService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // Vem do endereço, graças ao withComponentInputBinding(). Em /profissionais/novo não existe.
  readonly id = input<string>();

  protected readonly maxNome = MAX_NOME;
  protected readonly maxEspecialidade = MAX_ESPECIALIDADE;

  protected readonly form = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [obrigatorioSemEspacos, Validators.maxLength(MAX_NOME)],
    }),
    especialidade: new FormControl('', {
      nonNullable: true,
      validators: [obrigatorioSemEspacos, Validators.maxLength(MAX_ESPECIALIDADE)],
    }),
  });

  protected readonly modoEdicao = computed(() => this.id() !== undefined);
  protected readonly estado = signal<Estado>('carregando');
  protected readonly enviando = signal(false);
  // Erro que não pertence a nenhum campo (regra de negócio ou campo desconhecido).
  protected readonly erroGeral = signal<string | null>(null);

  // Número do profissional em edição; null quando está cadastrando.
  private profissionalId: number | null = null;

  // As entradas (inputs) só têm valor a partir do ngOnInit, não no constructor.
  ngOnInit(): void {
    const texto = this.id();

    if (texto === undefined) {
      this.estado.set('pronto');
      return;
    }

    const numero = Number(texto);
    if (!Number.isInteger(numero) || numero < 1) {
      this.estado.set('nao-encontrado');
      return;
    }

    this.profissionalId = numero;
    this.carregar();
  }

  protected carregar(): void {
    if (this.profissionalId === null) {
      return;
    }

    this.estado.set('carregando');

    this.service
      .obter(this.profissionalId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profissional) => {
          this.form.setValue({ nome: profissional.nome, especialidade: profissional.especialidade });
          this.estado.set('pronto');
        },
        error: (erro: ApiError) => this.estado.set(erro.status === 404 ? 'nao-encontrado' : 'erro'),
      });
  }

  protected salvar(): void {
    // Segunda barreira contra clique duplo: o botão já fica desabilitado enquanto envia.
    if (this.enviando()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nome, especialidade } = this.form.getRawValue();
    const dados = { nome: nome.trim(), especialidade: especialidade.trim() };

    this.erroGeral.set(null);
    this.enviando.set(true);

    const chamada =
      this.profissionalId === null ? this.service.criar(dados) : this.service.atualizar(this.profissionalId, dados);

    chamada.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (profissional) => {
        this.enviando.set(false);
        this.concluir(profissional);
      },
      error: (erro: ApiError) => {
        this.enviando.set(false);
        this.tratarErro(erro);
      },
    });
  }

  private concluir(profissional: Profissional): void {
    if (this.modoEdicao()) {
      this.snackBar.open('Alterações salvas.', 'Fechar', { duration: 4000 });
      void this.router.navigate(['/profissionais']);
      return;
    }

    // Sem expediente o profissional não tem horário livre para agendar: o próximo passo é definí-lo.
    this.snackBar.open('Profissional cadastrado. Agora defina o expediente.', 'Fechar', { duration: 5000 });
    void this.router.navigate(['/profissionais', profissional.id, 'horarios']);
  }

  private tratarErro(erro: ApiError): void {
    // Conexão e 5xx já foram avisados pelo interceptor.
    if (!ehErroDaTela(erro)) {
      return;
    }

    if (erro.status === 404) {
      this.estado.set('nao-encontrado');
      return;
    }

    const temErrosDeCampo = Object.keys(erro.errosPorCampo).length > 0;
    const semCampo = aplicarErrosDoServidor(this.form, erro);

    if (semCampo.length > 0) {
      this.erroGeral.set(semCampo.join(' '));
    } else if (!temErrosDeCampo) {
      // Regra de negócio: o detail já vem em português. Erro de campo não usa o título
      // genérico (em inglês), porque a mensagem já aparece no próprio campo.
      this.erroGeral.set(mensagemDe(erro));
    }
  }
}
