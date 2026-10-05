import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AtualizarCliente, Cliente, CriarCliente } from '../models/cliente';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly http = inject(HttpClient);

  // Caminho relativo: em desenvolvimento o proxy do ng serve encaminha para a API.
  private readonly url = '/api/clientes';

  // A API busca por parte do nome. Sem texto, devolve todos (então nem enviamos o parâmetro).
  listar(nome?: string): Observable<Cliente[]> {
    let params = new HttpParams();

    if (nome) {
      params = params.set('nome', nome);
    }

    return this.http.get<Cliente[]>(this.url, { params });
  }

  obter(id: number): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.url}/${id}`);
  }

  criar(dados: CriarCliente): Observable<Cliente> {
    return this.http.post<Cliente>(this.url, dados);
  }

  atualizar(id: number, dados: AtualizarCliente): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.url}/${id}`, dados);
  }
}
