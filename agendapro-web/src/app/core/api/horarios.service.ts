import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CriarHorario, Horario } from '../models/horario';

@Injectable({ providedIn: 'root' })
export class HorariosService {
  private readonly http = inject(HttpClient);

  // Rota aninhada: o expediente pertence a um profissional.
  private url(profissionalId: number): string {
    return `/api/profissionais/${profissionalId}/horarios`;
  }

  listar(profissionalId: number): Observable<Horario[]> {
    return this.http.get<Horario[]>(this.url(profissionalId));
  }

  criar(profissionalId: number, dados: CriarHorario): Observable<Horario> {
    return this.http.post<Horario>(this.url(profissionalId), dados);
  }

  // A API responde 204 sem corpo.
  remover(profissionalId: number, horarioId: number): Observable<void> {
    return this.http.delete<void>(`${this.url(profissionalId)}/${horarioId}`);
  }
}
