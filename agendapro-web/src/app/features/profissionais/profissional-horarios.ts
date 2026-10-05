import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { HorariosService } from '../../core/api/horarios.service';
import { ProfissionaisService } from '../../core/api/profissionais.service';
import { ApiError } from '../../core/models/api-error';
import { DiaSemana, Horario } from '../../core/models/horario';
import { Profissional } from '../../core/models/profissional';
import { ConfirmacaoService } from '../../shared/confirmacao.service';
import { formatarHora, paraHoraApi } from '../../shared/datas';
import { DIAS_SEMANA, nomeDoDia } from '../../shared/dias-semana';
import { ehErroDaTela, mensagemDe } from '../../shared/erros';
import { fimDepoisDoInicio } from '../../shared/validadores';

type Estado = 'carregando' | 'pronto' | 'nao-encontrado' | 'erro';

// Expediente do profissional: os blocos de horário em que ele atende, por dia da semana.
// É o que a tela de agendar usa para calcular os horários livres.
@Component({
  selector: 'app-profissional-horarios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './profissional-horarios.html',
  styleUrl: './profissional-horarios.scss',
})
export class ProfissionalHorarios implements OnInit {
  private readonly profissionaisService = inject(ProfissionaisService);
  private readonly horariosService = inject(HorariosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // Vem do endereço /profissionais/:id/horarios (withComponentInputBinding).
  readonly id = input.required<string>();

  protected readonly opcoesDia = DIAS_SEMANA;
  protected readonly formatarHora = formatarHora;

  protected readonly form = new FormGroup(
    {
      diaSemana: new FormControl<DiaSemana>('Monday', { nonNullable: true, validators: [Validators.required] }),
      horaInicio: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      horaFim: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    // O backend também recusa fim <= início (400). Validar aqui poupa a ida ao servidor.
    { validators: fimDepoisDoInicio },
  );

  protected readonly estado = signal<Estado>('carregando');
  protected readonly profissional = signal<Profissional | null>(null);
  protected readonly horarios = signal<Horario[]>([]);
  protected readonly enviando = signal(false);
  // Ids com remoção em andamento: o botão da linha fica desabilitado até a resposta.
  protected readonly emRemocao = signal<number[]>([]);
  // Mensagem do servidor (409 de sobreposição, por exemplo), mostrada junto ao formulário.
  protected readonly erroAdicionar = signal<string | null>(null);

  // Sempre os 7 dias, na ordem do calendário, cada um com seus blocos por horário de início.
  protected readonly porDia = computed(() =>
    DIAS_SEMANA.map((dia) => ({
      ...dia,
      blocos: this.horarios()
        .filter((horario) => horario.diaSemana === dia.valor)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    })),
  );

  private profissionalId = 0;

  constructor() {
    // O aviso do servidor vale para os dados que foram enviados: ao mexer em qualquer campo, ele sai.
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.erroAdicionar.set(null));
  }

  ngOnInit(): void {
    const numero = Number(this.id());

    if (!Number.isInteger(numero) || numero < 1) {
      this.estado.set('nao-encontrado');
      return;
    }

    this.profissionalId = numero;
    this.carregar();
  }

  protected carregar(): void {
    this.estado.set('carregando');

    // As duas consultas não dependem uma da outra: rodam juntas.
    forkJoin({
      profissional: this.profissionaisService.obter(this.profissionalId),
      horarios: this.horariosService.listar(this.profissionalId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ profissional, horarios }) => {
          this.profissional.set(profissional);
          this.horarios.set(horarios);
          this.estado.set('pronto');
        },
        error: (erro: ApiError) => this.estado.set(erro.status === 404 ? 'nao-encontrado' : 'erro'),
      });
  }

  // Recebe o FormGroupDirective do template para poder usar resetForm (veja o comentário abaixo).
  protected adicionar(diretiva: FormGroupDirective): void {
    // Segunda barreira contra clique duplo: o botão já fica desabilitado enquanto envia.
    if (this.enviando()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { diaSemana, horaInicio, horaFim } = this.form.getRawValue();

    this.erroAdicionar.set(null);
    this.enviando.set(true);

    this.horariosService
      .criar(this.profissionalId, {
        diaSemana,
        // O campo de hora da tela entrega "08:00"; a API espera "08:00:00".
        horaInicio: paraHoraApi(horaInicio),
        horaFim: paraHoraApi(horaFim),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (horario) => {
          this.enviando.set(false);
          this.horarios.update((lista) => [...lista, horario]);

          // resetForm (e não form.reset) também zera o "já enviado" do formulário. Sem isso, os
          // campos limpos apareceriam em vermelho ("obrigatório") logo depois de um envio com sucesso.
          // O dia fica escolhido: é comum cadastrar dois blocos seguidos no mesmo dia (manhã e tarde).
          diretiva.resetForm({ diaSemana, horaInicio: '', horaFim: '' });

          this.snackBar.open(`Horário adicionado: ${nomeDoDia(diaSemana)}.`, 'Fechar', { duration: 4000 });
        },
        error: (erro: ApiError) => {
          this.enviando.set(false);
          this.tratarErroAoAdicionar(erro);
        },
      });
  }

  protected remover(horario: Horario): void {
    if (this.emRemocao().includes(horario.id)) {
      return;
    }

    this.confirmacao
      .confirmar({
        titulo: 'Remover horário',
        mensagem: `Remover o horário de ${nomeDoDia(horario.diaSemana)}, das ${formatarHora(horario.horaInicio)} às ${formatarHora(horario.horaFim)}?`,
        confirmar: 'Remover',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmou) => {
        if (confirmou) {
          this.removerNoServidor(horario);
        }
      });
  }

  private removerNoServidor(horario: Horario): void {
    this.emRemocao.update((ids) => [...ids, horario.id]);

    this.horariosService
      .remover(this.profissionalId, horario.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.finalizarRemocao(horario.id);
          this.horarios.update((lista) => lista.filter((h) => h.id !== horario.id));
          this.snackBar.open('Horário removido.', 'Fechar', { duration: 4000 });
        },
        error: (erro: ApiError) => {
          this.finalizarRemocao(horario.id);

          if (!ehErroDaTela(erro)) {
            return;
          }

          if (erro.status === 404) {
            // Já tinha sido removido em outro lugar: recarrega para a tela refletir o servidor.
            this.snackBar.open('Esse horário já não existe. A lista foi atualizada.', 'Fechar', { duration: 5000 });
            this.carregar();
            return;
          }

          this.snackBar.open(mensagemDe(erro), 'Fechar', { duration: 5000 });
        },
      });
  }

  private finalizarRemocao(id: number): void {
    this.emRemocao.update((ids) => ids.filter((x) => x !== id));
  }

  private tratarErroAoAdicionar(erro: ApiError): void {
    // Conexão e 5xx já foram avisados pelo interceptor.
    if (!ehErroDaTela(erro)) {
      return;
    }

    if (erro.status === 404) {
      this.estado.set('nao-encontrado');
      return;
    }

    // 409: "Já existe um horário de trabalho que se sobrepõe a este nesse dia." (texto do backend).
    this.erroAdicionar.set(mensagemDe(erro));
  }
}
