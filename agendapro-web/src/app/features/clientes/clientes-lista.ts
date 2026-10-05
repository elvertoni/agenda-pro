import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, merge, of, startWith, switchMap, tap } from 'rxjs';
import { ClientesService } from '../../core/api/clientes.service';
import { Cliente } from '../../core/models/cliente';

type Estado = 'carregando' | 'pronto' | 'erro';

// Tempo de espera depois da última tecla antes de buscar na API.
const ESPERA_DA_BUSCA_MS = 300;

@Component({
  selector: 'app-clientes-lista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './clientes-lista.html',
  styleUrl: './clientes-lista.scss',
})
export class ClientesLista {
  private readonly service = inject(ClientesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly colunas = ['nome', 'cpf', 'telefone', 'acoes'];

  protected readonly busca = new FormControl('', { nonNullable: true });

  protected readonly estado = signal<Estado>('carregando');
  protected readonly clientes = signal<Cliente[]>([]);
  // Sem busca e sem resultado = "nenhum cadastrado". Com busca e sem resultado = "nada encontrado".
  protected readonly comBusca = signal(false);

  // "Tentar de novo" entra no mesmo fluxo da digitação, para a lógica de busca ficar em um lugar só.
  private readonly tentarDeNovo = new Subject<void>();

  constructor() {
    // Texto digitado: espera o usuário parar de teclar (debounceTime), ignora espaços nas pontas
    // e não busca de novo se o texto final for igual ao da busca anterior (distinctUntilChanged).
    // O startWith('') faz a primeira busca, sem filtro, assim que a tela abre.
    const digitacao$ = this.busca.valueChanges.pipe(
      debounceTime(ESPERA_DA_BUSCA_MS),
      map((texto) => texto.trim()),
      startWith(''),
      distinctUntilChanged(),
    );

    const repeticao$ = this.tentarDeNovo.pipe(map(() => this.busca.value.trim()));

    merge(digitacao$, repeticao$)
      .pipe(
        tap((nome) => {
          this.estado.set('carregando');
          this.comBusca.set(nome !== '');
        }),
        // switchMap cancela a busca anterior quando chega uma nova: a resposta atrasada
        // de "an" não pode sobrescrever a de "ana".
        // O catchError fica DENTRO do switchMap: se ficasse fora, o primeiro erro encerraria
        // o fluxo e a tela pararia de buscar. Aqui o erro vira "null" e o fluxo continua.
        switchMap((nome) => this.service.listar(nome).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => {
        if (lista === null) {
          // Conexão e 5xx já foram avisados pelo interceptor; a tela mostra o estado de erro.
          this.estado.set('erro');
          return;
        }

        this.clientes.set(lista);
        this.estado.set('pronto');
      });
  }

  protected limparBusca(): void {
    this.busca.setValue('');
  }

  protected recarregar(): void {
    this.tentarDeNovo.next();
  }
}
