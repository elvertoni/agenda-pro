import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FiltroProfissionais, Profissional, SalvarProfissional } from '../models/profissional';

@Injectable({ providedIn: 'root' })
export class ProfissionaisService {
  private readonly http = inject(HttpClient);

  // Caminho relativo: em desenvolvimento o proxy do ng serve encaminha para a API.
  private readonly url = '/api/profissionais';

  listar(filtro: FiltroProfissionais = {}): Observable<Profissional[]> {
    // Só envia o filtro que foi informado, como a API espera.
    let params = new HttpParams();

    if (filtro.especialidade) {
      params = params.set('especialidade', filtro.especialidade);
    }
    if (filtro.ativo !== undefined) {
      params = params.set('ativo', filtro.ativo);
    }

    return this.http.get<Profissional[]>(this.url, { params });
  }

  obter(id: number): Observable<Profissional> {
    return this.http.get<Profissional>(`${this.url}/${id}`);
  }

  criar(dados: SalvarProfissional): Observable<Profissional> {
    return this.http.post<Profissional>(this.url, dados);
  }

  atualizar(id: number, dados: SalvarProfissional): Observable<Profissional> {
    return this.http.put<Profissional>(`${this.url}/${id}`, dados);
  }

  alterarAtivo(id: number, ativo: boolean): Observable<Profissional> {
    return this.http.patch<Profissional>(`${this.url}/${id}/ativo`, { ativo });
  }
}
