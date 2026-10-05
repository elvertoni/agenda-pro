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
import { ClientesService } from '../../core/api/clientes.service';
import { ApiError } from '../../core/models/api-error';
import { formatarCpf, somenteDigitos } from '../../shared/cpf';
import { aplicarErrosDoServidor, ehErroDaTela, mensagemDe } from '../../shared/erros';
import { cpfValido, obrigatorioSemEspacos } from '../../shared/validadores';

type Estado = 'carregando' | 'pronto' | 'nao-encontrado' | 'erro';

// Os limites são os mesmos do backend (CriarClienteDto e AtualizarClienteDto).
const MAX_NOME = 100;
const MAX_TELEFONE = 20;

// Uma tela só para cadastrar (/clientes/novo) e editar (/clientes/:id/editar).
@Component({
  selector: 'app-cliente-form',
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
  templateUrl: './cliente-form.html',
  styleUrl: './cliente-form.scss',
})
export class ClienteForm implements OnInit {
  private readonly service = inject(ClientesService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // Vem do endereço, graças ao withComponentInputBinding(). Em /clientes/novo não existe.
  readonly id = input<string>();

  protected readonly maxNome = MAX_NOME;
  protected readonly maxTelefone = MAX_TELEFONE;

  protected readonly form = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [obrigatorioSemEspacos, Validators.maxLength(MAX_NOME)],
    }),
    cpf: new FormControl('', {
      nonNullable: true,
      validators: [obrigatorioSemEspacos, cpfValido],
    }),
    telefone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_TELEFONE)],
    }),
  });

  protected readonly modoEdicao = computed(() => this.id() !== undefined);
  protected readonly estado = signal<Estado>('carregando');
  protected readonly enviando = signal(false);
  // Erro que não pertence a nenhum campo (regra de negócio ou campo desconhecido).
  protected readonly erroGeral = signal<string | null>(null);

  // Número do cliente em edição; null quando está cadastrando.
  private clienteId: number | null = null;

  // As entradas (inputs) só têm valor a partir do ngOnInit, não no constructor.
  ngOnInit(): void {
    const texto = this.id();

    if (texto === undefined) {
      this.estado.set('pronto');
      return;
    }

    // A API não permite mudar o CPF. Desabilitado, o campo aparece só para leitura
    // e fica fora da validação (um CPF mascarado nunca passaria no validador).
    this.form.controls.cpf.disable();

    const numero = Number(texto);
    if (!Number.isInteger(numero) || numero < 1) {
      this.estado.set('nao-encontrado');
      return;
    }

    this.clienteId = numero;
    this.carregar();
  }

  protected carregar(): void {
    if (this.clienteId === null) {
      return;
    }

    this.estado.set('carregando');

    this.service
      .obter(this.clienteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cliente) => {
          this.form.setValue({ nome: cliente.nome, cpf: cliente.cpf, telefone: cliente.telefone ?? '' });
          this.estado.set('pronto');
        },
        error: (erro: ApiError) => this.estado.set(erro.status === 404 ? 'nao-encontrado' : 'erro'),
      });
  }

  // Máscara enquanto digita. Usa o texto do próprio campo (e não o valor do formulário)
  // para não depender da ordem em que o Angular atualiza cada um.
  protected aplicarMascaraDoCpf(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    this.form.controls.cpf.setValue(formatarCpf(campo.value));
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

    const { nome, cpf, telefone } = this.form.getRawValue();
    // Telefone é opcional: campo vazio vai como null, e não como texto vazio.
    const telefoneLimpo = telefone.trim() || null;

    this.erroGeral.set(null);
    this.enviando.set(true);

    const chamada =
      this.clienteId === null
        ? this.service.criar({ nome: nome.trim(), cpf: somenteDigitos(cpf), telefone: telefoneLimpo })
        : this.service.atualizar(this.clienteId, { nome: nome.trim(), telefone: telefoneLimpo });

    chamada.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.enviando.set(false);
        this.concluir();
      },
      error: (erro: ApiError) => {
        this.enviando.set(false);
        this.tratarErro(erro);
      },
    });
  }

  private concluir(): void {
    const mensagem = this.modoEdicao() ? 'Alterações salvas.' : 'Cliente cadastrado.';
    this.snackBar.open(mensagem, 'Fechar', { duration: 4000 });
    void this.router.navigate(['/clientes']);
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

    if (erro.status === 409) {
      // CPF duplicado: o erro é do campo CPF, então aparece nele. Some quando o usuário edita o CPF.
      const cpf = this.form.controls.cpf;
      cpf.setErrors({ servidor: mensagemDe(erro) });
      cpf.markAsTouched();
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
